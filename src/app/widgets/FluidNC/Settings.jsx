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
    gpioStatus: []
  };

  filesBuffer = [];
  pending = null;
  gpioBuffer = [];

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
  };

  fetchFiles = () => {
    this.filesBuffer = [];
    this.pending = 'list';
    controller.writeln('$LocalFS/List');
  };

  fetchConfig = async (name) => {
    const file = name || this.state.activeConfig || 'config.yaml';
    try {
      const res = await fetch(`/edit/${encodeURIComponent(file)}`);
      const text = await res.text();
      this.setState({ configText: text });
    } catch (err) {
      // ignore
    }
  };

  fetchEndstops = () => {
    this.gpioBuffer = [];
    this.pending = 'gpio';
    controller.writeln('$GPIO/Dump');
  };

  handleSerialRead = (data) => {
    const line = String(data).trim();
    if (this.pending === 'list') {
      const m = line.match(/\[FILE:\s*(.*?)\|SIZE:(\d+)\]/);
      if (m) {
        this.filesBuffer.push({ name: m[1], size: Number(m[2]) });
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
    } else if (this.pending === 'gpio') {
      const m = line.match(/^(\d+)\s+(GPIO\d+)\s+[IO]([01])/);
      if (m) {
        this.gpioBuffer.push({ pin: m[2], state: Number(m[3]) });
      } else if (line === 'ok' || line.startsWith('error')) {
        this.setState({ gpioStatus: this.gpioBuffer });
        this.gpioBuffer = [];
        this.pending = null;
      }
    }
  };

  handleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    const form = new FormData();
    form.append('data', file);
    try {
      await fetch(`/edit/${encodeURIComponent(file.name)}`, { method: 'POST', body: form });
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
    try {
      await fetch(`/edit/${encodeURIComponent(name)}`, { method: 'POST', body: form });
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
