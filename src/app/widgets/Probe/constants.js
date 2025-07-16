import constants from 'namespace-constants';

export const {
  MODAL_NONE,
  MODAL_PREVIEW
} = constants('widgets/Probe', [
  'MODAL_NONE',
  'MODAL_PREVIEW'
]);

// Probe Types
export const PROBE_TYPE_BASIC = 'basic';
export const PROBE_TYPE_EDGE = 'edge';
export const PROBE_TYPE_CENTER = 'center';
export const PROBE_TYPE_ROTATION = 'rotation';
export const PROBE_TYPE_HEIGHT_MAP = 'height_map';

// Edge Probe Types
export const EDGE_PROBE_EXTERNAL_X_POSITIVE = 'external_x_positive';
export const EDGE_PROBE_EXTERNAL_X_NEGATIVE = 'external_x_negative';
export const EDGE_PROBE_EXTERNAL_Y_POSITIVE = 'external_y_positive';
export const EDGE_PROBE_EXTERNAL_Y_NEGATIVE = 'external_y_negative';
export const EDGE_PROBE_INTERNAL_X_POSITIVE = 'internal_x_positive';
export const EDGE_PROBE_INTERNAL_X_NEGATIVE = 'internal_x_negative';
export const EDGE_PROBE_INTERNAL_Y_POSITIVE = 'internal_y_positive';
export const EDGE_PROBE_INTERNAL_Y_NEGATIVE = 'internal_y_negative';

// Center Probe Types
export const CENTER_PROBE_EXTERNAL = 'external';
export const CENTER_PROBE_INTERNAL = 'internal';
