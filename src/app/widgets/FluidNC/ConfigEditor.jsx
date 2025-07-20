import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Modal, Button, FormGroup, ControlLabel, FormControl, Checkbox } from 'react-bootstrap';
import i18n from 'app/lib/i18n';
import controller from 'app/lib/controller';

class ConfigEditor extends PureComponent {
    static propTypes = {
      filename: PropTypes.string.isRequired,
      onClose: PropTypes.func.isRequired
    };

    state = {
      config: {},
      loading: true,
      saving: false
    };

    componentDidMount() {
      this.loadConfig();
    }

    loadConfig = () => {
      this.setState({ loading: true });

      // For now, simulate loading a YAML config
      // In a real implementation, this would fetch the actual YAML file from FluidNC
      setTimeout(() => {
        // Sample FluidNC configuration structure
        this.setState({
          config: {
            board: 'FluidNC_ESP32',
            name: 'Basic 3 Axis',
            stepping: {
              engine: 'RMT',
              idle_ms: 250,
              pulse_us: 4,
              dir_delay_us: 1
            },
            axes: {
              x: {
                steps_per_mm: 80,
                max_rate_mm_per_min: 5000,
                acceleration_mm_per_sec2: 100,
                max_travel_mm: 300,
                soft_limits: true,
                homing: {
                  cycle: 1,
                  positive_direction: false,
                  mpos_mm: 0,
                  feed_mm_per_min: 100,
                  seek_mm_per_min: 500,
                  settle_ms: 500,
                  seek_scaler: 1.1,
                  feed_scaler: 1.1
                }
              },
              y: {
                steps_per_mm: 80,
                max_rate_mm_per_min: 5000,
                acceleration_mm_per_sec2: 100,
                max_travel_mm: 300,
                soft_limits: true,
                homing: {
                  cycle: 1,
                  positive_direction: false,
                  mpos_mm: 0,
                  feed_mm_per_min: 100,
                  seek_mm_per_min: 500,
                  settle_ms: 500,
                  seek_scaler: 1.1,
                  feed_scaler: 1.1
                }
              },
              z: {
                steps_per_mm: 400,
                max_rate_mm_per_min: 2500,
                acceleration_mm_per_sec2: 50,
                max_travel_mm: 200,
                soft_limits: true,
                homing: {
                  cycle: 2,
                  positive_direction: true,
                  mpos_mm: 200,
                  feed_mm_per_min: 100,
                  seek_mm_per_min: 500,
                  settle_ms: 500,
                  seek_scaler: 1.1,
                  feed_scaler: 1.1
                }
              }
            },
            spi: {
              miso_pin: 'gpio.19',
              mosi_pin: 'gpio.23',
              sck_pin: 'gpio.18'
            }
          },
          loading: false
        });
      }, 500);
    };

    handleConfigChange = (path, value) => {
      this.setState(prevState => {
        const newConfig = { ...prevState.config };
        this.setNestedValue(newConfig, path, value);
        return { config: newConfig };
      });
    };

    setNestedValue = (obj, path, value) => {
      const keys = path.split('.');
      let current = obj;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
    };

    handleSave = () => {
      this.setState({ saving: true });

      // In a real implementation, this would save the YAML config to FluidNC
      controller.writeln(`$Config/save=${this.props.filename}`);

      setTimeout(() => {
        this.setState({ saving: false });
        this.props.onClose();
      }, 1000);
    };

    renderAxisConfig = (axisName, axisConfig) => {
      return (
        <div key={axisName} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ddd', borderRadius: '4px' }}>
          <h5 style={{ textTransform: 'uppercase', color: '#337ab7' }}>
            {axisName} {i18n._('Axis')}
          </h5>

          <div className="row">
            <div className="col-md-6">
              <FormGroup>
                <ControlLabel>{i18n._('Steps per mm')}</ControlLabel>
                <FormControl
                  type="number"
                  value={axisConfig.steps_per_mm || ''}
                  onChange={(e) => this.handleConfigChange(`axes.${axisName}.steps_per_mm`, parseFloat(e.target.value))}
                />
              </FormGroup>
            </div>
            <div className="col-md-6">
              <FormGroup>
                <ControlLabel>{i18n._('Max Rate (mm/min)')}</ControlLabel>
                <FormControl
                  type="number"
                  value={axisConfig.max_rate_mm_per_min || ''}
                  onChange={(e) => this.handleConfigChange(`axes.${axisName}.max_rate_mm_per_min`, parseFloat(e.target.value))}
                />
              </FormGroup>
            </div>
          </div>

          <div className="row">
            <div className="col-md-6">
              <FormGroup>
                <ControlLabel>{i18n._('Acceleration (mm/s²)')}</ControlLabel>
                <FormControl
                  type="number"
                  value={axisConfig.acceleration_mm_per_sec2 || ''}
                  onChange={(e) => this.handleConfigChange(`axes.${axisName}.acceleration_mm_per_sec2`, parseFloat(e.target.value))}
                />
              </FormGroup>
            </div>
            <div className="col-md-6">
              <FormGroup>
                <ControlLabel>{i18n._('Max Travel (mm)')}</ControlLabel>
                <FormControl
                  type="number"
                  value={axisConfig.max_travel_mm || ''}
                  onChange={(e) => this.handleConfigChange(`axes.${axisName}.max_travel_mm`, parseFloat(e.target.value))}
                />
              </FormGroup>
            </div>
          </div>

          <FormGroup>
            <Checkbox
              checked={axisConfig.soft_limits || false}
              onChange={(e) => this.handleConfigChange(`axes.${axisName}.soft_limits`, e.target.checked)}
            >
              {i18n._('Enable Soft Limits')}
            </Checkbox>
          </FormGroup>

          {axisConfig.homing ? (
            <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '3px' }}>
              <h6>{i18n._('Homing Settings')}</h6>
              <div className="row">
                <div className="col-md-4">
                  <FormGroup>
                    <ControlLabel>{i18n._('Homing Cycle')}</ControlLabel>
                    <FormControl
                      type="number"
                      value={axisConfig.homing.cycle || ''}
                      onChange={(e) => this.handleConfigChange(`axes.${axisName}.homing.cycle`, parseInt(e.target.value, 10))}
                    />
                  </FormGroup>
                </div>
                <div className="col-md-4">
                  <FormGroup>
                    <ControlLabel>{i18n._('Feed Rate (mm/min)')}</ControlLabel>
                    <FormControl
                      type="number"
                      value={axisConfig.homing.feed_mm_per_min || ''}
                      onChange={(e) => this.handleConfigChange(`axes.${axisName}.homing.feed_mm_per_min`, parseFloat(e.target.value))}
                    />
                  </FormGroup>
                </div>
                <div className="col-md-4">
                  <FormGroup>
                    <ControlLabel>{i18n._('Seek Rate (mm/min)')}</ControlLabel>
                    <FormControl
                      type="number"
                      value={axisConfig.homing.seek_mm_per_min || ''}
                      onChange={(e) => this.handleConfigChange(`axes.${axisName}.homing.seek_mm_per_min`, parseFloat(e.target.value))}
                    />
                  </FormGroup>
                </div>
              </div>
              <FormGroup>
                <Checkbox
                  checked={axisConfig.homing.positive_direction || false}
                  onChange={(e) => this.handleConfigChange(`axes.${axisName}.homing.positive_direction`, e.target.checked)}
                >
                  {i18n._('Home in Positive Direction')}
                </Checkbox>
              </FormGroup>
            </div>
          ) : null}
        </div>
      );
    };

    render() {
      const { filename } = this.props;
      const { config, loading, saving } = this.state;

      return (
        <Modal
          backdrop="static"
          size="lg"
          show={true}
          onHide={this.props.onClose}
        >
          <Modal.Header closeButton>
            <Modal.Title>
              {i18n._('Edit Configuration: {{filename}}', { filename })}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <i className="fa fa-spinner fa-spin" />
                <span style={{ marginLeft: '10px' }}>{i18n._('Loading configuration...')}</span>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#d9edf7', borderRadius: '4px' }}>
                  <h5>{i18n._('General Settings')}</h5>
                  <div className="row">
                    <div className="col-md-6">
                      <FormGroup>
                        <ControlLabel>{i18n._('Board Type')}</ControlLabel>
                        <FormControl
                          type="text"
                          value={config.board || ''}
                          onChange={(e) => this.handleConfigChange('board', e.target.value)}
                        />
                      </FormGroup>
                    </div>
                    <div className="col-md-6">
                      <FormGroup>
                        <ControlLabel>{i18n._('Configuration Name')}</ControlLabel>
                        <FormControl
                          type="text"
                          value={config.name || ''}
                          onChange={(e) => this.handleConfigChange('name', e.target.value)}
                        />
                      </FormGroup>
                    </div>
                  </div>
                </div>

                {config.stepping ? (
                  <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fcf8e3', borderRadius: '4px' }}>
                    <h5>{i18n._('Stepping Settings')}</h5>
                    <div className="row">
                      <div className="col-md-6">
                        <FormGroup>
                          <ControlLabel>{i18n._('Idle Time (ms)')}</ControlLabel>
                          <FormControl
                            type="number"
                            value={config.stepping.idle_ms || ''}
                            onChange={(e) => this.handleConfigChange('stepping.idle_ms', parseInt(e.target.value, 10))}
                          />
                        </FormGroup>
                      </div>
                      <div className="col-md-6">
                        <FormGroup>
                          <ControlLabel>{i18n._('Pulse Width (µs)')}</ControlLabel>
                          <FormControl
                            type="number"
                            value={config.stepping.pulse_us || ''}
                            onChange={(e) => this.handleConfigChange('stepping.pulse_us', parseInt(e.target.value, 10))}
                          />
                        </FormGroup>
                      </div>
                    </div>
                  </div>
                ) : null}

                {config.axes ? (
                  <div>
                    <h4>{i18n._('Axis Configuration')}</h4>
                    {Object.keys(config.axes).map(axisName => this.renderAxisConfig(axisName, config.axes[axisName]))}
                  </div>
                ) : null}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={this.props.onClose}>
              {i18n._('Cancel')}
            </Button>
            <Button
              bsStyle="primary"
              onClick={this.handleSave}
              disabled={loading || saving}
            >
              {saving ? (
                <span>
                  <i className="fa fa-spinner fa-spin" />
                  <span style={{ marginLeft: '5px' }}>{i18n._('Saving...')}</span>
                </span>
              ) : (
                <span>
                  <i className="fa fa-save" />
                  <span style={{ marginLeft: '5px' }}>{i18n._('Save Configuration')}</span>
                </span>
              )}
            </Button>
          </Modal.Footer>
        </Modal>
      );
    }
}

export default ConfigEditor;
