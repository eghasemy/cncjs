import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from 'app/components/Buttons';
import Modal from 'app/components/Modal';
import Panel from 'app/components/Panel';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import { SETTINGS_INFO, SETTINGS_CATEGORIES } from './settingsInfo';
import styles from './index.styl';

class Settings extends PureComponent {
  static propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
  };

  constructor(props) {
    super(props);
    const settings = props.state.controller.settings || {};
    const all = settings.settings || {};
    this.state = {
      values: { ...all },
      all
    };
    // React 15 does not support createRef(), use a callback ref instead
    this.fileInputRef = null;
  }

  handleChange = (name, value) => {
    this.setState(state => ({
      values: { ...state.values, [name]: value }
    }));
  };

  handleSave = () => {
    const { values, all } = this.state;
    Object.keys(values).forEach(key => {
      if (String(all[key]) !== String(values[key])) {
        controller.writeln(`${key}=${values[key]}`);
      }
    });
    this.props.actions.closeModal();
  };

  handleExport = () => {
    const data = JSON.stringify(this.state.values, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'grblhal-settings.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  handleImport = () => {
    if (this.fileInputRef) {
      this.fileInputRef.click();
    }
  };

  onImportFile = (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const obj = JSON.parse(e.target.result);
        this.setState(state => ({ values: { ...state.values, ...obj } }));
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

    renderInput(name, info) {
      const value = this.state.values[name];
      if (info && info.units === 'boolean') {
        return (
          <input
            type="checkbox"
            checked={String(value) === '1' || value === true}
            onChange={e => this.handleChange(name, e.target.checked ? '1' : '0')}
          />
        );
      }
      return (
        <input
          type="text"
          className="form-control"
          value={value}
          onChange={e => this.handleChange(name, e.target.value)}
        />
      );
    }

    render() {
      const { values } = this.state;
      const { actions } = this.props;

      const infoMap = {};
      SETTINGS_INFO.forEach(item => {
        infoMap[item.setting] = item;
      });

      return (
        <Modal size="lg" onClose={actions.closeModal}>
          <Modal.Header>
            <Modal.Title>{i18n._('grblHAL Settings')}</Modal.Title>
          </Modal.Header>
          <Modal.Body className={styles.settingsModalBody}>
            {Object.keys(SETTINGS_CATEGORIES).map(section => (
              <Panel className={styles.settingsSection} key={section}>
                <Panel.Heading>{section}</Panel.Heading>
                <Panel.Body>
                  <table className={styles.settingsTable}>
                    <tbody>
                      {SETTINGS_CATEGORIES[section].filter(key => key in values).map(key => (
                        <tr key={key}>
                          <td>{infoMap[key]?.message || key}</td>
                          <td>{this.renderInput(key, infoMap[key])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel.Body>
              </Panel>
            ))}
            {Object.keys(values).filter(key => !infoMap[key]).length > 0 && (
              <Panel className={styles.settingsSection}>
                <Panel.Heading>Other</Panel.Heading>
                <Panel.Body>
                  <table className={styles.settingsTable}>
                    <tbody>
                      {Object.keys(values).filter(key => !infoMap[key]).map(key => (
                        <tr key={key}>
                          <td>{key}</td>
                          <td>{this.renderInput(key, {})}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel.Body>
              </Panel>
            )}
            <input
              type="file"
              style={{ display: 'none' }}
              ref={(el) => {
                this.fileInputRef = el;
              }}
              onChange={this.onImportFile}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.handleImport}>{i18n._('Import')}</Button>
            <Button onClick={this.handleExport}>{i18n._('Export')}</Button>
            <Button onClick={actions.closeModal}>{i18n._('Cancel')}</Button>
            <Button btnStyle="primary" onClick={this.handleSave}>{i18n._('Save')}</Button>
          </Modal.Footer>
        </Modal>
      );
    }
}

export default Settings;
