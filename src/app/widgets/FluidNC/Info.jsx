import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Table, FormGroup, InputGroup, FormControl, Button } from 'react-bootstrap';
import { ToastNotification } from 'app/components/Notifications';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';

class Info extends PureComponent {
  static propTypes = {
    state: PropTypes.object
  };

  constructor(props) {
    super(props);
    this.state = {
      manualIP: '',
      errorMessage: '',
      deviceInfo: {}
    };
  }

  componentDidMount() {
    this.token = controller.addListener(
      'fluidnc:deviceInfo',
      (info) => this.setState({ deviceInfo: info })
    );
  }

  componentWillUnmount() {
    if (this.token) {
      controller.removeListener(this.token);
    }
  }

  handleManualIPChange = (event) => {
    this.setState({
      manualIP: event.target.value
    });
  };

  handleSaveManualIP = () => {
    const { manualIP } = this.state;
    if (manualIP.trim()) {
      // Validate IP format
      const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
      if (ipPattern.test(manualIP.trim())) {
        console.log(`FluidNC Info: Setting manual IP address: ${manualIP.trim()}`);
        // Clear any previous error message
        this.setState({ errorMessage: '' });
        // Emit the manual IP to the controller
        controller.command('fluidnc:setManualIP', manualIP.trim());
      } else {
        this.setState({
          errorMessage: i18n._('Invalid IP address format. Please enter a valid IP address (e.g., 192.168.1.100)')
        });
      }
    }
  };

  render() {
    const { errorMessage, deviceInfo } = this.state;

    return (
      <div>
        {errorMessage ? (
          <ToastNotification
            style={{ marginBottom: '10px' }}
            type="error"
            onDismiss={() => {
              this.setState({ errorMessage: '' });
            }}
          >
            {errorMessage}
          </ToastNotification>
        ) : null}
        <h5>{i18n._('Device Information')}</h5>
        <Table striped bordered>
          <tbody>
            <tr>
              <td><strong>{i18n._('IP Address')}</strong></td>
              <td>
                {deviceInfo.ip ? (
                  <span style={{ color: '#5cb85c' }}>{deviceInfo.ip}</span>
                ) : (
                  <span style={{ color: '#d9534f' }}>{i18n._('Not detected')}</span>
                )}
              </td>
            </tr>
            <tr>
              <td><strong>{i18n._('Machine Name')}</strong></td>
              <td>{deviceInfo.machine || i18n._('Unknown')}</td>
            </tr>
            <tr>
              <td><strong>{i18n._('Mode')}</strong></td>
              <td>{deviceInfo.mode || i18n._('Unknown')}</td>
            </tr>
            <tr>
              <td><strong>{i18n._('SSID')}</strong></td>
              <td>{deviceInfo.ssid || i18n._('Unknown')}</td>
            </tr>
            <tr>
              <td><strong>{i18n._('Status')}</strong></td>
              <td>
                {deviceInfo.status ? (
                  <span style={{ color: deviceInfo.status === 'Connected' ? '#5cb85c' : '#f0ad4e' }}>
                    {deviceInfo.status}
                  </span>
                ) : (
                  i18n._('Unknown')
                )}
              </td>
            </tr>
            <tr>
              <td><strong>{i18n._('MAC Address')}</strong></td>
              <td>{deviceInfo.mac || i18n._('Unknown')}</td>
            </tr>
          </tbody>
        </Table>
        {!deviceInfo.ip ? (
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <small style={{ color: '#777' }}>
              {i18n._('To detect device information, send the $I command from the console.')}
            </small>
            <div style={{ marginTop: '10px' }}>
              <strong>{i18n._('Manual IP Entry:')}</strong>
              <FormGroup style={{ marginTop: '5px' }}>
                <InputGroup>
                  <FormControl
                    type="text"
                    placeholder={i18n._('Enter IP address (e.g., 192.168.1.100)')}
                    value={this.state.manualIP}
                    onChange={this.handleManualIPChange}
                  />
                  <InputGroup.Button>
                    <Button
                      onClick={this.handleSaveManualIP}
                      disabled={!this.state.manualIP.trim()}
                    >
                      {i18n._('Save')}
                    </Button>
                  </InputGroup.Button>
                </InputGroup>
              </FormGroup>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
}

export default Info;
