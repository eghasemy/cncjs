import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from 'app/components/Buttons';
import Modal from 'app/components/Modal';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import styles from './index.styl';

class Settings extends PureComponent {
  static propTypes = {
    state: PropTypes.object,
    actions: PropTypes.object
  };

  constructor(props) {
    super(props);
    const settings = props.state.controller.settings || {};
    const all = settings.settings || {};
    this.state = {
      values: { ...all },
      all
    };
  }

  handleChange = (name, value) => {
    this.setState(state => ({
      values: { ...state.values, [name]: value }
    }));
  };

  handleSave = () => {
    const { values, all } = this.state;
    Object.keys(values).forEach(key => {
      if (String(all[key]) !== String(values[key])) {
        controller.writeln(`${key}=${values[key]}`);
      }
    });
    this.props.actions.closeModal();
  };

  render() {
    const { values } = this.state;
    const { actions } = this.props;
    return (
      <Modal size="lg" onClose={actions.closeModal}>
        <Modal.Header>
          <Modal.Title>{i18n._('grblHAL Settings')}</Modal.Title>
        </Modal.Header>
        <Modal.Body className={styles.settingsModalBody}>
          <table className={styles.settingsTable}>
            <thead>
              <tr>
                <th>{i18n._('Setting')}</th>
                <th>{i18n._('Value')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(values).map(key => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      value={values[key]}
                      onChange={e => this.handleChange(key, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={actions.closeModal}>{i18n._('Cancel')}</Button>
          <Button btnStyle="primary" onClick={this.handleSave}>{i18n._('Save')}</Button>
        </Modal.Footer>
      </Modal>
    );
  }
}

export default Settings;
