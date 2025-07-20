import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Nav, NavItem } from 'app/components/Navs';
import { Button } from 'app/components/Buttons';
import Modal from 'app/components/Modal';
import api from 'app/api';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import yaml from 'js-yaml';

class Settings extends PureComponent {
  static propTypes = {
    actions: PropTypes.object
  };

  state = {
    tab: 'files',
    files: [],
    active: '',
    ip: '',
    editFile: '',
    editValues: {}
  };

  componentDidMount() {
    this.fetch();
    this.queryIP();
  }

  fetch = () => {
    const files = [];
    let active = '';
    let stage = 'list';

    const handleData = (data) => {
      String(data)
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line)
        .forEach((line) => {
          if (stage === 'list') {
            if (line.startsWith('[FILE:')) {
              const match = line.match(/^\[FILE:([^|]+)\|SIZE:/);
              if (match) {
                files.push(match[1]);
              }
              return;
            }
            if (line === 'ok') {
              stage = 'startup';
              controller.writeln('$N');
              return;
            }
            return;
          }

          if (stage === 'startup') {
            if (line.startsWith('$Config/Filename=')) {
              active = line.split('=')[1];
              return;
            }
            if (line === 'ok') {
              controller.removeListener('serialport:read', handleData);
              this.setState({ files, active });
            }
          }
        });
    };

    controller.addListener('serialport:read', handleData);
    controller.writeln('$LocalFS/List');
  };

  queryIP = () => {
    let ip = '';
    const handle = (data) => {
      String(data)
        .split(/\r?\n/)
        .map(line => line.trim())
        .forEach((line) => {
          const m = line.match(/IP=([^:]+):/);
          if (m) {
            ip = m[1];
          }
          if (line === 'ok') {
            controller.removeListener('serialport:read', handle);
            this.setState({ ip });
          }
        });
    };
    controller.addListener('serialport:read', handle);
    controller.writeln('$I');
  };

  handleSetActive = async (name) => {
    await api.fluidnc.setActive(name);
    this.setState({ active: name });
  };

  handleDelete = async (name) => {
    if (!window.confirm(i18n._('Delete {name}?', { name }))) { // eslint-disable-line no-alert
      return;
    }
    await api.fluidnc.remove(name);
    this.fetch();
  };

  handleDownload = async (name) => {
    const res = await api.fluidnc.download(name);
    const blob = new Blob([res.text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) {
        return;
      }
      const text = await file.text();
      await api.fluidnc.upload({ name: file.name, data: text });
      this.fetch();
    };
    input.click();
  };

  handleEdit = async (name) => {
    const res = await api.fluidnc.download(name);
    let values = {};
    try {
      values = yaml.load(res.text) || {};
    } catch (e) {
      values = { raw: res.text };
    }
    this.setState({ editFile: name, editValues: values });
  };

  handleSave = async () => {
    const { editFile, editValues } = this.state;
    let data = '';
    try {
      data = yaml.dump(editValues);
    } catch (e) {
      data = typeof editValues.raw === 'string' ? editValues.raw : '';
    }
    await api.fluidnc.upload({ name: editFile, data });
    this.setState({ editFile: '', editValues: {} });
    this.fetch();
  };

  renderEditModal() {
    const { editFile, editValues } = this.state;
    if (!editFile) {
      return null;
    }

    const renderField = (key, value) => {
      if (typeof value === 'boolean') {
        return (
          <input
            type="checkbox"
            checked={value}
            onChange={e => this.setState({ editValues: { ...editValues, [key]: e.target.checked } })}
          />
        );
      }
      if (typeof value === 'number') {
        return (
          <input
            type="number"
            value={value}
            onChange={e => this.setState({ editValues: { ...editValues, [key]: Number(e.target.value) } })}
          />
        );
      }
      if (typeof value === 'string') {
        return (
          <input
            type="text"
            value={value}
            onChange={e => this.setState({ editValues: { ...editValues, [key]: e.target.value } })}
          />
        );
      }
      return (
        <textarea
          className="form-control"
          value={yaml.dump(value)}
          rows={4}
          onChange={e => this.setState({ editValues: { ...editValues, [key]: yaml.load(e.target.value) } })}
        />
      );
    };

    const entries = Object.keys(editValues).map(key => (
      <tr key={key}>
        <td>{key}</td>
        <td>{renderField(key, editValues[key])}</td>
      </tr>
    ));

    return (
      <Modal size="lg" onClose={() => this.setState({ editFile: '', editValues: {} })}>
        <Modal.Header>
          <Modal.Title>{i18n._('Edit')} {editFile}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <table className="table table-bordered">
            <tbody>{entries}</tbody>
          </table>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.handleSave}>{i18n._('Save')}</Button>
          <Button onClick={() => this.setState({ editFile: '', editValues: {} })}>{i18n._('Cancel')}</Button>
        </Modal.Footer>
      </Modal>
    );
  }

  render() {
    const { actions } = this.props;
    const { tab, files, active, ip } = this.state;
    return (
      <Modal size="lg" onClose={actions.closeModal}>
        <Modal.Header>
          <Modal.Title>{i18n._('FluidNC Settings')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Nav navStyle="tabs" activeKey={tab} onSelect={key => this.setState({ tab: key })} style={{ marginBottom: 10 }}>
            <NavItem eventKey="files">{i18n._('File Manager')}</NavItem>
            <NavItem eventKey="calibrate">{i18n._('Calibrate')}</NavItem>
          </Nav>
          {tab === 'files' && (
            <div>
              <div style={{ marginBottom: 10 }}>
                <strong>{i18n._('Device IP')}:</strong> {ip || i18n._('Unknown')}
              </div>
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>{i18n._('File')}</th>
                    <th>{i18n._('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(f => (
                    <tr key={f}>
                      <td>
                        {f} {f === active && <strong>({i18n._('active')})</strong>}
                      </td>
                      <td>
                        <Button btnSize="xs" onClick={() => this.handleDownload(f)}><i className="fa fa-download" /></Button>
                        {' '}
                        <Button btnSize="xs" onClick={() => this.handleEdit(f)}><i className="fa fa-pencil" /></Button>
                        {' '}
                        <Button btnSize="xs" onClick={() => this.handleDelete(f)} disabled={f === active}><i className="fa fa-trash" /></Button>
                        {' '}
                        <Button btnSize="xs" onClick={() => this.handleSetActive(f)} disabled={f === active}><i className="fa fa-star" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ marginTop: 10 }}>
                <Button btnSize="xs" onClick={this.fetch}><i className="fa fa-refresh" /> {i18n._('Refresh')}</Button>
                {' '}
                <Button btnSize="xs" onClick={this.handleUpload}><i className="fa fa-upload" /> {i18n._('Upload')}</Button>
              </div>
              {this.renderEditModal()}
            </div>
          )}
          {tab === 'calibrate' && (
            <div>{i18n._('No calibration data')}</div>
          )}
        </Modal.Body>
      </Modal>
    );
  }
}

export default Settings;
