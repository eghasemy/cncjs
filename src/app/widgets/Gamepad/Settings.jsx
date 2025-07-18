import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from 'app/components/Buttons';
import Modal from 'app/components/Modal';
import i18n from 'app/lib/i18n';

const getActions = () => [
    { value: '', label: i18n._('None') },
    { value: 'jog-x+', label: i18n._('Jog +X') },
    { value: 'jog-x-', label: i18n._('Jog -X') },
    { value: 'jog-y+', label: i18n._('Jog +Y') },
    { value: 'jog-y-', label: i18n._('Jog -Y') },
    { value: 'jog-z+', label: i18n._('Jog +Z') },
    { value: 'jog-z-', label: i18n._('Jog -Z') },
    { value: 'coolant-on', label: i18n._('Coolant On') },
    { value: 'coolant-off', label: i18n._('Coolant Off') },
    { value: 'step-inc', label: i18n._('Increase Step') },
    { value: 'step-dec', label: i18n._('Decrease Step') },
    { value: 'feedhold', label: i18n._('Feed Hold') },
    { value: 'resume', label: i18n._('Resume') },
    { value: 'reset', label: i18n._('Reset') }
];

class Settings extends PureComponent {
    static propTypes = {
        buttonMap: PropTypes.object,
        axisMap: PropTypes.object,
        name: PropTypes.string,
        gamepadIndex: PropTypes.number,
        onChangeName: PropTypes.func,
        onSave: PropTypes.func,
        onCancel: PropTypes.func,
        onExport: PropTypes.func,
        onImport: PropTypes.func,
        onDelete: PropTypes.func
    };

    static defaultProps = {
        buttonMap: {},
        axisMap: {},
        name: '',
        gamepadIndex: 0,
        onChangeName: () => {},
        onSave: () => {},
        onCancel: () => {},
        onExport: () => {},
        onImport: () => {},
        onDelete: () => {}
    };

    state = this.getInitialState();

    componentDidMount() {
        this.poll();
    }

    componentWillUnmount() {
        cancelAnimationFrame(this.raf);
    }

    poll = () => {
        const pads = (typeof navigator.getGamepads === 'function') ? navigator.getGamepads() : [];
        const pad = pads[this.props.gamepadIndex];
        if (pad) {
            const activeButtons = pad.buttons.map(btn => btn.pressed);
            const activeAxes = pad.axes.slice();
            this.setState(state => ({
                activeButtons,
                activeAxes,
                buttons: pad.buttons.length || state.buttons,
                axes: pad.axes.length || state.axes
            }));
        } else {
            this.setState({ activeButtons: [], activeAxes: [] });
        }
        this.raf = requestAnimationFrame(this.poll);
    };

    getInitialState() {
        const { buttonMap, axisMap, name } = this.props;
        const pads = (typeof navigator.getGamepads === 'function') ? navigator.getGamepads() : [];
        const pad = pads[this.props.gamepadIndex];
        const buttons = pad ? pad.buttons.length : Object.keys(buttonMap).length;
        const axes = pad ? pad.axes.length : Object.keys(axisMap).length;
        return {
            buttons,
            axes,
            buttonMap: { ...buttonMap },
            axisMap: { ...axisMap },
            name,
            activeButtons: [],
            activeAxes: []
        };
    }

    handleChangeButton = (index, value) => {
        this.setState(state => ({
            buttonMap: { ...state.buttonMap, [index]: value }
        }));
    };

    handleChangeAxis = (index, dir, value) => {
        this.setState(state => ({
            axisMap: {
                ...state.axisMap,
                [index]: {
                    ...(state.axisMap[index] || {}),
                    [dir]: value
                }
            }
        }));
    };

    handleChangeName = (e) => {
        const { onChangeName } = this.props;
        this.setState({ name: e.target.value });
        onChangeName(e.target.value);
    };

    handleSave = () => {
        const { onSave } = this.props;
        onSave({
            buttonMap: this.state.buttonMap,
            axisMap: this.state.axisMap
        });
    };

    handleExport = () => {
        const { onExport } = this.props;
        onExport({
            name: this.state.name,
            buttonMap: this.state.buttonMap,
            axisMap: this.state.axisMap
        });
    };

    handleImport = (e) => {
        const { onImport } = this.props;
        const file = e.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                onImport(data);
            } catch (err) {
                // ignore parse errors
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    render() {
        const { onCancel } = this.props;
        const { buttons, axes, buttonMap, axisMap, name, activeButtons, activeAxes } = this.state;
        const actions = getActions();
        return (
          <Modal disableOverlay size="sm" onClose={onCancel}>
            <Modal.Header>
              <Modal.Title>{i18n._('Gamepad Settings')}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="form-group">
                <label>{i18n._('Profile Name')}</label>
                <input type="text" className="form-control" value={name} onChange={this.handleChangeName} />
              </div>
              {buttons > 0 && (
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>{i18n._('Buttons')}</th>
                      <th>{i18n._('Action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: buttons }).map((_, i) => (
                      <tr key={i} style={{ backgroundColor: activeButtons[i] ? '#ffeeba' : 'transparent' }}>
                        <td>{i}</td>
                        <td>
                          <select
                            className="form-control"
                            value={buttonMap[i] || ''}
                            onChange={e => this.handleChangeButton(i, e.target.value)}
                          >
                            {actions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                          </select>
                        </td>
                      </tr>
                                ))}
                  </tbody>
                </table>
                    )}
              {axes > 0 && (
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>{i18n._('Axes')}</th>
                      <th>{i18n._('Negative')}</th>
                      <th>{i18n._('Positive')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: axes }).map((_, i) => {
                                    const map = axisMap[i] || {};
                                    return (
                                      <tr key={i} style={{ backgroundColor: Math.abs(activeAxes[i] || 0) > 0.2 ? '#ffeeba' : 'transparent' }}>
                                        <td>{i}</td>
                                        <td style={{ backgroundColor: (activeAxes[i] || 0) < -0.2 ? '#ffeeba' : 'transparent' }}>
                                          <select
                                            className="form-control"
                                            value={map.negative || ''}
                                            onChange={e => this.handleChangeAxis(i, 'negative', e.target.value)}
                                          >
                                            {actions.map(opt => (
                                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                          </select>
                                        </td>
                                        <td style={{ backgroundColor: (activeAxes[i] || 0) > 0.2 ? '#ffeeba' : 'transparent' }}>
                                          <select
                                            className="form-control"
                                            value={map.positive || ''}
                                            onChange={e => this.handleChangeAxis(i, 'positive', e.target.value)}
                                          >
                                            {actions.map(opt => (
                                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                          </select>
                                        </td>
                                      </tr>
                                    );
                                })}
                  </tbody>
                </table>
                    )}
            </Modal.Body>
            <Modal.Footer>
              <label className="btn btn-default btn-file">
                {i18n._('Import Config')}
                <input type="file" style={{ display: 'none' }} onChange={this.handleImport} />
              </label>
              <Button onClick={this.handleExport}>{i18n._('Export Config')}</Button>
              <Button onClick={this.props.onDelete}>{i18n._('Remove')}</Button>
              <Button onClick={onCancel}>{i18n._('Cancel')}</Button>
              <Button btnStyle="primary" onClick={this.handleSave}>{i18n._('Save Changes')}</Button>
            </Modal.Footer>
          </Modal>
        );
    }
}

export default Settings;
