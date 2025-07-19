import PropTypes from 'prop-types';
import React, { useState } from 'react';
import { Button } from 'app/components/Buttons';
import Modal from 'app/components/Modal';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import styles from './index.styl';

const Settings = ({ state, actions }) => {
  const settings = state.controller.settings || {};
  const all = settings.settings || {};
  const [values, setValues] = useState(() => ({ ...all }));

  const handleChange = (name, value) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    Object.keys(values).forEach(key => {
      if (String(all[key]) !== String(values[key])) {
        controller.writeln(`${key}=${values[key]}`);
      }
    });
    actions.closeModal();
  };

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
                    onChange={e => handleChange(key, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={actions.closeModal}>{i18n._('Cancel')}</Button>
        <Button btnStyle="primary" onClick={handleSave}>{i18n._('Save')}</Button>
      </Modal.Footer>
    </Modal>
  );
};

Settings.propTypes = {
  state: PropTypes.object,
  actions: PropTypes.object
};

export default Settings;
