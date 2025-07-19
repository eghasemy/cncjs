import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from 'app/components/Buttons';
import Modal from 'app/components/Modal';
import { Nav, NavItem } from 'app/components/Navs';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import FileManager from './FileManager';
import ConfigEditor from './ConfigEditor';
import EndstopTester from './EndstopTester';
import styles from './index.styl';

class Settings extends PureComponent {
    static propTypes = {
      state: PropTypes.object.isRequired,
      actions: PropTypes.object.isRequired
    };

    state = {
      files: [],
      currentConfig: '',
      endstopStatus: {}
    };

    componentDidMount() {
      this.refreshFiles();
      this.refreshConfig();
      this.refreshEndstops();
    }

    refreshFiles = () => {
      // Command to list files on FluidNC device
      controller.command('gcode', '$File/List');
    };

    refreshConfig = () => {
      // Command to get current config from FluidNC device
      controller.command('gcode', '$Config/Dump');
    };

    refreshEndstops = () => {
      // Command to get endstop status from FluidNC device
      controller.command('gcode', '$Probe');
    };

    rebootDevice = () => {
      // TODO: Add proper confirmation modal
      controller.command('gcode', '$Bye');
    };

    uploadFile = (file, content) => {
      // Command to upload file to FluidNC device
      const command = `$File/Write=${file}`;
      controller.command('gcode', [command, content]);
      this.refreshFiles();
    };

    deleteFile = (filename) => {
      // TODO: Add proper confirmation modal
      controller.command('gcode', `$File/Delete=${filename}`);
      this.refreshFiles();
    };

    saveConfig = (config) => {
      // Save config to FluidNC device
      controller.command('gcode', ['$Config/Save', config]);
      this.refreshConfig();
    };

    render() {
      const { state, actions } = this.props;
      const { activeTab = 'files' } = state.modal.params;
      const height = Math.max(window.innerHeight * 0.7, 400);

      return (
        <Modal disableOverlay size="lg" onClose={actions.closeModal}>
          <Modal.Header>
            <Modal.Title>
              {i18n._('FluidNC Settings')}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Nav
              navStyle="tabs"
              activeKey={activeTab}
              onSelect={(eventKey, event) => {
                actions.updateModalParams({ activeTab: eventKey });
              }}
              style={{ marginBottom: 10 }}
            >
              <NavItem eventKey="files">{i18n._('File Manager')}</NavItem>
              <NavItem eventKey="config">{i18n._('Configuration')}</NavItem>
              <NavItem eventKey="endstops">{i18n._('Endstops')}</NavItem>
              <NavItem eventKey="system">{i18n._('System')}</NavItem>
            </Nav>
            <div className={styles.navContent} style={{ height: height }}>
              {activeTab === 'files' && (
                <FileManager
                  files={this.state.files}
                  onRefresh={this.refreshFiles}
                  onUpload={this.uploadFile}
                  onDelete={this.deleteFile}
                />
              )}
              {activeTab === 'config' && (
                <ConfigEditor
                  config={this.state.currentConfig}
                  onRefresh={this.refreshConfig}
                  onSave={this.saveConfig}
                />
              )}
              {activeTab === 'endstops' && (
                <EndstopTester
                  status={this.state.endstopStatus}
                  onRefresh={this.refreshEndstops}
                />
              )}
              {activeTab === 'system' && (
                <div className={styles.systemTab}>
                  <div className="form-group">
                    <label>{i18n._('Device Control')}</label>
                    <div>
                      <Button
                        btnStyle="danger"
                        onClick={this.rebootDevice}
                      >
                        <i className="fa fa-power-off" />
                        <span className="space" />
                        {i18n._('Reboot Device')}
                      </Button>
                    </div>
                    <small className="help-block">
                      {i18n._('Restart the FluidNC device. This will disconnect the current session.')}
                    </small>
                  </div>
                  <div className="form-group">
                    <label>{i18n._('Device Information')}</label>
                    <div className={styles.deviceInfo}>
                      <div><strong>{i18n._('Controller Type')}:</strong> FluidNC</div>
                      <div><strong>{i18n._('Port')}:</strong> {state.port || 'Unknown'}</div>
                      <div><strong>{i18n._('Status')}:</strong> {state.isReady ? i18n._('Ready') : i18n._('Not Ready')}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Modal.Body>
        </Modal>
      );
    }
}

export default Settings;
