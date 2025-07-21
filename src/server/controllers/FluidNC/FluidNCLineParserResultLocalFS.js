class FluidNCLineParserResultLocalFS {
  static parse(line) {
    console.log(`FluidNC LocalFS Parser: Attempting to parse line: "${line}"`);
    console.log(`FluidNC LocalFS Parser: Line analysis - length: ${line.length}, has brackets: ${line.includes('[')}, has colons: ${line.includes(':')}, has pipe: ${line.includes('|')}`);

    // Parse LocalFS command responses - try multiple formats
    // FluidNC may return files in various formats:
    // 1. filename:size:type (expected format)
    // 2. [FILE: filename|SIZE:size] (feedback format)
    // 3. Simple filename listing
    // 4. Other proprietary formats

    // Check for [FILE: ...] format in feedback messages
    const fileFormatMatch = line.match(/^\[FILE:\s*([^|]+)\|SIZE:(\d+)\]$/);
    if (fileFormatMatch) {
      const [, name, size] = fileFormatMatch;
      console.log(`FluidNC LocalFS Parser: MATCHED FILE format - name: ${name.trim()}, size: ${size}`);
      return {
        type: FluidNCLineParserResultLocalFS,
        payload: {
          command: 'list',
          file: {
            name: name.trim(),
            size: parseInt(size, 10),
            type: 'file'
          }
        }
      };
    }

    // Check if this is a LocalFS list response (simple filename with size)
    const fileListMatch = line.match(/^(.+):(\d+):(file|dir)$/);
    if (fileListMatch) {
      const [, name, size, type] = fileListMatch;
      console.log(`FluidNC LocalFS Parser: MATCHED colon format - name: ${name}, size: ${size}, type: ${type}`);
      return {
        type: FluidNCLineParserResultLocalFS,
        payload: {
          command: 'list',
          file: {
            name: name,
            size: parseInt(size, 10),
            type: type
          }
        }
      };
    }

    // EMERGENCY PARSER: Try to detect ANY line that looks like it could be a file
    // This is extremely liberal and will match almost anything that contains a file extension
    const emergencyFilePatterns = [
      // Look for any filename with extension, regardless of format
      /([a-zA-Z0-9_.-]+\.(yaml|yml|gcode|nc|txt|json|cfg|bin|hex))/i,
      // Look for quoted filenames
      /"([^"]+\.(yaml|yml|gcode|nc|txt|json|cfg|bin|hex))"/i,
      // Look for filenames after specific keywords
      /(?:file|name|filename):\s*([a-zA-Z0-9_.-]+\.(yaml|yml|gcode|nc|txt|json|cfg|bin|hex))/i,
      // Look for any word containing a dot followed by known extensions
      /(\w+\.(yaml|yml|gcode|nc|txt|json|cfg|bin|hex))/i
    ];

    for (let i = 0; i < emergencyFilePatterns.length; i++) {
      const pattern = emergencyFilePatterns[i];
      const match = line.match(pattern);
      if (match) {
        const filename = match[1];
        console.log(`FluidNC LocalFS Parser: EMERGENCY PATTERN ${i} MATCHED - filename: "${filename}"`);

        // Try to extract size if it's in the same line
        let size = 0;
        const sizeMatch = line.match(/(\d+)\s*bytes?/i) || line.match(/size:\s*(\d+)/i) || line.match(/(\d+)\s*B/i);
        if (sizeMatch) {
          size = parseInt(sizeMatch[1], 10);
          console.log(`FluidNC LocalFS Parser: Found size in emergency parsing: ${size}`);
        }
        return {
          type: FluidNCLineParserResultLocalFS,
          payload: {
            command: 'list',
            file: {
              name: filename,
              size: size,
              type: 'file'
            }
          }
        };
      }
    }

    // ULTRA EMERGENCY: If the line contains any text that looks like a filename
    // and we're clearly in a LocalFS context, just treat it as a file
    if (line.includes('.') && line.length > 3 && line.length < 100) {
      // Check if it's a simple filename-like string
      const cleanLine = line.trim().replace(/[^\w.-]/g, '');
      if (cleanLine.includes('.') && (cleanLine.includes('yaml') || cleanLine.includes('gcode') || cleanLine.includes('nc') || cleanLine.includes('txt'))) {
        console.log(`FluidNC LocalFS Parser: ULTRA EMERGENCY PARSE - treating as filename: "${cleanLine}"`);
        return {
          type: FluidNCLineParserResultLocalFS,
          payload: {
            command: 'list',
            file: {
              name: cleanLine,
              size: 0,
              type: 'file'
            }
          }
        };
      }
    }

    // Check for other LocalFS responses
    if (line.startsWith('$LocalFS/') || line.includes('LocalFS')) {
      console.log(`FluidNC LocalFS Parser: Found LocalFS command response: ${line}`);
      return {
        type: FluidNCLineParserResultLocalFS,
        payload: {
          command: 'unknown',
          response: line
        }
      };
    }

    // Don't log every non-matching line to avoid spam, but log potential file-related ones
    if (line.includes('LocalFS') || line.includes('FILE:') || line.includes('.yaml') || line.includes('.gcode') || line.includes('.nc') || line.includes('.txt')) {
      console.log(`FluidNC LocalFS Parser: Line contains file-related keywords but doesn't match any pattern: "${line}"`);
      console.log(`FluidNC LocalFS Parser: Line breakdown: chars=${Array.from(line).map(c => `${c.charCodeAt(0)}(${c})`).join(' ')}`);
    }

    return null;
  }
}

export default FluidNCLineParserResultLocalFS;
