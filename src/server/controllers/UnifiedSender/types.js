/**
 * Type definitions and interfaces for the Unified Sender system
 */

// Device connection types
export const CONNECTION_TYPES = {
  SERIAL: 'serial',
  TELNET: 'telnet',
  HTTP: 'http',
  SIMULATION: 'simulation'
};

// Controller states
export const CONTROLLER_STATES = {
  IDLE: 'Idle',
  RUN: 'Run',
  HOLD: 'Hold',
  JMOG: 'Jog',
  ALARM: 'Alarm',
  DOOR: 'Door',
  CHECK: 'Check',
  HOME: 'Home',
  SLEEP: 'Sleep'
};

// Pin states for inputs monitoring
export const PIN_STATES = {
  X_LIMIT_MIN: 'xMin',
  X_LIMIT_MAX: 'xMax',
  Y_LIMIT_MIN: 'yMin',
  Y_LIMIT_MAX: 'yMax',
  Z_LIMIT_MIN: 'zMin',
  Z_LIMIT_MAX: 'zMax',
  A_LIMIT: 'aLimit',
  B_LIMIT: 'bLimit',
  C_LIMIT: 'cLimit',
  PROBE: 'probe',
  DOOR: 'door',
  HOLD: 'hold',
  CYCLE_START: 'cycleStart',
  ESTOP: 'estop',
  RESET: 'reset'
};

/**
 * Base device adapter interface that all unified sender adapters must implement
 */
export class DeviceAdapter {
  constructor(profile) {
    this.profile = profile;
    this.isConnected = false;
    this.listeners = new Map();
  }

  /**
   * Connect to the device
   * @param {Object} options - Connection options
   * @returns {Promise<boolean>} - Success status
   */
  async connect(options) {
    throw new Error('connect() must be implemented by subclass');
  }

  /**
   * Disconnect from the device
   * @returns {Promise<boolean>} - Success status
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by subclass');
  }

  /**
   * Send G-code command to the device
   * @param {string} gcode - G-code command
   * @returns {Promise<boolean>} - Success status
   */
  async sendGCode(gcode) {
    throw new Error('sendGCode() must be implemented by subclass');
  }

  /**
   * Get current device status
   * @returns {Object} - Status object with state, position, pins, etc.
   */
  getStatus() {
    throw new Error('getStatus() must be implemented by subclass');
  }

  /**
   * Get device configuration
   * @returns {Promise<Object>} - Configuration object
   */
  async getConfig() {
    throw new Error('getConfig() must be implemented by subclass');
  }

  /**
   * Apply device configuration
   * @param {Object} config - Configuration to apply
   * @returns {Promise<boolean>} - Success status
   */
  async applyConfig(config) {
    throw new Error('applyConfig() must be implemented by subclass');
  }

  /**
   * List files on device (if supported)
   * @param {string} path - Directory path
   * @returns {Promise<Array>} - List of files
   */
  async listFiles(path = '/') {
    return []; // Default implementation returns empty array
  }

  /**
   * Upload file to device (if supported)
   * @param {string} path - File path
   * @param {Buffer|string} content - File content
   * @returns {Promise<boolean>} - Success status
   */
  async uploadFile(path, content) {
    return false; // Default implementation returns false
  }

  /**
   * Add event listener
   * @param {string} event - Event name
   * @param {function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {function} callback - Callback function
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * Emit event to listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err);
        }
      });
    }
  }
}

/**
 * Device profile structure
 */
export class DeviceProfile {
  constructor(config = {}) {
    this.name = config.name || 'Default Profile';
    this.type = config.type || 'grbl'; // grbl, grblhal, fluidnc, marlin, etc.
    this.connection = {
      type: config.connection?.type || CONNECTION_TYPES.SERIAL,
      port: config.connection?.port || '',
      baudRate: config.connection?.baudRate || 115200,
      host: config.connection?.host || '',
      httpUrl: config.connection?.httpUrl || ''
    };
    this.settings = config.settings || {};
  }

  /**
   * Validate profile configuration
   * @returns {Object} - Validation result with valid flag and errors array
   */
  validate() {
    const errors = [];

    if (!this.name) {
      errors.push('Profile name is required');
    }

    if (!this.type) {
      errors.push('Controller type is required');
    }

    if (this.connection.type === CONNECTION_TYPES.SERIAL && !this.connection.port) {
      errors.push('Serial port is required for serial connection');
    }

    if (this.connection.type === CONNECTION_TYPES.TELNET && !this.connection.host) {
      errors.push('Host is required for telnet connection');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

/**
 * Status object structure returned by device adapters
 */
export class DeviceStatus {
  constructor() {
    this.state = CONTROLLER_STATES.IDLE;
    this.subState = 0;
    this.position = {
      work: { x: 0, y: 0, z: 0 },
      machine: { x: 0, y: 0, z: 0 }
    };
    this.workCoordinateOffset = { x: 0, y: 0, z: 0 };
    this.feed = {
      rate: 0,
      override: 100
    };
    this.spindle = {
      rpm: 0,
      override: 100,
      direction: 'CW',
      enabled: false
    };
    this.pins = {};
    this.modal = {};
    this.parser = {};
    this.coolant = {
      flood: false,
      mist: false
    };
    this.buffer = {
      planner: 0,
      rx: 0
    };
    this.extended = {}; // For unknown/optional fields
    this.raw = '';
    this.timestamp = Date.now();
  }
}
