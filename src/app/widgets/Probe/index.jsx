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
  PROBE_TYPE_CONFIG,
  PROBE_TYPE_EXTERNAL_EDGE,
  PROBE_TYPE_INTERNAL_EDGE,
  PROBE_TYPE_CENTER,
  PROBE_TYPE_ROTATION,
  PROBE_TYPE_HEIGHT_MAP,
  EXTERNAL_EDGE_X_POSITIVE,
  EXTERNAL_EDGE_X_NEGATIVE,
  EXTERNAL_EDGE_Y_POSITIVE,
  EXTERNAL_EDGE_Y_NEGATIVE,
  EXTERNAL_EDGE_Z_NEGATIVE,
  INTERNAL_EDGE_X_POSITIVE,
  INTERNAL_EDGE_X_NEGATIVE,
  INTERNAL_EDGE_Y_POSITIVE,
  INTERNAL_EDGE_Y_NEGATIVE,
  CENTER_PROBE_EXTERNAL,
  ROTATION_EDGE_LEFT,
  ROTATION_EDGE_RIGHT,
  ROTATION_EDGE_TOP,
  ROTATION_EDGE_BOTTOM
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
      changeProbeType: (value) => {
        this.setState({ probeType: value });
      },
      changeCenterProbeType: (value) => {
        this.setState({ centerProbeType: value });
      },
      // Configuration tab handlers
      handleProbeDiameterChange: (event) => {
        const probeDiameter = event.target.value;
        this.setState({ probeDiameter });
      },
      handleTouchPlateHeightChange: (event) => {
        const touchPlateHeight = event.target.value;
        this.setState({ touchPlateHeight });
      },
      handleRapidsFeedrateChange: (event) => {
        const rapidsFeedrate = event.target.value;
        this.setState({ rapidsFeedrate });
      },
      handleSearchFeedrateChange: (event) => {
        const searchFeedrate = event.target.value;
        this.setState({ searchFeedrate });
      },
      handleLatchFeedrateChange: (event) => {
        const latchFeedrate = event.target.value;
        this.setState({ latchFeedrate });
      },
      handleProbingDistanceChange: (event) => {
        const probingDistance = event.target.value;
        this.setState({ probingDistance });
      },
      handleLatchDistanceChange: (event) => {
        const latchDistance = event.target.value;
        this.setState({ latchDistance });
      },
      handleXyClearanceChange: (event) => {
        const xyClearing = event.target.value;
        this.setState({ xyClearing });
      },
      handleProbeOffsetChange: (event) => {
        const probeOffset = event.target.value;
        this.setState({ probeOffset });
      },
      handleProbeDepthChange: (event) => {
        const probeDepth = event.target.value;
        this.setState({ probeDepth });
      },
      // External edge handlers
      selectExternalEdge: (direction) => {
        this.setState({
          selectedExternalEdge: this.state.selectedExternalEdge === direction ? null : direction
        });
      },
      // Internal edge handlers
      selectInternalEdge: (direction) => {
        this.setState({
          selectedInternalEdge: this.state.selectedInternalEdge === direction ? null : direction
        });
      },
      // Center probe handlers
      toggleSetCenterAsOrigin: () => {
        const { setCenterAsOrigin } = this.state;
        this.setState({ setCenterAsOrigin: !setCenterAsOrigin });
      },
      handleCenterSizeXChange: (event) => {
        const centerSizeX = event.target.value;
        this.setState({ centerSizeX });
      },
      handleCenterSizeYChange: (event) => {
        const centerSizeY = event.target.value;
        this.setState({ centerSizeY });
      },
      handleCenterPassesChange: (event) => {
        const centerPasses = event.target.value;
        this.setState({ centerPasses });
      },
      // Rotation handlers
      selectRotationEdge: (edge) => {
        this.setState({ selectedRotationEdge: edge });
      },
      applyRotationToGcode: () => {
        // TODO: Implement G-code rotation application
        console.log('Apply rotation to G-code');
      },
      // Height map handlers
      handleHeightMapStartXChange: (event) => {
        const heightMapStartX = event.target.value;
        this.setState({ heightMapStartX });
      },
      handleHeightMapStartYChange: (event) => {
        const heightMapStartY = event.target.value;
        this.setState({ heightMapStartY });
      },
      handleHeightMapWidthChange: (event) => {
        const heightMapWidth = event.target.value;
        this.setState({ heightMapWidth });
      },
      handleHeightMapHeightChange: (event) => {
        const heightMapHeight = event.target.value;
        this.setState({ heightMapHeight });
      },
      handleHeightMapGridSizeXChange: (event) => {
        const heightMapGridSizeX = event.target.value;
        this.setState({
          heightMapGridSizeX,
          heightMapData: [] // Clear existing data when grid size changes
        });
      },
      handleHeightMapGridSizeYChange: (event) => {
        const heightMapGridSizeY = event.target.value;
        this.setState({
          heightMapGridSizeY,
          heightMapData: [] // Clear existing data when grid size changes
        });
      },
      togglePauseBeforeProbing: () => {
        const { pauseBeforeProbing } = this.state;
        this.setState({ pauseBeforeProbing: !pauseBeforeProbing });
      },
      toggleSetZZeroAtOrigin: () => {
        const { setZZeroAtOrigin } = this.state;
        this.setState({ setZZeroAtOrigin: !setZZeroAtOrigin });
      },
      autoDetectHeightMapArea: () => {
        // TODO: Implement auto-detection from program limits
        console.log('Auto-detect height map area from program limits');
      },
      applyHeightMapToGcode: () => {
        // TODO: Implement height map application to G-code
        console.log('Apply height map to G-code');
      },
      generateSampleHeightMapData: () => {
        const { heightMapGridSizeX, heightMapGridSizeY } = this.state;

        // Generate sample height map data for demonstration
        const heightMapData = [];
        for (let row = 0; row < heightMapGridSizeY; row++) {
          const rowData = [];
          for (let col = 0; col < heightMapGridSizeX; col++) {
            // Create a sample height variation (simulating a slightly uneven surface)
            const height = Math.sin((row * Math.PI) / (heightMapGridSizeY - 1)) *
                          Math.cos((col * Math.PI) / (heightMapGridSizeX - 1)) * 0.5 +
                          (Math.random() - 0.5) * 0.2;
            rowData.push(height);
          }
          heightMapData.push(rowData);
        }

        this.setState({ heightMapData });
      },
      // Probe control
      stopProbing: () => {
        // TODO: Implement probe stop functionality
        controller.command('feedhold');
        controller.command('reset');
      },
      populateProbeCommands: () => {
        const { probeType } = this.state;

        // Handle different probe types
        if (probeType === PROBE_TYPE_EXTERNAL_EDGE) {
          return this.generateExternalEdgeProbeCommands();
        }

        if (probeType === PROBE_TYPE_INTERNAL_EDGE) {
          return this.generateInternalEdgeProbeCommands();
        }

        if (probeType === PROBE_TYPE_CENTER) {
          return this.generateCenterProbeCommands();
        }

        if (probeType === PROBE_TYPE_ROTATION) {
          return this.generateRotationProbeCommands();
        }

        if (probeType === PROBE_TYPE_HEIGHT_MAP) {
          return this.generateHeightMapProbeCommands();
        }

        // Default to empty commands for config tab
        return [];
      },
      generateExternalEdgeProbeCommands: () => {
        const {
          selectedExternalEdge,
          probingDistance,
          searchFeedrate,
          touchPlateHeight,
          xyClearing
        } = this.state;

        if (!selectedExternalEdge) {
          return [];
        }

        const commands = [
          gcode('; External Edge Probing Sequence'),
          gcode('G90'), // Absolute positioning
          gcode('#1 = [posx]'), // Store current X position
          gcode('#2 = [posy]'), // Store current Y position
          gcode('#3 = [posz]'), // Store current Z position
        ];

        // Determine probe direction and axis based on selection
        let probeAxis, probeDirection;
        switch (selectedExternalEdge) {
        case EXTERNAL_EDGE_X_POSITIVE:
          probeAxis = 'X';
          probeDirection = probingDistance;
          break;
        case EXTERNAL_EDGE_X_NEGATIVE:
          probeAxis = 'X';
          probeDirection = -probingDistance;
          break;
        case EXTERNAL_EDGE_Y_POSITIVE:
          probeAxis = 'Y';
          probeDirection = probingDistance;
          break;
        case EXTERNAL_EDGE_Y_NEGATIVE:
          probeAxis = 'Y';
          probeDirection = -probingDistance;
          break;
        case EXTERNAL_EDGE_Z_NEGATIVE:
          probeAxis = 'Z';
          probeDirection = -probingDistance;
          break;
        default:
          return [];
        }

        commands.push(
          // Probe toward edge
          gcode(`; Probe ${probeAxis} axis toward edge`),
          gcode('G91'), // Relative positioning
          gcode('G38.2', {
            [probeAxis]: probeDirection,
            F: searchFeedrate
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
            [probeAxis]: probeDirection > 0 ? -xyClearing : xyClearing
          }),
          gcode('G90') // Absolute positioning
        );

        return commands;
      },
      generateInternalEdgeProbeCommands: () => {
        const {
          selectedInternalEdge,
          probingDistance,
          searchFeedrate,
          touchPlateHeight,
          xyClearing
        } = this.state;

        if (!selectedInternalEdge) {
          return [];
        }

        const commands = [
          gcode('; Internal Edge Probing Sequence'),
          gcode('G90'), // Absolute positioning
          gcode('#1 = [posx]'), // Store current X position
          gcode('#2 = [posy]'), // Store current Y position
          gcode('#3 = [posz]'), // Store current Z position
        ];

        // Determine probe direction and axis based on selection
        let probeAxis, probeDirection;
        switch (selectedInternalEdge) {
        case INTERNAL_EDGE_X_POSITIVE:
          probeAxis = 'X';
          probeDirection = probingDistance;
          break;
        case INTERNAL_EDGE_X_NEGATIVE:
          probeAxis = 'X';
          probeDirection = -probingDistance;
          break;
        case INTERNAL_EDGE_Y_POSITIVE:
          probeAxis = 'Y';
          probeDirection = probingDistance;
          break;
        case INTERNAL_EDGE_Y_NEGATIVE:
          probeAxis = 'Y';
          probeDirection = -probingDistance;
          break;
        default:
          return [];
        }

        commands.push(
          // Probe toward internal edge
          gcode(`; Probe ${probeAxis} axis toward internal edge`),
          gcode('G91'), // Relative positioning
          gcode('G38.2', {
            [probeAxis]: probeDirection,
            F: searchFeedrate
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
            [probeAxis]: probeDirection > 0 ? -xyClearing : xyClearing
          }),
          gcode('G90') // Absolute positioning
        );

        return commands;
      },
      generateCenterProbeCommands: () => {
        const {
          centerProbeType,
          setCenterAsOrigin,
          centerPasses,
          probingDistance,
          searchFeedrate,
          xyClearing
        } = this.state;

        const commands = [
          gcode('; Center Finding Sequence'),
          gcode('G90'), // Absolute positioning
          gcode('#1 = [posx]'), // Store current X position
          gcode('#2 = [posy]'), // Store current Y position
          gcode('#3 = [posz]'), // Store current Z position
        ];

        // Multi-pass center finding
        for (let pass = 0; pass < centerPasses; pass++) {
          const passDistance = probingDistance * (1 - pass * 0.1); // Reduce distance each pass

          if (centerProbeType === CENTER_PROBE_EXTERNAL) {
            // External center finding - probe from outside toward center
            commands.push(
              gcode(`; External center finding - pass ${pass + 1}`),

              // Probe X positive direction
              gcode('; Probe X+ direction'),
              gcode('G91'),
              gcode('G38.2', { X: passDistance, F: searchFeedrate }),
              gcode(`#${4 + pass * 4} = [posx]`), // Store X+ probe result
              gcode('G0', { X: -xyClearing }), // Retract
              gcode('G0', { X: '#1' }), // Return to center X

              // Probe X negative direction
              gcode('; Probe X- direction'),
              gcode('G38.2', { X: -passDistance, F: searchFeedrate }),
              gcode(`#${5 + pass * 4} = [posx]`), // Store X- probe result
              gcode('G0', { X: xyClearing }), // Retract
              gcode('G0', { X: '#1' }), // Return to center X

              // Probe Y positive direction
              gcode('; Probe Y+ direction'),
              gcode('G38.2', { Y: passDistance, F: searchFeedrate }),
              gcode(`#${6 + pass * 4} = [posy]`), // Store Y+ probe result
              gcode('G0', { Y: -xyClearing }), // Retract
              gcode('G0', { Y: '#2' }), // Return to center Y

              // Probe Y negative direction
              gcode('; Probe Y- direction'),
              gcode('G38.2', { Y: -passDistance, F: searchFeedrate }),
              gcode(`#${7 + pass * 4} = [posy]`), // Store Y- probe result
              gcode('G0', { Y: xyClearing }), // Retract
              gcode('G90') // Absolute positioning
            );
          } else {
            // Internal center finding - probe from inside toward edges
            commands.push(
              gcode(`; Internal center finding - pass ${pass + 1}`),
              // Similar logic but probing outward from center
              gcode('; Probe X+ direction'),
              gcode('G91'),
              gcode('G38.2', { X: passDistance, F: searchFeedrate }),
              gcode(`#${4 + pass * 4} = [posx]`),
              gcode('G0', { X: -xyClearing }),
              gcode('G0', { X: '#1' }),

              gcode('; Probe X- direction'),
              gcode('G38.2', { X: -passDistance, F: searchFeedrate }),
              gcode(`#${5 + pass * 4} = [posx]`),
              gcode('G0', { X: xyClearing }),
              gcode('G0', { X: '#1' }),

              gcode('; Probe Y+ direction'),
              gcode('G38.2', { Y: passDistance, F: searchFeedrate }),
              gcode(`#${6 + pass * 4} = [posy]`),
              gcode('G0', { Y: -xyClearing }),
              gcode('G0', { Y: '#2' }),

              gcode('; Probe Y- direction'),
              gcode('G38.2', { Y: -passDistance, F: searchFeedrate }),
              gcode(`#${7 + pass * 4} = [posy]`),
              gcode('G0', { Y: xyClearing }),
              gcode('G90')
            );
          }
        }

        // Calculate center from final pass
        const finalPassOffset = (centerPasses - 1) * 4;
        commands.push(
          gcode('; Calculate and move to center'),
          gcode(`#100 = [[#${4 + finalPassOffset} + #${5 + finalPassOffset}] / 2]`), // Calculate X center
          gcode(`#101 = [[#${6 + finalPassOffset} + #${7 + finalPassOffset}] / 2]`), // Calculate Y center
          gcode('G0', { X: '#100', Y: '#101' })
        );

        if (setCenterAsOrigin) {
          commands.push(
            gcode('; Set center as coordinate origin'),
            gcode('G10', { L: 20, P: 1, X: 0, Y: 0 })
          );
        }

        return commands;
      },
      generateRotationProbeCommands: () => {
        const {
          selectedRotationEdge,
          probingDistance,
          searchFeedrate
        } = this.state;

        if (!selectedRotationEdge) {
          return [];
        }

        const commands = [
          gcode('; Rotation Finding Sequence'),
          gcode('G90'), // Absolute positioning
          gcode('#1 = [posx]'), // Store current X position
          gcode('#2 = [posy]'), // Store current Y position
        ];

        // Determine probe direction based on selected edge
        let probeDirection, moveDirection;
        switch (selectedRotationEdge) {
        case ROTATION_EDGE_LEFT:
          probeDirection = { X: probingDistance };
          moveDirection = { Y: 10 }; // Move 10mm in Y direction for second probe
          break;
        case ROTATION_EDGE_RIGHT:
          probeDirection = { X: -probingDistance };
          moveDirection = { Y: 10 };
          break;
        case ROTATION_EDGE_TOP:
          probeDirection = { Y: -probingDistance };
          moveDirection = { X: 10 };
          break;
        case ROTATION_EDGE_BOTTOM:
          probeDirection = { Y: probingDistance };
          moveDirection = { X: 10 };
          break;
        default:
          return [];
        }

        commands.push(
          // Probe first point
          gcode('; Probe first point'),
          gcode('G91'),
          gcode('G38.2', { ...probeDirection, F: searchFeedrate }),
          gcode('#3 = [posx]'), // Store first probe X
          gcode('#4 = [posy]'), // Store first probe Y
          gcode('G0', { ...Object.fromEntries(Object.entries(probeDirection).map(([k, v]) => [k, -v * 0.1])) }), // Small retract

          // Move to second probe position
          gcode('G90'),
          gcode('G0', moveDirection),

          // Probe second point
          gcode('; Probe second point'),
          gcode('G91'),
          gcode('G38.2', { ...probeDirection, F: searchFeedrate }),
          gcode('#5 = [posx]'), // Store second probe X
          gcode('#6 = [posy]'), // Store second probe Y
          gcode('G0', { ...Object.fromEntries(Object.entries(probeDirection).map(([k, v]) => [k, -v * 0.1])) }), // Small retract

          // Calculate rotation angle
          gcode('G90'),
          gcode('; Calculate rotation angle'),
          gcode('#7 = [#6 - #4]'), // Delta Y
          gcode('#8 = [#5 - #3]'), // Delta X
          gcode('#9 = [ATAN[#7]/[#8]]'), // Angle in radians

          // Apply coordinate system rotation using X0, Y0 as center
          gcode('; Apply rotation to coordinate system'),
          gcode('G68 X0 Y0 R[#9 * 180 / 3.14159]'), // Rotate coordinate system

          // Return to original position
          gcode('G0', { X: '#1', Y: '#2' })
        );

        return commands;
      },
      generateHeightMapProbeCommands: () => {
        const {
          heightMapStartX,
          heightMapStartY,
          heightMapWidth,
          heightMapHeight,
          heightMapGridSizeX,
          heightMapGridSizeY,
          pauseBeforeProbing,
          setZZeroAtOrigin,
          probingDistance,
          searchFeedrate,
          xyClearing
        } = this.state;

        const commands = [
          gcode('; Height Mapping Sequence'),
          gcode('G90'), // Absolute positioning
          gcode('#1 = [posx]'), // Store start X position
          gcode('#2 = [posy]'), // Store start Y position
          gcode('#3 = [posz]'), // Store start Z position
        ];

        if (pauseBeforeProbing) {
          commands.push(
            gcode('; Pause before probing'),
            gcode('M0')
          );
        }

        // Calculate step sizes
        const xStep = heightMapWidth / (heightMapGridSizeX - 1);
        const yStep = heightMapHeight / (heightMapGridSizeY - 1);

        // Generate probe points in a grid pattern
        let variableNum = 10; // Start variables from #10
        for (let row = 0; row < heightMapGridSizeY; row++) {
          for (let col = 0; col < heightMapGridSizeX; col++) {
            const xOffset = col * xStep;
            const yOffset = row * yStep;

            commands.push(
              gcode(`; Probe point ${row + 1},${col + 1}`),
              gcode('G0', {
                X: heightMapStartX + xOffset,
                Y: heightMapStartY + yOffset,
                Z: '#3'
              }),
              gcode('G91'),
              gcode('G38.2', { Z: -probingDistance, F: searchFeedrate }),
              gcode(`#${variableNum} = [posz]`), // Store probe Z result
              gcode('G0', { Z: xyClearing }), // Retract
              gcode('G90')
            );
            variableNum++;
          }
        }

        if (setZZeroAtOrigin) {
          commands.push(
            gcode('; Set Z=0 at X0Y0 based on probe at origin'),
            gcode('G10', { L: 20, P: 1, Z: '#10' }) // Use first probe point as Z reference
          );
        } else {
          // Use center point as reference
          const centerIndex = Math.floor(heightMapGridSizeY / 2) * heightMapGridSizeX + Math.floor(heightMapGridSizeX / 2);
          commands.push(
            gcode('; Set Z=0 at center point'),
            gcode('G10', { L: 20, P: 1, Z: `#${10 + centerIndex}` })
          );
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
          // Convert all measurement values to current units
          probeDiameter: mapValueToUnits(this.config.get('probeDiameter'), units),
          touchPlateHeight: mapValueToUnits(this.config.get('touchPlateHeight'), units),
          rapidsFeedrate: mapValueToUnits(this.config.get('rapidsFeedrate'), units),
          searchFeedrate: mapValueToUnits(this.config.get('searchFeedrate'), units),
          latchFeedrate: mapValueToUnits(this.config.get('latchFeedrate'), units),
          probingDistance: mapValueToUnits(this.config.get('probingDistance'), units),
          latchDistance: mapValueToUnits(this.config.get('latchDistance'), units),
          xyClearing: mapValueToUnits(this.config.get('xyClearing'), units),
          probeOffset: mapValueToUnits(this.config.get('probeOffset'), units),
          probeDepth: mapValueToUnits(this.config.get('probeDepth'), units),
          centerSizeX: mapValueToUnits(this.config.get('centerSizeX'), units),
          centerSizeY: mapValueToUnits(this.config.get('centerSizeY'), units),
          heightMapStartX: mapValueToUnits(this.config.get('heightMapStartX'), units),
          heightMapStartY: mapValueToUnits(this.config.get('heightMapStartY'), units),
          heightMapWidth: mapValueToUnits(this.config.get('heightMapWidth'), units),
          heightMapHeight: mapValueToUnits(this.config.get('heightMapHeight'), units),
          // Grid sizes don't need unit conversion
          heightMapGridSizeX: this.config.get('heightMapGridSizeX') || 3,
          heightMapGridSizeY: this.config.get('heightMapGridSizeY') || 3
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

      const {
        units,
        probeType,
        centerProbeType,
        selectedExternalEdge,
        selectedInternalEdge,
        setCenterAsOrigin,
        centerPasses,
        selectedRotationEdge,
        pauseBeforeProbing,
        setZZeroAtOrigin,
        heightMapGridSizeX,
        heightMapGridSizeY
      } = this.state;

      // Save non-numeric config
      this.config.set('probeType', probeType);
      this.config.set('centerProbeType', centerProbeType);
      this.config.set('selectedExternalEdge', selectedExternalEdge);
      this.config.set('selectedInternalEdge', selectedInternalEdge);
      this.config.set('setCenterAsOrigin', setCenterAsOrigin);
      this.config.set('centerPasses', centerPasses);
      this.config.set('selectedRotationEdge', selectedRotationEdge);
      this.config.set('pauseBeforeProbing', pauseBeforeProbing);
      this.config.set('setZZeroAtOrigin', setZZeroAtOrigin);
      this.config.set('heightMapGridSizeX', heightMapGridSizeX);
      this.config.set('heightMapGridSizeY', heightMapGridSizeY);

      let {
        probeDiameter,
        touchPlateHeight,
        rapidsFeedrate,
        searchFeedrate,
        latchFeedrate,
        probingDistance,
        latchDistance,
        xyClearing,
        probeOffset,
        probeDepth,
        centerSizeX,
        centerSizeY,
        heightMapStartX,
        heightMapStartY,
        heightMapWidth,
        heightMapHeight
      } = this.state;

      // To save in mm
      if (units === IMPERIAL_UNITS) {
        probeDiameter = in2mm(probeDiameter);
        touchPlateHeight = in2mm(touchPlateHeight);
        rapidsFeedrate = in2mm(rapidsFeedrate);
        searchFeedrate = in2mm(searchFeedrate);
        latchFeedrate = in2mm(latchFeedrate);
        probingDistance = in2mm(probingDistance);
        latchDistance = in2mm(latchDistance);
        xyClearing = in2mm(xyClearing);
        probeOffset = in2mm(probeOffset);
        probeDepth = in2mm(probeDepth);
        centerSizeX = in2mm(centerSizeX);
        centerSizeY = in2mm(centerSizeY);
        heightMapStartX = in2mm(heightMapStartX);
        heightMapStartY = in2mm(heightMapStartY);
        heightMapWidth = in2mm(heightMapWidth);
        heightMapHeight = in2mm(heightMapHeight);
      }

      // Save numeric config in mm
      this.config.set('probeDiameter', Number(probeDiameter));
      this.config.set('touchPlateHeight', Number(touchPlateHeight));
      this.config.set('rapidsFeedrate', Number(rapidsFeedrate));
      this.config.set('searchFeedrate', Number(searchFeedrate));
      this.config.set('latchFeedrate', Number(latchFeedrate));
      this.config.set('probingDistance', Number(probingDistance));
      this.config.set('latchDistance', Number(latchDistance));
      this.config.set('xyClearing', Number(xyClearing));
      this.config.set('probeOffset', Number(probeOffset));
      this.config.set('probeDepth', Number(probeDepth));
      this.config.set('centerSizeX', Number(centerSizeX));
      this.config.set('centerSizeY', Number(centerSizeY));
      this.config.set('heightMapStartX', Number(heightMapStartX));
      this.config.set('heightMapStartY', Number(heightMapStartY));
      this.config.set('heightMapWidth', Number(heightMapWidth));
      this.config.set('heightMapHeight', Number(heightMapHeight));
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
        // Probe type selection - start with configuration tab
        probeType: this.config.get('probeType', PROBE_TYPE_CONFIG),

        // Configuration parameters
        probeDiameter: Number(this.config.get('probeDiameter') || 3).toFixed(3) * 1,
        touchPlateHeight: Number(this.config.get('touchPlateHeight') || 0).toFixed(3) * 1,
        rapidsFeedrate: Number(this.config.get('rapidsFeedrate') || 1000).toFixed(3) * 1,
        searchFeedrate: Number(this.config.get('searchFeedrate') || 100).toFixed(3) * 1,
        latchFeedrate: Number(this.config.get('latchFeedrate') || 20).toFixed(3) * 1,
        probingDistance: Number(this.config.get('probingDistance') || 10).toFixed(3) * 1,
        latchDistance: Number(this.config.get('latchDistance') || 1).toFixed(3) * 1,
        xyClearing: Number(this.config.get('xyClearing') || 2).toFixed(3) * 1,
        probeOffset: Number(this.config.get('probeOffset') || 0).toFixed(3) * 1,
        probeDepth: Number(this.config.get('probeDepth') || 10).toFixed(3) * 1,

        // External edge probing
        selectedExternalEdge: this.config.get('selectedExternalEdge', null),

        // Internal edge probing
        selectedInternalEdge: this.config.get('selectedInternalEdge', null),

        // Center probing
        centerProbeType: this.config.get('centerProbeType', CENTER_PROBE_EXTERNAL),
        setCenterAsOrigin: this.config.get('setCenterAsOrigin', true),
        centerSizeX: Number(this.config.get('centerSizeX') || 0).toFixed(3) * 1,
        centerSizeY: Number(this.config.get('centerSizeY') || 0).toFixed(3) * 1,
        centerPasses: Number(this.config.get('centerPasses') || 1),

        // Rotation probing
        selectedRotationEdge: this.config.get('selectedRotationEdge', null),

        // Height mapping
        heightMapStartX: Number(this.config.get('heightMapStartX') || 0).toFixed(3) * 1,
        heightMapStartY: Number(this.config.get('heightMapStartY') || 0).toFixed(3) * 1,
        heightMapWidth: Number(this.config.get('heightMapWidth') || 20).toFixed(3) * 1,
        heightMapHeight: Number(this.config.get('heightMapHeight') || 20).toFixed(3) * 1,
        heightMapGridSizeX: Number(this.config.get('heightMapGridSizeX') || 3),
        heightMapGridSizeY: Number(this.config.get('heightMapGridSizeY') || 3),
        heightMapData: [], // Initialize empty height map data
        pauseBeforeProbing: this.config.get('pauseBeforeProbing', false),
        setZZeroAtOrigin: this.config.get('setZZeroAtOrigin', true)
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
              {isForkedWidget ? <i className="fa fa-code-fork" style={{ marginRight: 5 }} /> : null}
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
              <RunProbe state={state} actions={actions} />}
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
