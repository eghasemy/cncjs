import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Modal } from 'react-bootstrap';
import { Nav, NavItem } from '@trendmicro/react-navs';
import i18n from 'app/lib/i18n';
import FileManager from './FileManager';
import Calibrate from './Calibrate';
import Info from './Info';

class Settings extends PureComponent {
  static propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
  };

  state = {
    activeTab: 'info'
  };

  render() {
    const { state, actions } = this.props;
    const { activeTab } = this.state;

    return (
      <Modal
        backdrop="static"
        size="lg"
        show={true}
        onHide={actions.closeModal}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {i18n._('FluidNC Settings')}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0 }}>
          <Nav
            navStyle="tabs"
            activeKey={activeTab}
            onSelect={(eventKey) => {
              this.setState({ activeTab: eventKey });
            }}
            style={{
              marginBottom: 0,
              borderBottom: '1px solid #ddd'
            }}
          >
            <NavItem eventKey="info">
              {i18n._('Info')}
            </NavItem>
            <NavItem eventKey="filemanager">
              {i18n._('File Manager')}
            </NavItem>
            <NavItem eventKey="calibrate">
              {i18n._('Calibrate')}
            </NavItem>
          </Nav>
          <div style={{ padding: '20px' }}>
            {activeTab === 'info' ? (
              <Info
                state={state}
                actions={actions}
              />
            ) : null}
            {activeTab === 'filemanager' ? (
              <FileManager
                state={state}
                actions={actions}
              />
            ) : null}
            {activeTab === 'calibrate' ? (
              <Calibrate
                state={state}
                actions={actions}
              />
            ) : null}
          </div>
        </Modal.Body>
      </Modal>
    );
  }
}

export default Settings;
