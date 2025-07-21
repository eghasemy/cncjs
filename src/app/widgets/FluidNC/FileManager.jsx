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
    loadingMessage: 'Loading files...',
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
    // Clear any pending timeout
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }
  }

  subscribe() {
    console.log('FileManager: Subscribing to controller events...');
    const tokens = [
      controller.addListener('fluidnc:deviceInfo', (deviceInfo) => {
        console.log('FileManager: Device info received:', deviceInfo);
        const prevDeviceInfo = this.state.deviceInfo;
        this.setState({ deviceInfo });

        // Check if we have a valid IP address
        if (deviceInfo.ip) {
          const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
          if (ipPattern.test(deviceInfo.ip)) {
            console.log(`FileManager: Valid IP address detected: ${deviceInfo.ip}`);
            // If IP changed from empty/invalid to valid, automatically reload files
            if (!prevDeviceInfo.ip || !ipPattern.test(prevDeviceInfo.ip)) {
              console.log('FileManager: IP address newly available, reloading files...');
              setTimeout(() => {
                this.loadFiles();
              }, 500); // Small delay to allow connection to stabilize
            }
          } else {
            console.warn(`FileManager: Invalid IP address format: ${deviceInfo.ip}`);
          }
        } else {
          console.log('FileManager: No IP address in device info');
        }
      }),
      controller.addListener('fluidnc:activeConfig', (activeConfig) => {
        console.log('FileManager: Active config received:', activeConfig);
        this.setState({ activeConfig });
      }),
      controller.addListener('fluidnc:fileList', (files) => {
        console.log('FileManager: *** FILE LIST EVENT RECEIVED ***');
        console.log('FileManager: File list received - count:', files ? files.length : 0);
        console.log('FileManager: File list contents:', files);

        if (files && files.length > 0) {
          console.log('FileManager: Files detected! Setting state with files...');
          files.forEach((file, index) => {
            console.log(`FileManager: File ${index}: ${file.name} (${file.size} bytes, ${file.type})`);
          });
        } else {
          console.log('FileManager: No files in the received list');
        }
        // Clear timeout if we receive a response
        if (this.loadingTimeout) {
          clearTimeout(this.loadingTimeout);
          this.loadingTimeout = null;
        }
        this.setState({ files, loading: false });
        console.log('FileManager: State updated with file list');
      }),
      controller.addListener('fluidnc:localfs', (data) => {
        console.log('FileManager: LocalFS event received:', data);
      }),
      // Add debug listener for all controller events
      controller.addListener('*', (eventName, ...args) => {
        if (eventName && eventName.startsWith('fluidnc:')) {
          console.log(`FileManager: FluidNC event received: ${eventName}`, args);
        }
      })
    ];
    this.subscriptionTokens = tokens;
    console.log('FileManager: Subscribed to', tokens.length, 'controller events');
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
    console.log('FileManager: Loading files...');
    this.setState({ loading: true, loadingMessage: 'Loading files...' });
    // Request file list from FluidNC
    controller.command('fluidnc:listFiles');

    // Add timeout to clear loading state if no response
    this.loadingTimeout = setTimeout(() => {
      console.log('FileManager: File loading timed out after 5 seconds');
      this.setState({
        loading: false,
        files: [] // Empty list instead of hanging
      });
    }, 5000); // 5 second timeout
  };

  handleDownload = (file) => {
    // Request file download from FluidNC device
    controller.command('fluidnc:downloadFile', file.name, (error, fileData) => {
      if (error) {
        // eslint-disable-next-line no-alert
        alert(i18n._('Failed to download file: {{error}}', { error: error.message }));
        return;
      }

      // Create blob and download link
      const blob = new Blob([fileData]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    });
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
    // Show uploading state
    this.setState({ loading: true, loadingMessage: `Uploading ${file.name}...` });

    // Create a FileReader to read the file data
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = e.target.result;

      // Send file data to server for upload
      controller.command('fluidnc:uploadFile', fileData, file.name, (error) => {
        this.setState({ loading: false });
        if (error) {
          // eslint-disable-next-line no-alert
          alert(i18n._('Failed to upload file: {{error}}', { error: error.message }));
        } else {
          // File list will be refreshed automatically by the server
        }
      });
    };

    reader.onerror = () => {
      this.setState({ loading: false });
      // eslint-disable-next-line no-alert
      alert(i18n._('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
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
      controller.command('fluidnc:deleteFile', file.name, (error) => {
        if (error) {
          // eslint-disable-next-line no-alert
          alert(i18n._('Failed to delete file: {{error}}', { error: error.message }));
        }
      });
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
    const { files, loading, loadingMessage, editingFile, activeConfig } = this.state;

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
          <span style={{ marginLeft: '10px' }}>{i18n._(loadingMessage)}</span>
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
          <Button
            bsStyle="warning"
            onClick={() => {
              console.log('FileManager: DEBUG TEST - Sending $LocalFS/List command directly');
              controller.writeln('$LocalFS/List');
            }}
            style={{ marginLeft: '10px' }}
          >
            <i className="fa fa-bug" />
            <span style={{ marginLeft: '5px' }}>Debug List</span>
          </Button>
          <Button
            bsStyle="info"
            onClick={() => {
              console.log('FileManager: DEBUG TEST - Adding mock file to test UI');
              this.setState({
                files: [...this.state.files, {
                  name: 'test-mock.yaml',
                  size: 1234,
                  type: 'file'
                }]
              });
            }}
            style={{ marginLeft: '10px' }}
          >
            <i className="fa fa-plus" />
            <span style={{ marginLeft: '5px' }}>Add Mock</span>
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
