/* eslint max-len: 0 */
// FluidNC
export const FLUIDNC = 'FluidNC';

// Active State
export const FLUIDNC_ACTIVE_STATE_IDLE = 'Idle';
export const FLUIDNC_ACTIVE_STATE_RUN = 'Run';
export const FLUIDNC_ACTIVE_STATE_HOLD = 'Hold';
export const FLUIDNC_ACTIVE_STATE_DOOR = 'Door';
export const FLUIDNC_ACTIVE_STATE_HOME = 'Home';
export const FLUIDNC_ACTIVE_STATE_SLEEP = 'Sleep';
export const FLUIDNC_ACTIVE_STATE_ALARM = 'Alarm';
export const FLUIDNC_ACTIVE_STATE_CHECK = 'Check';

// Real-time Commands: ~, !, ?, and Ctrl-x (similar to GRBL)
export const FLUIDNC_REALTIME_COMMANDS = [
  '~', // Cycle Start
  '!', // Feed Hold
  '?', // Current Status
  '\x18' // Reset FluidNC (Ctrl-X)
];

// FluidNC Modal Groups (similar to GRBL)
export const FLUIDNC_MODAL_GROUPS = [
  { // Motion Mode (Defaults to G0)
    group: 'motion',
    modes: ['G0', 'G1', 'G2', 'G3', 'G38.2', 'G38.3', 'G38.4', 'G38.5', 'G80']
  },
  { // Work Coordinate System Select (Defaults to G54)
    group: 'wcs',
    modes: ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']
  },
  { // Plane Select (Defaults to G17)
    group: 'plane',
    modes: ['G17', 'G18', 'G19']
  },
  { // Units Mode (Defaults to G21)
    group: 'units',
    modes: ['G20', 'G21']
  },
  { // Distance Mode (Defaults to G90)
    group: 'distance',
    modes: ['G90', 'G91']
  },
  { // Feed Rate Mode (Defaults to G94)
    group: 'feedrate',
    modes: ['G93', 'G94']
  },
  { // Program Mode (Defaults to M0)
    group: 'program',
    modes: ['M0', 'M1', 'M2', 'M30']
  },
  { // Spindle Control (Defaults to M5)
    group: 'spindle',
    modes: ['M3', 'M4', 'M5']
  },
  { // Coolant Control (Defaults to M9)
    group: 'coolant',
    modes: ['M7', 'M8', 'M9']
  }
];

// FluidNC Error Codes (similar to GRBL, will be updated as needed)
export const FLUIDNC_ERRORS = {
  1: 'G-code words consist of a letter and a value. Letter was not found.',
  2: 'Numeric value format is not valid or missing an expected value.',
  3: 'Grbl \'$\' system command was not recognized or supported.',
  4: 'Negative value received for an expected positive value.',
  5: 'Homing cycle is not enabled via settings.',
  6: 'Minimum step pulse time must be greater than 3usec',
  7: 'EEPROM read failed. Reset and restored to default values.',
  8: 'Grbl \'$\' command cannot be used unless Grbl is IDLE. Ensures smooth operation during a job.',
  9: 'G-code locked out during alarm or jog state',
  10: 'Soft limits cannot be enabled without homing also enabled.',
  11: 'Max characters per line exceeded. Line was not processed and executed.',
  12: 'Grbl \'$\' setting value exceeds the maximum step rate supported.',
  13: 'Safety door detected as opened and door state initiated.',
  14: '(Grbl-Mega Only) Build info or startup line exceeded EEPROM line length limit.',
  15: 'Jog target exceeds machine travel. Command ignored.',
  16: 'Jog command with no \'=\' or contains prohibited g-code.',
  17: 'Laser mode requires PWM output.',
  20: 'Unsupported or invalid g-code command found in block.',
  21: 'More than one g-code command from same modal group found in block.',
  22: 'Feed rate has not yet been set or is undefined.',
  23: 'G-code command in block requires an integer value.',
  24: 'Two G-code commands that both require the use of the XYZ axis words were detected in the block.',
  25: 'A G-code word was repeated in the block.',
  26: 'A G-code command implicitly or explicitly requires XYZ axis words in the block, but none were detected.',
  27: 'N line number value is not within the valid range of 1 - 9,999,999.',
  28: 'A G-code command was sent, but is missing some required P or L value words in the line.',
  29: 'Grbl supports six work coordinate systems G54-G59. G59.1, G59.2, and G59.3 are not supported.',
  30: 'The G53 G-code command requires either a G0 seek or G1 feed motion mode to be active. A different motion was active.',
  31: 'There are unused axis words in the block and G80 motion mode cancel is active.',
  32: 'A G2 or G3 arc was commanded but there are no XYZ axis words in the selected plane to trace the arc.',
  33: 'The motion command has an invalid target. G2, G3, and G38.2 generates this error, if the arc is impossible to generate or if the probe target is the current position.',
  34: 'A G2 or G3 arc, traced with the radius definition, had a mathematical error when computing the arc geometry. Try either breaking up the arc into semi-circles or quadrants, or redefine them with the arc offset definition.',
  35: 'A G2 or G3 arc, traced with the offset definition, is missing the IJK offset word in the selected plane to trace the arc.',
  36: 'There are unused, leftover G-code words that aren\'t used by any command in the block.',
  37: 'The G43.1 dynamic tool length offset command cannot apply an offset to an axis other than its configured axis. The Grbl default axis is the Z-axis.'
};

// FluidNC Alarm Codes (similar to GRBL, will be updated as needed)
export const FLUIDNC_ALARMS = {
  1: 'Hard limit triggered. Machine position is likely lost due to sudden and immediate halt. Re-homing is highly recommended.',
  2: 'G-code motion target exceeds machine travel. Machine position safely retained. Alarm may be unlocked.',
  3: 'Reset while in motion. Grbl cannot guarantee position. Lost steps are likely. Re-homing is highly recommended.',
  4: 'Probe fail. The probe is not in the expected initial state before starting probe cycle, where G38.2 and G38.3 is not triggered and G38.4 and G38.5 is triggered.',
  5: 'Probe fail. Probe did not contact the workpiece within the programmed travel for G38.2 and G38.4.',
  6: 'Homing fail. Reset during active homing cycle.',
  7: 'Homing fail. Safety door was opened during active homing cycle.',
  8: 'Homing fail. Cycle failed to clear limit switch when pulling off. Try increasing pull-off setting or check wiring.',
  9: 'Homing fail. Could not find limit switch within search distance. Defined as 1.5 * max_travel on search and 5 * pulloff on locate phases.'
};

// FluidNC Settings (similar to GRBL, will be updated as needed)
export const FLUIDNC_SETTINGS = {
  '$0': 'Step pulse, microseconds',
  '$1': 'Step idle delay, milliseconds',
  '$2': 'Step port invert, mask',
  '$3': 'Direction port invert, mask',
  '$4': 'Step enable invert, boolean',
  '$5': 'Limit pins invert, boolean',
  '$6': 'Probe pin invert, boolean',
  '$10': 'Status report, mask',
  '$11': 'Junction deviation, mm',
  '$12': 'Arc tolerance, mm',
  '$13': 'Report inches, boolean',
  '$20': 'Soft limits, boolean',
  '$21': 'Hard limits, boolean',
  '$22': 'Homing cycle, boolean',
  '$23': 'Homing dir invert, mask',
  '$24': 'Homing feed, mm/min',
  '$25': 'Homing seek, mm/min',
  '$26': 'Homing debounce, milliseconds',
  '$27': 'Homing pull-off, mm',
  '$30': 'Max spindle speed, RPM',
  '$31': 'Min spindle speed, RPM',
  '$32': 'Laser mode, boolean',
  '$100': 'X steps/mm',
  '$101': 'Y steps/mm',
  '$102': 'Z steps/mm',
  '$110': 'X Max rate, mm/min',
  '$111': 'Y Max rate, mm/min',
  '$112': 'Z Max rate, mm/min',
  '$120': 'X Acceleration, mm/sec^2',
  '$121': 'Y Acceleration, mm/sec^2',
  '$122': 'Z Acceleration, mm/sec^2',
  '$130': 'X Max travel, mm',
  '$131': 'Y Max travel, mm',
  '$132': 'Z Max travel, mm'
};
