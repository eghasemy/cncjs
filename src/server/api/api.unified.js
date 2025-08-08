import { ensureBoolean, ensureString } from 'ensure-type';
import settings from '../config/settings';
import config from '../services/configstore';
import { UnifiedSenderManager } from '../controllers/UnifiedSender';
import logger from '../lib/logger';

const log = logger('api:unified');

let unifiedSenderManager = null;

/**
 * Initialize unified sender if feature is enabled
 */
const initializeUnifiedSender = (cncEngine) => {
  const enableUnifiedSender = ensureBoolean(
    config.get('enableUnifiedSender', settings.enableUnifiedSender)
  );

  if (enableUnifiedSender && !unifiedSenderManager) {
    log.info('Initializing Unified Sender');
    unifiedSenderManager = new UnifiedSenderManager(cncEngine);
    unifiedSenderManager.initialize();
  }

  return unifiedSenderManager;
};

/**
 * Check if unified sender is enabled and available
 */
const checkUnifiedSenderEnabled = (req, res, next) => {
  const enableUnifiedSender = ensureBoolean(
    config.get('enableUnifiedSender', settings.enableUnifiedSender)
  );

  if (!enableUnifiedSender) {
    return res.status(404).json({
      success: false,
      error: 'Unified Sender feature is not enabled'
    });
  }

  if (!unifiedSenderManager) {
    return res.status(500).json({
      success: false,
      error: 'Unified Sender not initialized'
    });
  }

  next();
};

/**
 * GET /api/unified/status
 * Get unified sender status and feature availability
 */
export const getStatus = (req, res) => {
  const enableUnifiedSender = ensureBoolean(
    config.get('enableUnifiedSender', settings.enableUnifiedSender)
  );

  res.json({
    success: true,
    data: {
      enabled: enableUnifiedSender,
      available: !!unifiedSenderManager,
      connected: unifiedSenderManager ? unifiedSenderManager.isConnected() : false,
      adapterType: unifiedSenderManager ? unifiedSenderManager.getAdapterType() : null,
      deviceStatus: unifiedSenderManager ? unifiedSenderManager.getStatus() : null
    }
  });
};

/**
 * POST /api/unified/connect
 * Connect to a device using specified profile
 */
export const connect = [checkUnifiedSenderEnabled, async (req, res) => {
  try {
    const { profileId = 'simulation', options = {} } = req.body;

    await unifiedSenderManager.connect(profileId, options);

    res.json({
      success: true,
      message: 'Connected successfully'
    });

  } catch (error) {
    log.error('Connection error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}];

/**
 * POST /api/unified/disconnect
 * Disconnect from current device
 */
export const disconnect = [checkUnifiedSenderEnabled, async (req, res) => {
  try {
    await unifiedSenderManager.disconnect();

    res.json({
      success: true,
      message: 'Disconnected successfully'
    });

  } catch (error) {
    log.error('Disconnection error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}];

/**
 * POST /api/unified/send
 * Send G-code command to device
 */
export const sendGCode = [checkUnifiedSenderEnabled, async (req, res) => {
  try {
    const { gcode } = req.body;

    if (!gcode) {
      return res.status(400).json({
        success: false,
        error: 'G-code is required'
      });
    }

    await unifiedSenderManager.sendGCode(ensureString(gcode));

    res.json({
      success: true,
      message: 'G-code sent successfully'
    });

  } catch (error) {
    log.error('Send G-code error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}];

/**
 * GET /api/unified/config
 * Get device configuration
 */
export const getConfig = [checkUnifiedSenderEnabled, async (req, res) => {
  try {
    const config = await unifiedSenderManager.getConfig();

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    log.error('Get config error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}];

/**
 * POST /api/unified/config
 * Apply device configuration
 */
export const applyConfig = [checkUnifiedSenderEnabled, async (req, res) => {
  try {
    const { config } = req.body;

    if (!config) {
      return res.status(400).json({
        success: false,
        error: 'Configuration is required'
      });
    }

    await unifiedSenderManager.applyConfig(config);

    res.json({
      success: true,
      message: 'Configuration applied successfully'
    });

  } catch (error) {
    log.error('Apply config error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}];

/**
 * GET /api/unified/files
 * List files on device
 */
export const listFiles = [checkUnifiedSenderEnabled, async (req, res) => {
  try {
    const { path = '/' } = req.query;
    const files = await unifiedSenderManager.listFiles(ensureString(path));

    res.json({
      success: true,
      data: files
    });

  } catch (error) {
    log.error('List files error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}];

/**
 * POST /api/unified/files/upload
 * Upload file to device
 */
export const uploadFile = [checkUnifiedSenderEnabled, async (req, res) => {
  try {
    const { path, content } = req.body;

    if (!path || !content) {
      return res.status(400).json({
        success: false,
        error: 'Path and content are required'
      });
    }

    const success = await unifiedSenderManager.uploadFile(
      ensureString(path),
      content
    );

    if (success) {
      res.json({
        success: true,
        message: 'File uploaded successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'File upload not supported by current adapter'
      });
    }

  } catch (error) {
    log.error('Upload file error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}];

/**
 * GET /api/unified/profiles
 * Get all device profiles
 */
export const getProfiles = [checkUnifiedSenderEnabled, (req, res) => {
  try {
    const profiles = unifiedSenderManager.getAllProfiles();

    res.json({
      success: true,
      data: profiles
    });

  } catch (error) {
    log.error('Get profiles error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}];

/**
 * POST /api/unified/profiles
 * Create new device profile
 */
export const createProfile = [checkUnifiedSenderEnabled, (req, res) => {
  try {
    const { profile } = req.body;

    if (!profile) {
      return res.status(400).json({
        success: false,
        error: 'Profile is required'
      });
    }

    // TODO: Implement profile creation
    // This would be part of later phases

    res.json({
      success: false,
      error: 'Profile creation not yet implemented'
    });

  } catch (error) {
    log.error('Create profile error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}];

// Export initialization function for use by CNCEngine
export { initializeUnifiedSender };