class FluidNCLineParserResultMessage {
  static parse(line) {
    // Parse FluidNC [MSG:...] format messages
    // Example: [MSG:Mode=STA:SSID=G&E:Status=Connected:IP=10.0.0.80:MAC=F0-24-F9-F8-72-5C]
    const r = line.match(/^\[MSG:(.+)\]$/);
    if (!r) {
      return null;
    }

    const message = r[1];
    const payload = { message };

    // Try to parse structured message data
    if (message.includes(':')) {
      const parts = message.split(':');
      const data = {};

      parts.forEach(part => {
        if (part.includes('=')) {
          const [key, value] = part.split('=');
          data[key] = value;
        }
      });

      // If we found structured data, include it
      if (Object.keys(data).length > 0) {
        payload.data = data;
      }
    }

    return {
      type: FluidNCLineParserResultMessage,
      payload: payload
    };
  }
}

export default FluidNCLineParserResultMessage;