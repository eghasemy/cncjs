import events from 'events';
import _ from 'lodash';
import decimalPlaces from '../../lib/decimal-places';
import FluidNCLineParser from './FluidNCLineParser';
import FluidNCLineParserResultStatus from './FluidNCLineParserResultStatus';
import FluidNCLineParserResultOk from './FluidNCLineParserResultOk';
import FluidNCLineParserResultError from './FluidNCLineParserResultError';
import FluidNCLineParserResultAlarm from './FluidNCLineParserResultAlarm';
import FluidNCLineParserResultParserState from './FluidNCLineParserResultParserState';
import FluidNCLineParserResultParameters from './FluidNCLineParserResultParameters';
import FluidNCLineParserResultFeedback from './FluidNCLineParserResultFeedback';
import FluidNCLineParserResultSettings from './FluidNCLineParserResultSettings';
import FluidNCLineParserResultStartup from './FluidNCLineParserResultStartup';
import FluidNCLineParserResultMessage from './FluidNCLineParserResultMessage';
import FluidNCLineParserResultLocalFS from './FluidNCLineParserResultLocalFS';
import {
  GRBL_ACTIVE_STATE_IDLE,
  GRBL_ACTIVE_STATE_ALARM
} from './constants';

class FluidNCRunner extends events.EventEmitter {
  state = {
    status: {
      activeState: '',
      mpos: {
        x: '0.000',
        y: '0.000',
        z: '0.000'
      },
      wpos: {
        x: '0.000',
        y: '0.000',
        z: '0.000'
      },
      ov: []
    },
    parserstate: {
      modal: {
        motion: 'G0', // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
        wcs: 'G54', // G54, G55, G56, G57, G58, G59
        plane: 'G17', // G17: xy-plane, G18: xz-plane, G19: yz-plane
        units: 'G21', // G20: Inches, G21: Millimeters
        distance: 'G90', // G90: Absolute, G91: Relative
        feedrate: 'G94', // G93: Inverse time mode, G94: Units per minute
        program: 'M0', // M0, M1, M2, M30
        spindle: 'M5', // M3: Spindle (cw), M4: Spindle (ccw), M5: Spindle off
        coolant: 'M9' // M7: Mist coolant, M8: Flood coolant, M9: Coolant off, [M7,M8]: Both on
      },
      tool: '',
      feedrate: '',
      spindle: ''
    }
  };

  settings = {
    version: '',
    parameters: {
    },
    settings: {
    }
  };

  // FluidNC-specific state
  fluidnc = {
    deviceInfo: {
      ip: '',
      machine: '',
      mode: '',
      ssid: '',
      status: '',
      mac: ''
    },
    activeConfig: '',
    files: []
  };

  parser = new FluidNCLineParser();

  parse(data) {
    data = ('' + data).replace(/\s+$/, '');
    if (!data) {
      return;
    }

    console.log(`FluidNC Runner: Parsing data: "${data}"`);
    this.emit('raw', { raw: data });

    const result = this.parser.parse(data) || {};
    const { type, payload } = result;
    console.log(`FluidNC Runner: Parse result - type: ${type ? type.name : 'null'}, payload:`, payload);

    // Enhanced debugging for message parsing
    if (data.includes('[MSG:') || data.includes('MSG:')) {
      console.log(`FluidNC Runner: MSG data being parsed: "${data}"`);
      console.log(`FluidNC Runner: Parse result for MSG: type=${type ? type.name : 'null'}`);
    }

    if (type === FluidNCLineParserResultStatus) {
      // Grbl v1.1
      // WCO:0.000,10.000,2.500
      // A current work coordinate offset is now sent to easily convert
      // between position vectors, where WPos = MPos - WCO for each axis.
      if (_.has(payload, 'mpos') && !_.has(payload, 'wpos')) {
        payload.wpos = payload.wpos || {};
        _.each(payload.mpos, (mpos, axis) => {
          const digits = decimalPlaces(mpos);
          const wco = _.get((payload.wco || this.state.status.wco), axis, 0);
          payload.wpos[axis] = (Number(mpos) - Number(wco)).toFixed(digits);
        });
      } else if (_.has(payload, 'wpos') && !_.has(payload, 'mpos')) {
        payload.mpos = payload.mpos || {};
        _.each(payload.wpos, (wpos, axis) => {
          const digits = decimalPlaces(wpos);
          const wco = _.get((payload.wco || this.state.status.wco), axis, 0);
          payload.mpos[axis] = (Number(wpos) + Number(wco)).toFixed(digits);
        });
      }

      const nextState = {
        ...this.state,
        status: {
          ...this.state.status,
          ...payload
        }
      };

      // Delete the raw key
      delete nextState.status.raw;

      if (!_.isEqual(this.state.status, nextState.status)) {
        this.state = nextState; // enforce change
      }
      this.emit('status', payload);
      return;
    }
    if (type === FluidNCLineParserResultOk) {
      this.emit('ok', payload);
      return;
    }
    if (type === FluidNCLineParserResultError) {
      // https://nodejs.org/api/events.html#events_error_events
      // As a best practice, listeners should always be added for the 'error' events.
      this.emit('error', payload);
      return;
    }
    if (type === FluidNCLineParserResultAlarm) {
      const alarmPayload = {
        activeState: GRBL_ACTIVE_STATE_ALARM
      };
      const nextState = {
        ...this.state,
        status: {
          ...this.state.status,
          ...alarmPayload
        }
      };
      if (!_.isEqual(this.state.status, nextState.status)) {
        this.state = nextState; // enforce change
      }
      this.emit('alarm', payload);
      return;
    }
    if (type === FluidNCLineParserResultParserState) {
      const { modal, tool, feedrate, spindle } = payload;
      const nextState = {
        ...this.state,
        parserstate: {
          modal: modal,
          tool: tool,
          feedrate: feedrate,
          spindle: spindle
        }
      };
      if (!_.isEqual(this.state.parserstate, nextState.parserstate)) {
        this.state = nextState; // enforce change
      }
      this.emit('parserstate', payload);
      return;
    }
    if (type === FluidNCLineParserResultParameters) {
      const { name, value } = payload;
      const nextSettings = {
        ...this.settings,
        parameters: {
          ...this.settings.parameters,
          [name]: value
        }
      };
      if (!_.isEqual(this.settings.parameters[name], nextSettings.parameters[name])) {
        this.settings = nextSettings; // enforce change
      }
      this.emit('parameters', payload);
      return;
    }
    if (type === FluidNCLineParserResultFeedback) {
      this.emit('feedback', payload);
      return;
    }
    if (type === FluidNCLineParserResultSettings) {
      const { name, value } = payload;

      // Check if this is the active config setting
      if (name === '$Config/Filename') {
        this.fluidnc.activeConfig = value;
      }

      const nextSettings = {
        ...this.settings,
        settings: {
          ...this.settings.settings,
          [name]: value
        }
      };
      if (this.settings.settings[name] !== nextSettings.settings[name]) {
        this.settings = nextSettings; // enforce change
      }
      this.emit('settings', payload);
      return;
    }
    if (type === FluidNCLineParserResultStartup) {
      const { version } = payload;
      const nextSettings = { // enforce change
        ...this.settings,
        version: version
      };
      if (!_.isEqual(this.settings.version, nextSettings.version)) {
        this.settings = nextSettings; // enforce change
      }
      this.emit('startup', payload);
      return;
    }
    if (type === FluidNCLineParserResultMessage) {
      // Handle FluidNC [MSG:...] messages
      const { message, data, invalidIP } = payload;
      console.log(`FluidNC Runner: Processing FluidNCLineParserResultMessage`);
      console.log(`FluidNC Runner: Message content: "${message}"`);
      console.log(`FluidNC Runner: Parsed data:`, data);
      console.log(`FluidNC Runner: Invalid IP flag:`, invalidIP);

      // Parse device info from status messages
      if (data && data.IP) {
        if (invalidIP) {
          // Log warning about invalid IP but still process the message
          console.warn(`FluidNC Runner: Invalid IP address format detected: ${data.IP}`);
        } else {
          // Valid IP address found - update device info
          console.log(`FluidNC Runner: Valid IP found, updating device info with IP: ${data.IP}`);
          const oldIP = this.fluidnc.deviceInfo.ip;
          this.fluidnc.deviceInfo = {
            ...this.fluidnc.deviceInfo,
            ip: data.IP,
            mode: data.Mode || this.fluidnc.deviceInfo.mode,
            ssid: data.SSID || this.fluidnc.deviceInfo.ssid,
            status: data.Status || this.fluidnc.deviceInfo.status,
            mac: data.MAC || this.fluidnc.deviceInfo.mac
          };
          console.log(`FluidNC Runner: Device IP changed from "${oldIP}" to "${data.IP}"`);
          console.log('FluidNC Runner: Current device info:', this.fluidnc.deviceInfo);
          
          // Emit device info update
          console.log('FluidNC Runner: Emitting fluidnc:deviceInfo event');
          this.emit('fluidnc:deviceInfo', this.fluidnc.deviceInfo);
        }
      }

      // Extract machine name from messages like "Machine: Leroy"
      if (message.startsWith('Machine: ')) {
        const machineName = message.substring(9);
        console.log(`FluidNC Runner: Setting machine name to: ${machineName}`);
        this.fluidnc.deviceInfo.machine = machineName;
        
        // Emit device info update when machine name changes
        console.log('FluidNC Runner: Emitting fluidnc:deviceInfo event for machine name update');
        this.emit('fluidnc:deviceInfo', this.fluidnc.deviceInfo);
      }

      console.log(`FluidNC Runner: Emitting fluidnc:message event`);
      this.emit('fluidnc:message', payload);
      return;
    }
    if (type === FluidNCLineParserResultLocalFS) {
      // Handle LocalFS responses
      const { command, file, response } = payload;
      console.log(`FluidNC Runner: Processing LocalFS response - command: ${command}, file:`, file, 'response:', response);

      if (command === 'list' && file) {
        // Add or update file in the list
        const existingIndex = this.fluidnc.files.findIndex(f => f.name === file.name);
        if (existingIndex >= 0) {
          console.log(`FluidNC Runner: Updating existing file: ${file.name}`);
          this.fluidnc.files[existingIndex] = file;
        } else {
          console.log(`FluidNC Runner: Adding new file: ${file.name}`);
          this.fluidnc.files.push(file);
        }
        console.log(`FluidNC Runner: File added to list: ${file.name} (${file.size} bytes, ${file.type})`);
        console.log(`FluidNC Runner: Total files in list: ${this.fluidnc.files.length}`);
      } else {
        console.log(`FluidNC Runner: LocalFS response - command: ${command}, response: ${response}`);
      }

      console.log(`FluidNC Runner: Emitting fluidnc:localfs event`);
      this.emit('fluidnc:localfs', payload);
      return;
    }
    if (data.length > 0) {
      this.emit('others', payload);
      return;
    }
  }

  getMachinePosition(state = this.state) {
    return _.get(state, 'status.mpos', {});
  }

  getWorkPosition(state = this.state) {
    return _.get(state, 'status.wpos', {});
  }

  getModalGroup(state = this.state) {
    return _.get(state, 'parserstate.modal', {});
  }

  getWorkCoordinateSystem(state = this.state) {
    const defaultWCS = 'G54';
    return _.get(state, 'parserstate.modal.wcs', defaultWCS);
  }

  getTool(state = this.state) {
    return Number(_.get(state, 'parserstate.tool')) || 0;
  }

  getParameters() {
    return _.get(this.settings, 'parameters', {});
  }

  isAlarm() {
    const activeState = _.get(this.state, 'status.activeState');
    return activeState === GRBL_ACTIVE_STATE_ALARM;
  }

  isIdle() {
    const activeState = _.get(this.state, 'status.activeState');
    return activeState === GRBL_ACTIVE_STATE_IDLE;
  }

  // FluidNC-specific methods
  getDeviceInfo() {
    return this.fluidnc.deviceInfo;
  }

  getActiveConfig() {
    return this.fluidnc.activeConfig;
  }

  getFileList() {
    return this.fluidnc.files;
  }

  setActiveConfig(filename) {
    this.fluidnc.activeConfig = filename;
  }

  clearFileList() {
    this.fluidnc.files = [];
  }
}

export default FluidNCRunner;
