// https://github.com/grbl/grbl/wiki/Interfacing-with-Grbl#alarms
class FluidNCLineParserResultAlarm {
  static parse(line) {
    const r = line.match(/^ALARM:\s*(.+)$/);
    if (!r) {
      return null;
    }

    const payload = {
      message: r[1]
    };

    return {
      type: FluidNCLineParserResultAlarm,
      payload: payload
    };
  }
}

export default FluidNCLineParserResultAlarm;
