import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from 'app/components/Buttons';
import i18n from 'app/lib/i18n';
import styles from './index.styl';

class FileManager extends PureComponent {
    static propTypes = {
      files: PropTypes.array.isRequired,
      onRefresh: PropTypes.func.isRequired,
      onUpload: PropTypes.func.isRequired,
      onDelete: PropTypes.func.isRequired
    };

    state = {
      dragOver: false,
      uploading: false
    };

    fileInputRef = React.createRef();
    _isMounted = false;

    handleDragOver = (e) => {
      e.preventDefault();
      if (this._isMounted) {
        this.setState({ dragOver: true });
      }
    };

    handleDragLeave = (e) => {
      e.preventDefault();
      if (this._isMounted) {
        this.setState({ dragOver: false });
      }
    };

    handleDrop = (e) => {
      e.preventDefault();
      if (this._isMounted) {
        this.setState({ dragOver: false });
      }

      const files = Array.from(e.dataTransfer.files);
      files.forEach(file => this.uploadFile(file));
    };

    handleFileSelect = (e) => {
      const files = Array.from(e.target.files);
      files.forEach(file => this.uploadFile(file));
      e.target.value = ''; // Reset input
    };

    uploadFile = (file) => {
      if (!this._isMounted) {
        return;
      }

      this.setState({ uploading: true });

      const reader = new FileReader();
      reader.onload = (e) => {
        if (this._isMounted) {
          this.props.onUpload(file.name, e.target.result);
          this.setState({ uploading: false });
        }
      };
      reader.onerror = () => {
        if (this._isMounted) {
          console.error(i18n._('Failed to read file: {{filename}}', { filename: file.name }));
          this.setState({ uploading: false });
        }
      };
      reader.readAsText(file);
    };

    formatFileSize = (bytes) => {
      if (bytes === 0) {
 return '0 B';
}
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i];
    };

    componentDidMount() {
      this._isMounted = true;
    }

    componentWillUnmount() {
      this._isMounted = false;
    }

    render() {
      const { files, onRefresh, onDelete } = this.props;
      const { dragOver, uploading } = this.state;

      return (
        <div className={styles.fileManager}>
          <div className="row">
            <div className="col-sm-12">
              <div className="pull-right" style={{ marginBottom: 10 }}>
                <Button
                  btnSize="sm"
                  onClick={onRefresh}
                  disabled={uploading}
                >
                  <i className="fa fa-refresh" />
                  <span className="space" />
                  {i18n._('Refresh')}
                </Button>
                <span className="space" />
                <Button
                  btnSize="sm"
                  onClick={() => this.fileInputRef.current.click()}
                  disabled={uploading}
                >
                  <i className="fa fa-upload" />
                  <span className="space" />
                  {i18n._('Upload File')}
                </Button>
                <input
                  ref={this.fileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={this.handleFileSelect}
                />
              </div>
            </div>
          </div>

          <div
            className={`${styles.dropZone} ${dragOver ? styles.dragOver : ''}`}
            onDragOver={this.handleDragOver}
            onDragLeave={this.handleDragLeave}
            onDrop={this.handleDrop}
          >
            {uploading ? (
              <div className={styles.uploading}>
                <i className="fa fa-spinner fa-spin" />
                <span className="space" />
                {i18n._('Uploading...')}
              </div>
            ) : (
              <>
                <i className="fa fa-cloud-upload fa-3x" />
                <p>{i18n._('Drop files here or click "Upload File" to select files')}</p>
              </>
            )}
          </div>

          <div className={styles.fileList}>
            <div className={styles.fileListHeader}>
              <div className="row">
                <div className="col-sm-6">
                  <strong>{i18n._('Filename')}</strong>
                </div>
                <div className="col-sm-2">
                  <strong>{i18n._('Size')}</strong>
                </div>
                <div className="col-sm-2">
                  <strong>{i18n._('Type')}</strong>
                </div>
                <div className="col-sm-2">
                  <strong>{i18n._('Actions')}</strong>
                </div>
              </div>
            </div>

            {files.length === 0 ? (
              <div className={styles.emptyState}>
                <p>{i18n._('No files found on the device.')}</p>
                <p><small>{i18n._('Click "Refresh" to check for files or upload new files.')}</small></p>
              </div>
            ) : (
              files.map((file, index) => (
                <div key={index} className={styles.fileRow}>
                  <div className="row">
                    <div className="col-sm-6">
                      <i className={`fa ${this.getFileIcon(file.name)}`} />
                      <span className="space" />
                      {file.name}
                      {file.active ? (
                        <span className={styles.activeIndicator}>
                          <span className="space" />
                          <i className="fa fa-star" title={i18n._('Active Configuration')} />
                        </span>
) : null}
                    </div>
                    <div className="col-sm-2">
                      {this.formatFileSize(file.size || 0)}
                    </div>
                    <div className="col-sm-2">
                      {this.getFileType(file.name)}
                    </div>
                    <div className="col-sm-2">
                      <Button
                        btnSize="xs"
                        btnStyle="flat"
                        onClick={() => onDelete(file.name)}
                        disabled={uploading}
                        title={i18n._('Delete File')}
                      >
                        <i className="fa fa-trash" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    getFileIcon = (filename) => {
      const ext = filename.split('.').pop().toLowerCase();
      switch (ext) {
        case 'yaml':
        case 'yml':
          return 'fa-file-code-o';
        case 'nc':
        case 'gcode':
        case 'cnc':
          return 'fa-file-text-o';
        case 'txt':
          return 'fa-file-text-o';
        default:
          return 'fa-file-o';
      }
    };

    getFileType = (filename) => {
      const ext = filename.split('.').pop().toLowerCase();
      switch (ext) {
        case 'yaml':
        case 'yml':
          return i18n._('Configuration');
        case 'nc':
        case 'gcode':
        case 'cnc':
          return i18n._('G-Code');
        case 'txt':
          return i18n._('Text');
        default:
          return i18n._('Unknown');
      }
    };
}

export default FileManager;
