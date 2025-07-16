import get from 'lodash/get';
import includes from 'lodash/includes';
import map from 'lodash/map';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Space from 'app/components/Space';
import Widget from 'app/components/Widget';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import { in2mm, mapValueToUnits } from 'app/lib/units';
import WidgetConfig from '../WidgetConfig';
import Probe from './Probe';
import RunProbe from './RunProbe';
import {
  // Units
  IMPERIAL_UNITS,
  METRIC_UNITS,
  // Grbl
  GRBL,
  GRBL_ACTIVE_STATE_IDLE,
  // Marlin
  MARLIN,
  // Smoothie
  SMOOTHIE,
  SMOOTHIE_ACTIVE_STATE_IDLE,
  // TinyG
  TINYG,
  TINYG_MACHINE_STATE_READY,
  TINYG_MACHINE_STATE_STOP,
  TINYG_MACHINE_STATE_END,
  // Workflow
  WORKFLOW_STATE_IDLE
} from '../../constants';
import {
  MODAL_NONE,
  MODAL_PREVIEW,
  PROBE_TYPE_BASIC,
  PROBE_TYPE_EDGE,
  PROBE_TYPE_CENTER,
  PROBE_TYPE_ROTATION,
  PROBE_TYPE_HEIGHT_MAP,
  EDGE_PROBE_EXTERNAL_X_POSITIVE,
  CENTER_PROBE_EXTERNAL
} from './constants';
import styles from './index.styl';

const gcode = (cmd, params) => {
  const s = map(params, (value, letter) => String(letter + value)).join(' ');
  return (s.length > 0) ? (cmd + ' ' + s) : cmd;
};

class ProbeWidget extends PureComponent {
    static propTypes = {
      widgetId: PropTypes.string.isRequired,
      onFork: PropTypes.func.isRequired,
      onRemove: PropTypes.func.isRequired,
      sortable: PropTypes.object
    };

    // Public methods
    collapse = () => {
      this.setState({ minimized: true });
    };

    expand = () => {
      this.setState({ minimized: false });
    };

    config = new WidgetConfig(this.props.widgetId);

    state = this.getInitialState();

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
      openModal: (name = MODAL_NONE, params = {}) => {
        this.setState({
          modal: {
            name: name,
            params: params
          }
        });
      },
      closeModal: () => {
        this.setState({
          modal: {
            name: MODAL_NONE,
            params: {}
          }
        });
      },
      updateModalParams: (params = {}) => {
        this.setState({
          modal: {
            ...this.state.modal,
            params: {
              ...this.state.modal.params,
              ...params
            }
          }
        });
      },
      changeProbeAxis: (value) => {
        this.setState({ probeAxis: value });
      },
      changeProbeCommand: (value) => {
        this.setState({ probeCommand: value });
      },
      changeProbeType: (value) => {
        this.setState({ probeType: value });
      },
      changeEdgeProbeType: (value) => {
        this.setState({ edgeProbeType: value });
      },
      changeCenterProbeType: (value) => {
        this.setState({ centerProbeType: value });
      },
      toggleUseTLO: () => {
        const { useTLO } = this.state;
        this.setState({ useTLO: !useTLO });
      },
      handleProbeDepthChange: (event) => {
        const probeDepth = event.target.value;
        this.setState({ probeDepth });
      },
      handleProbeFeedrateChange: (event) => {
        const probeFeedrate = event.target.value;
        this.setState({ probeFeedrate });
      },
      handleTouchPlateHeightChange: (event) => {
        const touchPlateHeight = event.target.value;
        this.setState({ touchPlateHeight });
      },
      handleRetractionDistanceChange: (event) => {
        const retractionDistance = event.target.value;
        this.setState({ retractionDistance });
      },
      populateProbeCommands: () => {
        const {
          probeAxis,
          probeCommand,
          probeType,
          useTLO,
          probeDepth,
          probeFeedrate,
          touchPlateHeight,
          retractionDistance
        } = this.state;

        // Handle basic probing (existing functionality)
        if (probeType === PROBE_TYPE_BASIC) {
          const wcs = this.getWorkCoordinateSystem();
          const mapWCSToP = (wcs) => ({
            'G54': 1,
            'G55': 2,
            'G56': 3,
            'G57': 4,
            'G58': 5,
            'G59': 6
          }[wcs] || 0);
          const towardWorkpiece = includes(['G38.2', 'G38.3'], probeCommand);
          const posname = `pos${probeAxis.toLowerCase()}`;
          const tloProbeCommands = [
            gcode('; Cancel tool length offset'),
            // Cancel tool length offset
            gcode('G49'),

            // Probe (use relative distance mode)
            gcode(`; ${probeAxis}-Probe`),
            gcode('G91'),
            gcode(probeCommand, {
              [probeAxis]: towardWorkpiece ? -probeDepth : probeDepth,
              F: probeFeedrate
            }),
            // Use absolute distance mode
            gcode('G90'),

            // Dwell
            gcode('; A dwell time of one second'),
            gcode('G4 P1'),

            // Apply touch plate height with tool length offset
            gcode('; Set tool length offset'),
            gcode('G43.1', {
              [probeAxis]: towardWorkpiece ? `[${posname}-${touchPlateHeight}]` : `[${posname}+${touchPlateHeight}]`
            }),

            // Retract from the touch plate (use relative distance mode)
            gcode('; Retract from the touch plate'),
            gcode('G91'),
            gcode('G0', {
              [probeAxis]: retractionDistance
            }),
            // Use asolute distance mode
            gcode('G90')
          ];
          const wcsProbeCommands = [
            // Probe (use relative distance mode)
            gcode(`; ${probeAxis}-Probe`),
            gcode('G91'),
            gcode(probeCommand, {
              [probeAxis]: towardWorkpiece ? -probeDepth : probeDepth,
              F: probeFeedrate
            }),
            // Use absolute distance mode
            gcode('G90'),

            // Set the WCS 0 offset
            gcode(`; Set the active WCS ${probeAxis}0`),
            gcode('G10', {
              L: 20,
              P: mapWCSToP(wcs),
              [probeAxis]: touchPlateHeight
            }),

            // Retract from the touch plate (use relative distance mode)
            gcode('; Retract from the touch plate'),
            gcode('G91'),
            gcode('G0', {
              [probeAxis]: retractionDistance
            }),
            // Use absolute distance mode
            gcode('G90')
          ];

          return useTLO ? tloProbeCommands : wcsProbeCommands;
        }

        // Handle edge probing
        if (probeType === PROBE_TYPE_EDGE) {
          return this.generateEdgeProbeCommands();
        }

        // Handle center probing
        if (probeType === PROBE_TYPE_CENTER) {
          return this.generateCenterProbeCommands();
        }

        // Handle rotation probing
        if (probeType === PROBE_TYPE_ROTATION) {
          return this.generateRotationProbeCommands();
        }

        // Handle height mapping
        if (probeType === PROBE_TYPE_HEIGHT_MAP) {
          return this.generateHeightMapProbeCommands();
        }

        // Default to basic probing commands
        return [];
      },
      generateEdgeProbeCommands: () => {
        const {
          edgeProbeType,
          probeDepth,
          probeFeedrate,
          touchPlateHeight,
          retractionDistance
        } = this.state;

        const commands = [
          gcode('; Edge Probing Sequence'),
          gcode('; Save current position'),
          gcode('G90'), // Absolute positioning
          gcode('#1 = [posx]'), // Store current X position
          gcode('#2 = [posy]'), // Store current Y position
          gcode('#3 = [posz]'), // Store current Z position
        ];

        // Determine probe direction based on edge type
        let probeAxis, probeDirection;
        switch (edgeProbeType) {
        case 'external_x_positive':
          probeAxis = 'X';
          probeDirection = probeDepth;
          break;
        case 'external_x_negative':
          probeAxis = 'X';
          probeDirection = -probeDepth;
          break;
        case 'external_y_positive':
          probeAxis = 'Y';
          probeDirection = probeDepth;
          break;
        case 'external_y_negative':
          probeAxis = 'Y';
          probeDirection = -probeDepth;
          break;
        case 'internal_x_positive':
          probeAxis = 'X';
          probeDirection = probeDepth;
          break;
        case 'internal_x_negative':
          probeAxis = 'X';
          probeDirection = -probeDepth;
          break;
        case 'internal_y_positive':
          probeAxis = 'Y';
          probeDirection = probeDepth;
          break;
        case 'internal_y_negative':
          probeAxis = 'Y';
          probeDirection = -probeDepth;
          break;
        default:
          probeAxis = 'X';
          probeDirection = probeDepth;
        }

        commands.push(
          // Probe toward edge
          gcode(`; Probe ${probeAxis} axis toward edge`),
          gcode('G91'), // Relative positioning
          gcode('G38.2', {
            [probeAxis]: probeDirection,
            F: probeFeedrate
          }),
          gcode('G90'), // Absolute positioning

          // Set work coordinate
          gcode(`; Set work coordinate for ${probeAxis} axis`),
          gcode('G10', {
            L: 20,
            P: 1, // G54 coordinate system
            [probeAxis]: touchPlateHeight
          }),

          // Retract from edge
          gcode('; Retract from edge'),
          gcode('G91'), // Relative positioning
          gcode('G0', {
            [probeAxis]: probeDirection > 0 ? -retractionDistance : retractionDistance
          }),
          gcode('G90') // Absolute positioning
        );

        return commands;
      },
      generateCenterProbeCommands: () => {
        const {
          centerProbeType,
          probeDepth,
          probeFeedrate,
          retractionDistance
        } = this.state;

        const commands = [
          gcode('; Center Finding Sequence'),
          gcode('G90'), // Absolute positioning
          gcode('#1 = [posx]'), // Store current X position
          gcode('#2 = [posy]'), // Store current Y position
          gcode('#3 = [posz]'), // Store current Z position
        ];

        if (centerProbeType === CENTER_PROBE_EXTERNAL) {
          // External center finding - probe from outside toward center
          commands.push(
            gcode('; External center finding - probe 4 directions'),

            // Probe X positive direction
            gcode('; Probe X+ direction'),
            gcode('G91'),
            gcode('G38.2', { X: probeDepth, F: probeFeedrate }),
            gcode('#4 = [posx]'), // Store X+ probe result
            gcode('G0', { X: -retractionDistance }), // Retract
            gcode('G0', { X: '#1' }), // Return to center X

            // Probe X negative direction
            gcode('; Probe X- direction'),
            gcode('G38.2', { X: -probeDepth, F: probeFeedrate }),
            gcode('#5 = [posx]'), // Store X- probe result
            gcode('G0', { X: retractionDistance }), // Retract
            gcode('G0', { X: '#1' }), // Return to center X

            // Probe Y positive direction
            gcode('; Probe Y+ direction'),
            gcode('G38.2', { Y: probeDepth, F: probeFeedrate }),
            gcode('#6 = [posy]'), // Store Y+ probe result
            gcode('G0', { Y: -retractionDistance }), // Retract
            gcode('G0', { Y: '#2' }), // Return to center Y

            // Probe Y negative direction
            gcode('; Probe Y- direction'),
            gcode('G38.2', { Y: -probeDepth, F: probeFeedrate }),
            gcode('#7 = [posy]'), // Store Y- probe result
            gcode('G0', { Y: retractionDistance }), // Retract
            gcode('G90'), // Absolute positioning

            // Calculate center and move there
            gcode('; Calculate and move to center'),
            gcode('#8 = [[#4 + #5] / 2]'), // Calculate X center
            gcode('#9 = [[#6 + #7] / 2]'), // Calculate Y center
            gcode('G0', { X: '#8', Y: '#9' }),

            // Set work coordinate to center
            gcode('G10', { L: 20, P: 1, X: 0, Y: 0 })
          );
        } else {
          // Internal center finding - probe from inside toward edges
          commands.push(
            gcode('; Internal center finding - probe 4 directions'),

            // Similar logic but probing outward from center
            gcode('; Probe X+ direction'),
            gcode('G91'),
            gcode('G38.2', { X: probeDepth, F: probeFeedrate }),
            gcode('#4 = [posx]'),
            gcode('G0', { X: -retractionDistance }),
            gcode('G0', { X: '#1' }),

            gcode('; Probe X- direction'),
            gcode('G38.2', { X: -probeDepth, F: probeFeedrate }),
            gcode('#5 = [posx]'),
            gcode('G0', { X: retractionDistance }),
            gcode('G0', { X: '#1' }),

            gcode('; Probe Y+ direction'),
            gcode('G38.2', { Y: probeDepth, F: probeFeedrate }),
            gcode('#6 = [posy]'),
            gcode('G0', { Y: -retractionDistance }),
            gcode('G0', { Y: '#2' }),

            gcode('; Probe Y- direction'),
            gcode('G38.2', { Y: -probeDepth, F: probeFeedrate }),
            gcode('#7 = [posy]'),
            gcode('G0', { Y: retractionDistance }),
            gcode('G90'),

            gcode('; Calculate and move to center'),
            gcode('#8 = [[#4 + #5] / 2]'),
            gcode('#9 = [[#6 + #7] / 2]'),
            gcode('G0', { X: '#8', Y: '#9' }),

            gcode('G10', { L: 20, P: 1, X: 0, Y: 0 })
          );
        }

        return commands;
      },
      generateRotationProbeCommands: () => {
        const {
          probeDepth,
          probeFeedrate,
          retractionDistance
        } = this.state;

        return [
          gcode('; Rotation Finding Sequence'),
          gcode('G90'), // Absolute positioning
          gcode('#1 = [posx]'), // Store current X position
          gcode('#2 = [posy]'), // Store current Y position

          // Probe first point
          gcode('; Probe first point'),
          gcode('G91'),
          gcode('G38.2', { Y: -probeDepth, F: probeFeedrate }),
          gcode('#3 = [posx]'), // Store first probe X
          gcode('#4 = [posy]'), // Store first probe Y
          gcode('G0', { Y: retractionDistance }), // Retract

          // Move to second probe position
          gcode('G90'),
          gcode('G0', { X: '#1 + 10' }), // Move 10mm in X direction

          // Probe second point
          gcode('; Probe second point'),
          gcode('G91'),
          gcode('G38.2', { Y: -probeDepth, F: probeFeedrate }),
          gcode('#5 = [posx]'), // Store second probe X
          gcode('#6 = [posy]'), // Store second probe Y
          gcode('G0', { Y: retractionDistance }), // Retract

          // Calculate rotation angle
          gcode('G90'),
          gcode('; Calculate rotation angle'),
          gcode('#7 = [#6 - #4]'), // Delta Y
          gcode('#8 = [#5 - #3]'), // Delta X
          gcode('#9 = [ATAN[#7]/[#8]]'), // Angle in radians

          // Apply coordinate system rotation
          gcode('; Apply rotation to coordinate system'),
          gcode('G68 X[#3] Y[#4] R[#9 * 180 / 3.14159]'), // Rotate coordinate system

          // Return to original position
          gcode('G0', { X: '#1', Y: '#2' })
        ];
      },
      generateHeightMapProbeCommands: () => {
        const {
          probeDepth,
          probeFeedrate,
          retractionDistance
        } = this.state;

        // Simple 3x3 height map for demonstration
        const gridSize = 3;
        const stepSize = 10; // 10mm steps

        const commands = [
          gcode('; Height Mapping Sequence'),
          gcode('G90'), // Absolute positioning
          gcode('#1 = [posx]'), // Store start X position
          gcode('#2 = [posy]'), // Store start Y position
          gcode('#3 = [posz]'), // Store start Z position
        ];

        // Generate probe points in a grid pattern
        for (let row = 0; row < gridSize; row++) {
          for (let col = 0; col < gridSize; col++) {
            const pointNum = row * gridSize + col + 4; // Start variables from #4
            const xOffset = col * stepSize;
            const yOffset = row * stepSize;

            commands.push(
              gcode(`; Probe point ${row + 1},${col + 1}`),
              gcode('G0', { X: `#1 + ${xOffset}`, Y: `#2 + ${yOffset}`, Z: '#3' }),
              gcode('G91'),
              gcode('G38.2', { Z: -probeDepth, F: probeFeedrate }),
              gcode(`#${pointNum} = [posz]`), // Store probe Z result
              gcode('G0', { Z: retractionDistance }), // Retract
              gcode('G90')
            );
          }
        }

        commands.push(
          gcode('; Return to start position'),
          gcode('G0', { X: '#1', Y: '#2', Z: '#3' })
        );

        return commands;
      },
      runProbeCommands: (commands) => {
        controller.command('gcode', commands);
      }
    };

    controllerEvents = {
      'serialport:open': (options) => {
        const { port } = options;
        this.setState({ port: port });
      },
      'serialport:close': (options) => {
        const initialState = this.getInitialState();
        this.setState({ ...initialState });
      },
      'workflow:state': (workflowState) => {
        this.setState(state => ({
          workflow: {
            state: workflowState
          }
        }));
      },
      'controller:state': (type, state) => {
        let units = this.state.units;

        // Grbl
        if (type === GRBL) {
          const { parserstate } = { ...state };
          const { modal = {} } = { ...parserstate };
          units = {
            'G20': IMPERIAL_UNITS,
            'G21': METRIC_UNITS
          }[modal.units] || units;
        }

        // Marlin
        if (type === MARLIN) {
          const { modal = {} } = { ...state };
          units = {
            'G20': IMPERIAL_UNITS,
            'G21': METRIC_UNITS
          }[modal.units] || units;
        }

        // Smoothie
        if (type === SMOOTHIE) {
          const { parserstate } = { ...state };
          const { modal = {} } = { ...parserstate };
          units = {
            'G20': IMPERIAL_UNITS,
            'G21': METRIC_UNITS
          }[modal.units] || units;
        }

        // TinyG
        if (type === TINYG) {
          const { sr } = { ...state };
          const { modal = {} } = { ...sr };
          units = {
            'G20': IMPERIAL_UNITS,
            'G21': METRIC_UNITS
          }[modal.units] || units;
        }

        if (this.state.units !== units) {
          // Set `this.unitsDidChange` to true if the unit has changed
          this.unitsDidChange = true;
        }

        this.setState({
          units: units,
          controller: {
            type: type,
            state: state
          },
          probeDepth: mapValueToUnits(this.config.get('probeDepth'), units),
          probeFeedrate: mapValueToUnits(this.config.get('probeFeedrate'), units),
          touchPlateHeight: mapValueToUnits(this.config.get('touchPlateHeight'), units),
          retractionDistance: mapValueToUnits(this.config.get('retractionDistance'), units)
        });
      }
    };

    unitsDidChange = false;

    componentDidMount() {
      this.addControllerEvents();
    }

    componentWillUnmount() {
      this.removeControllerEvents();
    }

    componentDidUpdate(prevProps, prevState) {
      const {
        minimized
      } = this.state;

      this.config.set('minimized', minimized);

      // Do not save config settings if the units did change between in and mm
      if (this.unitsDidChange) {
        this.unitsDidChange = false;
        return;
      }

      const { units, probeCommand, probeType, edgeProbeType, centerProbeType, useTLO } = this.state;
      this.config.set('probeCommand', probeCommand);
      this.config.set('probeType', probeType);
      this.config.set('edgeProbeType', edgeProbeType);
      this.config.set('centerProbeType', centerProbeType);
      this.config.set('useTLO', useTLO);

      let {
        probeDepth,
        probeFeedrate,
        touchPlateHeight,
        retractionDistance
      } = this.state;

      // To save in mm
      if (units === IMPERIAL_UNITS) {
        probeDepth = in2mm(probeDepth);
        probeFeedrate = in2mm(probeFeedrate);
        touchPlateHeight = in2mm(touchPlateHeight);
        retractionDistance = in2mm(retractionDistance);
      }
      this.config.set('probeDepth', Number(probeDepth));
      this.config.set('probeFeedrate', Number(probeFeedrate));
      this.config.set('touchPlateHeight', Number(touchPlateHeight));
      this.config.set('retractionDistance', Number(retractionDistance));
    }

    getInitialState() {
      return {
        minimized: this.config.get('minimized', false),
        isFullscreen: false,
        canClick: true, // Defaults to true
        port: controller.port,
        units: METRIC_UNITS,
        controller: {
          type: controller.type,
          state: controller.state
        },
        workflow: {
          state: controller.workflow.state
        },
        modal: {
          name: MODAL_NONE,
          params: {}
        },
        probeAxis: this.config.get('probeAxis', 'Z'),
        probeCommand: this.config.get('probeCommand', 'G38.2'),
        probeType: this.config.get('probeType', PROBE_TYPE_BASIC),
        edgeProbeType: this.config.get('edgeProbeType', EDGE_PROBE_EXTERNAL_X_POSITIVE),
        centerProbeType: this.config.get('centerProbeType', CENTER_PROBE_EXTERNAL),
        useTLO: this.config.get('useTLO'),
        probeDepth: Number(this.config.get('probeDepth') || 0).toFixed(3) * 1,
        probeFeedrate: Number(this.config.get('probeFeedrate') || 0).toFixed(3) * 1,
        touchPlateHeight: Number(this.config.get('touchPlateHeight') || 0).toFixed(3) * 1,
        retractionDistance: Number(this.config.get('retractionDistance') || 0).toFixed(3) * 1
      };
    }

    addControllerEvents() {
      Object.keys(this.controllerEvents).forEach(eventName => {
        const callback = this.controllerEvents[eventName];
        controller.addListener(eventName, callback);
      });
    }

    removeControllerEvents() {
      Object.keys(this.controllerEvents).forEach(eventName => {
        const callback = this.controllerEvents[eventName];
        controller.removeListener(eventName, callback);
      });
    }

    getWorkCoordinateSystem() {
      const controllerType = this.state.controller.type;
      const controllerState = this.state.controller.state;
      const defaultWCS = 'G54';

      if (controllerType === GRBL) {
        return get(controllerState, 'parserstate.modal.wcs') || defaultWCS;
      }

      if (controllerType === MARLIN) {
        return get(controllerState, 'modal.wcs') || defaultWCS;
      }

      if (controllerType === SMOOTHIE) {
        return get(controllerState, 'parserstate.modal.wcs') || defaultWCS;
      }

      if (controllerType === TINYG) {
        return get(controllerState, 'sr.modal.wcs') || defaultWCS;
      }

      return defaultWCS;
    }

    canClick() {
      const { port, workflow } = this.state;
      const controllerType = this.state.controller.type;
      const controllerState = this.state.controller.state;

      if (!port) {
        return false;
      }
      if (workflow.state !== WORKFLOW_STATE_IDLE) {
        return false;
      }
      if (!includes([GRBL, MARLIN, SMOOTHIE, TINYG], controllerType)) {
        return false;
      }
      if (controllerType === GRBL) {
        const activeState = get(controllerState, 'status.activeState');
        const states = [
          GRBL_ACTIVE_STATE_IDLE
        ];
        if (!includes(states, activeState)) {
          return false;
        }
      }
      if (controllerType === MARLIN) {
        // Marlin does not have machine state
      }
      if (controllerType === SMOOTHIE) {
        const activeState = get(controllerState, 'status.activeState');
        const states = [
          SMOOTHIE_ACTIVE_STATE_IDLE
        ];
        if (!includes(states, activeState)) {
          return false;
        }
      }
      if (controllerType === TINYG) {
        const machineState = get(controllerState, 'sr.machineState');
        const states = [
          TINYG_MACHINE_STATE_READY,
          TINYG_MACHINE_STATE_STOP,
          TINYG_MACHINE_STATE_END
        ];
        if (!includes(states, machineState)) {
          return false;
        }
      }

      return true;
    }

    render() {
      const { widgetId } = this.props;
      const { minimized, isFullscreen } = this.state;
      const isForkedWidget = widgetId.match(/\w+:[\w\-]+/);
      const state = {
        ...this.state,
        canClick: this.canClick()
      };
      const actions = {
        ...this.actions
      };

      return (
        <Widget fullscreen={isFullscreen}>
          <Widget.Header>
            <Widget.Title>
              <Widget.Sortable className={this.props.sortable.handleClassName}>
                <i className="fa fa-bars" />
                <Space width="8" />
              </Widget.Sortable>
              {isForkedWidget &&
                <i className="fa fa-code-fork" style={{ marginRight: 5 }} />
              }
              {i18n._('Probe')}
            </Widget.Title>
            <Widget.Controls className={this.props.sortable.filterClassName}>
              <Widget.Button
                disabled={isFullscreen}
                title={minimized ? i18n._('Expand') : i18n._('Collapse')}
                onClick={actions.toggleMinimized}
              >
                <i
                  className={classNames(
                    'fa',
                    { 'fa-chevron-up': !minimized },
                    { 'fa-chevron-down': minimized }
                  )}
                />
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
                  <i
                    className={classNames(
                      'fa',
                      'fa-fw',
                      { 'fa-expand': !isFullscreen },
                      { 'fa-compress': isFullscreen }
                    )}
                  />
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
          <Widget.Content
            className={classNames(
              styles['widget-content'],
              { [styles.hidden]: minimized }
            )}
          >
            {state.modal.name === MODAL_PREVIEW &&
              <RunProbe state={state} actions={actions} />
            }
            <Probe
              state={state}
              actions={actions}
            />
          </Widget.Content>
        </Widget>
      );
    }
}

export default ProbeWidget;
