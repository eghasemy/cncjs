import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from 'app/components/Buttons';
import Modal from 'app/components/Modal';
import i18n from 'app/lib/i18n';

const getActions = (macros = []) => {
    const base = [
        { value: '', label: i18n._('None') },
        { value: 'jog-x+', label: i18n._('Jog +X') },
        { value: 'jog-x-', label: i18n._('Jog -X') },
        { value: 'jog-y+', label: i18n._('Jog +Y') },
        { value: 'jog-y-', label: i18n._('Jog -Y') },
        { value: 'jog-z+', label: i18n._('Jog +Z') },
        { value: 'jog-z-', label: i18n._('Jog -Z') },
        { value: 'toggle-continuous-jog', label: i18n._('Continuous Jogging') },
        { value: 'coolant-on', label: i18n._('Coolant On') },
        { value: 'coolant-off', label: i18n._('Coolant Off') },
        { value: 'step-inc', label: i18n._('Increase Step') },
        { value: 'step-dec', label: i18n._('Decrease Step') },
        { value: 'feedhold', label: i18n._('Feed Hold') },
        { value: 'resume', label: i18n._('Resume') },
        { value: 'reset', label: i18n._('Reset') },
        { value: 'feed-decrease-10', label: i18n._('Feed -10%') },
        { value: 'feed-decrease-1', label: i18n._('Feed -1%') },
        { value: 'feed-increase-1', label: i18n._('Feed +1%') },
        { value: 'feed-increase-10', label: i18n._('Feed +10%') },
        { value: 'feed-reset', label: i18n._('Feed Reset') },
        { value: 'spindle-decrease-10', label: i18n._('Spindle -10%') },
        { value: 'spindle-decrease-1', label: i18n._('Spindle -1%') },
        { value: 'spindle-increase-1', label: i18n._('Spindle +1%') },
        { value: 'spindle-increase-10', label: i18n._('Spindle +10%') },
        { value: 'spindle-reset', label: i18n._('Spindle Reset') },
        { value: 'rapid-25', label: i18n._('Rapid 25%') },
        { value: 'rapid-50', label: i18n._('Rapid 50%') },
        { value: 'rapid-100', label: i18n._('Rapid 100%') }
    ];
    const macroActions = macros.map(macro => ({
        value: `run-macro-${macro.id}`,
        label: `${i18n._('Run Macro')}: ${macro.name}`
    }));
    return base.concat(macroActions);
};

class Settings extends PureComponent {
    static propTypes = {
        buttonMap: PropTypes.object,
        modifierMap: PropTypes.object,
        modifierButton: PropTypes.number,
        axisMap: PropTypes.object,
        name: PropTypes.string,
        gamepadIndex: PropTypes.number,
        onChangeName: PropTypes.func,
        onSave: PropTypes.func,
        onCancel: PropTypes.func,
        macros: PropTypes.array
    };

    static defaultProps = {
        buttonMap: {},
        modifierMap: {},
        modifierButton: null,
        axisMap: {},
        name: '',
        gamepadIndex: 0,
        onChangeName: () => {},
        onSave: () => {},
        onCancel: () => {},
        macros: []
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
        const { buttonMap, modifierMap, modifierButton, axisMap, name } = this.props;
        const pads = (typeof navigator.getGamepads === 'function') ? navigator.getGamepads() : [];
        const pad = pads[this.props.gamepadIndex];
        const buttons = pad ? pad.buttons.length : Object.keys(buttonMap).length;
        const axes = pad ? pad.axes.length : Object.keys(axisMap).length;
        return {
            buttons,
            axes,
            buttonMap: { ...buttonMap },
            modifierMap: { ...modifierMap },
            modifierButton: modifierButton,
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

    handleChangeModifierButton = (value) => {
        this.setState({ modifierButton: value });
    };

    handleChangeModifierMap = (index, value) => {
        this.setState(state => ({
            modifierMap: { ...state.modifierMap, [index]: value }
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
            modifierMap: this.state.modifierMap,
            modifierButton: this.state.modifierButton,
            axisMap: this.state.axisMap
        });
    };

    render() {
        const { onCancel, macros } = this.props;
        const { buttons, axes, buttonMap, modifierMap, modifierButton, axisMap, name, activeButtons, activeAxes } = this.state;
        const baseActions = getActions(macros);
        const usedActions = new Set();
        Object.keys(buttonMap).forEach(idx => {
            const val = buttonMap[idx];
            if (val) {
                usedActions.add(val);
            }
        });
        Object.keys(modifierMap).forEach(idx => {
            const val = modifierMap[idx];
            if (val) {
                usedActions.add(val);
            }
        });
        Object.values(axisMap).forEach(map => {
            if (map.negative) {
                usedActions.add(map.negative);
            }
            if (map.positive) {
                usedActions.add(map.positive);
            }
        });
        const getAvailable = current => baseActions.filter(a => !usedActions.has(a.value) || a.value === current);
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
                <div className="form-group">
                  <label>{i18n._('Modifier Button')}</label>
                  <select className="form-control" value={modifierButton != null ? modifierButton : ''} onChange={e => this.handleChangeModifierButton(e.target.value === '' ? null : Number(e.target.value))}>
                    <option value="">{i18n._('None')}</option>
                    {Array.from({ length: buttons }).map((_, i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              )}
              {buttons > 0 && (
                <table className="table table-bordered">
                  <thead>
                    <tr>
                      <th>{i18n._('Buttons')}</th>
                      <th>{i18n._('Action')}</th>
                      <th>{i18n._('With Modifier')}</th>
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
                            {getAvailable(buttonMap[i] || '').map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="form-control"
                            value={modifierMap[i] || ''}
                            onChange={e => this.handleChangeModifierMap(i, e.target.value)}
                          >
                            {getAvailable(modifierMap[i] || '').map(opt => (
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
                                            {getAvailable(map.negative || '').map(opt => (
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
                                            {getAvailable(map.positive || '').map(opt => (
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
              <Button onClick={onCancel}>{i18n._('Cancel')}</Button>
              <Button btnStyle="primary" onClick={this.handleSave}>{i18n._('Save Changes')}</Button>
            </Modal.Footer>
          </Modal>
        );
    }
}

export default Settings;
