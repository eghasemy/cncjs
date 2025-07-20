import _ from 'lodash';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button, Table, FormGroup, ControlLabel, FormControl, Checkbox } from 'react-bootstrap';
import i18n from 'app/lib/i18n';
import controller from 'app/lib/controller';

class Calibrate extends PureComponent {
    static propTypes = {
      state: PropTypes.object,
      actions: PropTypes.object
    };

    state = {
      endstops: [],
      loading: false,
      editingPin: null,
      editPullup: false,
      editInvert: false
    };

    componentDidMount() {
      this.loadEndstops();
    }

    loadEndstops = () => {
      this.setState({ loading: true });
      
      // For now, simulate endstop loading from config
      // In a real implementation, this would parse the active YAML config
      setTimeout(() => {
        this.setState({
          endstops: [
            { 
              name: 'X Min', 
              pin: 'gpio.2', 
              status: 'Open', 
              pullup: true, 
              invert: false,
              enabled: true 
            },
            { 
              name: 'X Max', 
              pin: 'gpio.3', 
              status: 'Closed', 
              pullup: true, 
              invert: false,
              enabled: true 
            },
            { 
              name: 'Y Min', 
              pin: 'gpio.4', 
              status: 'Open', 
              pullup: true, 
              invert: false,
              enabled: true 
            },
            { 
              name: 'Y Max', 
              pin: 'gpio.5', 
              status: 'Closed', 
              pullup: false, 
              invert: true,
              enabled: false 
            },
            { 
              name: 'Z Min', 
              pin: 'gpio.6', 
              status: 'Open', 
              pullup: true, 
              invert: false,
              enabled: true 
            }
          ],
          loading: false
        });
      }, 500);
    };

    handleEdit = (endstop) => {
      this.setState({
        editingPin: endstop.name,
        editPullup: endstop.pullup,
        editInvert: endstop.invert
      });
    };

    handleSave = () => {
      const { editingPin, editPullup, editInvert } = this.state;
      
      // Update the endstop configuration
      this.setState(prevState => ({
        endstops: prevState.endstops.map(endstop => 
          endstop.name === editingPin 
            ? { ...endstop, pullup: editPullup, invert: editInvert }
            : endstop
        ),
        editingPin: null
      }));

      // Send command to update FluidNC config
      // This would typically update the YAML config file
      const endstop = this.state.endstops.find(e => e.name === editingPin);
      if (endstop) {
        controller.writeln(`$Config/set ${endstop.pin}.pullup=${editPullup}`);
        controller.writeln(`$Config/set ${endstop.pin}.invert=${editInvert}`);
      }
    };

    handleCancel = () => {
      this.setState({
        editingPin: null,
        editPullup: false,
        editInvert: false
      });
    };

    render() {
      const { endstops, loading, editingPin, editPullup, editInvert } = this.state;

      if (loading) {
        return (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <i className="fa fa-spinner fa-spin" />
            <span style={{ marginLeft: '10px' }}>{i18n._('Loading endstop configuration...')}</span>
          </div>
        );
      }

      return (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <p className="text-muted">
              {i18n._('Configure endstop pins and their settings. Changes will be saved to the active configuration file.')}
            </p>
            <Button
              bsStyle="default"
              onClick={this.loadEndstops}
            >
              <i className="fa fa-refresh" />
              <span style={{ marginLeft: '5px' }}>{i18n._('Refresh Status')}</span>
            </Button>
          </div>

          <Table striped bordered condensed hover>
            <thead>
              <tr>
                <th>{i18n._('Endstop')}</th>
                <th>{i18n._('Pin')}</th>
                <th>{i18n._('Status')}</th>
                <th>{i18n._('Pullup')}</th>
                <th>{i18n._('Invert')}</th>
                <th>{i18n._('Enabled')}</th>
                <th>{i18n._('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {endstops.map((endstop, index) => (
                <tr key={index}>
                  <td><strong>{endstop.name}</strong></td>
                  <td><code>{endstop.pin}</code></td>
                  <td>
                    <span 
                      className={`label ${endstop.status === 'Closed' ? 'label-danger' : 'label-success'}`}
                    >
                      {endstop.status}
                    </span>
                  </td>
                  <td>
                    {editingPin === endstop.name ? (
                      <Checkbox
                        checked={editPullup}
                        onChange={(e) => this.setState({ editPullup: e.target.checked })}
                      />
                    ) : (
                      <span className={endstop.pullup ? 'text-success' : 'text-muted'}>
                        <i className={`fa ${endstop.pullup ? 'fa-check' : 'fa-times'}`} />
                      </span>
                    )}
                  </td>
                  <td>
                    {editingPin === endstop.name ? (
                      <Checkbox
                        checked={editInvert}
                        onChange={(e) => this.setState({ editInvert: e.target.checked })}
                      />
                    ) : (
                      <span className={endstop.invert ? 'text-warning' : 'text-muted'}>
                        <i className={`fa ${endstop.invert ? 'fa-check' : 'fa-times'}`} />
                      </span>
                    )}
                  </td>
                  <td>
                    <span className={endstop.enabled ? 'text-success' : 'text-muted'}>
                      <i className={`fa ${endstop.enabled ? 'fa-check-circle' : 'fa-circle-o'}`} />
                    </span>
                  </td>
                  <td>
                    {editingPin === endstop.name ? (
                      <div>
                        <Button
                          bsSize="xs"
                          bsStyle="success"
                          onClick={this.handleSave}
                          style={{ marginRight: '5px' }}
                        >
                          <i className="fa fa-check" />
                        </Button>
                        <Button
                          bsSize="xs"
                          bsStyle="default"
                          onClick={this.handleCancel}
                        >
                          <i className="fa fa-times" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        bsSize="xs"
                        bsStyle="primary"
                        onClick={() => this.handleEdit(endstop)}
                        disabled={!endstop.enabled}
                      >
                        <i className="fa fa-edit" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>

          {endstops.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
              {i18n._('No endstops configured')}
            </div>
          )}

          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <h5><i className="fa fa-info-circle" /> {i18n._('Endstop Settings Help')}</h5>
            <ul style={{ marginBottom: 0, paddingLeft: '20px' }}>
              <li><strong>{i18n._('Pullup')}:</strong> {i18n._('Enable internal pullup resistor for the pin')}</li>
              <li><strong>{i18n._('Invert')}:</strong> {i18n._('Invert the logic level of the endstop signal')}</li>
              <li><strong>{i18n._('Status')}:</strong> {i18n._('Current real-time state of the endstop pin')}</li>
            </ul>
          </div>
        </div>
      );
    }
}

export default Calibrate;