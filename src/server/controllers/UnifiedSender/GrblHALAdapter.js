import net from 'net';
import { DeviceAdapter, DeviceStatus, CONTROLLER_STATES, PIN_STATES } from './types';
import SerialConnection from '../../lib/SerialConnection';
import logger from '../../lib/logger';

const log = logger('service:grblhal-adapter');

/**
 * grblHAL adapter implementation for unified sender
 * Supports both serial and telnet connections with extended status parsing
 */
export class GrblHALAdapter extends DeviceAdapter {
  constructor(profile) {
    super(profile);
    this.connection = null;
    this.statusInterval = null;
    this.statusIntervalTime = 250; // Query status every 250ms
    this.lastStatus = new DeviceStatus();
    this.isStreaming = false;
    this.streamQueue = [];
    this.sentCommands = 0;
    this.receivedResponses = 0;
    this.bufferSize = 128; // grblHAL default buffer size
    this.currentBufferUsage = 0;
  }

  /**
   * Connect to grblHAL device via serial or telnet
   */
  async connect(options = {}) {
    if (this.isConnected) {
      return true;
    }

    try {
      const connectionType = this.profile.connection.type;
      
      if (connectionType === 'serial') {
        await this.connectSerial(options);
      } else if (connectionType === 'telnet') {
        await this.connectTelnet(options);
      } else {
        throw new Error(`Unsupported connection type: ${connectionType}`);
      }

      this.isConnected = true;
      this.startStatusUpdates();
      
      // Send initial commands to identify and configure controller
      await this.initializeController();

      this.emit('connected', {
        type: connectionType,
        port: this.profile.connection.port || this.profile.connection.host,
        baudRate: this.profile.connection.baudRate || 23
      });

      log.info(`Connected to grblHAL via ${connectionType}`);
      return true;

    } catch (error) {
      log.error('Failed to connect to grblHAL:', error);
      this.emit('error', { message: `Connection failed: ${error.message}` });
      return false;
    }
  }

  /**
   * Connect via serial port
   */
  async connectSerial(options) {
    const { port, baudRate = 115200 } = this.profile.connection;
    
    if (!port) {
      throw new Error('Serial port not specified in profile');
    }

    this.connection = new SerialConnection({
      path: port,
      baudRate: baudRate,
      autoOpen: false
    });

    // Set up event handlers
    this.connection.on('data', (data) => this.handleData(data));
    this.connection.on('error', (error) => this.handleError(error));
    this.connection.on('close', () => this.handleDisconnection());

    // Open the connection
    await new Promise((resolve, reject) => {
      this.connection.open((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Connect via telnet
   */
  async connectTelnet(options) {
    const { host, port = 23 } = this.profile.connection;
    
    if (!host) {
      throw new Error('Telnet host not specified in profile');
    }

    this.connection = new net.Socket();
    
    // Set up event handlers
    this.connection.on('data', (data) => this.handleData(data));
    this.connection.on('error', (error) => this.handleError(error));
    this.connection.on('close', () => this.handleDisconnection());

    // Connect via telnet
    await new Promise((resolve, reject) => {
      this.connection.connect(port, host, () => {
        resolve();
      });
      
      this.connection.on('error', reject);
    });
  }

  /**
   * Initialize controller after connection
   */
  async initializeController() {
    // Wait a moment for controller to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Request version info
    this.sendCommand('$I');
    
    // Request current status
    this.sendCommand('?');
    
    // Request current settings (for configuration detection)
    this.sendCommand('$$');
  }

  /**
   * Disconnect from device
   */
  async disconnect() {
    if (!this.isConnected) {
      return true;
    }

    this.stopStatusUpdates();
    
    if (this.connection) {
      if (this.profile.connection.type === 'serial') {
        this.connection.close();
      } else if (this.profile.connection.type === 'telnet') {
        this.connection.destroy();
      }
      this.connection = null;
    }

    this.isConnected = false;
    this.isStreaming = false;
    this.streamQueue = [];
    this.sentCommands = 0;
    this.receivedResponses = 0;
    this.currentBufferUsage = 0;

    this.emit('disconnected');
    log.info('Disconnected from grblHAL');
    return true;
  }

  /**
   * Send G-code command to device
   */
  async sendGCode(gcode) {
    if (!this.isConnected) {
      throw new Error('Not connected to device');
    }

    // Clean up the gcode
    const cleanGcode = gcode.trim();
    if (!cleanGcode) {
      return false;
    }

    // Add to stream queue for buffer management
    this.streamQueue.push(cleanGcode);
    await this.processStreamQueue();

    return true;
  }

  /**
   * Process stream queue with buffer awareness
   */
  async processStreamQueue() {
    if (!this.isConnected || this.streamQueue.length === 0) {
      return;
    }

    // Check if we have buffer space
    while (this.streamQueue.length > 0 && this.hasBufferSpace()) {
      const command = this.streamQueue.shift();
      this.sendCommand(command);
      
      // Update buffer usage estimation
      this.currentBufferUsage += command.length + 1; // +1 for newline
      this.sentCommands++;
    }
  }

  /**
   * Check if there's space in the controller buffer
   */
  hasBufferSpace() {
    const availableBuffer = this.bufferSize - this.currentBufferUsage;
    return availableBuffer > 50; // Keep some margin
  }

  /**
   * Send raw command to controller
   */
  sendCommand(command) {
    if (!this.connection) {
      return;
    }

    const data = command + '\n';
    
    if (this.profile.connection.type === 'serial') {
      this.connection.write(data);
    } else if (this.profile.connection.type === 'telnet') {
      this.connection.write(data);
    }

    log.debug('Sent command:', command);
  }

  /**
   * Handle incoming data from controller
   */
  handleData(data) {
    const lines = data.toString().split(/\r?\n/);
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        this.parseLine(trimmedLine);
      }
    }
  }

  /**
   * Parse incoming line from controller
   */
  parseLine(line) {
    log.debug('Received:', line);

    // Status reports: <Idle|MPos:0,0,0|FS:0,0>
    if (line.startsWith('<') && line.endsWith('>')) {
      this.parseStatusLine(line);
      return;
    }

    // OK responses
    if (line === 'ok') {
      this.handleOkResponse();
      return;
    }

    // Error responses: error:1
    if (line.startsWith('error:')) {
      this.handleErrorResponse(line);
      return;
    }

    // Alarm responses: ALARM:1
    if (line.startsWith('ALARM:')) {
      this.handleAlarmResponse(line);
      return;
    }

    // Settings responses: $0=10
    if (line.match(/^\$\d+=/)) {
      this.handleSettingResponse(line);
      return;
    }

    // Version/build info
    if (line.startsWith('[') && line.endsWith(']')) {
      this.handleInfoResponse(line);
      return;
    }

    // Generic message
    this.emit('message', line);
  }

  /**
   * Parse grblHAL status line with extended fields
   */
  parseStatusLine(line) {
    try {
      const status = this.parseGrblHALStatus(line);
      
      // Update our internal status
      Object.assign(this.lastStatus, status);
      this.lastStatus.timestamp = Date.now();
      this.lastStatus.raw = line;

      // Emit status update
      this.emit('status', this.lastStatus);

    } catch (error) {
      log.warn('Failed to parse status line:', line, error);
    }
  }

  /**
   * Parse grblHAL status with tolerance for unknown fields
   */
  parseGrblHALStatus(line) {
    const status = new DeviceStatus();
    
    // Remove brackets and split by pipe
    const content = line.slice(1, -1); // Remove < and >
    const sections = content.split('|');
    
    // First section is always the state
    if (sections.length > 0) {
      const stateParts = sections[0].split(':');
      status.state = stateParts[0];
      if (stateParts.length > 1) {
        status.subState = parseInt(stateParts[1], 10) || 0;
      }
    }

    // Parse remaining sections
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const colonIndex = section.indexOf(':');
      
      if (colonIndex === -1) continue;
      
      const key = section.substring(0, colonIndex);
      const values = section.substring(colonIndex + 1).split(',');

      switch (key) {
        case 'MPos': // Machine position
          status.position.machine = this.parseAxisValues(values);
          break;
          
        case 'WPos': // Work position
          status.position.work = this.parseAxisValues(values);
          break;
          
        case 'WCO': // Work coordinate offset
          status.workCoordinateOffset = this.parseAxisValues(values);
          break;
          
        case 'FS': // Feed and spindle
          if (values.length >= 2) {
            status.feed.rate = parseFloat(values[0]) || 0;
            status.spindle.rpm = parseFloat(values[1]) || 0;
          }
          break;
          
        case 'Pn': // Pin states (grblHAL extended)
          status.pins = this.parseGrblHALPinStates(values[0] || '');
          break;
          
        case 'Ov': // Override values
          if (values.length >= 3) {
            status.feed.override = parseInt(values[0], 10) || 100;
            status.spindle.override = parseInt(values[2], 10) || 100;
          }
          break;
          
        case 'A': // Accessory state (spindle/coolant)
          this.parseAccessoryState(status, values[0] || '');
          break;
          
        case 'Bf': // Buffer state
          if (values.length >= 2) {
            status.buffer = {
              planner: parseInt(values[0], 10) || 0,
              rx: parseInt(values[1], 10) || 0
            };
            
            // Update our buffer tracking
            this.currentBufferUsage = this.bufferSize - status.buffer.rx;
          }
          break;
          
        default:
          // Unknown field - store in extended data for tolerance
          if (!status.extended) {
            status.extended = {};
          }
          status.extended[key] = values;
          log.debug(`Unknown status field: ${key}:${values.join(',')}`);
          break;
      }
    }

    // Calculate work position if not provided
    if (!status.position.work.x && status.position.machine.x !== undefined && status.workCoordinateOffset.x !== undefined) {
      status.position.work = {
        x: status.position.machine.x - status.workCoordinateOffset.x,
        y: status.position.machine.y - status.workCoordinateOffset.y,
        z: status.position.machine.z - status.workCoordinateOffset.z
      };
    }

    return status;
  }

  /**
   * Parse axis values (x,y,z,a,b,c)
   */
  parseAxisValues(values) {
    const axes = ['x', 'y', 'z', 'a', 'b', 'c'];
    const result = {};
    
    for (let i = 0; i < values.length && i < axes.length; i++) {
      result[axes[i]] = parseFloat(values[i]) || 0;
    }
    
    return result;
  }

  /**
   * Parse grblHAL extended pin states
   * grblHAL extends standard Grbl pin reporting
   */
  parseGrblHALPinStates(pinString) {
    const pins = {};
    
    for (const char of pinString) {
      switch (char) {
        case 'X':
          pins[PIN_STATES.X_LIMIT_MIN] = true;
          break;
        case 'Y':
          pins[PIN_STATES.Y_LIMIT_MIN] = true;
          break;
        case 'Z':
          pins[PIN_STATES.Z_LIMIT_MIN] = true;
          break;
        case 'P':
          pins[PIN_STATES.PROBE] = true;
          break;
        case 'D':
          pins[PIN_STATES.DOOR] = true;
          break;
        case 'H':
          pins[PIN_STATES.HOLD] = true;
          break;
        case 'R':
          pins[PIN_STATES.RESET] = true;
          break;
        case 'S':
          pins[PIN_STATES.CYCLE_START] = true;
          break;
        case 'E':
          pins[PIN_STATES.ESTOP] = true;
          break;
        // grblHAL specific extensions
        case 'A':
          pins[PIN_STATES.A_LIMIT] = true;
          break;
        case 'B':
          pins[PIN_STATES.B_LIMIT] = true;
          break;
        case 'C':
          pins[PIN_STATES.C_LIMIT] = true;
          break;
        default:
          // Unknown pin state - log but don't fail
          log.debug(`Unknown pin state character: ${char}`);
          break;
      }
    }
    
    return pins;
  }

  /**
   * Parse accessory state (spindle/coolant)
   */
  parseAccessoryState(status, accessoryString) {
    for (const char of accessoryString) {
      switch (char) {
        case 'S':
          status.spindle.direction = 'CW';
          status.spindle.enabled = true;
          break;
        case 'C':
          status.spindle.direction = 'CCW';
          status.spindle.enabled = true;
          break;
        case 'F':
          status.coolant = status.coolant || {};
          status.coolant.flood = true;
          break;
        case 'M':
          status.coolant = status.coolant || {};
          status.coolant.mist = true;
          break;
      }
    }
  }

  /**
   * Handle OK response from controller
   */
  handleOkResponse() {
    this.receivedResponses++;
    
    // Continue processing stream queue
    this.processStreamQueue();
    
    this.emit('response', { type: 'ok' });
  }

  /**
   * Handle error response from controller
   */
  handleErrorResponse(line) {
    const match = line.match(/error:(\d+)/);
    const errorCode = match ? parseInt(match[1], 10) : null;
    
    this.receivedResponses++;
    
    const error = {
      type: 'error',
      code: errorCode,
      message: line
    };

    this.emit('error', error);
    this.emit('response', error);
    
    // Continue processing after error
    this.processStreamQueue();
  }

  /**
   * Handle alarm response from controller
   */
  handleAlarmResponse(line) {
    const match = line.match(/ALARM:(\d+)/);
    const alarmCode = match ? parseInt(match[1], 10) : null;
    
    const alarm = {
      type: 'alarm',
      code: alarmCode,
      message: line
    };

    this.emit('alarm', alarm);
    this.emit('response', alarm);
    
    // Stop streaming on alarm
    this.streamQueue = [];
    this.isStreaming = false;
  }

  /**
   * Handle setting response ($0=10)
   */
  handleSettingResponse(line) {
    const match = line.match(/^\$(\d+)=(.+)$/);
    if (match) {
      const setting = {
        type: 'setting',
        parameter: match[1],
        value: match[2]
      };
      
      this.emit('setting', setting);
    }
  }

  /**
   * Handle info response ([VER:...])
   */
  handleInfoResponse(line) {
    this.emit('info', { message: line });
    
    // Check if this is version info to confirm grblHAL
    if (line.includes('grblHAL') || line.includes('HAL')) {
      log.info('Confirmed grblHAL controller:', line);
    }
  }

  /**
   * Handle connection errors
   */
  handleError(error) {
    log.error('Connection error:', error);
    this.emit('error', { message: error.message });
  }

  /**
   * Handle disconnection
   */
  handleDisconnection() {
    if (this.isConnected) {
      log.info('Device disconnected unexpectedly');
      this.disconnect();
    }
  }

  /**
   * Start periodic status updates
   */
  startStatusUpdates() {
    if (this.statusInterval) {
      return;
    }

    this.statusInterval = setInterval(() => {
      if (this.isConnected) {
        this.sendCommand('?');
      }
    }, this.statusIntervalTime);
  }

  /**
   * Stop periodic status updates
   */
  stopStatusUpdates() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
  }

  /**
   * Get current device status
   */
  getStatus() {
    return { ...this.lastStatus };
  }

  /**
   * Get device configuration ($ parameters)
   */
  async getConfig() {
    return new Promise((resolve) => {
      const settings = {};
      const timeout = setTimeout(() => {
        resolve(settings);
      }, 5000);

      const settingHandler = (setting) => {
        settings[`$${setting.parameter}`] = setting.value;
      };

      this.on('setting', settingHandler);
      
      // Wait for all settings, then resolve
      const responseHandler = (response) => {
        if (response.type === 'ok') {
          // Settings dump complete
          clearTimeout(timeout);
          this.off('setting', settingHandler);
          this.off('response', responseHandler);
          resolve(settings);
        }
      };

      this.on('response', responseHandler);
      this.sendCommand('$$');
    });
  }

  /**
   * Apply device configuration
   */
  async applyConfig(config) {
    try {
      for (const [key, value] of Object.entries(config)) {
        if (key.startsWith('$')) {
          const command = `${key}=${value}`;
          await this.sendGCode(command);
        }
      }
      return true;
    } catch (error) {
      log.error('Failed to apply configuration:', error);
      return false;
    }
  }
}