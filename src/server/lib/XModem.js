// XModem protocol implementation for Node.js
// Based on the XModem protocol used by FluidNC

const SOH = 0x01; // Start of header
const STX = 0x02; // Start Of Text (used like SOH but means 1024 block size)
const EOT = 0x04; // End of text
const ACK = 0x06; // ACKnowlege
const NAK = 0x15; // Negative AcKnowlege
const CAN = 0x18; // CANcel character
const FILLER = 0x1a;
const CRC_MODE = 0x43; // 'C'

const crcTable = [
  0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7, 0x8108,
  0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad, 0xe1ce, 0xf1ef, 0x1231, 0x0210,
  0x3273, 0x2252, 0x52b5, 0x4294, 0x72f7, 0x62d6, 0x9339, 0x8318, 0xb37b,
  0xa35a, 0xd3bd, 0xc39c, 0xf3ff, 0xe3de, 0x2462, 0x3443, 0x0420, 0x1401,
  0x64e6, 0x74c7, 0x44a4, 0x5485, 0xa56a, 0xb54b, 0x8528, 0x9509, 0xe5ee,
  0xf5cf, 0xc5ac, 0xd58d, 0x3653, 0x2672, 0x1611, 0x0630, 0x76d7, 0x66f6,
  0x5695, 0x46b4, 0xb75b, 0xa77a, 0x9719, 0x8738, 0xf7df, 0xe7fe, 0xd79d,
  0xc7bc, 0x48c4, 0x58e5, 0x6886, 0x78a7, 0x0840, 0x1861, 0x2802, 0x3823,
  0xc9cc, 0xd9ed, 0xe98e, 0xf9af, 0x8948, 0x9969, 0xa90a, 0xb92b, 0x5af5,
  0x4ad4, 0x7ab7, 0x6a96, 0x1a71, 0x0a50, 0x3a33, 0x2a12, 0xdbfd, 0xcbdc,
  0xfbbf, 0xeb9e, 0x9b79, 0x8b58, 0xbb3b, 0xab1a, 0x6ca6, 0x7c87, 0x4ce4,
  0x5cc5, 0x2c22, 0x3c03, 0x0c60, 0x1c41, 0xedae, 0xfd8f, 0xcdec, 0xddcd,
  0xad2a, 0xbd0b, 0x8d68, 0x9d49, 0x7e97, 0x6eb6, 0x5ed5, 0x4ef4, 0x3e13,
  0x2e32, 0x1e51, 0x0e70, 0xff9f, 0xefbe, 0xdfdd, 0xcffc, 0xbf1b, 0xaf3a,
  0x9f59, 0x8f78, 0x9188, 0x81a9, 0xb1ca, 0xa1eb, 0xd10c, 0xc12d, 0xf14e,
  0xe16f, 0x1080, 0x00a1, 0x30c2, 0x20e3, 0x5004, 0x4025, 0x7046, 0x6067,
  0x83b9, 0x9398, 0xa3fb, 0xb3da, 0xc33d, 0xd31c, 0xe37f, 0xf35e, 0x02b1,
  0x1290, 0x22f3, 0x32d2, 0x4235, 0x5214, 0x6277, 0x7256, 0xb5ea, 0xa5cb,
  0x95a8, 0x8589, 0xf56e, 0xe54f, 0xd52c, 0xc50d, 0x34e2, 0x24c3, 0x14a0,
  0x0481, 0x7466, 0x6447, 0x5424, 0x4405, 0xa7db, 0xb7fa, 0x8799, 0x97b8,
  0xe75f, 0xf77e, 0xc71d, 0xd73c, 0x26d3, 0x36f2, 0x0691, 0x16b0, 0x6657,
  0x7676, 0x4615, 0x5634, 0xd94c, 0xc96d, 0xf90e, 0xe92f, 0x99c8, 0x89e9,
  0xb98a, 0xa9ab, 0x5844, 0x4865, 0x7806, 0x6827, 0x18c0, 0x08e1, 0x3882,
  0x28a3, 0xcb7d, 0xdb5c, 0xeb3f, 0xfb1e, 0x8bf9, 0x9bd8, 0xabbb, 0xbb9a,
  0x4a75, 0x5a54, 0x6a37, 0x7a16, 0x0af1, 0x1ad0, 0x2ab3, 0x3a92, 0xfd2e,
  0xed0f, 0xdd6c, 0xcd4d, 0xbdaa, 0xad8b, 0x9de8, 0x8dc9, 0x7c26, 0x6c07,
  0x5c64, 0x4c45, 0x3ca2, 0x2c83, 0x1ce0, 0x0cc1, 0xef1f, 0xff3e, 0xcf5d,
  0xdf7c, 0xaf9b, 0xbfba, 0x8fd9, 0x9ff8, 0x6e17, 0x7e36, 0x4e55, 0x5e74,
  0x2e93, 0x3eb2, 0x0ed1, 0x1ef0
];

const crc16 = (buffer) => {
  let crc = 0x0000;
  for (const value of buffer) {
    crc = ((crc << 8) ^ crcTable[(crc >> 8) ^ (0xff & value)]) & 0xffff;
  }
  return crc;
};

class XModem {
  constructor(serialConnection) {
    this.connection = serialConnection;
    this.timeout = 10000; // 10 second timeout
    this.maxRetries = 10;
  }

  async send(fileData) {
    console.log('XModem: Starting file upload, size:', fileData.length);

    // Wait for receiver to send 'C' to start CRC mode
    const startByte = await this.waitForByte([CRC_MODE], this.timeout);
    if (startByte !== CRC_MODE) {
      throw new Error('Failed to start XModem transmission - no CRC request received');
    }

    console.log('XModem: Received CRC start request');

    const blockSize = 128;
    const totalBlocks = Math.ceil(fileData.length / blockSize);
    let blockNumber = 1;

    for (let i = 0; i < fileData.length; i += blockSize) {
      const blockData = Buffer.allocUnsafe(blockSize);
      const chunk = fileData.slice(i, i + blockSize);

      // Copy chunk to block and pad with 0x1A if needed
      chunk.copy(blockData);
      if (chunk.length < blockSize) {
        blockData.fill(FILLER, chunk.length);
      }

      let success = false;
      for (let retry = 0; retry < this.maxRetries && !success; retry++) {
        const packet = Buffer.concat([
          Buffer.from([SOH, blockNumber & 0xFF, (~blockNumber) & 0xFF]),
          blockData
        ]);

        const crc = crc16(blockData);
        const crcBytes = Buffer.from([(crc >> 8) & 0xFF, crc & 0xFF]);
        const fullPacket = Buffer.concat([packet, crcBytes]);

        console.log(`XModem: Sending block ${blockNumber}/${totalBlocks} (retry ${retry + 1})`);
        this.connection.write(fullPacket);

        const response = await this.waitForByte([ACK, NAK, CAN], 5000);
        if (response === ACK) {
          success = true;
          console.log(`XModem: Block ${blockNumber} acknowledged`);
        } else if (response === CAN) {
          throw new Error('XModem transfer cancelled by receiver');
        } else {
          console.log(`XModem: Block ${blockNumber} rejected, retrying...`);
        }
      }

      if (!success) {
        throw new Error(`Failed to send block ${blockNumber} after ${this.maxRetries} retries`);
      }

      blockNumber = (blockNumber + 1) & 0xFF;
    }

    // Send EOT
    console.log('XModem: Sending end of transmission');
    this.connection.write(Buffer.from([EOT]));
    const finalResponse = await this.waitForByte([ACK], 5000);
    if (finalResponse !== ACK) {
      throw new Error('Failed to receive final acknowledgment');
    }

    console.log('XModem: Upload completed successfully');
  }

  async receive() {
    console.log('XModem: Starting file download');

    // Send 'C' to request CRC mode
    this.connection.write(Buffer.from([CRC_MODE]));

    const receivedData = [];
    let expectedBlock = 1;

    while (true) {
      const header = await this.readBytes(3, this.timeout);

      if (header[0] === EOT) {
        console.log('XModem: Received end of transmission');
        this.connection.write(Buffer.from([ACK]));
        break;
      }

      if (header[0] !== SOH) {
        console.log('XModem: Invalid header, sending NAK');
        this.connection.write(Buffer.from([NAK]));
        continue;
      }

      const blockNumber = header[1];
      const blockNumberComplement = header[2];

      if ((blockNumber ^ blockNumberComplement) !== 0xFF) {
        console.log('XModem: Block number mismatch, sending NAK');
        this.connection.write(Buffer.from([NAK]));
        continue;
      }

      const blockData = await this.readBytes(128, this.timeout);
      const crcBytes = await this.readBytes(2, this.timeout);
      const receivedCrc = (crcBytes[0] << 8) | crcBytes[1];
      const calculatedCrc = crc16(blockData);

      if (receivedCrc !== calculatedCrc) {
        console.log('XModem: CRC mismatch, sending NAK');
        this.connection.write(Buffer.from([NAK]));
        continue;
      }

      if (blockNumber === (expectedBlock & 0xFF)) {
        receivedData.push(blockData);
        expectedBlock++;
        console.log(`XModem: Block ${blockNumber} received successfully`);
        this.connection.write(Buffer.from([ACK]));
      } else {
        console.log('XModem: Unexpected block number, sending NAK');
        this.connection.write(Buffer.from([NAK]));
      }
    }

    const result = Buffer.concat(receivedData);
    console.log('XModem: Download completed, received', result.length, 'bytes');
    return result;
  }

  async waitForByte(expectedBytes, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for expected bytes: ${expectedBytes}`));
      }, timeout);

      const dataHandler = (data) => {
        for (const byte of data) {
          if (expectedBytes.includes(byte)) {
            clearTimeout(timer);
            this.connection.removeListener('data', dataHandler);
            resolve(byte);
            return;
          }
        }
      };

      this.connection.on('data', dataHandler);
    });
  }

  async readBytes(count, timeout) {
    return new Promise((resolve, reject) => {
      let received = Buffer.allocUnsafe(0);

      const timer = setTimeout(() => {
        this.connection.removeListener('data', dataHandler);
        reject(new Error(`Timeout reading ${count} bytes`));
      }, timeout);

      const dataHandler = (data) => {
        received = Buffer.concat([received, data]);
        if (received.length >= count) {
          clearTimeout(timer);
          this.connection.removeListener('data', dataHandler);
          resolve(received.slice(0, count));
        }
      };

      this.connection.on('data', dataHandler);
    });
  }
}

module.exports = XModem;
