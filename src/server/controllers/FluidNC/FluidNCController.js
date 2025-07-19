import {
  ensureArray,
  ensurePositiveNumber,
} from 'ensure-type';
import _ from 'lodash';
import SerialConnection from '../../lib/SerialConnection';
import EventTrigger from '../../lib/EventTrigger';
import Feeder from '../../lib/Feeder';
import Sender, { SP_TYPE_CHAR_COUNTING } from '../../lib/Sender';
import Workflow, {
  WORKFLOW_STATE_IDLE,
  WORKFLOW_STATE_RUNNING
} from '../../lib/Workflow';
import logger from '../../lib/logger';
import translateExpression from '../../lib/translate-expression';
import config from '../../services/configstore';
import monitor from '../../services/monitor';
import taskRunner from '../../services/taskrunner';
import store from '../../store';
import {
  // Write Source
  WRITE_SOURCE_CLIENT,
} from '../constants';
import FluidNCRunner from './FluidNCRunner';
import {
  FLUIDNC,
  FLUIDNC_REALTIME_COMMANDS,
} from './constants';

const log = logger('controller:FluidNC');
const noop = _.noop;

class FluidNCController {
    type = FLUIDNC;

    // CNCEngine
    engine = null;

    // Sockets
    sockets = {};

    // Connection
    connection = null;

    connectionEventListener = {
      data: (data) => {
        log.silly(`< ${data}`);
        this.runner.parse('' + data);
      },
      close: (err) => {
        this.ready = false;
        if (err) {
          log.warn(`Disconnected from serial port "${this.options.port}":`, err);
        }

        this.close(err => {
          // Remove controller from store
          const port = this.options.port;
          store.unset(`controllers[${JSON.stringify(port)}]`);

          // Destroy controller
          this.destroy();
        });
      },
      error: (err) => {
        this.ready = false;
        if (err) {
          log.error(`Unexpected error while reading/writing serial port "${this.options.port}":`, err);
        }
      }
    };

    // FluidNC
    controller = null;

    ready = false;

    initialized = false;

    state = {};

    settings = {};

    queryTimer = null;

    actionMask = {
      queryParserState: {
        state: false, // wait for a message containing the current G-code parser modal state
        reply: false // wait for an `ok` or `error` response
      },
      queryStatusReport: false,
      replyParserState: false, // wait for a parser state reply in the `statusReport` event
      replyStatusReport: false // wait for a status report reply in the `statusReport` event
    };

    // Event Trigger
    event = new EventTrigger((event, trigger, commands) => {
      log.debug(`EventTrigger: event="${event}", trigger="${trigger}", commands="${commands}"`);
      if (trigger === 'system') {
        taskRunner.run(commands);
      }
    });

    // Feeder
    feeder = null;

    // Sender
    sender = null;

    // Workflow
    workflow = null;

    // FluidNC Runner
    runner = null;

    constructor(engine, options) {
      const { port, baudrate, rtscts } = { ...options };

      this.engine = engine;
      this.options = {
        ...this.options,
        port: port,
        baudrate: baudrate,
        rtscts: rtscts
      };

      // Connection
      this.connection = new SerialConnection({
        path: port,
        baudRate: baudrate,
        rtscts: rtscts
      });

      // Event Trigger
      this.event = new EventTrigger((event, trigger, commands) => {
        log.debug(`EventTrigger: event="${event}", trigger="${trigger}", commands="${commands}"`);
        if (trigger === 'system') {
          taskRunner.run(commands);
        }
      });

      // Feeder
      this.feeder = new Feeder({
        dataFilter: (line, context) => {
          // Remove comments that start with a semicolon `;`
          line = line.replace(/;.*/g, '').trim();
          context = this.populateContext(context);

          if (line[0] === '%') {
            // %
            return '';
          }

          // line="G0 X[posx - 8] Y[posy]"
          // > "G0 X2 Y0"
          line = translateExpression(line, context);
          const data = line.replace(/\s+/g, ' ').trim();

          return data;
        }
      });
      this.feeder.on('data', (line = '', context = {}) => {
        if (this.isClose()) {
          log.error(`Serial port "${this.options.port}" is not accessible`);
          return;
        }

        if (this.runner) {
          line = String(line).trim();
          if (line.length === 0) {
            return;
          }

          this.emitAll('serialport:write', line, context);

          this.connection.write(line + '\n');
          log.silly(`> ${line}`);
        }
      });

      // Sender
      this.sender = new Sender(SP_TYPE_CHAR_COUNTING, {
        // Characters to wait for
        dataFilter: (line, context) => {
          // Remove comments that start with a semicolon `;`
          line = line.replace(/;.*/g, '').trim();
          context = this.populateContext(context);

          if (line[0] === '%') {
            // %
            return {
              data: '',
              context: {
                ...context,
                comment: line
              }
            };
          }

          const data = line.replace(/\s+/g, ' ').trim();
          return {
            data: data,
            context: context
          };
        },
        rewriteData: (data, context) => {
          // line="G0 X[posx - 8] Y[posy]"
          // > "G0 X2 Y0"
          data = translateExpression(data, context);
          return data;
        }
      });
      this.sender.on('data', (line = '', context = {}) => {
        if (this.isClose()) {
          log.error(`Serial port "${this.options.port}" is not accessible`);
          return;
        }

        if (this.runner) {
          line = String(line).trim();
          if (line.length === 0) {
            log.warn(`Expected non-empty line: line="${line}"`);
            return;
          }

          this.emitAll('serialport:write', line, context);

          this.connection.write(line + '\n');
          log.silly(`> ${line}`);
        }
      });

      // Workflow
      this.workflow = new Workflow();

      // FluidNC Runner
      this.runner = new FluidNCRunner();

      this.runner.on('raw', noop);

      this.runner.on('status', (res) => {
        this.queryTimer && clearTimeout(this.queryTimer);

        if (this.actionMask.queryStatusReport) {
          this.actionMask.queryStatusReport = false;
          this.actionMask.replyStatusReport = true;
        }

        this.state = { ...this.state, ...res };
        this.emitAll('FluidNC:state', this.state);
      });

      this.runner.on('ok', (res) => {
        if (this.actionMask.queryParserState.reply) {
          if (this.actionMask.replyParserState) {
            this.actionMask.queryParserState.state = false;
            this.actionMask.queryParserState.reply = false;
            this.actionMask.replyParserState = false;
          } else {
            this.actionMask.replyParserState = true;
          }
        }

        this.emitAll('FluidNC:ok', res);
      });

      this.runner.on('error', (res) => {
        // Feeder
        this.feeder.reset();

        // Sender
        if (this.workflow.state === WORKFLOW_STATE_RUNNING) {
          const { lines, received } = this.sender.state;
          const line = lines[received] || '';

          this.emitAll('sender:status', {
            ...this.sender.toJSON(),
            data: line
          });
        }
        this.sender.reset();

        this.emitAll('FluidNC:error', res);
      });

      this.runner.on('alarm', (res) => {
        // Feeder
        this.feeder.reset();

        // Sender
        this.sender.reset();

        this.emitAll('FluidNC:alarm', res);
      });

      this.runner.on('parserstate', (res) => {
        this.state = { ...this.state, parserstate: res };
        this.emitAll('FluidNC:parserstate', res);

        if (this.actionMask.queryParserState.state && this.actionMask.replyParserState) {
          this.actionMask.queryParserState.state = false;
          this.actionMask.queryParserState.reply = false;
          this.actionMask.replyParserState = false;
        }
      });

      this.runner.on('parameters', (res) => {
        this.state = { ...this.state, parameters: res };
        this.emitAll('FluidNC:parameters', res);
      });

      this.runner.on('feedback', (res) => {
        this.emitAll('FluidNC:feedback', res);
      });

      this.runner.on('settings', (res) => {
        const { name, value } = { ...res };
        this.settings = { ...this.settings, [name]: value };

        this.emitAll('FluidNC:settings', res);
      });

      this.runner.on('startup', (res) => {
        this.initialized = true;
        this.state = {};
        this.settings = {};

        this.emitAll('FluidNC:startup', res);

        if (this.workflow.state === WORKFLOW_STATE_IDLE) {
          // Feeder
          this.feeder.reset();

          // Sender
          this.sender.reset();

          // Query for parser state
          this.actionMask.queryParserState.state = true;
          this.actionMask.queryParserState.reply = true;
          this.connection.write('$G\n');

          // Query for status report
          this.actionMask.queryStatusReport = true;
          this.connection.write('?\n');
        }
      });

      this.runner.on('others', (res) => {
        this.emitAll('FluidNC:others', res);
      });

      this.queryTimer = setInterval(() => {
        if (this.isClose()) {
          // Serial port is closed
          return;
        }

        // Feeder
        if (this.feeder.isPending()) {
          return;
        }

        // Sender
        if (this.sender.sp.dataLength > 0) {
          // Do not send '?' when the sender queue is not empty
          return;
        }

        // XXX: Wait for the bootloader to complete before sending commands
        if (!this.initialized) {
          return;
        }

        this.connection.write('?\n');
      }, 250);
    }

    destroy() {
      this.connections = {};

      if (this.event) {
        this.event = null;
      }

      if (this.feeder) {
        this.feeder = null;
      }

      if (this.sender) {
        this.sender = null;
      }

      if (this.workflow) {
        this.workflow = null;
      }

      if (this.queryTimer) {
        clearInterval(this.queryTimer);
        this.queryTimer = null;
      }

      if (this.runner) {
        this.runner.removeAllListeners();
        this.runner = null;
      }
    }

    initController() {
      const cmds = [
        { pauseAfter: 500 },

        // Wait for the startup message
        { pauseAfter: 1000 },

        { cmd: 'status', pauseAfter: 50 },
        { cmd: 'gcode_parsers', pauseAfter: 50 },
        { cmd: 'settings', pauseAfter: 50 }
      ];

      const sendInitCommands = (i = 0) => {
        if (i >= cmds.length) {
          this.ready = true;
          return;
        }
        const { cmd = '', pauseAfter = 0 } = { ...cmds[i] };
        if (cmd) {
          this.command(null, cmd);
        }
        setTimeout(() => {
          sendInitCommands(i + 1);
        }, pauseAfter);
      };
      sendInitCommands();
    }

    get status() {
      return {
        port: this.options.port,
        baudrate: this.options.baudrate,
        rtscts: this.options.rtscts,
        sockets: Object.keys(this.sockets),
        ready: this.ready,
        controller: {
          type: this.type,
          state: this.state,
          settings: this.settings
        },
        feeder: this.feeder.toJSON(),
        sender: this.sender.toJSON(),
        workflow: {
          state: this.workflow.state
        }
      };
    }

    open(callback = noop) {
      const { port, baudrate } = this.options;

      // Assertion check
      if (this.isOpen()) {
        log.error(`Cannot open serial port "${port}"`);
        return;
      }

      this.connection.on('data', this.connectionEventListener.data);
      this.connection.on('close', this.connectionEventListener.close);
      this.connection.on('error', this.connectionEventListener.error);
      this.connection.open((err) => {
        if (err) {
          log.error(`Error opening serial port "${port}":`, err);
          this.emitAll('serialport:error', { err: err, port: port });
          callback(err); // notify error
          return;
        }

        this.emitAll('serialport:open', {
          port: port,
          baudrate: baudrate,
          controllerType: this.type,
          inuse: true
        });

        callback(); // register controller

        log.debug(`Connected to serial port "${port}"`);

        this.workflow.stop();

        // Unload G-code
        this.command(null, 'unload');

        // Initialize controller
        this.initController();
      });
    }

    close(callback = noop) {
      const { port } = this.options;

      // Assertion check
      if (this.isClose()) {
        log.error(`Cannot close serial port "${port}"`);
        return;
      }

      this.emitAll('serialport:close', {
        port: port,
        inuse: false
      });

      this.connection.removeListener('data', this.connectionEventListener.data);
      this.connection.removeListener('close', this.connectionEventListener.close);
      this.connection.removeListener('error', this.connectionEventListener.error);
      this.connection.close(callback);
    }

    isOpen() {
      return this.connection && this.connection.isOpen;
    }

    isClose() {
      return !(this.isOpen());
    }

    addConnection(socket) {
      if (!socket) {
        log.error('The socket parameter is not specified');
        return;
      }

      log.debug(`Add socket connection: id=${socket.id}`);
      this.sockets[socket.id] = socket;

      //
      // Send data to newly connected client
      //
      if (!_.isEmpty(this.state)) {
        // Controller state
        socket.emit('FluidNC:state', this.state);
      }
      if (!_.isEmpty(this.settings)) {
        // Controller settings
        Object.keys(this.settings).forEach(name => {
          socket.emit('FluidNC:settings', {
            name: name,
            value: this.settings[name]
          });
        });
      }
      if (this.workflow) {
        // Workflow state
        socket.emit('workflow:state', this.workflow.state);
      }
      if (this.sender) {
        // Sender status
        socket.emit('sender:status', this.sender.toJSON());
      }
    }

    removeConnection(socket) {
      if (!socket) {
        log.error('The socket parameter is not specified');
        return;
      }

      log.debug(`Remove socket connection: id=${socket.id}`);
      this.sockets[socket.id] = undefined;
      delete this.sockets[socket.id];
    }

    emitAll(eventName, ...args) {
      Object.keys(this.sockets).forEach(id => {
        const socket = this.sockets[id];
        socket.emit(eventName, ...args);
      });
    }

    // https://nodejs.org/api/events.html#events_emitter_emit_event_arg1_arg2
    // Returns true if the event had listeners, false otherwise.
    emit(eventName, ...args) {
      return this.emitAll(eventName, ...args);
    }

    command(socket, cmd, ...args) {
      const handler = {
        'load': () => {
          const [name, gcode, callback = noop] = args;

          const ok = this.sender.load(name, gcode, callback);
          if (!ok) {
            return;
          }

          this.event.trigger('gcode:load');

          log.debug(`Load G-code: name="${this.sender.state.name}", size=${this.sender.state.gcode.length}, total=${this.sender.state.total}`);

          this.workflow.stop();

          // Sender
          this.sender.unload(); // Unload previous G-code
          this.sender.load(name, gcode);
          this.emitAll('sender:status', this.sender.toJSON());
        },
        'unload': () => {
          this.workflow.stop();

          // Sender
          this.sender.unload();
          this.emitAll('sender:status', this.sender.toJSON());
        },
        'start': () => {
          this.event.trigger('gcode:start');

          this.workflow.start();

          // Feeder
          this.feeder.reset();

          // Sender
          this.sender.next();
        },
        'stop': () => {
          this.event.trigger('gcode:stop');

          this.workflow.stop();
          this.writeln(socket, '!'); // Hold
          setTimeout(() => {
            this.writeln(socket, '\x18'); // Reset
          }, 250);
        },
        'pause': () => {
          this.event.trigger('gcode:pause');

          this.workflow.pause();
          this.writeln(socket, '!'); // Hold
        },
        'resume': () => {
          this.event.trigger('gcode:resume');

          this.writeln(socket, '~'); // Resume
          this.workflow.resume();
        },
        'feedhold': () => {
          this.writeln(socket, '!');
        },
        'cyclestart': () => {
          this.writeln(socket, '~');
        },
        'statusreport': () => {
          this.writeln(socket, '?');
        },
        'homing': () => {
          this.event.trigger('gcode:homing');

          this.writeln(socket, '$H');
        },
        'sleep': () => {
          this.event.trigger('gcode:sleep');

          this.writeln(socket, '$SLP');
        },
        'unlock': () => {
          this.writeln(socket, '$X');
        },
        'reset': () => {
          this.workflow.stop();

          // Feeder
          this.feeder.reset();

          // Sender
          this.sender.reset();

          this.writeln(socket, '\x18'); // ^x
        },
        'feedOverride': () => {
          const [value] = args;
          let data = '0x91'; // Feed Overrides

          if (value === 0) {
            data = '0x90'; // Rapid Overrides
          } else if (value === 10) {
            data = '0x91';
          } else if (value === -10) {
            data = '0x92';
          } else if (value === 1) {
            data = '0x93';
          } else if (value === -1) {
            data = '0x94';
          }

          this.writeln(socket, data);
        },
        'spindleOverride': () => {
          const [value] = args;
          let data = '0x9A'; // Spindle Overrides

          if (value === 10) {
            data = '0x9A';
          } else if (value === -10) {
            data = '0x9B';
          } else if (value === 1) {
            data = '0x9C';
          } else if (value === -1) {
            data = '0x9D';
          }

          this.writeln(socket, data);
        },
        'rapidOverride': () => {
          const [value] = args;
          let data = '0x95'; // Rapid Overrides

          // Rapid Overrides
          if (value === 100) {
            data = '0x95';
          } else if (value === 50) {
            data = '0x96';
          } else if (value === 25) {
            data = '0x97';
          }

          this.writeln(socket, data);
        },
        'lasertest': () => {
          const [power = 0, duration = 0] = args;
          const durationMs = ensurePositiveNumber(duration);

          // Turn on the laser at the specified power level
          this.writeln(socket, 'M3 S' + ensurePositiveNumber(power));

          if (durationMs > 0) {
            // Turn off the laser after the specified duration
            setTimeout(() => {
              this.writeln(socket, 'M5');
            }, durationMs);
          }
        },
        'gcode': () => {
          const [commands, context] = args;
          const data = ensureArray(commands)
            .join('\n')
            .split('\n')
            .filter(line => {
              return line.trim().length > 0;
            });

          this.feeder.feed(data, context);

          if (!this.feeder.isPending()) {
            this.feeder.next();
          }
        },
        'macro': () => {
          const [id, context = {}, callback = noop] = args;
          const macros = config.get('macros');
          const macro = _.find(macros, { id: id });

          if (!macro) {
            log.error(`Cannot find the macro: id=${id}`);
            return;
          }

          this.event.trigger('macro:run');

          this.command(socket, 'gcode', macro.content, context);
          callback(null);
        },
        'watchdir:load': () => {
          const [file, callback = noop] = args;

          monitor.readFile(file, (err, data) => {
            if (err) {
              callback(err);
              return;
            }

            this.command(socket, 'load', file, data, callback);
          });
        }
      };

      try {
        if (!handler[cmd]) {
          log.error(`Unknown command: ${cmd}`);
          return;
        }

        handler[cmd]();
      } catch (err) {
        log.error(`Command "${cmd}":`, err);
      }
    }

    write(socket, data, context = {}) {
      // Assertion check
      if (this.isClose()) {
        log.error(`Serial port "${this.options.port}" is not accessible`);
        return;
      }

      const cmd = data.trim();

      this.emitAll('serialport:write', data, {
        ...context,
        source: WRITE_SOURCE_CLIENT
      });
      this.connection.write(data);
      log.silly(`> ${cmd}`);
    }

    writeln(socket, data, context = {}) {
      if (_.includes(FLUIDNC_REALTIME_COMMANDS, data)) {
        this.write(socket, data, context);
      } else {
        this.write(socket, data + '\n', context);
      }
    }

    populateContext(context) {
      return Object.assign(context || {}, {
        xmin: Number(this.settings.$130) || 0,
        xmax: Number(this.settings.$130) || 0,
        ymin: Number(this.settings.$131) || 0,
        ymax: Number(this.settings.$131) || 0,
        zmin: Number(this.settings.$132) || 0,
        zmax: Number(this.settings.$132) || 0
      });
    }
}

export default FluidNCController;
