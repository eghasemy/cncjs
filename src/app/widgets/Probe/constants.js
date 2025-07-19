import constants from 'namespace-constants';

export const {
  MODAL_NONE,
  MODAL_PREVIEW
} = constants('widgets/Probe', [
  'MODAL_NONE',
  'MODAL_PREVIEW'
]);

// Probe Types (removed basic, added separate external/internal edge)
export const PROBE_TYPE_CONFIG = 'config';
export const PROBE_TYPE_EXTERNAL_EDGE = 'external_edge';
export const PROBE_TYPE_INTERNAL_EDGE = 'internal_edge';
export const PROBE_TYPE_CENTER = 'center';
export const PROBE_TYPE_ROTATION = 'rotation';
export const PROBE_TYPE_HEIGHT_MAP = 'height_map';

// External Edge Probe Directions
export const EXTERNAL_EDGE_X_POSITIVE = 'x_positive';
export const EXTERNAL_EDGE_X_NEGATIVE = 'x_negative';
export const EXTERNAL_EDGE_Y_POSITIVE = 'y_positive';
export const EXTERNAL_EDGE_Y_NEGATIVE = 'y_negative';
export const EXTERNAL_EDGE_Z_NEGATIVE = 'z_negative';

// External Corner Probe Directions
export const EXTERNAL_CORNER_X_POSITIVE_Y_POSITIVE = 'x_positive_y_positive';
export const EXTERNAL_CORNER_X_POSITIVE_Y_NEGATIVE = 'x_positive_y_negative';
export const EXTERNAL_CORNER_X_NEGATIVE_Y_POSITIVE = 'x_negative_y_positive';
export const EXTERNAL_CORNER_X_NEGATIVE_Y_NEGATIVE = 'x_negative_y_negative';

// Internal Edge Probe Directions
export const INTERNAL_EDGE_X_POSITIVE = 'x_positive';
export const INTERNAL_EDGE_X_NEGATIVE = 'x_negative';
export const INTERNAL_EDGE_Y_POSITIVE = 'y_positive';
export const INTERNAL_EDGE_Y_NEGATIVE = 'y_negative';

// Internal Corner Probe Directions
export const INTERNAL_CORNER_X_POSITIVE_Y_POSITIVE = 'x_positive_y_positive';
export const INTERNAL_CORNER_X_POSITIVE_Y_NEGATIVE = 'x_positive_y_negative';
export const INTERNAL_CORNER_X_NEGATIVE_Y_POSITIVE = 'x_negative_y_positive';
export const INTERNAL_CORNER_X_NEGATIVE_Y_NEGATIVE = 'x_negative_y_negative';

// Center Probe Types
export const CENTER_PROBE_EXTERNAL = 'external';
export const CENTER_PROBE_INTERNAL = 'internal';

// Rotation Edges
export const ROTATION_EDGE_LEFT = 'left';
export const ROTATION_EDGE_RIGHT = 'right';
export const ROTATION_EDGE_TOP = 'top';
export const ROTATION_EDGE_BOTTOM = 'bottom';

// Rotation Methods
export const ROTATION_METHOD_G68 = 'g68';
export const ROTATION_METHOD_MATRIX = 'matrix';
