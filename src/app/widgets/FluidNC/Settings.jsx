import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from 'app/components/Buttons';
import Modal from 'app/components/Modal';
import { Nav, NavItem } from 'app/components/Navs';
import i18n from 'app/lib/i18n';
import styles from './index.styl';

class Settings extends PureComponent {
  static propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
  };

  state = {
    activeTab: 'files',
    files: [],
    configText: '',
    endstops: {}
  };

  componentDidMount() {
    this.refresh();
  }

  refresh = () => {
    this.fetchFiles();
    this.fetchConfig();
    this.fetchEndstops();
  };

  fetchFiles = async () => {
    try {
      const res = await fetch('/edit?dir=/');
      const data = await res.json();
      this.setState({ files: Array.isArray(data) ? data : [] });
    } catch (err) {
      // ignore errors
    }
  };

  fetchConfig = async () => {
    try {
      const res = await fetch('/edit/config.yaml');
      const text = await res.text();
      this.setState({ configText: text });
    } catch (err) {
      // ignore
    }
  };

  fetchEndstops = async () => {
    try {
      const res = await fetch('/input');
      const data = await res.json();
      this.setState({ endstops: data || {} });
    } catch (err) {
      // ignore
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

  handleDelete = async (name) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(i18n._('Delete file?'))) {
      return;
    }
    try {
      await fetch(`/edit/${encodeURIComponent(name)}`, { method: 'DELETE' });
      this.fetchFiles();
    } catch (err) {
      // ignore
    }
  };

  handleSetActive = async (name) => {
    try {
      await fetch(`/edit/config.yaml?active=${encodeURIComponent(name)}`, { method: 'PUT' });
      this.fetchConfig();
    } catch (err) {
      // ignore
    }
  };

  handleSaveConfig = async () => {
    const blob = new Blob([this.state.configText], { type: 'text/plain' });
    const form = new FormData();
    form.append('data', blob, 'config.yaml');
    try {
      await fetch('/edit/config.yaml', { method: 'POST', body: form });
    } catch (err) {
      // ignore
    }
  };

  handleReboot = async () => {
    try {
      await fetch('/command', { method: 'POST', body: '$RST=*' });
    } catch (err) {
      // ignore
    }
  };

  handleEndstopChange = (name, value) => {
    this.setState(state => ({
      endstops: { ...state.endstops, [name]: value }
    }));
  };

  handleSaveEndstops = async () => {
    try {
      await fetch('/endstops', { method: 'POST', body: JSON.stringify(this.state.endstops) });
    } catch (err) {
      // ignore
    }
  };

  renderFiles() {
    const { files } = this.state;
    return (
      <div>
        <input type="file" onChange={this.handleUpload} />
        <table className={styles.filesTable}>
          <tbody>
            {files.map(file => (
              <tr key={file.name}>
                <td>{file.name}</td>
                <td>
                  <Button btnSize="xs" onClick={() => this.handleSetActive(file.name)}>
                    {i18n._('Set Active')}
                  </Button>
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
    const { endstops } = this.state;
    return (
      <div>
        {Object.keys(endstops).map(key => (
          <div key={key} className={styles.endstopRow}>
            <label>
              <input
                type="checkbox"
                checked={!!endstops[key]}
                onChange={e => this.handleEndstopChange(key, e.target.checked)}
              />
              <span style={{ marginLeft: 5 }}>{key}</span>
            </label>
          </div>
        ))}
        <Button onClick={this.handleSaveEndstops}>{i18n._('Save')}</Button>
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
