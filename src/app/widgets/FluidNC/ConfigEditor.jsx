import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from 'app/components/Buttons';
import i18n from 'app/lib/i18n';
import styles from './index.styl';

class ConfigEditor extends PureComponent {
    static propTypes = {
      config: PropTypes.string.isRequired,
      onRefresh: PropTypes.func.isRequired,
      onSave: PropTypes.func.isRequired
    };

    state = {
      editedConfig: '',
      hasChanges: false,
      saving: false
    };

    componentDidMount() {
      this.setState({ editedConfig: this.props.config });
    }

    componentDidUpdate(prevProps) {
      if (prevProps.config !== this.props.config) {
        this.setState({
          editedConfig: this.props.config,
          hasChanges: false
        });
      }
    }

    handleConfigChange = (e) => {
      const editedConfig = e.target.value;
      this.setState({
        editedConfig,
        hasChanges: editedConfig !== this.props.config
      });
    };

    handleSave = () => {
      // TODO: Add proper confirmation modal
      this.setState({ saving: true });
      this.props.onSave(this.state.editedConfig);
      setTimeout(() => {
          this.setState({ saving: false, hasChanges: false });
        }, 2000);
    };

    handleReset = () => {
      // TODO: Add proper confirmation modal
      this.setState({
        editedConfig: this.props.config,
        hasChanges: false
      });
    };

    render() {
      const { onRefresh } = this.props;
      const { editedConfig, hasChanges, saving } = this.state;

      return (
        <div className={styles.configEditor}>
          <div className="row">
            <div className="col-sm-12">
              <div className="pull-right" style={{ marginBottom: 10 }}>
                <Button
                  btnSize="sm"
                  onClick={onRefresh}
                  disabled={saving}
                >
                  <i className="fa fa-refresh" />
                  <span className="space" />
                  {i18n._('Refresh')}
                </Button>
                <span className="space" />
                <Button
                  btnSize="sm"
                  onClick={this.handleReset}
                  disabled={!hasChanges || saving}
                >
                  <i className="fa fa-undo" />
                  <span className="space" />
                  {i18n._('Reset')}
                </Button>
                <span className="space" />
                <Button
                  btnSize="sm"
                  btnStyle="primary"
                  onClick={this.handleSave}
                  disabled={!hasChanges || saving}
                >
                  {saving ? (
                    <>
                      <i className="fa fa-spinner fa-spin" />
                      <span className="space" />
                      {i18n._('Saving...')}
                    </>
                  ) : (
                    <>
                      <i className="fa fa-save" />
                      <span className="space" />
                      {i18n._('Save Configuration')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className={styles.editorContainer}>
            {hasChanges ? (
              <div className={styles.changeIndicator}>
                <i className="fa fa-exclamation-triangle" />
                <span className="space" />
                {i18n._('You have unsaved changes')}
              </div>
) : null}

            <textarea
              className={styles.configTextarea}
              value={editedConfig}
              onChange={this.handleConfigChange}
              placeholder={i18n._('Configuration will appear here...')}
              disabled={saving}
            />
          </div>

          <div className={styles.helpText}>
            <h5>{i18n._('Configuration Help')}</h5>
            <ul>
              <li>{i18n._('This is the FluidNC YAML configuration file')}</li>
              <li>{i18n._('Changes will take effect after saving and device restart')}</li>
              <li>{i18n._('Syntax errors may prevent the device from starting properly')}</li>
              <li>{i18n._('Always backup your working configuration before making changes')}</li>
            </ul>

            <h6>{i18n._('Common Configuration Sections:')}</h6>
            <div className={styles.configReference}>
              <div className="row">
                <div className="col-sm-6">
                  <strong>axes:</strong>
                  <ul>
                    <li>shared_stepper_disable_pin</li>
                    <li>x, y, z axis settings</li>
                    <li>steps_per_mm</li>
                    <li>max_rate_mm_per_min</li>
                  </ul>
                </div>
                <div className="col-sm-6">
                  <strong>spi:</strong>
                  <ul>
                    <li>miso_pin, mosi_pin</li>
                    <li>sck_pin</li>
                  </ul>
                </div>
              </div>
              <div className="row">
                <div className="col-sm-6">
                  <strong>stepping:</strong>
                  <ul>
                    <li>engine</li>
                    <li>idle_ms</li>
                    <li>pulse_us</li>
                  </ul>
                </div>
                <div className="col-sm-6">
                  <strong>control:</strong>
                  <ul>
                    <li>safety_door_pin</li>
                    <li>reset_pin</li>
                    <li>feed_hold_pin</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
}

export default ConfigEditor;
