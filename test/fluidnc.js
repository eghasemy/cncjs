import { test } from 'tap';
import FluidNCRunner from '../src/server/controllers/FluidNC/FluidNCRunner';

// Test FluidNC message parsing for Info tab functionality
test('FluidNC Message Parser: Machine name with space after MSG:', (t) => {
  const runner = new FluidNCRunner();
  let messageReceived = false;
  let deviceInfoReceived = false;

  runner.on('fluidnc:message', (payload) => {
    t.equal(payload.message, 'Machine: Slider');
    t.equal(payload.machineName, 'Slider');
    messageReceived = true;
    checkComplete();
  });

  runner.on('fluidnc:deviceInfo', (deviceInfo) => {
    t.equal(deviceInfo.machine, 'Slider');
    deviceInfoReceived = true;
    checkComplete();
  });

  function checkComplete() {
    if (messageReceived && deviceInfoReceived) {
      t.end();
    }
  }

  // FluidNC v3.4+ format with space after MSG:
  const line = '[MSG: Machine: Slider]';
  runner.parse(line);
});

test('FluidNC Message Parser: Network info with space after MSG:', (t) => {
  const runner = new FluidNCRunner();
  let messageReceived = false;
  let deviceInfoReceived = false;

  runner.on('fluidnc:message', (payload) => {
    t.equal(payload.message, 'Mode=STA:SSID=myssid:Status=Connected:IP=192.168.3.18:MAC=66‑55‑44‑33‑22‑11');
    t.ok(payload.data, 'Should have parsed data');
    t.equal(payload.data.Mode, 'STA');
    t.equal(payload.data.SSID, 'myssid');
    t.equal(payload.data.Status, 'Connected');
    t.equal(payload.data.IP, '192.168.3.18');
    t.equal(payload.data.MAC, '66‑55‑44‑33‑22‑11');
    t.notOk(payload.invalidIP, 'IP should be valid');
    messageReceived = true;
    checkComplete();
  });

  runner.on('fluidnc:deviceInfo', (deviceInfo) => {
    t.equal(deviceInfo.ip, '192.168.3.18');
    t.equal(deviceInfo.mode, 'STA');
    t.equal(deviceInfo.ssid, 'myssid');
    t.equal(deviceInfo.status, 'Connected');
    t.equal(deviceInfo.mac, '66‑55‑44‑33‑22‑11');
    deviceInfoReceived = true;
    checkComplete();
  });

  function checkComplete() {
    if (messageReceived && deviceInfoReceived) {
      t.end();
    }
  }

  // FluidNC v3.4+ format with space after MSG:
  const line = '[MSG: Mode=STA:SSID=myssid:Status=Connected:IP=192.168.3.18:MAC=66‑55‑44‑33‑22‑11]';
  runner.parse(line);
});

test('FluidNC BuildInfo Parser: Version detection', (t) => {
  const runner = new FluidNCRunner();
  
  runner.on('startup', (payload) => {
    t.equal(payload.version, '3.4 FluidNC v3.4.8:');
    t.ok(payload.buildInfo, 'Should have buildInfo object');
    t.equal(payload.buildInfo.version, '3.4 FluidNC v3.4.8:');
    t.end();
  });

  // FluidNC v3.4+ build info start
  const line = '[VER:3.4 FluidNC v3.4.8:]';
  runner.parse(line);
});

test('FluidNC Message Parser: Legacy format without space', (t) => {
  const runner = new FluidNCRunner();
  
  runner.on('fluidnc:message', (payload) => {
    t.equal(payload.message, 'Machine: Legacy');
    t.equal(payload.machineName, 'Legacy');
    t.end();
  });

  // Legacy format without space after MSG:
  const line = '[MSG:Machine: Legacy]';
  runner.parse(line);
});