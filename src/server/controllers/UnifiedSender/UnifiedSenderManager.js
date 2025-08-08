import { DeviceProfile, CONNECTION_TYPES } from './types';
import { SimulationAdapter } from './SimulationAdapter';
import { LegacyAdapter } from './LegacyAdapter';
import { GrblHALAdapter } from './GrblHALAdapter';
import logger from '../../lib/logger';

const log = logger('service:unified-sender');

/**
 * Unified Sender Manager
 * Manages device connections and provides a unified interface for different controllers
 */
export class UnifiedSenderManager {
  constructor(cncEngine) {
    this.cncEngine = cncEngine;
    this.activeAdapter = null;
    this.profiles = new Map();
    this.listeners = new Map();
    this.defaultProfile = new DeviceProfile({
      name: 'Default Simulation',
      type: 'simulation',
      connection: {
        type: CONNECTION_TYPES.SIMULATION
      }
    });
  }

  /**
   * Initialize the unified sender system
   */
  initialize() {
    log.info('Initializing Unified Sender Manager');
    this.loadProfiles();
  }

  /**
   * Connect to a device using the specified profile
   * @param {string|DeviceProfile} profileOrId - Profile ID or profile object
   * @param {Object} options - Connection options
   * @returns {Promise<boolean>} - Success status
   */
  async connect(profileOrId, options = {}) {
    try {
      // Disconnect existing connection
      if (this.activeAdapter) {
        await this.disconnect();
      }

      // Get profile
      let profile;
      if (typeof profileOrId === 'string') {
        profile = this.profiles.get(profileOrId) || this.defaultProfile;
      } else {
        profile = profileOrId;
      }

      // Validate profile
      const validation = profile.validate();
      if (!validation.valid) {
        throw new Error(`Invalid profile: ${validation.errors.join(', ')}`);
      }

      // Create appropriate adapter
      this.activeAdapter = this.createAdapter(profile);
      this.setupAdapterListeners();

      // Connect
      await this.activeAdapter.connect(options);

      log.info(`Connected to device using profile: ${profile.name}`);
      this.emit('connected', { profile: profile.name });

      return true;
    } catch (error) {
      log.error('Connection failed:', error.message);
      this.emit('error', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from the current device
   * @returns {Promise<boolean>} - Success status
   */
  async disconnect() {
    if (!this.activeAdapter) {
      return true;
    }

    try {
      this.removeAdapterListeners();
      await this.activeAdapter.disconnect();
      this.activeAdapter = null;

      log.info('Disconnected from device');
      this.emit('disconnected');

      return true;
    } catch (error) {
      log.error('Disconnection failed:', error.message);
      this.emit('error', error.message);
      throw error;
    }
  }

  /**
   * Send G-code to the active device
   * @param {string} gcode - G-code command
   * @returns {Promise<boolean>} - Success status
   */
  async sendGCode(gcode) {
    if (!this.activeAdapter) {
      throw new Error('No active connection');
    }

    return this.activeAdapter.sendGCode(gcode);
  }

  /**
   * Get current device status
   * @returns {Object|null} - Status object or null if not connected
   */
  getStatus() {
    return this.activeAdapter ? this.activeAdapter.getStatus() : null;
  }

  /**
   * Get device configuration
   * @returns {Promise<Object>} - Configuration object
   */
  async getConfig() {
    if (!this.activeAdapter) {
      throw new Error('No active connection');
    }

    return this.activeAdapter.getConfig();
  }

  /**
   * Apply device configuration
   * @param {Object} config - Configuration to apply
   * @returns {Promise<boolean>} - Success status
   */
  async applyConfig(config) {
    if (!this.activeAdapter) {
      throw new Error('No active connection');
    }

    return this.activeAdapter.applyConfig(config);
  }

  /**
   * List files on device
   * @param {string} path - Directory path
   * @returns {Promise<Array>} - List of files
   */
  async listFiles(path = '/') {
    if (!this.activeAdapter) {
      throw new Error('No active connection');
    }

    return this.activeAdapter.listFiles(path);
  }

  /**
   * Upload file to device
   * @param {string} path - File path
   * @param {Buffer|string} content - File content
   * @returns {Promise<boolean>} - Success status
   */
  async uploadFile(path, content) {
    if (!this.activeAdapter) {
      throw new Error('No active connection');
    }

    return this.activeAdapter.uploadFile(path, content);
  }

  /**
   * Check if connected
   * @returns {boolean} - Connection status
   */
  isConnected() {
    return this.activeAdapter && this.activeAdapter.isConnected;
  }

  /**
   * Get current adapter type
   * @returns {string|null} - Adapter type or null if not connected
   */
  getAdapterType() {
    if (!this.activeAdapter) {
      return null;
    }

    return this.activeAdapter.constructor.name;
  }

  /**
   * Create device adapter based on profile
   * @param {DeviceProfile} profile - Device profile
   * @returns {DeviceAdapter} - Device adapter instance
   */
  createAdapter(profile) {
    // For simulation, always use simulation adapter
    if (profile.connection.type === CONNECTION_TYPES.SIMULATION) {
      return new SimulationAdapter(profile);
    }

    // For real connections, choose based on controller type
    switch (profile.type.toLowerCase()) {
      case 'grblhal':
        if (profile.connection.type === CONNECTION_TYPES.SERIAL ||
            profile.connection.type === CONNECTION_TYPES.TELNET) {
          return new GrblHALAdapter(profile);
        }
        break;

      case 'grbl':
      case 'marlin':
      case 'smoothie':
      case 'tinyg':
      case 'g2core':
        // Use legacy adapter for existing controllers
        return new LegacyAdapter(profile, this.cncEngine);

      default:
        log.warn(`Unknown controller type: ${profile.type}, falling back to legacy adapter`);
        return new LegacyAdapter(profile, this.cncEngine);
    }

    throw new Error(`Unsupported combination: ${profile.type} with ${profile.connection.type}`);
  }

  /**
   * Setup event listeners for the active adapter
   */
  setupAdapterListeners() {
    if (!this.activeAdapter) {
      return;
    }

    // Forward adapter events to our listeners
    this.activeAdapter.on('status', (status) => {
      this.emit('status', status);
    });

    this.activeAdapter.on('message', (message) => {
      this.emit('message', message);
    });

    this.activeAdapter.on('error', (error) => {
      this.emit('error', error);
    });

    this.activeAdapter.on('alarm', (alarm) => {
      this.emit('alarm', alarm);
    });

    this.activeAdapter.on('connected', (data) => {
      this.emit('adapter:connected', data);
    });

    this.activeAdapter.on('disconnected', () => {
      this.emit('adapter:disconnected');
    });
  }

  /**
   * Remove adapter event listeners
   */
  removeAdapterListeners() {
    if (!this.activeAdapter) {
      return;
    }

    // Remove all listeners (simplified approach)
    this.activeAdapter.listeners.clear();
  }

  /**
   * Load profiles from configuration
   */
  loadProfiles() {
    // Add default simulation profile
    this.profiles.set('simulation', this.defaultProfile);

    // TODO: Load user-defined profiles from configuration
    // This would be implemented in later phases
  }

  /**
   * Save profiles to configuration
   */
  saveProfiles() {
    // TODO: Save profiles to persistent storage
    // This would be implemented in later phases
  }

  /**
   * Add profile
   * @param {DeviceProfile} profile - Profile to add
   * @returns {string} - Profile ID
   */
  addProfile(profile) {
    const id = profile.name.toLowerCase().replace(/\s+/g, '-');
    this.profiles.set(id, profile);
    this.saveProfiles();
    return id;
  }

  /**
   * Get profile by ID
   * @param {string} id - Profile ID
   * @returns {DeviceProfile|null} - Profile or null if not found
   */
  getProfile(id) {
    return this.profiles.get(id) || null;
  }

  /**
   * Get all profiles
   * @returns {Array} - Array of profiles with IDs
   */
  getAllProfiles() {
    return Array.from(this.profiles.entries()).map(([id, profile]) => ({
      id,
      profile
    }));
  }

  /**
   * Remove profile
   * @param {string} id - Profile ID
   * @returns {boolean} - Success status
   */
  removeProfile(id) {
    if (id === 'simulation') {
      return false; // Cannot remove default simulation profile
    }

    const removed = this.profiles.delete(id);
    if (removed) {
      this.saveProfiles();
    }
    return removed;
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
          log.error(`Error in event listener for ${event}:`, err);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.activeAdapter) {
      await this.disconnect();
    }
    this.listeners.clear();
    this.profiles.clear();
  }
}
