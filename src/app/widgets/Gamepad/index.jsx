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
    modifierPrev = false;
    raf = 0;

    // Continuous jogging state
    continuousJogState = {
        activeAxes: new Set(), // Set of active axis keys (e.g., 'X+', 'Y-')
        lastCommandTime: {},
        jogCancelTimeout: null,
        pendingStarts: {} // Track pending setTimeout calls for axis starts
    };

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
                    [id]: {
                        name: 'Profile',
                        buttonMap: {},
                        modifierMap: {},
                        modifierButton: null,
                        axisMap: {},
                        gamepadId: null
                    }
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
                                modifierMap: data.modifierMap || {},
                                modifierButton: data.modifierButton || null,
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
        // Stop any active continuous jogging
        this.stopAllContinuousJogging();
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

    // Get jog feed rate for continuous jogging
    getJogFeedRate = (axis = 'XY') => {
        const units = this.getUnits();
        // Use feed rates similar to OpenBuilds CONTROL
        const baseRates = {
            X: units === IMPERIAL_UNITS ? 157 : 4000, // ~157 IPM = 4000 mm/min
            Y: units === IMPERIAL_UNITS ? 157 : 4000,
            Z: units === IMPERIAL_UNITS ? 79 : 2000, // ~79 IPM = 2000 mm/min
            A: units === IMPERIAL_UNITS ? 79 : 2000
        };

        if (axis.includes('X') || axis.includes('Y')) {
            return Math.max(baseRates.X, baseRates.Y);
        }
        if (axis.includes('Z')) {
            return baseRates.Z;
        }
        if (axis.includes('A')) {
            return baseRates.A;
        }
        return baseRates.X; // Default
    };

    // Enhanced continuous jogging implementation inspired by OpenBuilds CONTROL
    handleContinuousJog = (axis, direction, magnitude) => {
        const { continuousJog } = this.state;
        if (!continuousJog) {
            return false; // Let normal jogging handle it
        }

        const axisKey = `${axis}${direction}`;
        const isActive = magnitude > 0.2; // Lowered threshold from 0.5 to 0.2 for better responsiveness
        const wasActive = this.continuousJogState.activeAxes.has(axisKey);

        // Debug logging
        if (magnitude > 0.1 || wasActive) {
            console.log(`[Gamepad] handleContinuousJog: ${axisKey}, magnitude=${magnitude.toFixed(3)}, isActive=${isActive}, wasActive=${wasActive}, activeAxes=[${Array.from(this.continuousJogState.activeAxes).join(',')}]`);
        }

        if (isActive && !wasActive) {
            // Start continuous jog
            console.log(`[Gamepad] Starting continuous jog: ${axisKey}`);
            this.startContinuousJog(axis, direction, magnitude);
            this.continuousJogState.activeAxes.add(axisKey);
        } else if (!isActive && wasActive) {
            // Stop continuous jog
            console.log(`[Gamepad] Stopping continuous jog: ${axisKey}`);
            this.stopContinuousJog(axisKey);
            this.continuousJogState.activeAxes.delete(axisKey);
        } else if (isActive && wasActive) {
            // Update jog rate based on magnitude change
            this.updateContinuousJog(axis, direction, magnitude);
        }

        return true; // Handled by continuous jogging
    };

    startContinuousJog = (axis, direction, magnitude) => {
        // Calculate variable feed rate based on stick magnitude (0.5 to 1.0 maps to 50% to 100% of max rate)
        const baseFeedRate = this.getJogFeedRate(axis);
        const feedRateMultiplier = Math.min(1.0, Math.max(0.3, (magnitude - 0.5) * 2)); // 30% to 100% based on stick position
        const feedRate = Math.round(baseFeedRate * feedRateMultiplier);

        // Use large distance for continuous jogging (similar to OpenBuilds CONTROL)
        const units = this.getUnits();
        const distance = units === IMPERIAL_UNITS ? 39.37 : 1000; // 1000mm or ~39 inches

        const directionSign = direction === '+' ? '' : '-';

        // Use $J command for GRBL real-time jogging
        const jogCommand = `$J=G91 G21 ${axis}${directionSign}${distance} F${feedRate}`;

        console.log(`[Gamepad] Starting continuous jog: ${jogCommand}`);
        controller.command('gcode', jogCommand);

        this.continuousJogState.lastCommandTime[`${axis}${direction}`] = Date.now();
    };

    updateContinuousJog = (axis, direction, magnitude) => {
        const axisKey = `${axis}${direction}`;
        const lastCommandTime = this.continuousJogState.lastCommandTime[axisKey] || 0;
        const now = Date.now();

        // Only update if enough time has passed to avoid spamming commands
        if (now - lastCommandTime > 100) { // 100ms throttle
            // Cancel current jog and start new one with updated feed rate
            this.stopContinuousJog(axisKey, false);

            // Cancel any pending start for this axis
            if (this.continuousJogState.pendingStarts[axisKey]) {
                clearTimeout(this.continuousJogState.pendingStarts[axisKey]);
                delete this.continuousJogState.pendingStarts[axisKey];
            }

            // Schedule new start with proper tracking
            this.continuousJogState.pendingStarts[axisKey] = setTimeout(() => {
                // Only start if the axis is still supposed to be active
                if (this.continuousJogState.activeAxes.has(axisKey)) {
                    this.startContinuousJog(axis, direction, magnitude);
                }
                delete this.continuousJogState.pendingStarts[axisKey];
            }, 10);
        }
    };

    stopContinuousJog = (axisKey, removeFromActive = true) => {
        console.log(`[Gamepad] Stopping continuous jog: ${axisKey}`);

        // Cancel any pending start for this axis
        if (this.continuousJogState.pendingStarts[axisKey]) {
            console.log(`[Gamepad] Canceling pending start for: ${axisKey}`);
            clearTimeout(this.continuousJogState.pendingStarts[axisKey]);
            delete this.continuousJogState.pendingStarts[axisKey];
        }

        // Send jog cancel command
        controller.command('jogCancel');

        if (removeFromActive) {
            this.continuousJogState.activeAxes.delete(axisKey);
        }

        // Clear the timeout if it exists
        if (this.continuousJogState.jogCancelTimeout) {
            clearTimeout(this.continuousJogState.jogCancelTimeout);
            this.continuousJogState.jogCancelTimeout = null;
        }
    };

    // Stop all continuous jogging (useful for emergency stops)
    stopAllContinuousJogging = () => {
        const hasActiveAxes = this.continuousJogState.activeAxes.size > 0;
        const hasPendingStarts = this.continuousJogState.pendingStarts &&
            Object.keys(this.continuousJogState.pendingStarts).length > 0;

        if (hasActiveAxes || hasPendingStarts) {
            console.log('[Gamepad] Emergency stop - canceling all continuous jogs');

            // Cancel all pending starts
            if (hasPendingStarts) {
                Object.values(this.continuousJogState.pendingStarts).forEach(timeout => {
                    clearTimeout(timeout);
                });
                this.continuousJogState.pendingStarts = {};
            }

            controller.command('jogCancel');
            this.continuousJogState.activeAxes.clear();
            this.continuousJogState.lastCommandTime = {};
        }
    };

    // Extract axis and direction from jog action (e.g., 'jog-x+' -> { axis: 'X', direction: '+' })
    getAxisAndDirectionFromAction = (action) => {
        if (typeof action !== 'string') {
            return null;
        }

        const jogMatch = action.match(/^jog-([xyzabc])([+-])$/i);
        if (jogMatch) {
            return {
                axis: jogMatch[1].toUpperCase(),
                direction: jogMatch[2]
            };
        }
        return null;
    };

    // Legacy method for backward compatibility
    getAxisFromAction = (action) => {
        const result = this.getAxisAndDirectionFromAction(action);
        return result ? result.axis : null;
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
        const modifier = profile.modifierButton;
        const pad = (typeof navigator.getGamepads === 'function') ? navigator.getGamepads()[selectedGamepad] : null;
        if (pad) {
            const modifierPressed = modifier !== null && pad.buttons[modifier] && pad.buttons[modifier].pressed;
            pad.buttons.forEach((btn, i) => {
                if (i === modifier) {
                    this.prevButtons[i] = btn.pressed;
                    return;
                }
                const map = modifierPressed ? (profile.modifierMap || {}) : (profile.buttonMap || {});
                const action = map[i];
                if (action && btn.pressed && !this.prevButtons[i]) {
                    this.handleAction(action);
                }
                this.prevButtons[i] = btn.pressed;
            });
            pad.axes.forEach((val, i) => {
                const map = (profile.axisMap || {})[i] || {};
                const prev = this.prevAxes[i] || 0;

                if (continuousJog) {
                    // Enhanced continuous jogging mode

                    // Debug: Log significant axis changes
                    if (Math.abs(val - prev) > 0.1 || Math.abs(val) > 0.1) {
                        console.log(`[Gamepad] Axis ${i}: val=${val.toFixed(3)}, prev=${prev.toFixed(3)}, positive=${map.positive}, negative=${map.negative}`);
                    }

                    // Handle positive direction
                    if (map.positive) {
                        const actionInfo = this.getAxisAndDirectionFromAction(map.positive);
                        if (actionInfo) {
                            // Only process if axis value indicates movement in this direction
                            const magnitude = val > 0 ? val : 0;
                            this.handleContinuousJog(actionInfo.axis, actionInfo.direction, magnitude);
                        }
                    }

                    // Handle negative direction
                    if (map.negative) {
                        const actionInfo = this.getAxisAndDirectionFromAction(map.negative);
                        if (actionInfo) {
                            // Only process if axis value indicates movement in this direction
                            const magnitude = val < 0 ? Math.abs(val) : 0;
                            this.handleContinuousJog(actionInfo.axis, actionInfo.direction, magnitude);
                        }
                    }
                } else {
                    // Traditional step jogging mode

                    // Handle positive direction
                    if (map.positive && val > 0.5 && prev <= 0.5) {
                        this.handleAction(map.positive);
                    }

                    // Handle negative direction
                    if (map.negative && val < -0.5 && prev >= -0.5) {
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
                this.stopAllContinuousJogging(); // Stop any continuous jogging before feedhold
                controller.command('feedhold');
                break;
            case 'resume':
                controller.command('cyclestart');
                break;
            case 'reset':
                this.stopAllContinuousJogging(); // Stop any continuous jogging before reset
                controller.command('reset');
                break;
            case 'feed-decrease-10':
                controller.command('feedOverride', -10);
                break;
            case 'feed-decrease-1':
                controller.command('feedOverride', -1);
                break;
            case 'feed-increase-1':
                controller.command('feedOverride', 1);
                break;
            case 'feed-increase-10':
                controller.command('feedOverride', 10);
                break;
            case 'feed-reset':
                controller.command('feedOverride', 0);
                break;
            case 'spindle-decrease-10':
                controller.command('spindleOverride', -10);
                break;
            case 'spindle-decrease-1':
                controller.command('spindleOverride', -1);
                break;
            case 'spindle-increase-1':
                controller.command('spindleOverride', 1);
                break;
            case 'spindle-increase-10':
                controller.command('spindleOverride', 10);
                break;
            case 'spindle-reset':
                controller.command('spindleOverride', 0);
                break;
            case 'rapid-25':
                controller.command('rapidOverride', 25);
                break;
            case 'rapid-50':
                controller.command('rapidOverride', 50);
                break;
            case 'rapid-100':
                controller.command('rapidOverride', 100);
                break;
            case 'zero-x':
                controller.command('gcode', 'G92 X0');
                break;
            case 'zero-y':
                controller.command('gcode', 'G92 Y0');
                break;
            case 'zero-z':
                controller.command('gcode', 'G92 Z0');
                break;
            default:
                break;
        }
    }

    render() {
        const { widgetId } = this.props;
        const { minimized, isFullscreen, profiles, currentProfile, selectedGamepad } = this.state;
        const current = profiles[currentProfile] || { name: '', buttonMap: {}, modifierMap: {}, modifierButton: null, axisMap: {} };
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
                  modifierMap={current.modifierMap}
                  modifierButton={current.modifierButton}
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
                  onSave={({ buttonMap, modifierMap, modifierButton, axisMap }) => {
                    const pad = navigator.getGamepads ? navigator.getGamepads()[selectedGamepad] : null;
                    this.setState(state => ({
                      profiles: {
                        ...state.profiles,
                        [state.currentProfile]: {
                          ...current,
                          buttonMap,
                          modifierMap,
                          modifierButton,
                          axisMap,
                          gamepadId: pad ? pad.id : null
                        }
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

              {/* Continuous Jog Status - shows when enhanced mode is active */}
              {this.state.continuousJog && this.continuousJogState.activeAxes.size > 0 ? (
                <div style={{ marginTop: 10, padding: 10, border: '1px solid #28a745', borderRadius: 3, backgroundColor: '#d4edda' }}>
                  <div style={{ fontSize: '12px', color: '#155724' }}>
                    <i className="fa fa-circle" style={{ marginRight: 4 }} />
                    {i18n._('Enhanced Continuous Jogging Active: {{axes}}', { axes: Array.from(this.continuousJogState.activeAxes).join(', ') })}
                  </div>
                </div>
              ) : null}
            </Widget.Content>
          </Widget>
        );
    }
}

export default GamepadWidget;
