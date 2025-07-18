import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from 'app/components/Buttons';
import Modal from 'app/components/Modal';
import i18n from 'app/lib/i18n';

const ACTIONS = [
    { value: '', label: i18n._('None') },
    { value: 'jog-x+', label: i18n._('Jog +X') },
    { value: 'jog-x-', label: i18n._('Jog -X') },
    { value: 'jog-y+', label: i18n._('Jog +Y') },
    { value: 'jog-y-', label: i18n._('Jog -Y') },
    { value: 'jog-z+', label: i18n._('Jog +Z') },
    { value: 'jog-z-', label: i18n._('Jog -Z') },
    { value: 'feedhold', label: i18n._('Feed Hold') },
    { value: 'resume', label: i18n._('Resume') },
    { value: 'reset', label: i18n._('Reset') }
];

class Settings extends PureComponent {
    static propTypes = {
        buttonMap: PropTypes.object,
        axisMap: PropTypes.object,
        onSave: PropTypes.func,
        onCancel: PropTypes.func
    };

    static defaultProps = {
        buttonMap: {},
        axisMap: {},
        onSave: () => {},
        onCancel: () => {}
    };

    state = this.getInitialState();

    getInitialState() {
        const { buttonMap, axisMap } = this.props;
        const pads = (typeof navigator.getGamepads === 'function') ? Array.from(navigator.getGamepads()).filter(p => p)[0] : null;
        const buttons = pads ? pads.buttons.length : Object.keys(buttonMap).length;
        const axes = pads ? pads.axes.length : Object.keys(axisMap).length;
        return {
            buttons,
            axes,
            buttonMap: { ...buttonMap },
            axisMap: { ...axisMap }
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

    handleSave = () => {
        const { onSave } = this.props;
        onSave({
            buttonMap: this.state.buttonMap,
            axisMap: this.state.axisMap
        });
    };

    render() {
        const { onCancel } = this.props;
        const { buttons, axes, buttonMap, axisMap } = this.state;
        return (
            <Modal disableOverlay size="sm" onClose={onCancel}>
                <Modal.Header>
                    <Modal.Title>{i18n._('Gamepad Settings')}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
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
                                    <tr key={i}>
                                        <td>{i}</td>
                                        <td>
                                            <select
                                                className="form-control"
                                                value={buttonMap[i] || ''}
                                                onChange={e => this.handleChangeButton(i, e.target.value)}
                                            >
                                                {ACTIONS.map(opt => (
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
                                        <tr key={i}>
                                            <td>{i}</td>
                                            <td>
                                                <select
                                                    className="form-control"
                                                    value={map.negative || ''}
                                                    onChange={e => this.handleChangeAxis(i, 'negative', e.target.value)}
                                                >
                                                    {ACTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <select
                                                    className="form-control"
                                                    value={map.positive || ''}
                                                    onChange={e => this.handleChangeAxis(i, 'positive', e.target.value)}
                                                >
                                                    {ACTIONS.map(opt => (
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
