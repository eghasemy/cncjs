import cx from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Space from 'app/components/Space';
import Widget from 'app/components/Widget';
import i18n from 'app/lib/i18n';
import shortid from 'shortid';
import controller from 'app/lib/controller';
import api from 'app/api';
import store from 'app/store';
import { ensureArray } from 'ensure-type';
import combokeys from 'app/lib/combokeys';
import {
    IMPERIAL_UNITS,
    METRIC_UNITS,
    IMPERIAL_STEPS,
    METRIC_STEPS,
    GRBL,
    MARLIN,
    SMOOTHIE,
    TINYG
} from 'app/constants';
import WidgetConfig from '../WidgetConfig';
import Gamepad from './Gamepad';
import Settings from './Settings';
import { MODAL_NONE, MODAL_SETTINGS } from './constants';
import styles from './index.styl';

class GamepadWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        onFork: PropTypes.func.isRequired,
        onRemove: PropTypes.func.isRequired,
        sortable: PropTypes.object
    };

    collapse = () => {
        this.setState({ minimized: true });
    };

    expand = () => {
        this.setState({ minimized: false });
    };

    config = new WidgetConfig(this.props.widgetId);

    state = this.getInitialState();

    prevButtons = [];
    prevAxes = [];
    raf = 0;

    actions = {
        toggleFullscreen: () => {
            const { minimized, isFullscreen } = this.state;
            this.setState({
                minimized: isFullscreen ? minimized : false,
                isFullscreen: !isFullscreen
            });
        },
        toggleMinimized: () => {
            const { minimized } = this.state;
            this.setState({ minimized: !minimized });
        },
        openModal: (name = MODAL_NONE) => {
            if (name === MODAL_SETTINGS) {
                this.fetchMacros();
            }
            this.setState({ modal: name });
        },
        closeModal: () => {
            this.setState({ modal: MODAL_NONE });
        },
        selectGamepad: (index) => {
            this.setState({ selectedGamepad: index });
        },
        selectProfile: (id) => {
            this.setState({ currentProfile: id });
        },
        newProfile: () => {
            const id = shortid.generate();
            this.setState(state => ({
                profiles: {
                    ...state.profiles,
                    [id]: { name: 'Profile', buttonMap: {}, axisMap: {}, gamepadId: null }
                },
                currentProfile: id
            }));
        },
        deleteProfile: () => {
            this.setState(state => {
                const profiles = { ...state.profiles };
                delete profiles[state.currentProfile];
                const ids = Object.keys(profiles);
                return {
                    profiles,
                    currentProfile: ids[0] || ''
                };
            });
        },
        exportProfile: () => {
            const { profiles, currentProfile } = this.state;
            const data = profiles[currentProfile];
            if (!data) {
                return;
            }
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${data.name || 'profile'}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },
        importProfile: (e) => {
            const file = e.target.files[0];
            if (!file) {
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(reader.result);
                    const id = shortid.generate();
                    this.setState(state => ({
                        profiles: {
                            ...state.profiles,
                            [id]: {
                                name: data.name || 'Imported',
                                buttonMap: data.buttonMap || {},
                                axisMap: data.axisMap || {},
                                gamepadId: data.gamepadId || null
                            }
                        },
                        currentProfile: id
                    }));
                } catch (err) {
                    // ignore
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        }
    };

    getInitialState() {
        const profiles = this.config.get('profiles', {});
        const currentProfile = this.config.get('currentProfile', Object.keys(profiles)[0] || '');
        return {
            minimized: this.config.get('minimized', false),
            isFullscreen: false,
            modal: MODAL_NONE,
            profiles,
            currentProfile,
            selectedGamepad: this.config.get('selectedGamepad', 0),
            continuousJog: this.config.get('continuousJog', false),
            macros: []
        };
    }

    componentDidUpdate() {
        const { minimized, profiles, currentProfile, selectedGamepad, continuousJog } = this.state;
        this.config.set('minimized', minimized);
        this.config.replace('profiles', profiles);
        this.config.set('currentProfile', currentProfile);
        this.config.set('selectedGamepad', selectedGamepad);
        this.config.set('continuousJog', continuousJog);
    }

    componentDidMount() {
        this.fetchMacros();
        this.loop();
    }

    componentWillUnmount() {
        cancelAnimationFrame(this.raf);
    }

    getUnits = () => {
        const type = controller.type;
        const state = controller.state || {};
        if (type === GRBL) {
            const modal = (state.parserstate || {}).modal || {};
            return { 'G20': IMPERIAL_UNITS, 'G21': METRIC_UNITS }[modal.units] || METRIC_UNITS;
        }
        if (type === MARLIN) {
            const modal = state.modal || {};
            return { 'G20': IMPERIAL_UNITS, 'G21': METRIC_UNITS }[modal.units] || METRIC_UNITS;
        }
        if (type === SMOOTHIE) {
            const modal = (state.parserstate || {}).modal || {};
            return { 'G20': IMPERIAL_UNITS, 'G21': METRIC_UNITS }[modal.units] || METRIC_UNITS;
        }
        if (type === TINYG) {
            const modal = ((state.sr || {}).modal) || {};
            return { 'G20': IMPERIAL_UNITS, 'G21': METRIC_UNITS }[modal.units] || METRIC_UNITS;
        }
        return METRIC_UNITS;
    };

    getJogDistance = () => {
        const units = this.getUnits();
        if (units === IMPERIAL_UNITS) {
            const step = store.get('widgets.axes.jog.imperial.step');
            const custom = ensureArray(store.get('widgets.axes.jog.imperial.distances', []));
            const steps = [...custom, ...IMPERIAL_STEPS];
            return Number(steps[step]) || 0;
        }
        const step = store.get('widgets.axes.jog.metric.step');
        const custom = ensureArray(store.get('widgets.axes.jog.metric.distances', []));
        const steps = [...custom, ...METRIC_STEPS];
        return Number(steps[step]) || 0;
    };

    stepForward = () => {
        combokeys.emit('JOG_LEVER_SWITCH', null, { key: '+' });
    };

    stepBackward = () => {
        combokeys.emit('JOG_LEVER_SWITCH', null, { key: '-' });
    };

    fetchMacros = async () => {
        try {
            const res = await api.macros.fetch();
            const { records: macros } = res.body;
            this.setState({ macros });
        } catch (err) {
            // ignore errors
        }
    };

    loop = () => {
        const { profiles, currentProfile, selectedGamepad, continuousJog } = this.state;
        const profile = profiles[currentProfile] || {};
        const pad = (typeof navigator.getGamepads === 'function') ? navigator.getGamepads()[selectedGamepad] : null;
        if (pad) {
            pad.buttons.forEach((btn, i) => {
                const action = (profile.buttonMap || {})[i];
                if (action && btn.pressed && !this.prevButtons[i]) {
                    this.handleAction(action);
                }
                this.prevButtons[i] = btn.pressed;
            });
            pad.axes.forEach((val, i) => {
                const map = (profile.axisMap || {})[i] || {};
                const prev = this.prevAxes[i] || 0;
                const now = Date.now();
                const posKey = `${i}-pos`;
                const negKey = `${i}-neg`;
                if (map.positive && val > 0.5) {
                    if (continuousJog) {
                        if (!this.lastJogTime) {
                            this.lastJogTime = {};
                        }
                        if (now - (this.lastJogTime[posKey] || 0) > 200) {
                            this.handleAction(map.positive);
                            this.lastJogTime[posKey] = now;
                        }
                    } else if (prev <= 0.5) {
                        this.handleAction(map.positive);
                    }
                }
                if (map.negative && val < -0.5) {
                    if (continuousJog) {
                        if (!this.lastJogTime) {
                            this.lastJogTime = {};
                        }
                        if (now - (this.lastJogTime[negKey] || 0) > 200) {
                            this.handleAction(map.negative);
                            this.lastJogTime[negKey] = now;
                        }
                    } else if (prev >= -0.5) {
                        this.handleAction(map.negative);
                    }
                }
                this.prevAxes[i] = val;
            });
        }
        this.raf = requestAnimationFrame(this.loop);
    };

    handleAction(action) {
        if (action.startsWith('run-macro-')) {
            const id = action.substring('run-macro-'.length);
            controller.command('macro:run', id, controller.context, () => {});
            return;
        }
        switch (action) {
            case 'jog-x+':
                controller.command('gcode', 'G91');
                controller.command('gcode', `G0 X${this.getJogDistance()}`);
                controller.command('gcode', 'G90');
                break;
            case 'jog-x-':
                controller.command('gcode', 'G91');
                controller.command('gcode', `G0 X-${this.getJogDistance()}`);
                controller.command('gcode', 'G90');
                break;
            case 'jog-y+':
                controller.command('gcode', 'G91');
                controller.command('gcode', `G0 Y${this.getJogDistance()}`);
                controller.command('gcode', 'G90');
                break;
            case 'jog-y-':
                controller.command('gcode', 'G91');
                controller.command('gcode', `G0 Y-${this.getJogDistance()}`);
                controller.command('gcode', 'G90');
                break;
            case 'jog-z+':
                controller.command('gcode', 'G91');
                controller.command('gcode', `G0 Z${this.getJogDistance()}`);
                controller.command('gcode', 'G90');
                break;
            case 'jog-z-':
                controller.command('gcode', 'G91');
                controller.command('gcode', `G0 Z-${this.getJogDistance()}`);
                controller.command('gcode', 'G90');
                break;
            case 'toggle-continuous-jog':
                this.setState(state => ({ continuousJog: !state.continuousJog }));
                break;
            case 'step-inc':
                this.stepForward();
                break;
            case 'step-dec':
                this.stepBackward();
                break;
            case 'coolant-on':
                controller.command('gcode', 'M8');
                break;
            case 'coolant-off':
                controller.command('gcode', 'M9');
                break;
            case 'feedhold':
                controller.command('feedhold');
                break;
            case 'resume':
                controller.command('cyclestart');
                break;
            case 'reset':
                controller.command('reset');
                break;
            default:
                break;
        }
    }

    render() {
        const { widgetId } = this.props;
        const { minimized, isFullscreen, profiles, currentProfile, selectedGamepad } = this.state;
        const current = profiles[currentProfile] || { name: '', buttonMap: {}, axisMap: {} };
        const isForkedWidget = widgetId.match(/\w+:[\w\-]+/);
        const actions = { ...this.actions };

        return (
          <Widget fullscreen={isFullscreen}>
            <Widget.Header>
              <Widget.Title>
                <Widget.Sortable className={this.props.sortable.handleClassName}>
                  <i className="fa fa-bars" />
                  <Space width="8" />
                </Widget.Sortable>
                {isForkedWidget ? <i className="fa fa-code-fork" style={{ marginRight: 5 }} /> : null}
                {i18n._('Gamepad')}
              </Widget.Title>
              <Widget.Controls className={this.props.sortable.filterClassName}>
                <Widget.Button
                  title={i18n._('Edit')}
                  onClick={() => actions.openModal(MODAL_SETTINGS)}
                >
                  <i className="fa fa-cog" />
                </Widget.Button>
                <Widget.Button
                  disabled={isFullscreen}
                  title={minimized ? i18n._('Expand') : i18n._('Collapse')}
                  onClick={actions.toggleMinimized}
                >
                  <i className={cx('fa', { 'fa-chevron-up': !minimized, 'fa-chevron-down': minimized })} />
                </Widget.Button>
                <Widget.DropdownButton
                  title={i18n._('More')}
                  toggle={<i className="fa fa-ellipsis-v" />}
                  onSelect={(eventKey) => {
                                if (eventKey === 'fullscreen') {
                                    actions.toggleFullscreen();
                                } else if (eventKey === 'fork') {
                                    this.props.onFork();
                                } else if (eventKey === 'remove') {
                                    this.props.onRemove();
                                }
                            }}
                >
                  <Widget.DropdownMenuItem eventKey="fullscreen">
                    <i className={cx('fa', 'fa-fw', { 'fa-expand': !isFullscreen }, { 'fa-compress': isFullscreen })} />
                    <Space width="4" />
                    {!isFullscreen ? i18n._('Enter Full Screen') : i18n._('Exit Full Screen')}
                  </Widget.DropdownMenuItem>
                  <Widget.DropdownMenuItem eventKey="fork">
                    <i className="fa fa-fw fa-code-fork" />
                    <Space width="4" />
                    {i18n._('Fork Widget')}
                  </Widget.DropdownMenuItem>
                  <Widget.DropdownMenuItem eventKey="remove">
                    <i className="fa fa-fw fa-times" />
                    <Space width="4" />
                    {i18n._('Remove Widget')}
                  </Widget.DropdownMenuItem>
                </Widget.DropdownButton>
              </Widget.Controls>
            </Widget.Header>
            <Widget.Content className={cx(styles.widgetContent, { [styles.hidden]: minimized })}>
              {this.state.modal === MODAL_SETTINGS && (
                <Settings
                  name={current.name}
                  buttonMap={current.buttonMap}
                  axisMap={current.axisMap}
                  gamepadIndex={selectedGamepad}
                  macros={this.state.macros}
                  onChangeName={(name) => {
                    this.setState(state => ({
                      profiles: {
                        ...state.profiles,
                        [state.currentProfile]: { ...current, name }
                      }
                    }));
                  }}
                  onSave={({ buttonMap, axisMap }) => {
                    const pad = navigator.getGamepads ? navigator.getGamepads()[selectedGamepad] : null;
                    this.setState(state => ({
                      profiles: {
                        ...state.profiles,
                        [state.currentProfile]: { ...current, buttonMap, axisMap, gamepadId: pad ? pad.id : null }
                      }
                    }));
                    actions.closeModal();
                  }}
                  onCancel={actions.closeModal}
                />
              )}
              <div style={{ marginBottom: 10 }}>
                <select className="form-control" value={currentProfile} onChange={e => actions.selectProfile(e.target.value)}>
                  {Object.keys(profiles).map(id => (
                    <option key={id} value={id}>{profiles[id].name}</option>
                  ))}
                </select>
                <div className="btn-group btn-group-justified" role="group" style={{ marginTop: 5 }}>
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      className="btn btn-default"
                      style={{ padding: '5px 0' }}
                      onClick={actions.newProfile}
                      title={i18n._('New')}
                    >
                      <i className="fa fa-plus" />
                    </button>
                  </div>
                  <div className="btn-group btn-group-sm" role="group">
                    <label
                      className="btn btn-default btn-file"
                      style={{ padding: '5px 0', marginBottom: 0 }}
                      title={i18n._('Import Config')}
                    >
                      <i className="fa fa-upload" />
                      <input type="file" style={{ display: 'none' }} onChange={actions.importProfile} />
                    </label>
                  </div>
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      className="btn btn-default"
                      style={{ padding: '5px 0' }}
                      onClick={actions.exportProfile}
                      title={i18n._('Export Config')}
                    >
                      <i className="fa fa-download" />
                    </button>
                  </div>
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      className="btn btn-default"
                      style={{ padding: '5px 0' }}
                      onClick={actions.deleteProfile}
                      title={i18n._('Remove')}
                    >
                      <i className="fa fa-trash" />
                    </button>
                  </div>
                </div>
              </div>
              <Gamepad selectedIndex={selectedGamepad} onSelectIndex={actions.selectGamepad} />
            </Widget.Content>
          </Widget>
        );
    }
}

export default GamepadWidget;
