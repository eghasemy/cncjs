import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Table } from 'react-bootstrap';
import i18n from 'app/lib/i18n';

class Info extends PureComponent {
  static propTypes = {
    state: PropTypes.object
  };

  render() {
    const { state } = this.props;
    const deviceInfo = state.fluidnc ? state.fluidnc.deviceInfo : {};

    return (
      <div>
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
          </div>
        ) : null}
      </div>
    );
  }
}

export default Info;