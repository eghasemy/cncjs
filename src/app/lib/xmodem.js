/* eslint-disable */
export class XModemSocketAdapter {
  constructor(controller) {
    this.controller = controller;
    this.buffer = Buffer.alloc(0);
    this.onData = this.onData.bind(this);
    controller.addListener('serialport:read', this.onData);
  }

  onData(data) {
    const buf = Buffer.from(data);
    this.buffer = Buffer.concat([this.buffer, buf]);
  }

  write(buffer) {
    this.controller.write(buffer);
    return Promise.resolve();
  }

  read() {
    const buf = this.buffer;
    this.buffer = Buffer.alloc(0);
    return Promise.resolve(buf);
  }

  peekByte() {
    return Promise.resolve(this.buffer.length > 0 ? this.buffer[0] : undefined);
  }

  close() {
    this.controller.removeListener('serialport:read', this.onData);
  }
}

const SOH = 0x01;
const STX = 0x02;
const EOT = 0x04;
const ACK = 0x06;
const NAK = 0x15;
const CAN = 0x18;
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

function crc16(buffer) {
  let crc = 0x0000;
  for (let i = 0; i < buffer.length; i++) {
    crc = ((crc << 8) ^ crcTable[(crc >> 8) ^ (0xff & buffer[i])]) & 0xffff;
  }
  return crc;
}

function crc16Bytes(buffer) {
  const crc = crc16(buffer);
  return Buffer.from([(crc >> 8) & 0xff, crc & 0xff]);
}

export class XModem {
  constructor(socket) {
    this.socket = socket;
    this.maxTransmissionRestarts = 4;
    this.maxErrors = 5;
  }

  async send(fileBuffer) {
    let start;
    let retries = 0;
    while (retries < this.maxTransmissionRestarts) {
      const data = await this.socket.read();
      start = data[0];
      if (start === NAK || start === EOT) throw new Error('Could not upload');
      if (start === CRC_MODE) break;
      retries++;
      await delay(100);
    }

    let block = 1;
    let remaining = Buffer.from(fileBuffer);
    while (remaining.length > 0) {
      let chunk = remaining.slice(0, 1024);
      remaining = remaining.slice(chunk.length);
      if (chunk.length < 1024) {
        chunk = Buffer.concat([chunk, Buffer.alloc(1024 - chunk.length, FILLER)]);
      }
      const packet = Buffer.concat([
        Buffer.from([STX, block, 0xff - block]),
        chunk,
        crc16Bytes(chunk)
      ]);
      let ok = false;
      let errors = 0;
      while (!ok) {
        if (errors > this.maxErrors) throw new Error('Could not upload');
        await this.socket.write(packet);
        const resp = (await this.socket.read())[0];
        if (resp === ACK) {
          ok = true;
          block = (block + 1) & 0xff;
        } else if (resp === NAK || resp === CRC_MODE) {
          errors++;
        } else if (resp === CAN || resp === EOT) {
          throw new Error('Upload cancelled');
        } else {
          await delay(100);
        }
      }
    }
    while (true) {
      await this.socket.write(Buffer.from([EOT]));
      await delay(100);
      const resp = (await this.socket.read())[0];
      if (resp === ACK) break;
      if (resp === CAN) throw new Error('Upload cancelled');
    }
  }

  async receive() {
    await this.requestStart();
    let block = 1;
    let result = Buffer.alloc(0);
    let errors = 0;
    const use1k = true;
    const blockSize = use1k ? 1024 : 128;
    while (true) {
      await delay(100);
      const data = await this.socket.read();
      if (data[0] === EOT) {
        await this.socket.write(Buffer.from([ACK]));
        break;
      }
      if (data[0] !== STX) {
        await this.socket.write(Buffer.from([NAK]));
        if (++errors > this.maxErrors) throw new Error('Download error');
        continue;
      }
      const pktNum = data[1];
      const pktNum2 = data[2];
      if (pktNum !== block || (pktNum + pktNum2) !== 0xff) {
        await this.socket.write(Buffer.from([NAK]));
        if (++errors > this.maxErrors) throw new Error('Download error');
        continue;
      }
      const payload = data.slice(3, 3 + blockSize);
      const crcBytes = data.slice(3 + blockSize, 3 + blockSize + 2);
      const crcCalc = crc16Bytes(payload);
      if (crcBytes[0] !== crcCalc[0] || crcBytes[1] !== crcCalc[1]) {
        await this.socket.write(Buffer.from([NAK]));
        if (++errors > this.maxErrors) throw new Error('Download error');
        continue;
      }
      result = Buffer.concat([result, payload]);
      await this.socket.write(Buffer.from([ACK]));
      block = (block + 1) & 0xff;
      errors = 0;
    }
    return trim(result);
  }

  async requestStart() {
    await this.socket.read();
    let tries = 0;
    while (tries < this.maxTransmissionRestarts) {
      await delay(200);
      await this.socket.write(Buffer.from([CRC_MODE]));
      await delay(200);
      const b = await this.socket.peekByte();
      if (b === STX) return;
      if (b === SOH) throw new Error('Legacy XModem not supported');
      tries++;
    }
    throw new Error('Could not start');
  }
}

function trim(buf) {
  let i = buf.length - 1;
  while (i >= 0 && buf[i] === FILLER) i--;
  return buf.slice(0, i + 1);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
