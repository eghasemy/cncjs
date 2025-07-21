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

    // Try to match any format that might contain file information
    // Look for patterns like "filename size" or just "filename" for common extensions
    const filePatterns = [
      // Pattern: "filename size" (space separated)
      /^([^\/\\\s:]+\.(yaml|yml|gcode|nc|txt|json|cfg))\s+(\d+)$/i,
      // Pattern: "filename,size" (comma separated)
      /^([^\/\\\s:]+\.(yaml|yml|gcode|nc|txt|json|cfg)),(\d+)$/i,
      // Pattern: "filename\tsize" (tab separated)
      /^([^\/\\\s:]+\.(yaml|yml|gcode|nc|txt|json|cfg))\t+(\d+)$/i,
      // Pattern: just filename with extension
      /^([^\/\\\s:,\[\]]+\.(yaml|yml|gcode|nc|txt|json|cfg))$/i
    ];

    for (let i = 0; i < filePatterns.length; i++) {
      const pattern = filePatterns[i];
      const match = line.match(pattern);
      if (match) {
        const [, name, , size] = match;
        console.log(`FluidNC LocalFS Parser: MATCHED pattern ${i} - name: ${name}, size: ${size || 'unknown'}`);
        return {
          type: FluidNCLineParserResultLocalFS,
          payload: {
            command: 'list',
            file: {
              name: name,
              size: size ? parseInt(size, 10) : 0,
              type: 'file'
            }
          }
        };
      }
    }

    // Check for simple filename listing (no size/type info)
    // Look for common file extensions
    const simpleFileMatch = line.match(/^([^:\/\[\]]+\.(yaml|yml|gcode|nc|txt|json|cfg))$/i);
    if (simpleFileMatch) {
      const [, name] = simpleFileMatch;
      console.log(`FluidNC LocalFS Parser: MATCHED simple filename format - name: ${name}`);
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

    // Try to detect any format that might be a directory listing
    // Some devices might return simple lists like:
    // config.yaml
    // test.gcode
    // etc.
    const directoryListPattern = /^([a-zA-Z0-9_.-]+\.(yaml|yml|gcode|nc|txt|json|cfg))$/i;
    if (directoryListPattern.test(line.trim())) {
      const name = line.trim();
      console.log(`FluidNC LocalFS Parser: DETECTED possible directory listing item: ${name}`);
      return {
        type: FluidNCLineParserResultLocalFS,
        payload: {
          command: 'list',
          file: {
            name: name,
            size: 0,
            type: 'file'
          }
        }
      };
    }

    // Ultra-liberal pattern: ANY line that contains a file extension and looks like a filename
    // This will catch almost anything that looks like a file
    const ultraLiberalPattern = /([a-zA-Z0-9_.-]*\.(yaml|yml|gcode|nc|txt|json|cfg))/i;
    if (ultraLiberalPattern.test(line)) {
      const match = line.match(ultraLiberalPattern);
      if (match) {
        const [, name] = match;
        console.log(`FluidNC LocalFS Parser: ULTRA-LIBERAL match detected filename: ${name}`);
        return {
          type: FluidNCLineParserResultLocalFS,
          payload: {
            command: 'list',
            file: {
              name: name,
              size: 0,
              type: 'file'
            }
          }
        };
      }
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
