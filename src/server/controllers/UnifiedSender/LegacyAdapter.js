import { DeviceAdapter, DeviceStatus, CONTROLLER_STATES, CONNECTION_TYPES } from './types';
import { GRBL, GRBLHAL } from '../Grbl/constants';
import { MARLIN } from '../Marlin/constants';
import { SMOOTHIE } from '../Smoothie/constants';
import { G2CORE, TINYG } from '../TinyG/constants';

/**
 * Legacy adapter that wraps existing CNCjs controllers
 * This provides backward compatibility while adding unified sender capabilities
 */
export class LegacyAdapter extends DeviceAdapter {
  constructor(profile, cncEngine) {
    super(profile);
    this.cncEngine = cncEngine;
    this.controllerId = null;
    this.controller = null;
    this.currentStatus = new DeviceStatus();
  }

  async connect(options = {}) {
    if (this.isConnected) {
      return true;
    }

    const { port, baudRate = 115200 } = options;
    if (!port) {
      throw new Error('Port is required for connection');
    }

    try {
      // Use existing CNCjs connection mechanism
      const controllerType = this.mapProfileTypeToController(this.profile.type);
      
      // Create a connection through the existing CNCjs engine
      this.controllerId = await new Promise((resolve, reject) => {
        const connectionOptions = {
          port,
          baudRate,
          controllerType
        };

        // Listen for connection success/failure
        const onConnect = (data) => {
          if (data.port === port) {
            this.cncEngine.off('serialport:open', onConnect);
            this.cncEngine.off('serialport:error', onError);
            resolve(data.id);
          }
        };

        const onError = (data) => {
          if (data.port === port) {
            this.cncEngine.off('serialport:open', onConnect);
            this.cncEngine.off('serialport:error', onError);
            reject(new Error(data.message || 'Connection failed'));
          }
        };

        this.cncEngine.on('serialport:open', onConnect);
        this.cncEngine.on('serialport:error', onError);

        // Initiate connection
        this.cncEngine.openPort(port, connectionOptions);
      });

      this.controller = this.cncEngine.controllers[this.controllerId];
      this.setupEventListeners();
      this.isConnected = true;

      this.emit('connected', { port, baudRate, controllerId: this.controllerId });
      return true;

    } catch (error) {
      this.emit('error', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (!this.isConnected || !this.controllerId) {
      return true;
    }

    try {
      this.removeEventListeners();
      await this.cncEngine.closePort(this.controllerId);
      
      this.controllerId = null;
      this.controller = null;
      this.isConnected = false;

      this.emit('disconnected');
      return true;

    } catch (error) {
      this.emit('error', error.message);
      throw error;
    }
  }

  async sendGCode(gcode) {
    if (!this.isConnected || !this.controller) {
      throw new Error('Not connected');
    }

    try {
      // Use existing controller's command method
      this.controller.command(gcode);
      return true;
    } catch (error) {
      this.emit('error', error.message);
      throw error;
    }
  }

  getStatus() {
    return { ...this.currentStatus };
  }

  async getConfig() {
    if (!this.isConnected || !this.controller) {
      throw new Error('Not connected');
    }

    // For Grbl/grblHAL controllers, get $$ parameters
    if (this.isGrblController()) {
      return new Promise((resolve, reject) => {
        const params = {};
        let collecting = false;

        const onData = (data) => {
          if (data.startsWith('$') && data.includes('=')) {
            const [key, value] = data.split('=');
            params[key] = value;
            collecting = true;
          } else if (collecting && (data === 'ok' || data.startsWith('error'))) {
            this.controller.off('serialport:read', onData);
            if (data === 'ok') {
              resolve(params);
            } else {
              reject(new Error(data));
            }
          }
        };

        this.controller.on('serialport:read', onData);
        this.controller.command('$$');

        // Timeout after 5 seconds
        setTimeout(() => {
          this.controller.off('serialport:read', onData);
          reject(new Error('Timeout waiting for configuration'));
        }, 5000);
      });
    }

    // For other controllers, return empty config for now
    return {};
  }

  async applyConfig(config) {
    if (!this.isConnected || !this.controller) {
      throw new Error('Not connected');
    }

    if (this.isGrblController()) {
      // Apply Grbl parameters
      for (const [key, value] of Object.entries(config)) {
        if (key.startsWith('$')) {
          this.controller.command(`${key}=${value}`);
          // Add small delay between commands
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      return true;
    }

    return false;
  }

  setupEventListeners() {
    if (!this.controller) return;

    // Listen to controller events and translate them
    this.controller.on('serialport:read', this.handleControllerData.bind(this));
    this.controller.on('serialport:write', this.handleControllerWrite.bind(this));
    this.controller.on('serialport:error', this.handleControllerError.bind(this));
  }

  removeEventListeners() {
    if (!this.controller) return;

    this.controller.off('serialport:read', this.handleControllerData.bind(this));
    this.controller.off('serialport:write', this.handleControllerWrite.bind(this));
    this.controller.off('serialport:error', this.handleControllerError.bind(this));
  }

  handleControllerData(data) {
    this.emit('message', data);

    // Update status based on controller type and data
    if (this.isGrblController() && data.startsWith('<') && data.endsWith('>')) {
      this.parseGrblStatus(data);
    }
    
    // Emit unified status update
    this.emit('status', this.getStatus());
  }

  handleControllerWrite(data) {
    // Optional: emit write events for debugging
  }

  handleControllerError(data) {
    this.emit('error', data);
  }

  parseGrblStatus(statusLine) {
    // Parse Grbl/grblHAL status line and update unified status
    try {
      const match = statusLine.match(/<([^|>]+)(?:\|([^>]+))?>/);
      if (!match) return;

      const [, state, rest] = match;
      this.currentStatus.state = this.mapGrblState(state);
      this.currentStatus.raw = statusLine;
      this.currentStatus.timestamp = Date.now();

      if (rest) {
        const fields = rest.split('|');
        fields.forEach(field => {
          const [key, value] = field.split(':');
          switch (key) {
            case 'MPos':
              const mpos = value.split(',').map(Number);
              this.currentStatus.position.machine = {
                x: mpos[0] || 0,
                y: mpos[1] || 0,
                z: mpos[2] || 0
              };
              break;
            case 'WPos':
              const wpos = value.split(',').map(Number);
              this.currentStatus.position.work = {
                x: wpos[0] || 0,
                y: wpos[1] || 0,
                z: wpos[2] || 0
              };
              break;
            case 'WCO':
              const wco = value.split(',').map(Number);
              this.currentStatus.workCoordinateOffset = {
                x: wco[0] || 0,
                y: wco[1] || 0,
                z: wco[2] || 0
              };
              break;
            case 'F':
              this.currentStatus.feed.rate = Number(value) || 0;
              break;
            case 'S':
              this.currentStatus.spindle.rpm = Number(value) || 0;
              break;
            case 'Pn':
              this.parseGrblPins(value);
              break;
          }
        });
      }
    } catch (error) {
      // Ignore parse errors, keep existing status
    }
  }

  parseGrblPins(pinString) {
    this.currentStatus.pins = {};
    
    // Map Grbl pin letters to our unified pin names
    const pinMap = {
      'X': 'xMin',
      'Y': 'yMin', 
      'Z': 'zMin',
      'P': 'probe',
      'D': 'door',
      'H': 'hold',
      'R': 'reset',
      'S': 'safetyDoor'
    };

    for (const char of pinString) {
      if (pinMap[char]) {
        this.currentStatus.pins[pinMap[char]] = true;
      }
    }
  }

  mapGrblState(grblState) {
    const stateMap = {
      'Idle': CONTROLLER_STATES.IDLE,
      'Run': CONTROLLER_STATES.RUN,
      'Hold': CONTROLLER_STATES.HOLD,
      'Jog': CONTROLLER_STATES.JOG,
      'Alarm': CONTROLLER_STATES.ALARM,
      'Door': CONTROLLER_STATES.DOOR,
      'Check': CONTROLLER_STATES.CHECK,
      'Home': CONTROLLER_STATES.HOME,
      'Sleep': CONTROLLER_STATES.SLEEP
    };

    return stateMap[grblState] || CONTROLLER_STATES.IDLE;
  }

  mapProfileTypeToController(profileType) {
    const typeMap = {
      'grbl': GRBL,
      'grblhal': GRBLHAL,
      'marlin': MARLIN,
      'smoothie': SMOOTHIE,
      'tinyg': TINYG,
      'g2core': G2CORE
    };

    return typeMap[profileType.toLowerCase()] || GRBL;
  }

  isGrblController() {
    const grblTypes = ['grbl', 'grblhal'];
    return grblTypes.includes(this.profile.type.toLowerCase());
  }
}