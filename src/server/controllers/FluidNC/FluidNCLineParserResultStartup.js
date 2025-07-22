import _trim from 'lodash/trim';

const pattern = new RegExp(/^([a-zA-Z0-9]+)\s+((?:\d+\.){1,2}\d+[a-zA-Z0-9\-\.]*)([^\[]*\[[^\]]+\].*)?/);

class FluidNCLineParserResultStartup {
  // Grbl 0.9j ['$' for help]
  // Grbl 1.1d ['$' for help]
  // Grbl 1.1
  // Grbl 1.1h: LongMill build ['$' for help]
  // Grbl 1.1h ['$' for help] LongMill build Feb 25, 2020
  // gCarvin 2.0.0 ['$' for help]
  static parse(line) {
    const r = line.match(pattern);
    if (!r) {
      return null;
    }

    const firmware = r[1];
    const version = r[2];
    const message = _trim(r[3]);

    const payload = {
      firmware,
      version,
      message,
    };

    return {
      type: FluidNCLineParserResultStartup,
      payload: payload
    };
  }
}

export default FluidNCLineParserResultStartup;
