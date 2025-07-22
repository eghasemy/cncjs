class FluidNCLineParserResultOption {
  static parse(line) {
    // * Grbl v1.1
    //   [OPT:]
    const r = line.match(/^\[(?:OPT:)(.+)\]$/);
    if (!r) {
      return null;
    }

    const payload = {
      message: r[1]
    };

    return {
      type: FluidNCLineParserResultOption,
      payload: payload
    };
  }
}

export default FluidNCLineParserResultOption;
