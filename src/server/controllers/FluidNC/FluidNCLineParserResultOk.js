class FluidNCLineParserResultOk {
  static parse(line) {
    const r = line.match(/^ok$/);
    if (!r) {
      return null;
    }

    const payload = {};

    return {
      type: FluidNCLineParserResultOk,
      payload: payload
    };
  }
}

export default FluidNCLineParserResultOk;
