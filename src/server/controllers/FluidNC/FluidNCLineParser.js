import _ from 'lodash';
import FluidNCLineParserResultStatus from './FluidNCLineParserResultStatus';
import FluidNCLineParserResultOk from './FluidNCLineParserResultOk';
import FluidNCLineParserResultError from './FluidNCLineParserResultError';
import FluidNCLineParserResultAlarm from './FluidNCLineParserResultAlarm';
import FluidNCLineParserResultParserState from './FluidNCLineParserResultParserState';
import FluidNCLineParserResultParameters from './FluidNCLineParserResultParameters';
import FluidNCLineParserResultHelp from './FluidNCLineParserResultHelp';
import FluidNCLineParserResultVersion from './FluidNCLineParserResultVersion';
import FluidNCLineParserResultOption from './FluidNCLineParserResultOption';
import FluidNCLineParserResultEcho from './FluidNCLineParserResultEcho';
import FluidNCLineParserResultFeedback from './FluidNCLineParserResultFeedback';
import FluidNCLineParserResultSettings from './FluidNCLineParserResultSettings';
import FluidNCLineParserResultStartup from './FluidNCLineParserResultStartup';
import FluidNCLineParserResultMessage from './FluidNCLineParserResultMessage';
import FluidNCLineParserResultLocalFS from './FluidNCLineParserResultLocalFS';

// FluidNC (based on Grbl v1.1)
// https://github.com/gnea/grbl/blob/edge/doc/markdown/interface.md

class FluidNCLineParser {
  parse(line) {
    const parsers = [
      // <>
      FluidNCLineParserResultStatus,

      // ok
      FluidNCLineParserResultOk,

      // error:x
      FluidNCLineParserResultError,

      // ALARM:
      FluidNCLineParserResultAlarm,

      // [G38.2 G54 G17 G21 G91 G94 M0 M5 M9 T0 F20. S0.] (v0.9)
      // [GC:G38.2 G54 G17 G21 G91 G94 M0 M5 M9 T0 F20. S0.] (v1.1)
      FluidNCLineParserResultParserState,

      // [G54:0.000,0.000,0.000]
      // [G55:0.000,0.000,0.000]
      // [G56:0.000,0.000,0.000]
      // [G57:0.000,0.000,0.000]
      // [G58:0.000,0.000,0.000]
      // [G59:0.000,0.000,0.000]
      // [G28:0.000,0.000,0.000]
      // [G30:0.000,0.000,0.000]
      // [G92:0.000,0.000,0.000]
      // [TLO:0.000]
      // [PRB:0.000,0.000,0.000:0]
      FluidNCLineParserResultParameters,

      // [HLP:] (v1.1)
      FluidNCLineParserResultHelp,

      // [VER:] (v1.1)
      FluidNCLineParserResultVersion,

      // [OPT:] (v1.1)
      FluidNCLineParserResultOption,

      // [echo:] (v1.1)
      FluidNCLineParserResultEcho,

      // [] (v0.9)
      // [MSG:] (v1.1)
      FluidNCLineParserResultFeedback,

      // FluidNC [MSG:...] format messages
      FluidNCLineParserResultMessage,

      // LocalFS responses
      FluidNCLineParserResultLocalFS,

      // $xx
      FluidNCLineParserResultSettings,

      // Grbl X.Xx ['$' for help]
      FluidNCLineParserResultStartup
    ];

    for (let parser of parsers) {
      const result = parser.parse(line);
      if (result) {
        _.set(result, 'payload.raw', line);
        return result;
      }
    }

    return {
      type: null,
      payload: {
        raw: line
      }
    };
  }
}

export default FluidNCLineParser;
