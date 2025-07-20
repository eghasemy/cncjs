import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button, Table } from 'react-bootstrap';
import i18n from 'app/lib/i18n';
import controller from 'app/lib/controller';
import ConfigEditor from './ConfigEditor';

class FileManager extends PureComponent {
    static propTypes = {
      state: PropTypes.object,
      actions: PropTypes.object
    };

    state = {
      files: [],
      activeConfig: null,
      loading: false,
      editingFile: null,
      deviceInfo: {}
    };

    componentDidMount() {
      this.subscribe();
      this.loadDeviceInfo();
      this.loadFiles();
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    subscribe() {
      const tokens = [
        controller.addListener('fluidnc:deviceInfo', (deviceInfo) => {
          this.setState({ deviceInfo });
        }),
        controller.addListener('fluidnc:activeConfig', (activeConfig) => {
          this.setState({ activeConfig });
        }),
        controller.addListener('fluidnc:fileList', (files) => {
          this.setState({ files, loading: false });
        })
      ];
      this.subscriptionTokens = tokens;
    }

    unsubscribe() {
      this.subscriptionTokens.forEach((token) => {
        controller.removeListener(token);
      });
      this.subscriptionTokens = [];
    }

    loadDeviceInfo = () => {
      // Request device info from FluidNC
      controller.command('fluidnc:getInfo');
    };

    loadActiveConfig = () => {
      // Request active config from FluidNC
      controller.command('fluidnc:getActiveConfig');
    };

    loadFiles = () => {
      this.setState({ loading: true });
      // Request file list from FluidNC
      controller.command('fluidnc:listFiles');
    };

    handleDownload = (file) => {
      // TODO: Implement file download from FluidNC
      console.log('Downloading file:', file.name);
    };

    handleUpload = () => {
      // Create file input for upload
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.yaml,.yml,.gcode,.nc,.txt';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          this.uploadFile(file);
        }
      };
      input.click();
    };

    uploadFile = (file) => {
      // In a real implementation, this would upload the file to FluidNC
      console.log('Uploading file:', file.name);
      // TODO: Implement file upload to FluidNC device
      // For now, just refresh the file list
      this.loadFiles();
    };

    handleDelete = (file) => {
      if (file.name === this.state.activeConfig) {
        // eslint-disable-next-line no-alert
        alert(i18n._('Cannot delete the active configuration file'));
        return;
      }

      // eslint-disable-next-line no-alert, no-restricted-globals
      if (confirm(i18n._('Are you sure you want to delete {{filename}}?', { filename: file.name }))) {
        // Send command to delete file from FluidNC
        controller.command('fluidnc:deleteFile', file.name);
      }
    };

    handleEdit = (file) => {
      if (file.type === 'yaml' || file.type === 'yml') {
        this.setState({ editingFile: file.name });
      }
    };

    handleCloseEditor = () => {
      this.setState({ editingFile: null });
    };

    render() {
      const { files, loading, editingFile, activeConfig } = this.state;

      if (editingFile) {
        return (
          <ConfigEditor
            filename={editingFile}
            onClose={this.handleCloseEditor}
          />
        );
      }

      if (loading) {
        return (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <i className="fa fa-spinner fa-spin" />
            <span style={{ marginLeft: '10px' }}>{i18n._('Loading files...')}</span>
          </div>
        );
      }

      return (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <Button
              bsStyle="primary"
              onClick={this.handleUpload}
            >
              <i className="fa fa-upload" />
              <span style={{ marginLeft: '5px' }}>{i18n._('Upload File')}</span>
            </Button>
            <Button
              bsStyle="default"
              onClick={this.loadFiles}
              style={{ marginLeft: '10px' }}
            >
              <i className="fa fa-refresh" />
              <span style={{ marginLeft: '5px' }}>{i18n._('Refresh')}</span>
            </Button>
          </div>

          <Table
            striped bordered condensed
            hover
          >
            <thead>
              <tr>
                <th>{i18n._('File Name')}</th>
                <th>{i18n._('Size')}</th>
                <th>{i18n._('Type')}</th>
                <th>{i18n._('Status')}</th>
                <th>{i18n._('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, index) => {
                const isActive = file.name === activeConfig;
                return (
                  <tr key={index}>
                  <td>
                    {file.name}
                    {isActive ? (
                      <span
                        className="label label-success"
                        style={{ marginLeft: '10px' }}
                      >
                        {i18n._('Active')}
                      </span>
                    ) : null}
                  </td>
                  <td>{(file.size / 1024).toFixed(1)} KB</td>
                  <td>{file.type.toUpperCase()}</td>
                  <td>
                    {isActive ? (
                      <span className="text-success">
                        <i className="fa fa-check-circle" />
                        <span style={{ marginLeft: '5px' }}>{i18n._('Active Config')}</span>
                      </span>
                    ) : (
                      <span className="text-muted">{i18n._('Available')}</span>
                    )}
                  </td>
                  <td>
                    <Button
                      bsSize="xs"
                      bsStyle="primary"
                      onClick={() => this.handleDownload(file)}
                      style={{ marginRight: '5px' }}
                    >
                      <i className="fa fa-download" />
                    </Button>
                    {(file.type === 'yaml' || file.type === 'yml') ? (
                      <Button
                        bsSize="xs"
                        bsStyle="info"
                        onClick={() => this.handleEdit(file)}
                        style={{ marginRight: '5px' }}
                      >
                        <i className="fa fa-edit" />
                      </Button>
                    ) : null}
                    <Button
                      bsSize="xs"
                      bsStyle="danger"
                      disabled={isActive}
                      onClick={() => this.handleDelete(file)}
                    >
                      <i className="fa fa-trash" />
                    </Button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </Table>

          {files.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
              {i18n._('No files found')}
            </div>
          )}
        </div>
      );
    }
}

export default FileManager;
