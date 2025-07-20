import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from 'app/components/Buttons';
import Modal from 'app/components/Modal';
import { Nav, NavItem } from 'app/components/Navs';
import i18n from 'app/lib/i18n';
import controller from 'app/lib/controller';
import styles from './index.styl';

class Settings extends PureComponent {
  static propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
  };

  state = {
    activeTab: 'files',
    files: [],
    activeConfig: '',
    configText: '',
    gpioStatus: [],
    ip: '',
    httpPort: 80,
    telnetPort: 23
  };

  filesBuffer = [];
  pending = null;
  gpioBuffer = [];
  configBuffer = [];
  networkInfo = { ip: '', httpPort: 80, telnetPort: 23 };

  // React 15 does not support createRef(), use a callback ref instead
  fileInput = null;

  componentDidMount() {
    controller.addListener('serialport:read', this.handleSerialRead);
    this.refresh();
  }

  componentWillUnmount() {
    controller.removeListener('serialport:read', this.handleSerialRead);
  }

  refresh = () => {
    this.fetchFiles();
    this.fetchConfig();
    this.fetchEndstops();
    this.fetchNetwork();
  };

  fetchFiles = () => {
    this.filesBuffer = [];
    this.pending = 'list';
    controller.writeln('$LocalFS/List');
  };

  fetchConfig = async (name) => {
    const file = name || this.state.activeConfig || 'config.yaml';
    const path = encodeURIComponent(`/localfs/${file}`);
    try {
      const { ip, httpPort } = this.state;
      if (ip) {
        const base = `http://${ip}:${httpPort}`;
        const res = await fetch(`${base}/edit?download=${path}`);
        const text = await res.text();
        if (text.trim().length > 0 && !text.startsWith('<')) {
          this.setState({ configText: text });
          return;
        }
      }
    } catch (err) {
      // ignore network errors and fall back to serial dump
    }

    this.configBuffer = [];
    this.pending = 'configdump';
    controller.writeln('$Config/Dump');
  };

  fetchEndstops = () => {
    this.gpioBuffer = [];
    this.pending = 'gpio';
    controller.writeln('$GPIO/Dump');
  };

  fetchNetwork = () => {
    this.pending = 'net';
    this.networkInfo = { ip: '', httpPort: 80, telnetPort: 23 };
    controller.writeln('$Settings/List');
  };

  handleSerialRead = (data) => {
    const lines = String(data).trim().split(/\r?\n/);
    lines.forEach(line => {
      line = line.trim();
      if (!line) { return; }
      if (this.pending === 'list') {
      const m = line.match(/\[FILE:\s*(.*?)\|SIZE:(\d+)/i);
      if (m) {
        this.filesBuffer.push({ name: m[1].trim(), size: Number(m[2]) });
      } else if (line.startsWith('[ /') && line.includes('Free:')) {
        // summary line
      } else if (line === 'ok' || line.startsWith('error')) {
        this.setState({ files: this.filesBuffer });
        this.filesBuffer = [];
        this.pending = 'configfile';
        controller.writeln('$Config/Filename');
      }
      } else if (this.pending === 'configfile') {
        if (line.startsWith('$Config/Filename=')) {
          const name = line.substring(17);
          this.setState({ activeConfig: name });
          this.fetchConfig(name);
        } else if (line === 'ok' || line.startsWith('error')) {
          this.pending = null;
        }
    } else if (this.pending === 'configdump') {
      if (line === 'ok' || line.startsWith('error')) {
        this.setState({ configText: this.configBuffer.join('\n') });
        this.configBuffer = [];
        this.pending = null;
      } else {
        this.configBuffer.push(line);
      }
    } else if (this.pending === 'gpio') {
      const m = line.match(/^(\d+)\s+(GPIO\d+)\s+[IO]([01])/);
      if (m) {
        this.gpioBuffer.push({ pin: m[2], state: Number(m[3]) });
      } else if (line === 'ok' || line.startsWith('error')) {
        this.setState({ gpioStatus: this.gpioBuffer });
        this.gpioBuffer = [];
        this.pending = null;
      }
    } else if (this.pending === 'net') {
      if (line.startsWith('$Sta/IP=')) {
        this.networkInfo.ip = line.substring(8);
      } else if (line.startsWith('$AP/IP=')) {
        this.networkInfo.ip = this.networkInfo.ip || line.substring(7);
      } else if (line.startsWith('$HTTP/Port=')) {
        this.networkInfo.httpPort = Number(line.substring(11));
      } else if (line.startsWith('$Telnet/Port=')) {
        this.networkInfo.telnetPort = Number(line.substring(13));
      } else if (line === 'ok' || line.startsWith('error')) {
        this.pending = null;
        this.setState({
          ip: this.networkInfo.ip,
          httpPort: this.networkInfo.httpPort,
          telnetPort: this.networkInfo.telnetPort
        });
      }
    }
    });
  };

  handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    const form = new FormData();
    form.append('data', file);
    const path = encodeURIComponent(`/localfs/${file.name}`);
    try {
      const { ip, httpPort } = this.state;
      const base = ip ? `http://${ip}:${httpPort}` : '';
      await fetch(`${base}/edit?path=${path}`, { method: 'POST', body: form });
      this.fetchFiles();
    } catch (err) {
      // ignore
    }
    event.target.value = '';
  };

  handleDelete = (name) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(i18n._('Delete file?'))) {
      return;
    }
    controller.writeln(`$LocalFS/Delete=/localfs/${name}`);
    this.fetchFiles();
  };

  handleSetActive = (name) => {
    controller.writeln(`$Config/Filename=${name}`);
    this.fetchFiles();
    this.fetchConfig(name);
  };

  handleSaveConfig = async () => {
    const blob = new Blob([this.state.configText], { type: 'text/plain' });
    const form = new FormData();
    const name = this.state.activeConfig || 'config.yaml';
    form.append('data', blob, name);
    const path = encodeURIComponent(`/localfs/${name}`);
    try {
      const { ip, httpPort } = this.state;
      const base = ip ? `http://${ip}:${httpPort}` : '';
      await fetch(`${base}/edit?path=${path}`, { method: 'POST', body: form });
    } catch (err) {
      // ignore
    }
  };

  handleReboot = () => {
    controller.writeln('$RST=*');
  };

  renderFiles() {
    const { files, activeConfig } = this.state;
    return (
      <div>
        <input
          type="file"
          style={{ display: 'none' }}
          ref={(el) => {
            this.fileInput = el;
          }}
          onChange={this.handleUpload}
        />
        <Button btnStyle="primary" btnSize="sm" onClick={() => this.fileInput && this.fileInput.click()} style={{ marginBottom: 5 }}>
          {i18n._('Upload')}
        </Button>
        <table className={styles.filesTable}>
          <tbody>
            {files.map(file => (
              <tr key={file.name}>
                <td>
                  {file.name}
                  {file.name === activeConfig && <strong> *</strong>}
                </td>
                <td>
                  {(file.name.endsWith('.yaml') || file.name.endsWith('.yml')) && (
                    <Button btnSize="xs" onClick={() => this.handleSetActive(file.name)}>
                      {i18n._('Set Active')}
                    </Button>
                  )}
                  <Button btnSize="xs" onClick={() => this.handleDelete(file.name)}>
                    {i18n._('Delete')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  renderConfig() {
    return (
      <div className={styles.configEditor}>
        <textarea
          className="form-control"
          rows="10"
          value={this.state.configText}
          onChange={e => this.setState({ configText: e.target.value })}
        />
        <div style={{ marginTop: 10 }}>
          <Button btnStyle="primary" onClick={this.handleSaveConfig}>{i18n._('Save')}</Button>
          <Button onClick={this.handleReboot} style={{ marginLeft: 10 }}>{i18n._('Reboot')}</Button>
        </div>
      </div>
    );
  }

  renderEndstops() {
    const { gpioStatus } = this.state;
    return (
      <div>
        <table className={styles.filesTable}>
          <thead>
            <tr>
              <th>{i18n._('Pin')}</th>
              <th>{i18n._('State')}</th>
            </tr>
          </thead>
          <tbody>
            {gpioStatus.map(item => (
              <tr key={item.pin}>
                <td>{item.pin}</td>
                <td>
                  <span style={{ color: item.state ? 'red' : 'green' }}>
                    {item.state ? i18n._('TRIGGERED') : i18n._('INACTIVE')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button onClick={this.fetchEndstops} style={{ marginTop: 10 }}>
          {i18n._('Refresh')}
        </Button>
      </div>
    );
  }

  render() {
    const { actions } = this.props;
    const { activeTab } = this.state;
    const height = Math.max(window.innerHeight / 2, 300);

    return (
      <Modal size="lg" onClose={actions.closeModal}>
        <Modal.Header>
          <Modal.Title>{i18n._('FluidNC Settings')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Nav
            navStyle="tabs"
            activeKey={activeTab}
            onSelect={active => this.setState({ activeTab: active })}
            style={{ marginBottom: 10 }}
          >
            <NavItem eventKey="files">{i18n._('Files')}</NavItem>
            <NavItem eventKey="config">{i18n._('Config')}</NavItem>
            <NavItem eventKey="endstops">{i18n._('Endstops')}</NavItem>
          </Nav>
          <div style={{ height: height, overflowY: 'auto' }}>
            {activeTab === 'files' && this.renderFiles()}
            {activeTab === 'config' && this.renderConfig()}
            {activeTab === 'endstops' && this.renderEndstops()}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={actions.closeModal}>{i18n._('Close')}</Button>
        </Modal.Footer>
      </Modal>
    );
  }
}

export default Settings;
