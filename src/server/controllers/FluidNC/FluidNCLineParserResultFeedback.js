// https://github.com/grbl/grbl/wiki/Interfacing-with-Grbl#feedback-messages
class FluidNCLineParserResultFeedback {
  // * Grbl v0.9
  //   []
  // * Grbl v1.1
  //   [MSG:]
  static parse(line) {
    const r = line.match(/^\[(?:MSG:)?(.+)\]$/);
    if (!r) {
      return null;
    }

    const message = r[1];

    // Skip FluidNC-specific structured messages (those with key=value pairs)
    // Let FluidNCLineParserResultMessage handle those
    if (message.includes('=') && (message.includes('IP=') || message.includes('Mode=') || message.includes('Status='))) {
      return null;
    }

    const payload = {
      message: message
    };

    return {
      type: FluidNCLineParserResultFeedback,
      payload: payload
    };
  }
}

export default FluidNCLineParserResultFeedback;
