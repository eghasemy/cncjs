import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Nav, NavItem } from 'app/components/Navs';
import Modal from 'app/components/Modal';
import controller from 'app/lib/controller';
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
    const files = [];
    let active = '';
    let stage = 'list';

    const handleData = (data) => {
      String(data)
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line)
        .forEach((line) => {
          if (stage === 'list') {
            if (line.startsWith('[FILE:')) {
              const match = line.match(/^\[FILE:([^|]+)\|SIZE:/);
              if (match) {
                files.push(match[1]);
              }
              return;
            }
            if (line === 'ok') {
              stage = 'startup';
              controller.writeln('$N');
              return;
            }
            return;
          }

          if (stage === 'startup') {
            if (line.startsWith('$Config/Filename=')) {
              active = line.split('=')[1];
              return;
            }
            if (line === 'ok') {
              controller.removeListener('serialport:read', handleData);
              this.setState({ files, active });
            }
          }
        });
    };

    controller.addListener('serialport:read', handleData);
    controller.writeln('$LocalFS/List');
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
