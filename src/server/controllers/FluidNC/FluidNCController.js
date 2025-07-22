import {
  ensureArray,
  ensurePositiveNumber,
  ensureString,
} from 'ensure-type';
import * as gcodeParser from 'gcode-parser';
import _ from 'lodash';
import http from 'http';
import { URL } from 'url';
import SerialConnection from '../../lib/SerialConnection';
import EventTrigger from '../../lib/EventTrigger';
import Feeder from '../../lib/Feeder';
import MessageSlot from '../../lib/MessageSlot';
import Sender, { SP_TYPE_CHAR_COUNTING } from '../../lib/Sender';
import Workflow, {
  WORKFLOW_STATE_IDLE,
  WORKFLOW_STATE_PAUSED,
  WORKFLOW_STATE_RUNNING
} from '../../lib/Workflow';
import delay from '../../lib/delay';
import evaluateAssignmentExpression from '../../lib/evaluate-assignment-expression';
import x from '../../lib/json-stringify';
import logger from '../../lib/logger';
import translateExpression from '../../lib/translate-expression';
import config from '../../services/configstore';
import monitor from '../../services/monitor';
import taskRunner from '../../services/taskrunner';
import store from '../../store';
import XModem from '../../lib/XModem';
import {
  GLOBAL_OBJECTS as globalObjects,
  // Builtin Commands
  BUILTIN_COMMAND_MSG,
  BUILTIN_COMMAND_WAIT,
  // M6 Tool Change
  TOOL_CHANGE_POLICY_IGNORE_M6_COMMANDS,
  TOOL_CHANGE_POLICY_SEND_M6_COMMANDS,
  TOOL_CHANGE_POLICY_MANUAL_TOOL_CHANGE_WCS,
  TOOL_CHANGE_POLICY_MANUAL_TOOL_CHANGE_TLO,
  TOOL_CHANGE_POLICY_MANUAL_TOOL_CHANGE_CUSTOM_PROBING,
  // Units
  IMPERIAL_UNITS,
  METRIC_UNITS,
  // Write Source
  WRITE_SOURCE_CLIENT,
  WRITE_SOURCE_FEEDER
} from '../constants';
import * as builtinCommand from '../utils/builtin-command';
import { isM0, isM1, isM6, replaceM6 } from '../utils/gcode';
import { mapPositionToUnits, mapValueToUnits } from '../utils/units';
import FluidNCRunner from './FluidNCRunner';
import {
  FLUIDNC,
  GRBL_ACTIVE_STATE_RUN,
  GRBL_ACTIVE_STATE_HOLD,
  GRBL_REALTIME_COMMANDS,
  GRBL_ALARMS,
  GRBL_ERRORS,
  GRBL_SETTINGS,
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
      const dataStr = '' + data;
      console.log(`FluidNC Controller: Received data: "${dataStr}"`);
      log.silly(`< ${dataStr}`);

      // Log ALL data when expecting LocalFS response to catch any format
      if (this.expectingLocalFSResponse && dataStr.trim()) {
        console.log(`\n!!! FluidNC Controller: DATA RECEIVED WHILE EXPECTING LocalFS !!!`);
        console.log(`Data: "${dataStr}"`);
        console.log(`Length: ${dataStr.length}`);
        console.log(`Trimmed: "${dataStr.trim()}"`);
        console.log(`Contains known keywords: LocalFS=${dataStr.includes('LocalFS')}, FILE=${dataStr.includes('FILE')}, yaml=${dataStr.includes('.yaml')}, gcode=${dataStr.includes('.gcode')}`);
        console.log(`Raw bytes:`, Array.from(dataStr).map(c => `${c.charCodeAt(0)}(${c})`).join(' '));

        // Store each line of response for later analysis
        if (dataStr.includes('\n')) {
          dataStr.split('\n').forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed) {
              console.log(`Line ${index}: "${trimmed}" (${trimmed.length} chars)`);
              this.localFSResponseLines = this.localFSResponseLines || [];
              this.localFSResponseLines.push(trimmed);
            }
          });
        } else {
          const trimmed = dataStr.trim();
          if (trimmed) {
            this.localFSResponseLines = this.localFSResponseLines || [];
            this.localFSResponseLines.push(trimmed);
          }
        }

        // Immediately test if any captured lines look like file listings
        if (this.localFSResponseLines && this.localFSResponseLines.length > 0) {
          console.log(`\n=== IMMEDIATE PATTERN TESTING ===`);
          this.localFSResponseLines.slice(-1).forEach((line, index) => { // Test only the newest line
            console.log(`\nTesting newest line for file patterns: "${line}"`);
            this.testFilePatterns(line);
          });
          console.log(`=== END IMMEDIATE PATTERN TESTING ===\n`);
        }

        console.log(`!!! END DATA CAPTURE (total lines captured: ${this.localFSResponseLines?.length || 0}) !!!\n`);
      }

      // Enhanced debugging for $I responses
      if (dataStr.includes('[MSG:') || dataStr.includes('MSG:')) {
        console.log(`FluidNC Controller: MSG data detected - passing to runner: "${dataStr}"`);
      }

      // Enhanced debugging for LocalFS responses
      if (dataStr.includes('LocalFS') || dataStr.includes('FILE:') || dataStr.includes('.yaml') || dataStr.includes('.gcode') || dataStr.includes('.nc') || dataStr.includes('.txt') || this.expectingLocalFSResponse) {
        console.log(`\n======= FluidNC LocalFS DATA ANALYSIS =======`);
        console.log(`FluidNC Controller: POTENTIAL LocalFS/FILE data detected: "${dataStr}"`);
        console.log(`FluidNC Controller: Expecting LocalFS response: ${this.expectingLocalFSResponse}`);
        if (this.expectingLocalFSResponse) {
          const elapsed = Date.now() - this.localFSResponseStartTime;
          console.log(`FluidNC Controller: Time since $LocalFS/List sent: ${elapsed}ms`);
        }
        console.log(`FluidNC Controller: Data length: ${dataStr.length}, Contains newlines: ${dataStr.includes('\n')}`);
        console.log(`FluidNC Controller: Raw bytes:`, Array.from(dataStr).map(c => `${c.charCodeAt(0)}(${c})`).join(' '));
        if (dataStr.includes('\n')) {
          console.log(`FluidNC Controller: Splitting multiline response for detailed analysis:`);
          dataStr.split('\n').forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed) {
              console.log(`FluidNC Controller: Line ${index}: "${trimmed}" (length: ${trimmed.length})`);
              console.log(`FluidNC Controller: Line ${index} chars:`, Array.from(trimmed).map(c => `${c.charCodeAt(0)}(${c})`).join(' '));
              // Try to identify file patterns in this line
              if (trimmed.includes('.')) {
                console.log(`FluidNC Controller: Line ${index} contains dot - potential file: "${trimmed}"`);
              }
              // Check for various possible file listing formats
              if (trimmed.includes('\t')) {
                console.log(`FluidNC Controller: Line ${index} contains TAB - possibly tab-separated: parts = [${trimmed.split('\t').join(', ')}]`);
              }
              if (trimmed.match(/\S+\s+\d+/)) {
                console.log(`FluidNC Controller: Line ${index} has filename-size pattern`);
              }
            }
          });
        } else {
          console.log(`FluidNC Controller: Single line LocalFS response: "${dataStr.trim()}"`);
        }
        console.log(`======= END LocalFS DATA ANALYSIS =======\n`);
      }

      this.runner.parse(dataStr);
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

  // Grbl
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

    // Respond to user input
    replyParserState: false, // $G
    replyStatusReport: false // ?
  };

  actionTime = {
    queryParserState: 0,
    queryStatusReport: 0,
    senderFinishTime: 0
  };

  // Message Slot
  messageSlot = null;

  // Event Trigger
  event = null;

  // Feeder
  feeder = null;

  // Sender
  sender = null;

  // Shared context
  sharedContext = {};

  // Workflow
  workflow = null;

  constructor(engine, options = {}) {
    if (!engine) {
      throw new Error('engine must be specified');
    }
    this.engine = engine;
    this.type = options.type || FLUIDNC;

    const { port, baudrate, rtscts, pin } = { ...options };
    this.options = {
      ...this.options,
      port: port,
      baudrate: baudrate,
      rtscts: rtscts,
      pin,
    };

    // Connection
    this.connection = new SerialConnection({
      path: port,
      baudRate: baudrate,
      rtscts: rtscts,
      writeFilter: (data) => {
        // Handle binary data from XModem (no string operations on binary data)
        if (data instanceof Buffer || (typeof data === 'object' && data.constructor === Uint8Array)) {
          return data;
        }
        
        // Handle string data normally
        if (typeof data !== 'string') {
          return data;
        }
        
        const line = data.trim();

        if (!line) {
          return data;
        }

        { // Grbl settings: $0-$255
          const r = line.match(/^(\$\d{1,3})=([\d\.]+)$/);
          if (r) {
            const name = r[1];
            const value = Number(r[2]);
            if ((name === '$13') && (value >= 0) && (value <= 65535)) {
              const nextSettings = {
                ...this.runner.settings,
                settings: {
                  ...this.runner.settings.settings,
                  [name]: value ? '1' : '0'
                }
              };
              this.runner.settings = nextSettings; // enforce change
            }
          }
        }

        return data;
      }
    });

    // Message Slot
    this.messageSlot = new MessageSlot();

    // Event Trigger
    this.event = new EventTrigger((event, trigger, commands) => {
      log.debug(`EventTrigger: event="${event}", trigger="${trigger}", commands="${commands}"`);
      if (trigger === 'system') {
        taskRunner.run(commands);
      } else {
        this.command('gcode', commands);
      }
    });

    // Feeder
    this.feeder = new Feeder({
      dataFilter: (line, context) => {
        const originalLine = line;
        line = line.trim();
        context = this.populateContext(context);

        if (line[0] === '%') {
          const [command, commandArgs] = ensureArray(builtinCommand.match(line));

          // %msg
          if (command === BUILTIN_COMMAND_MSG) {
            log.debug(`${command}: line=${x(originalLine)}`);
            const msg = translateExpression(commandArgs, context);
            this.messageSlot.put(msg);
            return '';
          }

          // %wait
          if (command === BUILTIN_COMMAND_WAIT) {
            log.debug(`${command}: line=${x(originalLine)}`);
            this.sender.hold({
              data: BUILTIN_COMMAND_WAIT,
              msg: this.messageSlot.take() ?? originalLine,
            });
            const delay = parseFloat(commandArgs) || 0.5; // in seconds
            const pauseValue = delay.toFixed(3) * 1;
            return `G4 P${pauseValue}`; // dwell
          }

          // Expression
          // %_x=posx,_y=posy,_z=posz
          log.debug(`%: line=${x(originalLine)}`);
          const expr = line.slice(1);
          evaluateAssignmentExpression(expr, context);
          return '';
        }

        // Example: `G0 X[posx - 8] Y[ymax]` is converted to `G0 X2 Y50`
        line = translateExpression(line, context);

        const { line: strippedLine, words } = gcodeParser.parseLine(line, {
          flatten: true,
          lineMode: 'stripped',
        });
        line = strippedLine;

        // M0 Program Pause
        if (words.find(isM0)) {
          log.debug(`M0 Program Pause: line=${x(originalLine)}`);

          this.feeder.hold({
            data: 'M0',
            msg: this.messageSlot.take() ?? originalLine,
          });
        }

        // M1 Program Pause
        if (words.find(isM1)) {
          log.debug(`M1 Program Pause: line=${x(originalLine)}`);

          this.feeder.hold({
            data: 'M1',
            msg: this.messageSlot.take() ?? originalLine,
          });
        }

        // M6 Tool Change
        if (words.find(isM6)) {
          log.debug(`M6 Tool Change: line=${x(originalLine)}`);

          const toolChangePolicy = config.get('tool.toolChangePolicy', TOOL_CHANGE_POLICY_IGNORE_M6_COMMANDS);
          const isManualToolChange = [
            TOOL_CHANGE_POLICY_MANUAL_TOOL_CHANGE_WCS,
            TOOL_CHANGE_POLICY_MANUAL_TOOL_CHANGE_TLO,
            TOOL_CHANGE_POLICY_MANUAL_TOOL_CHANGE_CUSTOM_PROBING,
          ].includes(toolChangePolicy);

          if (toolChangePolicy === TOOL_CHANGE_POLICY_IGNORE_M6_COMMANDS) {
            // Ignore M6 commands
            line = replaceM6(line, (x) => `(${x})`); // replace with parentheses

            this.feeder.hold({
              data: 'M6',
              msg: this.messageSlot.take() ?? originalLine,
            });
          } else if (toolChangePolicy === TOOL_CHANGE_POLICY_SEND_M6_COMMANDS) {
            // Send M6 commands
          } else if (isManualToolChange) {
            // Manual Tool Change
            line = replaceM6(line, (x) => `(${x})`); // replace with parentheses

            this.feeder.hold({
              data: 'M6',
              msg: this.messageSlot.take() ?? originalLine,
            });

            this.command('tool:change');
          }
        }

        return line;
      }
    });
    this.feeder.on('data', (line = '', context = {}) => {
      if (this.isClose()) {
        log.error(`Serial port "${this.options.port}" is not accessible`);
        return;
      }

      if (this.runner.isAlarm()) {
        this.feeder.reset();
        log.warn('Stopped sending G-code commands in Alarm mode');
        return;
      }

      line = String(line).trim();
      if (line.length === 0) {
        return;
      }

      this.emit('serialport:write', line + '\n', {
        ...context,
        source: WRITE_SOURCE_FEEDER
      });

      this.connection.write(line + '\n');
      log.silly(`> ${line}`);
    });
    this.feeder.on('hold', noop);
    this.feeder.on('unhold', noop);

    // Sender
    this.sender = new Sender(SP_TYPE_CHAR_COUNTING, {
      // Deduct the buffer size to prevent from buffer overrun
      bufferSize: (128 - 8), // The default buffer size is 128 bytes
      dataFilter: (line, context) => {
        const originalLine = line;
        const { sent, received } = this.sender.state;
        line = line.trim();
        context = this.populateContext(context);

        if (line[0] === '%') {
          const [command, commandArgs] = ensureArray(builtinCommand.match(line));

          // %msg
          if (command === BUILTIN_COMMAND_MSG) {
            log.debug(`${command}: line=${x(originalLine)}, sent=${sent}, received=${received}`);
            const msg = translateExpression(commandArgs, context);
            this.messageSlot.put(msg);
            return '';
          }

          // %wait
          if (command === BUILTIN_COMMAND_WAIT) {
            log.debug(`${command}: line=${x(originalLine)}, sent=${sent}, received=${received}`);
            this.sender.hold({
              data: BUILTIN_COMMAND_WAIT,
              msg: this.messageSlot.take() ?? originalLine,
            });
            const delay = parseFloat(commandArgs) || 0.5; // in seconds
            const pauseValue = delay.toFixed(3) * 1;
            return `G4 P${pauseValue}`; // dwell
          }

          // Expression
          // %_x=posx,_y=posy,_z=posz
          log.debug(`%: line=${x(originalLine)}, sent=${sent}, received=${received}`);
          const expr = line.slice(1);
          evaluateAssignmentExpression(expr, context);
          return '';
        }

        // Example: `G0 X[posx - 8] Y[ymax]` is converted to `G0 X2 Y50`
        line = translateExpression(line, context);

        const { line: strippedLine, words } = gcodeParser.parseLine(line, {
          flatten: true,
          lineMode: 'stripped',
        });
        line = strippedLine;

        // M0 Program Pause
        if (words.find(isM0)) {
          log.debug(`M0 Program Pause: line=${x(originalLine)}, sent=${sent}, received=${received}`);

          this.event.trigger('gcode:pause');
          this.workflow.pause({
            data: 'M0',
            msg: this.messageSlot.take() ?? originalLine,
          });
        }

        // M1 Program Pause
        if (words.find(isM1)) {
          log.debug(`M1 Program Pause: line=${x(originalLine)}, sent=${sent}, received=${received}`);

          this.event.trigger('gcode:pause');
          this.workflow.pause({
            data: 'M1',
            msg: this.messageSlot.take() ?? originalLine,
          });
        }

        // M6 Tool Change
        if (words.find(isM6)) {
          log.debug(`M6 Tool Change: line=${x(originalLine)}, sent=${sent}, received=${received}`);

          const toolChangePolicy = config.get('tool.toolChangePolicy', TOOL_CHANGE_POLICY_IGNORE_M6_COMMANDS);
          const isManualToolChange = [
            TOOL_CHANGE_POLICY_MANUAL_TOOL_CHANGE_WCS,
            TOOL_CHANGE_POLICY_MANUAL_TOOL_CHANGE_TLO,
            TOOL_CHANGE_POLICY_MANUAL_TOOL_CHANGE_CUSTOM_PROBING,
          ].includes(toolChangePolicy);

          if (toolChangePolicy === TOOL_CHANGE_POLICY_IGNORE_M6_COMMANDS) {
            // Ignore M6 commands
            line = replaceM6(line, (x) => `(${x})`); // replace with parentheses

            this.event.trigger('gcode:pause');
            this.workflow.pause({
              data: 'M6',
              msg: this.messageSlot.take() ?? originalLine,
            });
          } else if (toolChangePolicy === TOOL_CHANGE_POLICY_SEND_M6_COMMANDS) {
            // Send M6 commands
          } else if (isManualToolChange) {
            // Manual Tool Change
            line = replaceM6(line, (x) => `(${x})`); // replace with parentheses

            this.event.trigger('gcode:pause');
            this.workflow.pause({
              data: 'M6',
              msg: this.messageSlot.take() ?? originalLine,
            });

            this.command('tool:change');
          }
        }

        return line;
      }
    });
    this.sender.on('data', (line = '', context = {}) => {
      if (this.isClose()) {
        log.error(`Serial port "${this.options.port}" is not accessible`);
        return;
      }

      if (this.workflow.state === WORKFLOW_STATE_IDLE) {
        log.error(`Unexpected workflow state: ${this.workflow.state}`);
        return;
      }

      line = String(line).trim();
      if (line.length === 0) {
        log.warn(`Expected non-empty line: N=${this.sender.state.sent}`);
        return;
      }

      this.connection.write(line + '\n');
      log.silly(`> ${line}`);
    });
    this.sender.on('hold', noop);
    this.sender.on('unhold', noop);
    this.sender.on('start', (startTime) => {
      this.actionTime.senderFinishTime = 0;
    });
    this.sender.on('end', (finishTime) => {
      this.actionTime.senderFinishTime = finishTime;
    });

    // Workflow
    this.workflow = new Workflow();
    this.workflow.on('start', (...args) => {
      this.emit('workflow:state', this.workflow.state);
      this.sender.rewind();
    });
    this.workflow.on('stop', (...args) => {
      this.emit('workflow:state', this.workflow.state);
      this.sender.rewind();
    });
    this.workflow.on('pause', (...args) => {
      this.emit('workflow:state', this.workflow.state);

      if (args.length > 0) {
        const reason = { ...args[0] };
        this.sender.hold(reason); // Hold reason
      } else {
        this.sender.hold();
      }
    });
    this.workflow.on('resume', (...args) => {
      this.emit('workflow:state', this.workflow.state);

      // Reset feeder prior to resume program execution
      this.feeder.reset();

      // Resume program execution
      this.sender.unhold();
      this.sender.next();
    });

    // Grbl
    this.runner = new FluidNCRunner();

    this.runner.on('raw', noop);

    this.runner.on('status', (res) => {
      /**
         * Handle the scenario where a startup message is not received during UART communication.
         * A status query (?) will be issued in the `queryActivity` function.
         */
      if (!this.ready) {
        this.ready = true;

        // Reset the state
        this.clearActionValues();
      }
      if (!this.initialized) {
        this.initialized = true;

        // Initialize controller
        this.initController();
      }

      this.actionMask.queryStatusReport = false;

      if (this.actionMask.replyStatusReport) {
        this.actionMask.replyStatusReport = false;
        this.emit('serialport:read', res.raw);
      }

      // Check if the receive buffer is available in the status report
      // @see https://github.com/cncjs/cncjs/issues/115
      // @see https://github.com/cncjs/cncjs/issues/133
      const rx = Number(_.get(res, 'buf.rx', 0)) || 0;
      if (rx > 0) {
        // Do not modify the buffer size when running a G-code program
        if (this.workflow.state !== WORKFLOW_STATE_IDLE) {
          return;
        }

        // Check if the streaming protocol is character-counting streaming protocol
        if (this.sender.sp.type !== SP_TYPE_CHAR_COUNTING) {
          return;
        }

        // Check if the queue is empty
        if (this.sender.sp.dataLength !== 0) {
          return;
        }

        // Deduct the receive buffer length to prevent from buffer overrun
        const bufferSize = (rx - 8); // TODO
        if (bufferSize > this.sender.sp.bufferSize) {
          this.sender.sp.bufferSize = bufferSize;
        }
      }
    });

    this.runner.on('ok', (res) => {
      if (this.actionMask.queryParserState.reply) {
        if (this.actionMask.replyParserState) {
          this.actionMask.replyParserState = false;
          this.emit('serialport:read', res.raw);
        }
        this.actionMask.queryParserState.reply = false;
        return;
      }

      const { hold, sent, received } = this.sender.state;

      if (this.workflow.state === WORKFLOW_STATE_RUNNING) {
        if (hold && (received + 1 >= sent)) {
          log.debug(`Continue sending G-code: hold=${hold}, sent=${sent}, received=${received + 1}`);
          this.sender.unhold();
        }
        this.sender.ack();
        this.sender.next();
        return;
      }

      if ((this.workflow.state === WORKFLOW_STATE_PAUSED) && (received < sent)) {
        if (!hold) {
          log.error('The sender does not hold off during the paused state');
        }
        if (received + 1 >= sent) {
          log.debug(`Stop sending G-code: hold=${hold}, sent=${sent}, received=${received + 1}`);
        }
        this.sender.ack();
        this.sender.next();
        return;
      }

      this.emit('serialport:read', res.raw);

      // Feeder
      this.feeder.next();
    });

    this.runner.on('error', (res) => {
      const code = Number(res.message) || undefined;
      const error = _.find(GRBL_ERRORS, { code: code });

      if (this.workflow.state === WORKFLOW_STATE_RUNNING) {
        const ignoreErrors = config.get('state.controller.exception.ignoreErrors');
        const pauseError = !ignoreErrors;
        const { lines, received } = this.sender.state;
        const line = ensureString(lines[received - 1]).trim();
        const ln = received + 1;

        this.emit('serialport:read', `> ${line} (ln=${ln})`);
        if (error) {
          // Grbl v1.1
          this.emit('serialport:read', `error:${code} (${error.message})`);

          if (pauseError) {
            this.workflow.pause({
              err: true,
              msg: `error:${code} (${error.message})`,
            });
          }
        } else {
          // Grbl v0.9
          this.emit('serialport:read', res.raw);

          if (pauseError) {
            this.workflow.pause({
              err: true,
              msg: res.raw,
            });
          }
        }

        this.sender.ack();
        this.sender.next();

        return;
      }

      if (error) {
        // Grbl v1.1
        this.emit('serialport:read', `error:${code} (${error.message})`);
      } else {
        // Grbl v0.9
        this.emit('serialport:read', res.raw);
      }

      // Feeder
      this.feeder.next();
    });

    this.runner.on('alarm', (res) => {
      const code = Number(res.message) || undefined;
      const alarm = _.find(GRBL_ALARMS, { code: code });

      if (alarm) {
        // Grbl v1.1
        this.emit('serialport:read', `ALARM:${code} (${alarm.message})`);
      } else {
        // Grbl v0.9
        this.emit('serialport:read', res.raw);
      }
    });

    this.runner.on('parserstate', (res) => {
      this.actionMask.queryParserState.state = false;
      this.actionMask.queryParserState.reply = true;

      if (this.actionMask.replyParserState) {
        this.emit('serialport:read', res.raw);
      }
    });

    this.runner.on('parameters', (res) => {
      this.emit('serialport:read', res.raw);
    });

    this.runner.on('feedback', (res) => {
      // Parse file information from feedback messages
      const fileMatch = res.message.match(/^FILE:\s*(.+)\|SIZE:(\d+)$/);
      if (fileMatch) {
        const [, filename, size] = fileMatch;
        const file = {
          name: filename,
          size: parseInt(size, 10),
          type: filename.endsWith('.yaml') || filename.endsWith('.yml') ? 'config' : 'file'
        };
        console.log(`FluidNC Controller: Adding file to list: ${filename} (${size} bytes)`);
        this.runner.addFile(file);

        // Emit updated file list immediately after adding each file
        const fileList = this.runner.getFileList();
        console.log(`FluidNC Controller: Emitting updated file list with ${fileList.length} files after adding ${filename}`);
        this.emit('fluidnc:fileList', fileList);
      }

      this.emit('serialport:read', res.raw);
    });

    this.runner.on('settings', (res) => {
      const setting = _.find(GRBL_SETTINGS, { setting: res.name });

      // Check if this is an active config setting
      if (res.name === '$Config/Filename') {
        this.emit('fluidnc:activeConfig', res.value);
      }

      if (!res.message && setting) {
        // Grbl v1.1
        this.emit('serialport:read', `${res.name}=${res.value} (${setting.message}, ${setting.units})`);
      } else {
        // Grbl v0.9
        this.emit('serialport:read', res.raw);
      }
    });

    this.runner.on('startup', (res) => {
      this.emit('serialport:read', res.raw);

      if (!this.ready) {
        // The startup message always prints upon startup, after a reset, or at program end.
        // Setting the initial state when Grbl has completed re-initializing all systems.
        this.clearActionValues();

        // Set ready flag to true when a startup message has arrived
        this.ready = true;
      }

      if (!this.initialized) {
        this.initialized = true;

        // Initialize controller
        this.initController();
      }
    });

    this.runner.on('fluidnc:message', (res) => {
      console.log('FluidNC Controller: Message event received:', res);
      this.emit('fluidnc:message', res);
    });

    this.runner.on('fluidnc:deviceInfo', (deviceInfo) => {
      console.log('FluidNC Controller: Device info event received from runner:', deviceInfo);
      this.emit('fluidnc:deviceInfo', deviceInfo);
    });

    this.runner.on('fluidnc:localfs', (res) => {
      // Emit file list when it changes
      this.emit('fluidnc:fileList', this.runner.getFileList());
      this.emit('fluidnc:localfs', res);
    });

    this.runner.on('others', (res) => {
      this.emit('serialport:read', res.raw);
    });

    // Restrict the function to execute once within the specified time interval, occurring only on the trailing edge of the timeout.
    const queryActivity = _.throttle(() => {
      if (this.isOpen()) {
        this.connection.write('?');
      }
    }, 2000, {
      // For grbl-Mega, it is essential to allow a specific delay before querying the status report to avoid blocking the connection.
      // Therefore, the `leading` option must be set to false.
      // @see https://github.com/cncjs/cncjs/issues/889
      leading: false,
      trailing: true,
    });

    const queryStatusReport = () => {
      // Check the ready flag
      if (!(this.ready)) {
        return;
      }

      const now = new Date().getTime();

      // The status report query (?) is a realtime command, it does not consume the receive buffer.
      const lastQueryTime = this.actionTime.queryStatusReport;
      if (lastQueryTime > 0) {
        const timespan = Math.abs(now - lastQueryTime);
        const toleranceTime = 5000; // 5 seconds

        // Check if it has not been updated for a long time
        if (timespan >= toleranceTime) {
          log.debug(`Continue status report query: timespan=${timespan}ms`);
          this.actionMask.queryStatusReport = false;
        }
      }

      if (this.actionMask.queryStatusReport) {
        return;
      }

      if (this.isOpen()) {
        this.actionMask.queryStatusReport = true;
        this.actionTime.queryStatusReport = now;
        this.connection.write('?');
      }
    };

    const queryParserState = _.throttle(() => {
      // Check the ready flag
      if (!(this.ready)) {
        return;
      }

      const now = new Date().getTime();

      // Do not force query parser state ($G) when running a G-code program,
      // it will consume 3 bytes from the receive buffer in each time period.
      // @see https://github.com/cncjs/cncjs/issues/176
      // @see https://github.com/cncjs/cncjs/issues/186
      if ((this.workflow.state === WORKFLOW_STATE_IDLE) && this.runner.isIdle()) {
        const lastQueryTime = this.actionTime.queryParserState;
        if (lastQueryTime > 0) {
          const timespan = Math.abs(now - lastQueryTime);
          const toleranceTime = 10000; // 10 seconds

          // Check if it has not been updated for a long time
          if (timespan >= toleranceTime) {
            log.debug(`Continue parser state query: timespan=${timespan}ms`);
            this.actionMask.queryParserState.state = false;
            this.actionMask.queryParserState.reply = false;
          }
        }
      }

      if (this.actionMask.queryParserState.state || this.actionMask.queryParserState.reply) {
        return;
      }

      if (this.isOpen()) {
        this.actionMask.queryParserState.state = true;
        this.actionMask.queryParserState.reply = false;
        this.actionTime.queryParserState = now;
        this.connection.write('$G\n');
      }
    }, 500);

    this.queryTimer = setInterval(() => {
      if (this.isClose()) {
        // Serial port is closed
        return;
      }

      // Feeder
      if (this.feeder.peek()) {
        this.emit('feeder:status', this.feeder.toJSON());
      }

      // Sender
      if (this.sender.peek()) {
        this.emit('sender:status', this.sender.toJSON());
      }

      const zeroOffset = _.isEqual(
        this.runner.getWorkPosition(this.state),
        this.runner.getWorkPosition(this.runner.state)
      );

      // Grbl settings
      if (this.settings !== this.runner.settings) {
        this.settings = this.runner.settings;
        this.emit('controller:settings', this.type, this.settings);
        this.emit('Grbl:settings', this.settings); // Backward compatibility
      }

      // Grbl state
      if (this.state !== this.runner.state) {
        this.state = this.runner.state;
        this.emit('controller:state', this.type, this.state);
        this.emit('Grbl:state', this.state); // Backward compatibility
      }

      // Check the ready flag
      if (!(this.ready)) {
        queryActivity();
        return;
      }

      // ? - Status Report
      queryStatusReport();

      // $G - Parser State
      queryParserState();

      // Check if the machine has stopped movement after completion
      if (this.actionTime.senderFinishTime > 0) {
        const machineIdle = zeroOffset && this.runner.isIdle();
        const now = new Date().getTime();
        const timespan = Math.abs(now - this.actionTime.senderFinishTime);
        const toleranceTime = 500; // in milliseconds

        if (!machineIdle) {
          // Extend the sender finish time
          this.actionTime.senderFinishTime = now;
        } else if (timespan > toleranceTime) {
          log.silly(`Finished sending G-code: timespan=${timespan}`);

          this.actionTime.senderFinishTime = 0;

          // Stop workflow
          this.command('gcode:stop');
        }
      }
    }, 250);
  }

  async initController() {
    // https://github.com/cncjs/cncjs/issues/206
    // $13=0 (report in mm)
    // $13=1 (report in inches)
    this.writeln('$$');

    await delay(50);

    // Send $I command to get FluidNC device info including IP address
    console.log('FluidNC Controller: Sending initial $I command during initialization');
    this.writeln('$I');

    await delay(50);
    this.event.trigger('controller:ready');
  }

  populateContext(context) {
    // Machine position
    const {
      x: mposx,
      y: mposy,
      z: mposz,
      a: mposa,
      b: mposb,
      c: mposc
    } = this.runner.getMachinePosition();

    // Work position
    const {
      x: posx,
      y: posy,
      z: posz,
      a: posa,
      b: posb,
      c: posc
    } = this.runner.getWorkPosition();

    // Modal group
    const modal = this.runner.getModalGroup();

    // Tool
    const tool = this.runner.getTool();

    // G-code parameters
    const parameters = this.runner.getParameters();

    return Object.assign(context || {}, {
      // User-defined global variables
      global: this.sharedContext,

      // Bounding box
      xmin: Number(context.xmin) || 0,
      xmax: Number(context.xmax) || 0,
      ymin: Number(context.ymin) || 0,
      ymax: Number(context.ymax) || 0,
      zmin: Number(context.zmin) || 0,
      zmax: Number(context.zmax) || 0,

      // Machine position
      mposx: Number(mposx) || 0,
      mposy: Number(mposy) || 0,
      mposz: Number(mposz) || 0,
      mposa: Number(mposa) || 0,
      mposb: Number(mposb) || 0,
      mposc: Number(mposc) || 0,

      // Work position
      posx: Number(posx) || 0,
      posy: Number(posy) || 0,
      posz: Number(posz) || 0,
      posa: Number(posa) || 0,
      posb: Number(posb) || 0,
      posc: Number(posc) || 0,

      // Modal group
      modal: {
        motion: modal.motion,
        wcs: modal.wcs,
        plane: modal.plane,
        units: modal.units,
        distance: modal.distance,
        feedrate: modal.feedrate,
        program: modal.program,
        spindle: modal.spindle,
        // M7 and M8 may be active at the same time, but a modal group violation might occur when issuing M7 and M8 together on the same line. Using the new line character (\n) to separate lines can avoid this issue.
        coolant: ensureArray(modal.coolant).join('\n'),
      },

      // Tool
      tool: Number(tool) || 0,

      // G-code parameters
      params: parameters,

      // Global objects
      ...globalObjects,
    });
  }

  clearActionValues() {
    this.actionMask.queryParserState.state = false;
    this.actionMask.queryParserState.reply = false;
    this.actionMask.queryStatusReport = false;
    this.actionMask.replyParserState = false;
    this.actionMask.replyStatusReport = false;
    this.actionTime.queryParserState = 0;
    this.actionTime.queryStatusReport = 0;
    this.actionTime.senderFinishTime = 0;
  }

  destroy() {
    if (this.queryTimer) {
      clearInterval(this.queryTimer);
      this.queryTimer = null;
    }

    if (this.runner) {
      this.runner.removeAllListeners();
      this.runner = null;
    }

    this.sockets = {};

    if (this.connection) {
      this.connection = null;
    }

    if (this.messageSlot) {
      this.messageSlot = null;
    }

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
        settings: this.settings,
        state: this.state
      },
      fluidnc: this.runner ? {
        deviceInfo: this.runner.getDeviceInfo(),
        activeConfig: this.runner.getActiveConfig(),
        fileList: this.runner.getFileList()
      } : null,
      feeder: this.feeder.toJSON(),
      sender: this.sender.toJSON(),
      workflow: {
        state: this.workflow.state
      }
    };
  }

  // Test file patterns for debugging LocalFS responses
  testFilePatterns(line) {
    console.log(`    Testing patterns for: "${line}"`);

    // All known FluidNC file listing patterns
    const patterns = [
      // [FILE: filename|SIZE:size] format
      { name: '[FILE: |SIZE:]', regex: /^\[FILE:\s*([^|]+)\|SIZE:(\d+)\]$/ },

      // Tab-separated values (filename<TAB>size<TAB>type)
      { name: 'tab-separated', regex: /^(\S+\.\w+)\s*\t+\s*(\d+)\s*(?:\t+\s*(\w+))?$/ },

      // Space-separated values
      { name: 'space-separated', regex: /^(\S+\.\w+)\s+(\d+)\s*(\w*)$/ },

      // Colon-separated format (filename:size:type)
      { name: 'colon-separated', regex: /^(.+):(\d+):(file|dir)$/ },

      // Plain filename (just the filename on its own line)
      { name: 'plain-filename', regex: /^([a-zA-Z0-9_.-]+\.(yaml|yml|gcode|nc|txt|json|cfg|bin|hex))$/ },

      // Filenames with whitespace
      { name: 'filename-with-spaces', regex: /^\s*([a-zA-Z0-9_.-]+\.(yaml|yml|gcode|nc|txt|json|cfg|bin|hex))\s*$/ },

      // Any line containing a filename
      { name: 'contains-filename', regex: /([a-zA-Z0-9_.-]+\.(yaml|yml|gcode|nc|txt|json|cfg|bin|hex))/ },

      // Quoted filenames
      { name: 'quoted-filename', regex: /"([^"]+\.(yaml|yml|gcode|nc|txt|json|cfg|bin|hex))"/ },

      // Directory listing format (ls -la style)
      { name: 'ls-style', regex: /^[-rwx]{10}\s+\d+\s+\w+\s+\w+\s+(\d+)\s+.+?\s+([a-zA-Z0-9_.-]+\.(yaml|yml|gcode|nc|txt|json|cfg|bin|hex))$/ },

      // Alternative formats
      { name: 'filename-size-bytes', regex: /^([a-zA-Z0-9_.-]+\.(yaml|yml|gcode|nc|txt|json|cfg|bin|hex))\s+(\d+)\s*bytes?/ },
      { name: 'size-filename', regex: /^(\d+)\s+([a-zA-Z0-9_.-]+\.(yaml|yml|gcode|nc|txt|json|cfg|bin|hex))/ }
    ];

    patterns.forEach((pattern, index) => {
      const match = line.match(pattern.regex);
      if (match) {
        console.log(`    ✓ Pattern ${index} (${pattern.name}) MATCHED!`);
        console.log(`      Match groups:`, match);

        // Try to extract filename and size
        let filename = null;
        let size = 0;

        if (pattern.name === '[FILE: |SIZE:]') {
          filename = match[1]?.trim();
          size = parseInt(match[2], 10) || 0;
        } else if (pattern.name === 'colon-separated') {
          filename = match[1];
          size = parseInt(match[2], 10) || 0;
        } else if (pattern.name.includes('space') || pattern.name.includes('tab')) {
          filename = match[1];
          size = parseInt(match[2], 10) || 0;
        } else if (pattern.name.includes('filename')) {
          filename = match[1] || match[2]; // Try both capture groups
          // Look for size in the line
          const sizeMatch = line.match(/(\d+)/);
          size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0;
        }

        if (filename) {
          console.log(`      → Extracted: filename="${filename}", size=${size}`);

          // Try to add this file to the runner immediately
          const file = {
            name: filename,
            size: size,
            type: 'file'
          };

          this.runner.addFile(file);
          console.log(`      → Added file to runner list: ${filename}`);

          // Emit the updated file list immediately
          const currentFiles = this.runner.getFileList();
          console.log(`      → Emitting file list with ${currentFiles.length} files`);
          this.emit('fluidnc:fileList', [...currentFiles]);
        }
      }
    });

    if (!patterns.some(p => line.match(p.regex))) {
      console.log(`    ✗ No patterns matched for: "${line}"`);
      console.log(`    Line analysis:`);
      console.log(`      - Length: ${line.length}`);
      console.log(`      - Has dots: ${line.includes('.')}`);
      console.log(`      - Has spaces: ${line.includes(' ')}`);
      console.log(`      - Has tabs: ${line.includes('\t')}`);
      console.log(`      - Has colons: ${line.includes(':')}`);
      console.log(`      - Has pipes: ${line.includes('|')}`);
      console.log(`      - Has brackets: ${line.includes('[')}`);
      console.log(`      - Char codes: [${Array.from(line).map(c => c.charCodeAt(0)).join(', ')}]`);
    }
  }

  open(callback = noop) {
    const { port, baudrate, pin } = this.options;

    // Assertion check
    if (this.isOpen()) {
      log.error(`Cannot open serial port "${port}"`);
      return;
    }

    this.connection.on('data', this.connectionEventListener.data);
    this.connection.on('close', this.connectionEventListener.close);
    this.connection.on('error', this.connectionEventListener.error);

    this.connection.open(async (err) => {
      if (err) {
        log.error(`Error opening serial port "${port}":`, err);
        this.emit('serialport:error', { err: err, port: port });
        callback(err); // notify error
        return;
      }

      let setOptions = null;
      try {
        // Set DTR and RTS control flags if they exist
        if (typeof pin?.dtr === 'boolean') {
          setOptions = {
            ...setOptions,
            dtr: pin?.dtr,
          };
        }
        if (typeof pin?.rts === 'boolean') {
          setOptions = {
            ...setOptions,
            rts: pin?.rts,
          };
        }

        if (setOptions) {
          await delay(100);
          await this.connection.port.set(setOptions);
          await delay(100);
        }
      } catch (err) {
        log.error('Failed to set control flags:', { err, port });
      }

      this.emit('serialport:open', {
        port: port,
        baudrate: baudrate,
        controllerType: this.type,
        inuse: true
      });

      // Emit a change event to all connected sockets
      if (this.engine.io) {
        this.engine.io.emit('serialport:change', {
          port: port,
          inuse: true
        });
      }

      callback(); // register controller

      log.debug(`Connected to serial port "${port}"`);

      this.workflow.stop();

      // Clear action values
      this.clearActionValues();

      if (this.sender.state.gcode) {
        // Unload G-code
        this.command('unload');
      }
    });
  }

  close(callback) {
    const { port } = this.options;

    // Assertion check
    if (!this.connection) {
      const err = `Serial port "${port}" is not available`;
      callback(new Error(err));
      return;
    }

    // Stop status query
    this.ready = false;

    // Clear initialized flag
    this.initialized = false;

    this.emit('serialport:close', {
      port: port,
      inuse: false
    });

    // Emit a change event to all connected sockets
    if (this.engine.io) {
      this.engine.io.emit('serialport:change', {
        port: port,
        inuse: false
      });
    }

    if (this.isClose()) {
      callback(null);
      return;
    }

    this.connection.removeAllListeners();
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
    if (this.isOpen()) {
      socket.emit('serialport:open', {
        port: this.options.port,
        baudrate: this.options.baudrate,
        controllerType: this.type,
        inuse: true
      });
    }
    if (!_.isEmpty(this.settings)) {
      // controller settings
      socket.emit('controller:settings', this.type, this.settings);
      socket.emit('Grbl:settings', this.settings); // Backward compatibility
    }
    if (!_.isEmpty(this.state)) {
      // controller state
      socket.emit('controller:state', this.type, this.state);
      socket.emit('Grbl:state', this.state); // Backward compatibility
    }
    if (this.feeder) {
      // feeder status
      socket.emit('feeder:status', this.feeder.toJSON());
    }
    if (this.sender) {
      // sender status
      socket.emit('sender:status', this.sender.toJSON());

      const { name, gcode, context } = this.sender.state;
      if (gcode) {
        socket.emit('gcode:load', name, gcode, context);
      }
    }
    if (this.workflow) {
      // workflow state
      socket.emit('workflow:state', this.workflow.state);
    }

    // Send FluidNC-specific state
    if (this.runner) {
      socket.emit('fluidnc:deviceInfo', this.runner.getDeviceInfo());
      socket.emit('fluidnc:activeConfig', this.runner.getActiveConfig());
      socket.emit('fluidnc:fileList', this.runner.getFileList());
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

  emit(eventName, ...args) {
    Object.keys(this.sockets).forEach(id => {
      const socket = this.sockets[id];
      socket.emit(eventName, ...args);
    });
  }

  command(cmd, ...args) {
    const handler = {
      'gcode:load': () => {
        let [name, gcode, context = {}, callback = noop] = args;
        if (typeof context === 'function') {
          callback = context;
          context = {};
        }

        // G4 P0 or P with a very small value will empty the planner queue and then
        // respond with an ok when the dwell is complete. At that instant, there will
        // be no queued motions, as long as no more commands were sent after the G4.
        // This is the fastest way to do it without having to check the status reports.
        const dwell = '%wait ; Wait for the planner to empty';
        const ok = this.sender.load(name, gcode + '\n' + dwell, context);
        if (!ok) {
          callback(new Error(`Invalid G-code: name=${name}`));
          return;
        }

        this.emit('gcode:load', name, this.sender.state.gcode, context);
        this.event.trigger('gcode:load');

        log.debug(`Load G-code: name="${this.sender.state.name}", size=${this.sender.state.gcode.length}, total=${this.sender.state.total}`);

        this.workflow.stop();

        callback(null, this.sender.toJSON());
      },
      'gcode:unload': () => {
        this.workflow.stop();

        // Sender
        this.sender.unload();

        this.emit('gcode:unload');
        this.event.trigger('gcode:unload');
      },
      'start': () => {
        log.warn(`Warning: The "${cmd}" command is deprecated and will be removed in a future release.`);
        this.command('gcode:start');
      },
      'gcode:start': () => {
        this.event.trigger('gcode:start');

        this.workflow.start();

        // Feeder
        this.feeder.reset();

        // Sender
        this.sender.next();
      },
      'stop': () => {
        log.warn(`Warning: The "${cmd}" command is deprecated and will be removed in a future release.`);
        this.command('gcode:stop', ...args);
      },
      // @param {object} options The options object.
      // @param {boolean} [options.force] Whether to force stop a G-code program. Defaults to false.
      'gcode:stop': async () => {
        this.event.trigger('gcode:stop');

        this.workflow.stop();

        const [options] = args;
        const { force = false } = { ...options };
        if (force) {
          let activeState;

          activeState = _.get(this.state, 'status.activeState', '');
          if (activeState === GRBL_ACTIVE_STATE_RUN) {
            this.write('!'); // hold
          }

          await delay(500); // delay 500ms

          activeState = _.get(this.state, 'status.activeState', '');
          if (activeState === GRBL_ACTIVE_STATE_HOLD) {
            this.write('\x18'); // ^x
          }
        }
      },
      'pause': () => {
        log.warn(`Warning: The "${cmd}" command is deprecated and will be removed in a future release.`);
        this.command('gcode:pause');
      },
      'gcode:pause': () => {
        this.event.trigger('gcode:pause');

        this.workflow.pause();
        this.write('!');
      },
      'resume': () => {
        log.warn(`Warning: The "${cmd}" command is deprecated and will be removed in a future release.`);
        this.command('gcode:resume');
      },
      'gcode:resume': () => {
        this.event.trigger('gcode:resume');

        this.write('~');
        this.workflow.resume();
      },
      'feeder:feed': () => {
        const [commands, context] = args;
        this.command('gcode', commands, context);
      },
      'feeder:start': () => {
        if (this.workflow.state === WORKFLOW_STATE_RUNNING) {
          return;
        }
        this.write('~');
        this.feeder.unhold();
        this.feeder.next();
      },
      'feeder:stop': () => {
        this.feeder.reset();
      },
      'feedhold': () => {
        this.event.trigger('feedhold');

        this.write('!');
      },
      'cyclestart': () => {
        this.event.trigger('cyclestart');

        this.write('~');
      },
      'statusreport': () => {
        this.write('?');
      },
      'homing': () => {
        this.event.trigger('homing');

        this.writeln('$H');
      },
      'sleep': () => {
        this.event.trigger('sleep');

        this.writeln('$SLP');
      },
      'unlock': () => {
        this.writeln('$X');
      },
      'reset': () => {
        this.workflow.stop();

        this.feeder.reset();

        this.write('\x18'); // ^x
      },
      'jogCancel': () => {
        // https://github.com/gnea/grbl/blob/master/doc/markdown/jogging.md
        this.write('\x85');
      },
      // Feed Overrides
      // @param {number} value The amount of percentage increase or decrease.
      //   0: Set 100% of programmed rate.
      //  10: Increase 10%
      // -10: Decrease 10%
      //   1: Increase 1%
      //  -1: Decrease 1%
      'feedOverride': () => {
        const [value] = args;

        if (value === 0) {
          this.write('\x90');
        } else if (value === 10) {
          this.write('\x91');
        } else if (value === -10) {
          this.write('\x92');
        } else if (value === 1) {
          this.write('\x93');
        } else if (value === -1) {
          this.write('\x94');
        }
      },
      // Spindle Speed Overrides
      // @param {number} value The amount of percentage increase or decrease.
      //   0: Set 100% of programmed spindle speed
      //  10: Increase 10%
      // -10: Decrease 10%
      //   1: Increase 1%
      //  -1: Decrease 1%
      'spindleOverride': () => {
        const [value] = args;

        if (value === 0) {
          this.write('\x99');
        } else if (value === 10) {
          this.write('\x9a');
        } else if (value === -10) {
          this.write('\x9b');
        } else if (value === 1) {
          this.write('\x9c');
        } else if (value === -1) {
          this.write('\x9d');
        }
      },
      // Rapid Overrides
      // @param {number} value A percentage value of 25, 50, or 100. A value of zero will reset to 100%.
      // 100: Set to 100% full rapid rate.
      //  50: Set to 50% of rapid rate.
      //  25: Set to 25% of rapid rate.
      'rapidOverride': () => {
        const [value] = args;

        if (value === 0 || value === 100) {
          this.write('\x95');
        } else if (value === 50) {
          this.write('\x96');
        } else if (value === 25) {
          this.write('\x97');
        }
      },
      'lasertest:on': () => {
        const [power = 0, duration = 0, maxS = 1000] = args;
        const commands = [
          // https://github.com/gnea/grbl/wiki/Grbl-v1.1-Laser-Mode
          // The laser will only turn on when Grbl is in a G1, G2, or G3 motion mode.
          'G1F1',
          'M3S' + ensurePositiveNumber(maxS * (power / 100))
        ];
        if (duration > 0) {
          commands.push('G4P' + ensurePositiveNumber(duration / 1000));
          commands.push('M5S0');
        }
        this.command('gcode', commands);
      },
      'lasertest:off': () => {
        const commands = [
          'M5S0'
        ];
        this.command('gcode', commands);
      },
      'gcode': () => {
        const [commands, context] = args;
        const data = ensureArray(commands)
          .join('\n')
          .split(/\r?\n/)
          .filter(line => {
            if (typeof line !== 'string') {
              return false;
            }

            return line.trim().length > 0;
          });

        this.feeder.feed(data, context);

        if (!this.feeder.isPending()) {
          this.feeder.next();
        }
      },
      'macro:run': () => {
        let [id, context = {}, callback = noop] = args;
        if (typeof context === 'function') {
          callback = context;
          context = {};
        }

        const macros = config.get('macros');
        const macro = _.find(macros, { id: id });

        if (!macro) {
          log.error(`Cannot find the macro: id=${id}`);
          return;
        }

        this.event.trigger('macro:run');

        this.command('gcode', macro.content, context);
        callback(null);
      },
      'macro:load': () => {
        let [id, context = {}, callback = noop] = args;
        if (typeof context === 'function') {
          callback = context;
          context = {};
        }

        const macros = config.get('macros');
        const macro = _.find(macros, { id: id });

        if (!macro) {
          log.error(`Cannot find the macro: id=${id}`);
          return;
        }

        this.event.trigger('macro:load');

        this.command('gcode:load', macro.name, macro.content, context, callback);
      },
      'watchdir:load': () => {
        const [file, callback = noop] = args;
        const context = {}; // empty context

        monitor.readFile(file, (err, data) => {
          if (err) {
            callback(err);
            return;
          }

          this.command('gcode:load', file, data, context, callback);
        });
      },
      'tool:change': () => {
        const modal = this.runner.getModalGroup();
        const units = {
          'G20': IMPERIAL_UNITS,
          'G21': METRIC_UNITS,
        }[modal.units];
        const toolChangePolicy = config.get('tool.toolChangePolicy', TOOL_CHANGE_POLICY_IGNORE_M6_COMMANDS);
        const toolChangeX = mapPositionToUnits(config.get('tool.toolChangeX', 0), units);
        const toolChangeY = mapPositionToUnits(config.get('tool.toolChangeY', 0), units);
        const toolChangeZ = mapPositionToUnits(config.get('tool.toolChangeZ', 0), units);
        const toolProbeX = mapPositionToUnits(config.get('tool.toolProbeX', 0), units);
        const toolProbeY = mapPositionToUnits(config.get('tool.toolProbeY', 0), units);
        const toolProbeZ = mapPositionToUnits(config.get('tool.toolProbeZ', 0), units);
        const toolProbeCustomCommands = ensureString(config.get('tool.toolProbeCustomCommands')).split('\n');
        const toolProbeCommand = config.get('tool.toolProbeCommand', 'G38.2');
        const toolProbeDistance = mapValueToUnits(config.get('tool.toolProbeDistance', 1), units);
        const toolProbeFeedrate = mapValueToUnits(config.get('tool.toolProbeFeedrate', 10), units);
        const touchPlateHeight = mapValueToUnits(config.get('tool.touchPlateHeight', 0), units);

        const context = {
          'tool_change_x': toolChangeX,
          'tool_change_y': toolChangeY,
          'tool_change_z': toolChangeZ,
          'tool_probe_x': toolProbeX,
          'tool_probe_y': toolProbeY,
          'tool_probe_z': toolProbeZ,
          'tool_probe_command': toolProbeCommand,
          'tool_probe_distance': toolProbeDistance,
          'tool_probe_feedrate': toolProbeFeedrate,
          'touch_plate_height': touchPlateHeight,

          // internal functions
          'mapWCSToPValue': function (wcs) {
            return {
              'G54': 1,
              'G55': 2,
              'G56': 3,
              'G57': 4,
              'G58': 5,
              'G59': 6,
            }[wcs] || 0;
          },
        };

        const lines = [];

        // Wait until the planner queue is empty
        lines.push('%wait');

        // Remember original position and spindle state
        lines.push('%_posx=posx');
        lines.push('%_posy=posy');
        lines.push('%_posz=posz');
        lines.push('%_modal_spindle=modal.spindle');

        // Stop the spindle
        lines.push('M5');

        // Absolute positioning
        lines.push('G90');

        // Move to the tool change position
        lines.push('G53 G0 Z[tool_change_z]');
        lines.push('G53 G0 X[tool_change_x] Y[tool_change_y]');
        lines.push('%wait');

        // Prompt the user to change the tool
        lines.push('%msg Tool Change T[tool]');
        lines.push('M0');

        // Move to the tool probe position
        lines.push('G53 G0 X[tool_probe_x] Y[tool_probe_y]');
        lines.push('G53 G0 Z[tool_probe_z]');
        lines.push('%wait');

        if (toolChangePolicy === TOOL_CHANGE_POLICY_MANUAL_TOOL_CHANGE_WCS) {
          // Probe the tool
          lines.push('G91 [tool_probe_command] F[tool_probe_feedrate] Z[tool_probe_z - mposz - tool_probe_distance]');
          // Set coordinate system offset
          lines.push('G10 L20 P[mapWCSToPValue(modal.wcs)] Z[touch_plate_height]');
        } else if (toolChangePolicy === TOOL_CHANGE_POLICY_MANUAL_TOOL_CHANGE_TLO) {
          // Probe the tool
          lines.push('G91 [tool_probe_command] F[tool_probe_feedrate] Z[tool_probe_z - mposz - tool_probe_distance]');
          // Pause for 1 second
          lines.push('%wait 1');
          // Set tool length offset
          lines.push('G43.1 Z[posz - touch_plate_height]');
        } else if (toolChangePolicy === TOOL_CHANGE_POLICY_MANUAL_TOOL_CHANGE_CUSTOM_PROBING) {
          lines.push(...toolProbeCustomCommands);
        }

        // Move to the tool change position
        lines.push('G53 G0 Z[tool_change_z]');
        lines.push('G53 G0 X[tool_change_x] Y[tool_change_y]');
        lines.push('%wait');

        // Prompt the user to restart the spindle
        lines.push('%msg Restart Spindle');
        lines.push('M0');

        // Restore the position and spindle state
        lines.push('G90');
        lines.push('G0 X[_posx] Y[_posy]');
        lines.push('G0 Z[_posz]');
        lines.push('[_modal_spindle]');

        // Wait 5 seconds for the spindle to speed up
        lines.push('%wait 5');

        this.command('gcode', lines, context);
      },
      // FluidNC-specific commands
      'fluidnc:getInfo': () => {
        // Send $I command to get device info including IP address
        console.log('FluidNC Controller: Sending $I command to get device info');
        this.writeln('$I');
      },
      'fluidnc:getActiveConfig': () => {
        // Send $N command to get active config
        this.writeln('$N');
      },
      'fluidnc:setManualIP': () => {
        const [ip] = args;
        console.log(`FluidNC Controller: Setting manual IP address: ${ip}`);

        // Update the device info with manual IP
        this.runner.fluidnc.deviceInfo.ip = ip;
        const deviceInfo = this.runner.getDeviceInfo();
        console.log('FluidNC Controller: Manual IP set, emitting to clients:', deviceInfo);
        this.emit('fluidnc:deviceInfo', deviceInfo);
      },
      'fluidnc:listFiles': () => {
        console.log('\n======= FluidNC Controller: File List Request =======');
        
        // Check if we have device IP for HTTP access
        const deviceInfo = this.runner.getDeviceInfo();
        const deviceIP = deviceInfo.ip;
        
        if (deviceIP && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(deviceIP)) {
          console.log(`FluidNC Controller: Device IP available: ${deviceIP}`);
          console.log('FluidNC Controller: Attempting HTTP-based file listing...');
          
          // Try HTTP API for file listing (FluidNC's primary interface)
          this.listFilesViaHTTP(deviceIP);
        } else {
          console.log('FluidNC Controller: No valid IP available for HTTP access');
          console.log('FluidNC Controller: FluidNC file operations require web interface access');
          
          // Emit empty file list with information message
          this.emit('fluidnc:fileList', []);
          this.emit('fluidnc:message', {
            message: 'FluidNC file operations require web interface access. Connect to FluidNC web interface for file management.',
            type: 'info'
          });
        }

        // Set a timer to analyze results
        setTimeout(() => {
          const fileList = this.runner.getFileList();
          console.log(`\n======= FluidNC Controller: File List Analysis =======`);
          console.log(`FluidNC Controller: Timer callback - found ${fileList.length} files in runner`);
          console.log(`FluidNC Controller: Total response lines captured: ${this.localFSResponseLines.length}`);
          console.log('FluidNC Controller: All captured response lines:');
          
          if (this.localFSResponseLines.length === 0) {
            console.log('  ⚠️  NO RESPONSES CAPTURED AT ALL!');
            console.log('  This suggests:');
            console.log('    1. FluidNC device may not support $LocalFS/List command');
            console.log('    2. Command may have different syntax');
            console.log('    3. Device may not be responding to commands');
            console.log('    4. Responses may be filtered out by other parsing logic');
          } else {
            this.localFSResponseLines.forEach((line, index) => {
              console.log(`  Response ${index}: "${line}" (${line.length} chars)`);
              console.log(`    Hex: ${Array.from(line).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ')}`);
            });
          }

          // Emergency parsing attempt on ALL captured lines
          console.log('\nFluidNC Controller: Starting comprehensive emergency parsing...');
          let emergencyFilesFound = 0;
          
          this.localFSResponseLines.forEach((line, index) => {
            console.log(`\n--- Emergency parsing line ${index}: "${line}" ---`);
            
            // Ultra-permissive patterns - try to find ANY file-like content
            const emergencyPatterns = [
              // Any text with file extensions
              /([a-zA-Z0-9_.-]+\.(yaml|yml|gcode|nc|txt|json|cfg|bin|hex|exe|bat|sh))/gi,
              // Text followed by numbers (possible size)
              /([a-zA-Z0-9_.-]+\.[a-zA-Z]+)\s*[:\t\s]+(\d+)/gi,
              // Numbers followed by text (possible size then filename)
              /(\d+)\s*[:\t\s]+([a-zA-Z0-9_.-]+\.[a-zA-Z]+)/gi,
              // Look for any structured data that might contain filenames
              /["']([^"']+\.[a-zA-Z]+)["']/gi,
              // Look for directory-style listings
              /^[\s]*([a-zA-Z0-9_.-]+\.[a-zA-Z]+)[\s]*$/gm
            ];

            let lineHadMatches = false;
            emergencyPatterns.forEach((pattern, patternIndex) => {
              const matches = [...line.matchAll(pattern)];
              if (matches.length > 0) {
                lineHadMatches = true;
                console.log(`  Emergency pattern ${patternIndex} found ${matches.length} matches:`);
                matches.forEach((match, matchIndex) => {
                  let filename, size;
                  
                  if (patternIndex === 0 || patternIndex === 4) {
                    filename = match[1];
                    size = 0;
                  } else if (patternIndex === 1) {
                    filename = match[1];
                    size = parseInt(match[2], 10) || 0;
                  } else if (patternIndex === 2) {
                    filename = match[2];
                    size = parseInt(match[1], 10) || 0;
                  } else if (patternIndex === 3) {
                    filename = match[1];
                    size = 0;
                  }
                  
                  if (filename && filename.includes('.')) {
                    console.log(`    Emergency match ${matchIndex}: filename="${filename}", size=${size}`);
                    
                    const emergencyFile = {
                      name: filename,
                      size: size,
                      type: 'file'
                    };
                    this.runner.addFile(emergencyFile);
                    emergencyFilesFound++;
                    console.log(`    ✓ Emergency: Added file "${filename}" to list`);
                  }
                });
              }
            });
            
            if (!lineHadMatches) {
              console.log(`  No emergency patterns matched this line`);
            }
          });

          const finalFileList = this.runner.getFileList();
          console.log(`\nFluidNC Controller: Final results:`);
          console.log(`  Files from normal parsing: ${fileList.length}`);
          console.log(`  Files from emergency parsing: ${emergencyFilesFound}`);
          console.log(`  Total files in final list: ${finalFileList.length}`);
          
          if (finalFileList.length > 0) {
            console.log('FluidNC Controller: Final file list:');
            finalFileList.forEach((file, index) => {
              console.log(`  File ${index}: ${file.name} (${file.size} bytes, ${file.type})`);
            });
          } else {
            console.log('⚠️  STILL NO FILES FOUND AFTER ALL ATTEMPTS!');
            console.log('This indicates one of:');
            console.log('  1. FluidNC device has no files in its filesystem');
            console.log('  2. $LocalFS/List command is not supported');
            console.log('  3. Different command syntax is required');
            console.log('  4. Files are returned in a completely different format');
          }
          
          console.log(`FluidNC Controller: Emitting file list with ${finalFileList.length} files`);
          this.emit('fluidnc:fileList', [...finalFileList]);
          this.expectingLocalFSResponse = false;
          this.localFSResponseLines = [];
          console.log('======= End File List Operation =======\n');
        }, 3000); // Increased to 3 seconds for more comprehensive analysis
      },
      'fluidnc:deleteFile': async () => {
        const [filename, callback = noop] = args;
        if (!filename) {
          callback(new Error('Filename is required'));
          return;
        }

        try {
          // Try HTTP delete first, fallback to serial command
          const deviceInfo = this.runner.getDeviceInfo();
          if (deviceInfo.ip) {
            await this.deleteFileFromDevice(filename);
          } else {
            // Fallback to serial command
            this.writeln(`$LocalFS/Delete=${filename}`);
          }

          // Refresh file list after delete
          this.command('fluidnc:listFiles');
          callback(null);
        } catch (error) {
          callback(error);
        }
      },
      'fluidnc:runFile': () => {
        const [filename, callback = noop] = args;
        if (!filename) {
          callback(new Error('Filename is required'));
          return;
        }
        this.writeln(`$LocalFS/Run=${filename}`);
      },
      'fluidnc:uploadFile': async () => {
        const [fileData, filename, callback = noop] = args;
        try {
          await this.uploadFileToDevice(fileData, filename);
          // Refresh file list after upload
          this.command('fluidnc:listFiles');
          callback(null);
        } catch (error) {
          callback(error);
        }
      },
      'fluidnc:downloadFile': async () => {
        const [filename, callback = noop] = args;
        try {
          const fileData = await this.downloadFileFromDevice(filename);
          callback(null, fileData);
        } catch (error) {
          callback(error);
        }
      },
    }[cmd];

    if (!handler) {
      log.error(`Unknown command: ${cmd}`);
      return;
    }

    handler();
  }

  // FluidNC XModem file operations
  async uploadFileToDevice(fileData, filename) {
    console.log(`FluidNC Controller: Starting HTTP upload of ${filename}, size: ${fileData.length}`);

    const deviceInfo = this.runner.getDeviceInfo();
    const deviceIP = deviceInfo.ip;
    
    if (!deviceIP || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(deviceIP)) {
      throw new Error('Device IP address required for file upload. Use FluidNC web interface.');
    }

    try {
      // FluidNC typically accepts file uploads at /upload endpoint
      const result = await this.httpPost(deviceIP, '/upload', fileData, filename);
      
      if (result.success) {
        console.log(`FluidNC Controller: Successfully uploaded ${filename}`);
        return { success: true, message: 'File uploaded successfully' };
      } else {
        throw new Error(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error(`FluidNC Controller: Upload failed:`, error);
      throw new Error(`Upload failed: ${error.message}. Use FluidNC web interface for file operations.`);
    }
  }

  async downloadFileFromDevice(filename) {
    console.log(`FluidNC Controller: Starting HTTP download of ${filename}`);

    const deviceInfo = this.runner.getDeviceInfo();
    const deviceIP = deviceInfo.ip;
    
    if (!deviceIP || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(deviceIP)) {
      throw new Error('Device IP address required for file download. Use FluidNC web interface.');
    }

    try {
      // FluidNC typically serves files at /files endpoint
      const result = await this.httpGet(deviceIP, `/files/${filename}`);
      
      if (result.success) {
        console.log(`FluidNC Controller: Successfully downloaded ${filename}, size: ${result.data.length}`);
        return result.data;
      } else {
        throw new Error(result.error || 'Download failed');
      }
    } catch (error) {
      console.error(`FluidNC Controller: Download failed:`, error);
      throw new Error(`Download failed: ${error.message}. Use FluidNC web interface for file operations.`);
    }
  }

  async deleteFileFromDevice(filename) {
    console.log(`FluidNC Controller: Deleting file ${filename} via HTTP`);

    const deviceInfo = this.runner.getDeviceInfo();
    const deviceIP = deviceInfo.ip;
    
    if (!deviceIP || !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(deviceIP)) {
      throw new Error('Device IP address required for file deletion. Use FluidNC web interface.');
    }

    try {
      // FluidNC typically accepts file deletions at /files endpoint
      const result = await this.httpDelete(deviceIP, `/files/${filename}`);
      
      if (result.success) {
        console.log(`FluidNC Controller: Successfully deleted ${filename}`);
        return { success: true, message: 'File deleted successfully' };
      } else {
        throw new Error(result.error || 'Delete failed');
      }
    } catch (error) {
      console.error(`FluidNC Controller: Delete failed:`, error);
      throw new Error(`Delete failed: ${error.message}. Use FluidNC web interface for file operations.`);
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  write(data, context) {
    // Assertion check
    if (this.isClose()) {
      log.error(`Serial port "${this.options.port}" is not accessible`);
      return;
    }

    const cmd = data.trim();
    this.actionMask.replyStatusReport = (cmd === '?') || this.actionMask.replyStatusReport;
    this.actionMask.replyParserState = (cmd === '$G') || this.actionMask.replyParserState;

    this.emit('serialport:write', data, {
      ...context,
      source: WRITE_SOURCE_CLIENT
    });
    this.connection.write(data);
    log.silly(`> ${data}`);
  }

  // HTTP-based file operations for FluidNC
  async listFilesViaHTTP(deviceIP) {
    try {
      console.log(`FluidNC Controller: Attempting HTTP file list from ${deviceIP}`);
      
      // FluidNC typically serves file listings at /files or /api/files
      const paths = [
        '/files',
        '/api/files',
        '/upload',
        '/filesystem'
      ];
      
      for (const path of paths) {
        try {
          console.log(`FluidNC Controller: Trying path: ${path}`);
          
          const result = await this.httpGet(deviceIP, path);
          
          if (result.success) {
            console.log(`FluidNC Controller: Success! Content-Type: ${result.contentType}`);
            
            if (result.contentType && result.contentType.includes('application/json')) {
              console.log('FluidNC Controller: Received JSON response:', result.data);
              this.parseHTTPFileList(JSON.parse(result.data));
              return;
            } else {
              console.log('FluidNC Controller: Received HTML/text response (length):', result.data.length);
              this.parseHTMLFileList(result.data, `http://${deviceIP}${path}`);
              return;
            }
          } else {
            console.log(`FluidNC Controller: HTTP error from ${path}:`, result.error);
          }
        } catch (pathError) {
          console.log(`FluidNC Controller: Error with ${path}:`, pathError.message);
        }
      }
      
      // If no HTTP endpoints work, provide web interface link
      console.log('FluidNC Controller: No HTTP file API found, directing to web interface');
      this.emit('fluidnc:fileList', []);
      this.emit('fluidnc:message', {
        message: `FluidNC web interface available at http://${deviceIP}/ for file management`,
        type: 'info',
        url: `http://${deviceIP}/`
      });
      
    } catch (error) {
      console.error('FluidNC Controller: HTTP file listing failed:', error);
      this.emit('fluidnc:fileList', []);
      this.emit('fluidnc:message', {
        message: 'FluidNC file listing failed. Use FluidNC web interface for file management.',
        type: 'warning'
      });
    }
  }

  // HTTP GET helper using Node.js http module
  httpGet(hostname, path, port = 80) {
    return new Promise((resolve) => {
      const options = {
        hostname,
        port,
        path,
        method: 'GET',
        timeout: 5000,
        headers: {
          'Accept': 'application/json, text/html, */*',
          'User-Agent': 'CNCjs FluidNC Client'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              data,
              contentType: res.headers['content-type'],
              statusCode: res.statusCode
            });
          } else {
            resolve({
              success: false,
              error: `HTTP ${res.statusCode}`,
              statusCode: res.statusCode
            });
          }
        });
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout'
        });
      });

      req.end();
    });
  }
  
  parseHTTPFileList(data) {
    console.log('FluidNC Controller: Parsing JSON file list:', data);
    
    let files = [];
    
    // Handle different JSON response formats
    if (Array.isArray(data)) {
      files = data;
    } else if (data.files && Array.isArray(data.files)) {
      files = data.files;
    } else if (data.items && Array.isArray(data.items)) {
      files = data.items;
    }
    
    const fileList = files.map(file => ({
      name: file.name || file.filename || file.path || String(file),
      size: file.size || file.length || 0,
      type: this.getFileType(file.name || file.filename || file.path || String(file)),
      modified: file.modified || file.mtime || file.lastModified
    }));
    
    console.log(`FluidNC Controller: Parsed ${fileList.length} files from JSON`);
    this.emit('fluidnc:fileList', fileList);
  }
  
  parseHTMLFileList(html, baseUrl) {
    console.log('FluidNC Controller: Parsing HTML file list...');
    
    // Extract file links from HTML
    const fileRegex = /<a[^>]+href=["']([^"']+\.(yaml|yml|gcode|nc|txt|json|cfg|bin))["'][^>]*>([^<]+)<\/a>/gi;
    const files = [];
    let match;
    
    while ((match = fileRegex.exec(html)) !== null) {
      const [, href, extension, text] = match;
      files.push({
        name: text.trim(),
        size: 0,
        type: this.getFileType(text.trim()),
        url: new URL(href, baseUrl).href
      });
    }
    
    console.log(`FluidNC Controller: Parsed ${files.length} files from HTML`);
    this.emit('fluidnc:fileList', files);
  }
  
  // HTTP POST helper using Node.js http module
  httpPost(hostname, path, fileData, filename, port = 80) {
    return new Promise((resolve) => {
      // Create multipart form data for file upload
      const boundary = '----FluidNCUpload' + Date.now();
      const formData = Buffer.concat([
        Buffer.from(`--${boundary}\r\n`),
        Buffer.from(`Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`),
        Buffer.from(`Content-Type: application/octet-stream\r\n\r\n`),
        Buffer.from(fileData),
        Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);

      const options = {
        hostname,
        port,
        path,
        method: 'POST',
        timeout: 10000,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': formData.length,
          'User-Agent': 'CNCjs FluidNC Client'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              data,
              statusCode: res.statusCode
            });
          } else {
            resolve({
              success: false,
              error: `HTTP ${res.statusCode}`,
              statusCode: res.statusCode
            });
          }
        });
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout'
        });
      });

      req.write(formData);
      req.end();
    });
  }

  // HTTP DELETE helper using Node.js http module
  httpDelete(hostname, path, port = 80) {
    return new Promise((resolve) => {
      const options = {
        hostname,
        port,
        path,
        method: 'DELETE',
        timeout: 5000,
        headers: {
          'User-Agent': 'CNCjs FluidNC Client'
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              success: true,
              data,
              statusCode: res.statusCode
            });
          } else {
            resolve({
              success: false,
              error: `HTTP ${res.statusCode}`,
              statusCode: res.statusCode
            });
          }
        });
      });

      req.on('error', (err) => {
        resolve({
          success: false,
          error: err.message
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout'
        });
      });

      req.end();
    });
  }

  getFileType(filename) {
    if (!filename) return 'unknown';
    const ext = filename.toLowerCase().split('.').pop();
    
    const typeMap = {
      'yaml': 'config',
      'yml': 'config', 
      'gcode': 'gcode',
      'nc': 'gcode',
      'txt': 'text',
      'json': 'config',
      'cfg': 'config'
    };
    
    return typeMap[ext] || 'file';
  }

  writeln(data, context) {
    console.log(`FluidNC Controller: Writing command: "${data}"`);
    // https://github.com/gnea/grbl/blob/master/doc/markdown/commands.md#grbl-v11-realtime-commands
    const isASCIIRealtimeCommand = _.includes(GRBL_REALTIME_COMMANDS, data);
    const isExtendedASCIIRealtimeCommand = String(data).match(/[\x80-\xff]/);
    const isRealtimeCommand = isASCIIRealtimeCommand || isExtendedASCIIRealtimeCommand;

    if (isRealtimeCommand) {
      this.write(data, context);
    } else {
      this.write(data + '\n', context);
    }
  }
}

export default FluidNCController;
