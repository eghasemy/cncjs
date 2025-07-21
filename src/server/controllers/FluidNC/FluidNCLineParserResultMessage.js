class FluidNCLineParserResultMessage {
  static parse(line) {
    console.log(`FluidNC Message Parser: Attempting to parse line: "${line}"`);

    // Parse FluidNC [MSG:...] format messages
    // FluidNC v3.4+ includes a space after MSG: like [MSG: Machine: Slider] or [MSG: Mode=STA:...]
    // Also handle legacy format without space [MSG:Mode=STA:...]
    const r = line.match(/^\[MSG:\s*(.+)\]$/);
    if (!r) {
      console.log(`FluidNC Message Parser: Line does not match MSG pattern: "${line}"`);
      return null;
    }

    console.log(`FluidNC Message Parser: MSG pattern matched!`);
    const message = r[1].trim(); // Remove any leading/trailing whitespace
    const payload = { message };

    console.log(`FluidNC Message Parser: Processing message: "${message}"`);

    // Handle machine name messages like "Machine: Slider" (with space after MSG:)
    if (message.startsWith('Machine: ')) {
      const machineName = message.substring(9).trim();
      console.log(`FluidNC Message Parser: Found machine name: "${machineName}"`);
      payload.machineName = machineName;
      return {
        type: FluidNCLineParserResultMessage,
        payload: payload
      };
    }

    // Try to parse structured message data using regex to properly handle key=value pairs
    // This handles cases like Mode=STA:SSID=G&E:Status=Connected:IP=10.0.0.80:MAC=F0-24-F9-F8-72-5C
    if (message.includes('=')) {
      console.log(`FluidNC Message Parser: Found structured data in message`);
      const data = {};

      // Enhanced regex to handle various key=value patterns, including special characters in values
      // This pattern captures key=value where value can contain special chars until : or end
      const keyValuePattern = /(\w+)=([^:]+?)(?=:\w+=|$)/g;
      let match;

      while ((match = keyValuePattern.exec(message)) !== null) {
        const key = match[1];
        const value = match[2].trim(); // Trim whitespace from values
        data[key] = value;
        console.log(`FluidNC Message Parser: Found ${key}="${value}"`);
      }

      // If we found structured data, include it
      if (Object.keys(data).length > 0) {
        payload.data = data;
        console.log(`FluidNC Message Parser: Parsed structured data:`, data);

        // Validate IP address format if present
        if (data.IP) {
          const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
          if (!ipPattern.test(data.IP)) {
            // Mark as invalid IP but still include it
            payload.invalidIP = true;
            console.warn(`FluidNC Message Parser: Invalid IP address format: ${data.IP}`);
          } else {
            console.log(`FluidNC Message Parser: Valid IP address found: ${data.IP}`);
          }
        }
      }
    }

    console.log(`FluidNC Message Parser: Returning parsed result:`, {
      type: FluidNCLineParserResultMessage,
      payload: payload
    });

    return {
      type: FluidNCLineParserResultMessage,
      payload: payload
    };
  }
}

export default FluidNCLineParserResultMessage;
