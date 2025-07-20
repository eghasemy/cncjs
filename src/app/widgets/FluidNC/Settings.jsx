import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Nav, NavItem } from 'app/components/Navs';
import Modal from 'app/components/Modal';
import api from 'app/api';
import i18n from 'app/lib/i18n';

class Settings extends PureComponent {
  static propTypes = {
    actions: PropTypes.object
  };

  state = {
    tab: 'files',
    files: [],
    active: ''
  };

  componentDidMount() {
    this.fetch();
  }

  fetch = () => {
    api.fluidnc.list().then(res => {
      const { files = [], active } = res.body || {};
      this.setState({ files, active });
    });
  };

  render() {
    const { actions } = this.props;
    const { tab, files, active } = this.state;
    return (
      <Modal size="lg" onClose={actions.closeModal}>
        <Modal.Header>
          <Modal.Title>{i18n._('FluidNC Settings')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Nav navStyle="tabs" activeKey={tab} onSelect={key => this.setState({ tab: key })} style={{ marginBottom: 10 }}>
            <NavItem eventKey="files">{i18n._('File Manager')}</NavItem>
            <NavItem eventKey="calibrate">{i18n._('Calibrate')}</NavItem>
          </Nav>
          {tab === 'files' && (
            <div>
              <ul>
                {files.map(f => (
                  <li key={f}>
                    {f} {f === active && <strong>({i18n._('active')})</strong>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {tab === 'calibrate' && (
            <div>{i18n._('No calibration data')}</div>
          )}
        </Modal.Body>
      </Modal>
    );
  }
}

export default Settings;
