class FluidNCLineParserResultLocalFS {
  static parse(line) {
    // Parse LocalFS command responses
    // Examples:
    // $LocalFS/List response: filename:size:type
    // config.yaml:2048:file
    // Directory listing format may vary
    
    // Check if this is a LocalFS list response (simple filename with size)
    const fileListMatch = line.match(/^(.+):(\d+):(file|dir)$/);
    if (fileListMatch) {
      const [, name, size, type] = fileListMatch;
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
      return {
        type: FluidNCLineParserResultLocalFS,
        payload: {
          command: 'unknown',
          response: line
        }
      };
    }

    return null;
  }
}

export default FluidNCLineParserResultLocalFS;