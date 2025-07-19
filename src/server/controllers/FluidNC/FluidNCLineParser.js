import _ from 'lodash';

// https://github.com/bdring/FluidNC/wiki/Using-the-FluidNC-Serial-Connection
class FluidNCLineParser {
    // Type constants
    static TYPE_STATUS = 'status';
    static TYPE_OK = 'ok';
    static TYPE_ERROR = 'error';
    static TYPE_ALARM = 'alarm';
    static TYPE_PARSERSTATE = 'parserstate';
    static TYPE_PARAMETERS = 'parameters';
    static TYPE_FEEDBACK = 'feedback';
    static TYPE_SETTINGS = 'settings';
    static TYPE_STARTUP = 'startup';
    static TYPE_OTHERS = 'others';

    parse(data) {
      const parsers = [
        // Status Report
        // <Idle|WPos:0.000,0.000,0.000|MPos:0.000,0.000,0.000>
        // <Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>
        // <Idle|WPos:0.000,0.000,0.000|MPos:0.000,0.000,0.000|Pn:P|F:0|S:0>
        FluidNCLineParser.parseStatusReport,

        // ok
        FluidNCLineParser.parseOk,

        // error:x
        FluidNCLineParser.parseError,

        // ALARM:x
        FluidNCLineParser.parseAlarm,

        // [G0 G54 G17 G21 G90 G94 M0 M5 M9 T0 F0.]
        FluidNCLineParser.parseParserState,

        // [G28:0.000,0.000,0.000]
        // [G30:0.000,0.000,0.000]
        // [G92:0.000,0.000,0.000]
        // [TLO:0.000]
        // [PRB:0.000,0.000,0.000:0]
        FluidNCLineParser.parseParameters,

        // [MSG:...]
        // [GC:...]
        FluidNCLineParser.parseFeedback,

        // $xxxx=val
        FluidNCLineParser.parseSettings,

        // FluidNC x.x.x ['$' for help]
        FluidNCLineParser.parseStartup,

        // Others
        FluidNCLineParser.parseOthers
      ];

      for (let parser of parsers) {
        const result = parser.call(parser, data);
        if (result) {
          _.set(result, 'payload.raw', data);
          return result;
        }
      }

      return {
        type: FluidNCLineParser.TYPE_OTHERS,
        payload: {
          raw: data
        }
      };
    }

    static parseStatusReport(data) {
      // Status Report
      // https://github.com/bdring/FluidNC/wiki/Using-the-FluidNC-Serial-Connection#status-reports
      // <Idle|WPos:0.000,0.000,0.000|MPos:0.000,0.000,0.000>
      // <Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>
      // <Idle|WPos:0.000,0.000,0.000|MPos:0.000,0.000,0.000|Pn:P|F:0|S:0>
      const r = data.match(/^<(.+)>$/);
      if (!r) {
        return null;
      }

      const payload = {};
      const pattern = /[a-zA-Z]+(:[^|]*)?/g;
      const params = r[1].match(pattern);

      for (let param of params) {
        const nv = param.match(/^(.+?):(.*)$/);
        if (nv) {
          let [, name, value] = nv;
          payload[name] = value;
        } else {
          // Active State (Grbl v0.9, v1.1)
          // * Valid states types: Idle, Run, Hold, Jog, Alarm, Door, Check, Home, Sleep
          // * Sub-states may be included via : a colon delimiter and numeric code.
          // * Current sub-states are:
          //   - Hold:0 Hold complete. Ready to resume.
          //   - Hold:1 Hold in-progress. Reset will throw an alarm.
          //   - Door:0 Door closed. Ready to resume.
          //   - Door:1 Machine stopped. Door still ajar. Can't resume until closed.
          //   - Door:2 Door opened. Hold (or parking retract) in-progress. Reset will throw an alarm.
          //   - Door:3 Door closed and resuming. Restoring from park, if applicable. Reset will throw an alarm.
          payload.activeState = param;
        }
      }

      // Work Position (WPos) and Machine Position (MPos)
      const axes = ['x', 'y', 'z', 'a', 'b', 'c'];
      ['WPos', 'MPos'].forEach((pos) => {
        if (!(pos in payload)) {
          return;
        }

        const v = payload[pos];
        const positions = v.split(',');
        delete payload[pos];
        payload[pos.toLowerCase()] = {};
        positions.forEach((position, index) => {
          if (index < axes.length) {
            payload[pos.toLowerCase()][axes[index]] = position;
          }
        });
      });

      // Work Coordinate Offset (WCO)
      if ('WCO' in payload) {
        const v = payload.WCO;
        const offsets = v.split(',');
        delete payload.WCO;
        payload.wco = {};
        offsets.forEach((offset, index) => {
          if (index < axes.length) {
            payload.wco[axes[index]] = offset;
          }
        });
      }

      return {
        type: FluidNCLineParser.TYPE_STATUS,
        payload: payload
      };
    }

    static parseOk(data) {
      const r = data.match(/^ok$/i);
      if (!r) {
        return null;
      }

      return {
        type: FluidNCLineParser.TYPE_OK,
        payload: {}
      };
    }

    static parseError(data) {
      const r = data.match(/^error:(.+)$/i);
      if (!r) {
        return null;
      }

      const code = Number(r[1]) || 0;
      const description = '';

      return {
        type: FluidNCLineParser.TYPE_ERROR,
        payload: {
          code: code,
          description: description
        }
      };
    }

    static parseAlarm(data) {
      const r = data.match(/^ALARM:(.+)$/i);
      if (!r) {
        return null;
      }

      const code = Number(r[1]) || 0;
      const description = '';

      return {
        type: FluidNCLineParser.TYPE_ALARM,
        payload: {
          code: code,
          description: description
        }
      };
    }

    static parseParserState(data) {
      const r = data.match(/^\[(.+)\]$/);
      if (!r) {
        return null;
      }

      const payload = {};
      const words = r[1].split(' ');
      for (let word of words) {
        // Motion Mode
        // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
        if (word.match(/^(G0|G1|G2|G3|G38\.2|G38\.3|G38\.4|G38\.5|G80)$/)) {
          payload.motion = word;
          continue;
        }

        // Coordinate System Select
        // G54, G55, G56, G57, G58, G59
        if (word.match(/^(G54|G55|G56|G57|G58|G59)$/)) {
          payload.wcs = word;
          continue;
        }

        // Plane Select
        // G17: XY-plane, G18: ZX-plane, G19: YZ-plane
        if (word.match(/^(G17|G18|G19)$/)) {
          payload.plane = word;
          continue;
        }

        // Units Mode
        // G20: Inches, G21: Millimeters
        if (word.match(/^(G20|G21)$/)) {
          payload.units = word;
          continue;
        }

        // Distance Mode
        // G90: Absolute, G91: Relative
        if (word.match(/^(G90|G91)$/)) {
          payload.distance = word;
          continue;
        }

        // Arc IJK Distance Mode
        // G91.1: Relative, G91.1: Absolute (default)
        if (word.match(/^(G91\.1)$/)) {
          payload.arc = word;
          continue;
        }

        // Feed Rate Mode
        // G93: Inverse time mode, G94: Units per minute
        if (word.match(/^(G93|G94)$/)) {
          payload.feedrate = word;
          continue;
        }

        // Canned Cycle Return Mode
        // G98: Previous level, G99: R-point level
        if (word.match(/^(G98|G99)$/)) {
          payload.canned = word;
          continue;
        }

        // Program Mode
        // M0: Pause, M1: Optional pause, M2: End, M30: End
        if (word.match(/^(M0|M1|M2|M30)$/)) {
          payload.program = word;
          continue;
        }

        // Spindle Control
        // M3: CW, M4: CCW, M5: Stop
        if (word.match(/^(M3|M4|M5)$/)) {
          payload.spindle = word;
          continue;
        }

        // Coolant Control
        // M7: Mist, M8: Flood, M9: Off
        if (word.match(/^(M7|M8|M9)$/)) {
          payload.coolant = word;
          continue;
        }

        // Tool
        // T: Tool
        if (word.match(/^T(\d+)$/)) {
          payload.tool = word.substring(1);
          continue;
        }

        // Feedrate
        // F: Feedrate
        if (word.match(/^F([\d\.]+)$/)) {
          payload.feedrate_speed = word.substring(1);
          continue;
        }

        // Spindle Speed
        // S: Spindle Speed
        if (word.match(/^S([\d\.]+)$/)) {
          payload.spindle_speed = word.substring(1);
          continue;
        }
      }

      return {
        type: FluidNCLineParser.TYPE_PARSERSTATE,
        payload: payload
      };
    }

    static parseParameters(data) {
      const r = data.match(/^\[(.+):(.+)\]$/);
      if (!r) {
        return null;
      }

      const name = r[1];
      const value = r[2];
      const payload = {
        name: name,
        value: value
      };

      return {
        type: FluidNCLineParser.TYPE_PARAMETERS,
        payload: payload
      };
    }

    static parseFeedback(data) {
      const r = data.match(/^\[(.+)\]$/);
      if (!r) {
        return null;
      }

      const message = r[1];

      return {
        type: FluidNCLineParser.TYPE_FEEDBACK,
        payload: {
          message: message
        }
      };
    }

    static parseSettings(data) {
      const r = data.match(/^\$(.+)=(.+)$/);
      if (!r) {
        return null;
      }

      const name = '$' + r[1];
      const value = r[2];

      return {
        type: FluidNCLineParser.TYPE_SETTINGS,
        payload: {
          name: name,
          value: value
        }
      };
    }

    static parseStartup(data) {
      // FluidNC x.x.x ['$' for help]
      const r = data.match(/^FluidNC\s+(.+)\s+\[(.+)\]$/i);
      if (!r) {
        return null;
      }

      const version = r[1];
      const message = r[2];

      return {
        type: FluidNCLineParser.TYPE_STARTUP,
        payload: {
          version: version,
          message: message
        }
      };
    }

    static parseOthers(data) {
      return {
        type: FluidNCLineParser.TYPE_OTHERS,
        payload: {
          message: data
        }
      };
    }
}

export default FluidNCLineParser;