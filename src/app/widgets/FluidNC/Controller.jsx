import PropTypes from 'prop-types';
import React from 'react';
import { Button } from 'app/components/Buttons';
import Modal from 'app/components/Modal';
import { Nav, NavItem } from 'app/components/Navs';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import styles from './index.styl';

const Controller = (props) => {
  const { state, actions } = props;
  const { activeTab = 'state' } = state.modal.params;
  const height = Math.max(window.innerHeight / 2, 200);

  return (
    <Modal disableOverlay size="lg" onClose={actions.closeModal}>
      <Modal.Header>
        <Modal.Title>
          FluidNC
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Nav
          navStyle="tabs"
          activeKey={activeTab}
          onSelect={(eventKey, event) => {
            actions.updateModalParams({ activeTab: eventKey });
          }}
          style={{ marginBottom: 10 }}
        >
          <NavItem eventKey="state">{i18n._('Controller State')}</NavItem>
          <NavItem eventKey="settings">{i18n._('Controller Settings')}</NavItem>
        </Nav>
        <div className={styles.navContent} style={{ height: height }}>
          {activeTab === 'state' && (
            <pre className={styles.pre}>
              <code>{JSON.stringify(state.controller.state, null, 4)}</code>
            </pre>
          )}
          {activeTab === 'settings' && (
            <div>
              <Button
                btnSize="xs"
                btnStyle="flat"
                style={{
                  position: 'absolute',
                  right: 10,
                  top: 10
                }}
                onClick={event => {
                  controller.command('gcode', '$$');
                }}
              >
                <i className="fa fa-refresh" />
                <span className="space" />
                {i18n._('Refresh')}
              </Button>
              <pre className={styles.pre}>
                <code>{JSON.stringify(state.controller.settings, null, 4)}</code>
              </pre>
            </div>
          )}
        </div>
      </Modal.Body>
    </Modal>
  );
};

Controller.propTypes = {
  state: PropTypes.object,
  actions: PropTypes.object
};

export default Controller;
