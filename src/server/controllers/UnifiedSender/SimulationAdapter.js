import { DeviceAdapter, DeviceStatus, CONTROLLER_STATES, PIN_STATES } from './types';

/**
 * Simulation adapter for offline development and testing
 * Simulates a grblHAL controller with realistic responses
 */
export class SimulationAdapter extends DeviceAdapter {
  constructor(profile) {
    super(profile);
    this.status = new DeviceStatus();
    this.isRunning = false;
    this.statusInterval = null;
    this.statusCounter = 0;
    this.simulatedParams = new Map([
      ['$0', '10'], // Step pulse time, µs
      ['$1', '25'], // Step idle delay, ms
      ['$2', '0'], // Step pulse invert
      ['$3', '0'], // Step direction invert
      ['$4', '0'], // Invert step enable pin
      ['$5', '0'], // Invert limit pins
      ['$6', '0'], // Invert probe pin
      ['$10', '1'], // Status report options
      ['$11', '0.010'], // Junction deviation, mm
      ['$12', '0.002'], // Arc tolerance, mm
      ['$13', '0'], // Report in inches
      ['$20', '0'], // Soft limits enable
      ['$21', '0'], // Hard limits enable
      ['$22', '0'], // Homing cycle enable
      ['$23', '0'], // Homing direction invert
      ['$24', '25.000'], // Homing locate feed rate, mm/min
      ['$25', '500.000'], // Homing search seek rate, mm/min
      ['$26', '250'], // Homing switch debounce delay, ms
      ['$27', '1.000'], // Homing switch pull-off distance, mm
      ['$30', '1000'], // Maximum spindle speed, RPM
      ['$31', '0'], // Minimum spindle speed, RPM
      ['$32', '0'], // Laser-mode enable
      ['$100', '250.000'], // X-axis travel resolution, step/mm
      ['$101', '250.000'], // Y-axis travel resolution, step/mm
      ['$102', '250.000'], // Z-axis travel resolution, step/mm
      ['$110', '500.000'], // X-axis maximum rate, mm/min
      ['$111', '500.000'], // Y-axis maximum rate, mm/min
      ['$112', '500.000'], // Z-axis maximum rate, mm/min
      ['$120', '10.000'], // X-axis acceleration, mm/sec^2
      ['$121', '10.000'], // Y-axis acceleration, mm/sec^2
      ['$122', '10.000'], // Z-axis acceleration, mm/sec^2
      ['$130', '200.000'], // X-axis maximum travel, mm
      ['$131', '200.000'], // Y-axis maximum travel, mm
      ['$132', '200.000'] // Z-axis maximum travel, mm
    ]);
  }

  async connect(options = {}) {
    if (this.isConnected) {
      return true;
    }

    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 500));

    this.isConnected = true;
    this.startStatusUpdates();

    // Emit connection events
    this.emit('connected', { port: 'simulation', baudRate: 115200 });
    this.emit('message', 'Grbl 1.1h [\'$\' for help]');

    return true;
  }

  async disconnect() {
    if (!this.isConnected) {
      return true;
    }

    this.stopStatusUpdates();
    this.isConnected = false;
    this.isRunning = false;

    this.emit('disconnected');
    return true;
  }

  async sendGCode(gcode) {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }

    const trimmedGcode = gcode.trim();
    
    // Handle special commands
    if (trimmedGcode === '?') {
      // Status request - will be handled by next status update
      return true;
    }

    if (trimmedGcode.startsWith('$$')) {
      // Parameter dump
      this.emitParameterDump();
      return true;
    }

    if (trimmedGcode.match(/^\$\d+=/)) {
      // Parameter setting
      const [param, value] = trimmedGcode.split('=');
      this.simulatedParams.set(param, value);
      this.emit('message', 'ok');
      return true;
    }

    if (trimmedGcode === '$H') {
      // Homing cycle
      this.simulateHomingCycle();
      return true;
    }

    if (trimmedGcode === '$X') {
      // Kill alarm lock
      if (this.status.state === CONTROLLER_STATES.ALARM) {
        this.status.state = CONTROLLER_STATES.IDLE;
        this.emit('message', 'ok');
      }
      return true;
    }

    if (trimmedGcode.startsWith('!')) {
      // Feed hold
      if (this.status.state === CONTROLLER_STATES.RUN) {
        this.status.state = CONTROLLER_STATES.HOLD;
        this.emit('message', 'ok');
      }
      return true;
    }

    if (trimmedGcode.startsWith('~')) {
      // Resume
      if (this.status.state === CONTROLLER_STATES.HOLD) {
        this.status.state = CONTROLLER_STATES.RUN;
        this.emit('message', 'ok');
      }
      return true;
    }

    // Simulate G-code execution
    this.simulateGCodeExecution(trimmedGcode);
    return true;
  }

  getStatus() {
    return { ...this.status };
  }

  async getConfig() {
    const config = {};
    for (const [key, value] of this.simulatedParams) {
      config[key] = value;
    }
    return config;
  }

  async applyConfig(config) {
    for (const [key, value] of Object.entries(config)) {
      if (key.startsWith('$')) {
        this.simulatedParams.set(key, String(value));
      }
    }
    return true;
  }

  startStatusUpdates() {
    if (this.statusInterval) {
      return;
    }

    this.statusInterval = setInterval(() => {
      this.updateStatus();
      this.emitStatus();
    }, 100); // 10Hz status updates
  }

  stopStatusUpdates() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
  }

  updateStatus() {
    this.statusCounter++;
    this.status.timestamp = Date.now();

    // Simulate position changes during run
    if (this.status.state === CONTROLLER_STATES.RUN) {
      // Simulate slow movement
      const time = this.statusCounter * 0.1;
      this.status.position.work.x = Math.sin(time * 0.1) * 50;
      this.status.position.work.y = Math.cos(time * 0.1) * 50;
      this.status.position.machine.x = this.status.position.work.x + this.status.workCoordinateOffset.x;
      this.status.position.machine.y = this.status.position.work.y + this.status.workCoordinateOffset.y;
      
      this.status.feed.rate = 1000 + Math.sin(time * 0.2) * 200;
      this.status.spindle.rpm = 5000 + Math.sin(time * 0.15) * 1000;
    }

    // Simulate pin states (occasionally toggle probe for testing)
    this.status.pins = {
      [PIN_STATES.X_LIMIT_MIN]: false,
      [PIN_STATES.X_LIMIT_MAX]: false,
      [PIN_STATES.Y_LIMIT_MIN]: false,
      [PIN_STATES.Y_LIMIT_MAX]: false,
      [PIN_STATES.Z_LIMIT_MIN]: false,
      [PIN_STATES.Z_LIMIT_MAX]: false,
      [PIN_STATES.PROBE]: this.statusCounter % 200 < 10, // Briefly triggered every 20 seconds
      [PIN_STATES.DOOR]: false,
      [PIN_STATES.ESTOP]: false,
      [PIN_STATES.RESET]: false
    };
  }

  emitStatus() {
    // Generate grblHAL-style status report
    const status = this.getStatus();
    const pins = Object.entries(status.pins)
      .filter(([, active]) => active)
      .map(([pin]) => pin.charAt(0).toUpperCase())
      .join('');

    const statusLine = `<${status.state}|` +
      `MPos:${status.position.machine.x.toFixed(3)},${status.position.machine.y.toFixed(3)},${status.position.machine.z.toFixed(3)}|` +
      `WPos:${status.position.work.x.toFixed(3)},${status.position.work.y.toFixed(3)},${status.position.work.z.toFixed(3)}|` +
      `WCO:${status.workCoordinateOffset.x.toFixed(3)},${status.workCoordinateOffset.y.toFixed(3)},${status.workCoordinateOffset.z.toFixed(3)}` +
      (status.feed.rate > 0 ? `|F:${status.feed.rate.toFixed(0)}` : '') +
      (status.spindle.rpm > 0 ? `|S:${status.spindle.rpm.toFixed(0)}` : '') +
      (pins ? `|Pn:${pins}` : '') +
      `>`;

    status.raw = statusLine;
    this.emit('status', status);
  }

  emitParameterDump() {
    for (const [param, value] of this.simulatedParams) {
      this.emit('message', `${param}=${value}`);
    }
    this.emit('message', 'ok');
  }

  simulateHomingCycle() {
    this.status.state = CONTROLLER_STATES.HOME;
    this.emit('message', 'ok');

    // Simulate homing sequence
    setTimeout(() => {
      this.status.position.machine = { x: 0, y: 0, z: 0 };
      this.status.position.work = { x: 0, y: 0, z: 0 };
      this.status.workCoordinateOffset = { x: 0, y: 0, z: 0 };
      this.status.state = CONTROLLER_STATES.IDLE;
    }, 2000);
  }

  simulateGCodeExecution(gcode) {
    // Basic G-code parsing simulation
    if (gcode.match(/^[GM]\d+/i)) {
      this.emit('message', 'ok');
      
      // Start motion simulation for movement commands
      if (gcode.match(/^G[01]/i)) {
        this.status.state = CONTROLLER_STATES.RUN;
        
        // Return to idle after simulated execution time
        setTimeout(() => {
          if (this.status.state === CONTROLLER_STATES.RUN) {
            this.status.state = CONTROLLER_STATES.IDLE;
            this.status.feed.rate = 0;
          }
        }, 1000 + Math.random() * 2000);
      }
    } else if (gcode.match(/^[ST]\d+/i)) {
      // Spindle/tool commands
      this.emit('message', 'ok');
      if (gcode.startsWith('S')) {
        const rpm = parseInt(gcode.substring(1)) || 0;
        this.status.spindle.rpm = rpm;
      }
    } else {
      // Unknown command
      this.emit('error', `error:70`);
    }
  }
}