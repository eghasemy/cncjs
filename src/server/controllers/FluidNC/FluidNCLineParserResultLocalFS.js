class FluidNCLineParserResultLocalFS {
  static parse(line) {
    console.log(`FluidNC LocalFS Parser: Attempting to parse line: "${line}"`);
    
    // Parse LocalFS command responses
    // Examples:
    // $LocalFS/List response: filename:size:type
    // config.yaml:2048:file
    // Directory listing format may vary

    // Check if this is a LocalFS list response (simple filename with size)
    const fileListMatch = line.match(/^(.+):(\d+):(file|dir)$/);
    if (fileListMatch) {
      const [, name, size, type] = fileListMatch;
      console.log(`FluidNC LocalFS Parser: Parsed file entry - name: ${name}, size: ${size}, type: ${type}`);
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

    console.log(`FluidNC LocalFS Parser: Line does not match LocalFS pattern: "${line}"`);
    return null;
  }
}

export default FluidNCLineParserResultLocalFS;