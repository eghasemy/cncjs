class FluidNCLineParserResultBuildInfo {
  static parse(line) {
    // FluidNC BuildInfo parser for handling multi-line $I command responses
    // Example FluidNC v3.4+ response:
    // [VER:3.4 FluidNC v3.4.8:]
    // [OPT:MPHS]
    // [MSG: Machine: Slider]
    // [MSG: Mode=STA:SSID=myssid:Status=Connected:IP=192.168.3.18:MAC=66‑55‑44‑33‑22‑11]
    
    // We only capture the initial [VER:...] line to start build info collection
    // The subsequent lines will be processed by other parsers
    const r = line.match(/^\[VER:(.+)\]$/);
    if (!r) {
      return null;
    }

    const version = r[1];
    console.log(`FluidNC BuildInfo Parser: Starting build info collection with version: "${version}"`);

    const payload = {
      version: version.trim(),
      buildInfo: {
        version: version.trim(),
        options: '',
        machine: '',
        deviceInfo: {}
      }
    };

    return {
      type: FluidNCLineParserResultBuildInfo,
      payload: payload
    };
  }
}

export default FluidNCLineParserResultBuildInfo;