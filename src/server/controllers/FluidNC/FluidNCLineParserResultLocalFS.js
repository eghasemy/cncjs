class FluidNCLineParserResultLocalFS {
  static parse(line) {
    // Enhanced debugging to capture exact format
    console.log(`FluidNC LocalFS Parser: ===============================`);
    console.log(`FluidNC LocalFS Parser: RAW LINE: "${line}"`);
    console.log(`FluidNC LocalFS Parser: Line length: ${line.length}`);
    console.log(`FluidNC LocalFS Parser: Char codes:`, Array.from(line).map(c => `${c}(${c.charCodeAt(0)})`).join(' '));
    console.log(`FluidNC LocalFS Parser: Has brackets: ${line.includes('[')}`);
    console.log(`FluidNC LocalFS Parser: Has colons: ${line.includes(':')}`);
    console.log(`FluidNC LocalFS Parser: Has pipe: ${line.includes('|')}`);
    console.log(`FluidNC LocalFS Parser: Has tabs: ${line.includes('\t')}`);
    console.log(`FluidNC LocalFS Parser: Has spaces: ${line.includes(' ')}`);
    console.log(`FluidNC LocalFS Parser: Starts with: "${line.substring(0, 10)}"`);
    console.log(`FluidNC LocalFS Parser: Ends with: "${line.substring(line.length - 10)}"`);

    // Parse LocalFS command responses - try multiple formats
    // FluidNC may return files in various formats:
    // 1. filename:size:type (expected format)
    // 2. [FILE: filename|SIZE:size] (feedback format)
    // 3. Simple filename listing
    // 4. Tab-separated values
    // 5. Space-separated values
    // 6. Other proprietary formats

    // Pattern 1: [FILE: filename|SIZE:size] format
    const fileFormatMatch = line.match(/^\[FILE:\s*([^|]+)\|SIZE:(\d+)\]$/);
    if (fileFormatMatch) {
      const [, name, size] = fileFormatMatch;
      console.log(`FluidNC LocalFS Parser: ✓ MATCHED [FILE:] format - name: ${name.trim()}, size: ${size}`);
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

    // Pattern 2: Tab-separated values (filename<TAB>size<TAB>type)
    if (line.includes('\t')) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const size = parseInt(parts[1].trim(), 10) || 0;
        const type = parts[2] ? parts[2].trim() : 'file';
        if (name && name.includes('.')) {
          console.log(`FluidNC LocalFS Parser: ✓ MATCHED tab-separated format - name: ${name}, size: ${size}, type: ${type}`);
          return {
            type: FluidNCLineParserResultLocalFS,
            payload: {
              command: 'list',
              file: {
                name: name,
                size: size,
                type: type
              }
            }
          };
        }
      }
    }

    // Pattern 3: Space-separated values (common format)
    const spaceMatch = line.match(/^(\S+\.\w+)\s+(\d+)\s*(\w*)$/);
    if (spaceMatch) {
      const [, name, size, type] = spaceMatch;
      console.log(`FluidNC LocalFS Parser: ✓ MATCHED space-separated format - name: ${name}, size: ${size}, type: ${type || 'file'}`);
      return {
        type: FluidNCLineParserResultLocalFS,
        payload: {
          command: 'list',
          file: {
            name: name,
            size: parseInt(size, 10),
            type: type || 'file'
          }
        }
      };
    }

    // Pattern 4: Plain filename on its own line (simple format)
    const cleanLine = line.trim();
    if (cleanLine && cleanLine.includes('.') && !cleanLine.includes(' ') && cleanLine.length < 100) {
      // Check if it looks like a filename with known extensions
      const knownExtensions = ['yaml', 'yml', 'gcode', 'nc', 'txt', 'json', 'cfg', 'bin', 'hex'];
      const hasKnownExtension = knownExtensions.some(ext => cleanLine.toLowerCase().endsWith('.' + ext));

      if (hasKnownExtension) {
        console.log(`FluidNC LocalFS Parser: ✓ MATCHED plain filename format - name: ${cleanLine}`);
        return {
          type: FluidNCLineParserResultLocalFS,
          payload: {
            command: 'list',
            file: {
              name: cleanLine,
              size: 0, // Size unknown in this format
              type: 'file'
            }
          }
        };
      }
    }

    // Pattern 5: Colon-separated format (filename:size:type)
    const fileListMatch = line.match(/^(.+):(\d+):(file|dir)$/);
    if (fileListMatch) {
      const [, name, size, type] = fileListMatch;
      console.log(`FluidNC LocalFS Parser: ✓ MATCHED colon format - name: ${name}, size: ${size}, type: ${type}`);
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
