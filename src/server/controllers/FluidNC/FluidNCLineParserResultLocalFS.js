class FluidNCLineParserResultLocalFS {
  static parse(line) {
    console.log(`FluidNC LocalFS Parser: Attempting to parse line: "${line}"`);

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
      console.log(`FluidNC LocalFS Parser: Parsed FILE format - name: ${name.trim()}, size: ${size}`);
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
      console.log(`FluidNC LocalFS Parser: Parsed colon format - name: ${name}, size: ${size}, type: ${type}`);
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

    // Check for simple filename listing (no size/type info)
    // Look for common file extensions
    const simpleFileMatch = line.match(/^([^:\/\[\]]+\.(yaml|yml|gcode|nc|txt|json|cfg))$/i);
    if (simpleFileMatch) {
      const [, name] = simpleFileMatch;
      console.log(`FluidNC LocalFS Parser: Parsed simple filename format - name: ${name}`);
      return {
        type: FluidNCLineParserResultLocalFS,
        payload: {
          command: 'list',
          file: {
            name: name,
            size: 0, // Unknown size
            type: 'file'
          }
        }
      };
    }

    // Check for any line that might contain a filename
    // This is a more liberal approach to catch files we might be missing
    if (line.includes('.yaml') || line.includes('.yml') || line.includes('.gcode') || line.includes('.nc') || line.includes('.txt')) {
      console.log(`FluidNC LocalFS Parser: Potential file detected (liberal parsing): "${line}"`);
      // Try to extract just the filename part
      const liberalMatch = line.match(/([^\/\\\s:]+\.(yaml|yml|gcode|nc|txt|json|cfg))/i);
      if (liberalMatch) {
        const [, name] = liberalMatch;
        console.log(`FluidNC LocalFS Parser: Extracted filename from liberal parsing: ${name}`);
        return {
          type: FluidNCLineParserResultLocalFS,
          payload: {
            command: 'list',
            file: {
              name: name,
              size: 0, // Unknown size
              type: 'file'
            }
          }
        };
      }
    }

    // Check for other LocalFS responses
    if (line.startsWith('$LocalFS/')) {
      console.log(`FluidNC LocalFS Parser: Found LocalFS command response: ${line}`);
      return {
        type: FluidNCLineParserResultLocalFS,
        payload: {
          command: 'unknown',
          response: line
        }
      };
    }

    // Don't log every non-matching line to avoid spam
    if (line.includes('LocalFS') || line.includes('FILE:') || line.includes('.yaml') || line.includes('.gcode')) {
      console.log(`FluidNC LocalFS Parser: Line contains file-related keywords but doesn't match any pattern: "${line}"`);
    }

    return null;
  }
}

export default FluidNCLineParserResultLocalFS;
