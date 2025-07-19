import get from 'lodash/get';
import includes from 'lodash/includes';
import map from 'lodash/map';
import classNames from 'classnames';
import PropTypes from 'prop-types';
import pubsub from 'pubsub-js';
import React, { PureComponent } from 'react';
import Space from 'app/components/Space';
import Widget from 'app/components/Widget';
import api from 'app/api';
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
  EXTERNAL_CORNER_X_POSITIVE_Y_POSITIVE,
  EXTERNAL_CORNER_X_POSITIVE_Y_NEGATIVE,
  EXTERNAL_CORNER_X_NEGATIVE_Y_POSITIVE,
  EXTERNAL_CORNER_X_NEGATIVE_Y_NEGATIVE,
  INTERNAL_EDGE_X_POSITIVE,
  INTERNAL_EDGE_X_NEGATIVE,
  INTERNAL_EDGE_Y_POSITIVE,
  INTERNAL_EDGE_Y_NEGATIVE,
  INTERNAL_CORNER_X_POSITIVE_Y_POSITIVE,
  INTERNAL_CORNER_X_POSITIVE_Y_NEGATIVE,
  INTERNAL_CORNER_X_NEGATIVE_Y_POSITIVE,
  INTERNAL_CORNER_X_NEGATIVE_Y_NEGATIVE,
  CENTER_PROBE_EXTERNAL,
  ROTATION_EDGE_LEFT,
  ROTATION_EDGE_RIGHT,
  ROTATION_EDGE_TOP,
  ROTATION_EDGE_BOTTOM,
  ROTATION_METHOD_G68,
  ROTATION_METHOD_MATRIX
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
      toggleShowProbeModal: () => {
        const { showProbeModal } = this.state;
        this.setState({ showProbeModal: !showProbeModal });
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
      changeRotationMethod: (method) => {
        this.setState({ rotationMethod: method });
      },
      applyRotationToGcode: () => {
        // TODO: Implement G-code rotation application
        console.log('Apply rotation to G-code');
      },
      applyRotationMatrixToGcode: () => {
        // Access the loaded G-code content from widget state
        const { gcode } = this.state;
        if (!gcode || !gcode.content) {
          console.warn('No G-code loaded to transform');
          return;
        }

        // Extract rotation angle from controller variables or state
        // The angle is calculated and stored in variable #9 during probe execution
        // For now, we'll get it from the modal state or provide a way to input it
        // In a production system, this would be extracted from the controller's variable state

        // Since we can't directly access CNC variables from here in real-time,
        // we'll need to store the angle when the probe completes or ask user to input it
        // For now, let's use a reasonable default or get it from state

        let rotationAngleRadians = 0;

        // Try to get the angle from recent probe results or prompt user
        // This is a simplified approach - in practice you'd store this during probe execution
        if (this.lastCalculatedRotationAngle !== undefined) {
          rotationAngleRadians = this.lastCalculatedRotationAngle;
        } else {
          // Fallback: use zero angle if no stored angle available
          console.warn('No rotation angle available. Using 0 degrees. Set this.lastCalculatedRotationAngle to apply rotation.');
          rotationAngleRadians = 0;
        }

        if (Math.abs(rotationAngleRadians) < 0.0001) {
          console.log('Rotation angle is too small, skipping transformation');
          return;
        }

        const originalGcode = gcode.content;
        const lines = originalGcode.split('\n');
        const transformedLines = [];

        // Regular expressions to match coordinate parameters
        const coordRegex = /([XY])(-?\d*\.?\d+)/gi;

        lines.forEach(line => {
          let transformedLine = line;

          // Check if this line contains coordinate movements (G0, G1, G2, G3)
          if (/^[;\s]*G[0-3]/.test(line.trim()) && /[XY]/.test(line)) {
            let hasCoords = false;
            let newX = null;
            let newY = null;
            let originalX = null;
            let originalY = null;

            // Extract current X and Y coordinates
            const matches = [...line.matchAll(coordRegex)];
            matches.forEach(match => {
              const axis = match[1].toUpperCase();
              const value = parseFloat(match[2]);

              if (axis === 'X') {
                originalX = value;
                hasCoords = true;
              } else if (axis === 'Y') {
                originalY = value;
                hasCoords = true;
              }
            });

            // Apply 2D rotation matrix transformation if coordinates found
            if (hasCoords && (originalX !== null || originalY !== null)) {
              // Use current values for missing coordinates
              const x = originalX !== null ? originalX : 0;
              const y = originalY !== null ? originalY : 0;

              // Apply 2D rotation matrix around origin (0, 0):
              // x' = x*cos(θ) - y*sin(θ)
              // y' = x*sin(θ) + y*cos(θ)
              const cos = Math.cos(rotationAngleRadians);
              const sin = Math.sin(rotationAngleRadians);

              newX = x * cos - y * sin;
              newY = x * sin + y * cos;

              // Replace coordinates in the line
              if (originalX !== null) {
                const xPattern = new RegExp(`X${originalX.toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
                transformedLine = transformedLine.replace(xPattern, `X${newX.toFixed(6)}`);
              }
              if (originalY !== null) {
                const yPattern = new RegExp(`Y${originalY.toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
                transformedLine = transformedLine.replace(yPattern, `Y${newY.toFixed(6)}`);
              }
            }
          }

          transformedLines.push(transformedLine);
        });

        const transformedGcode = transformedLines.join('\n');

        // Reload the transformed G-code using the proper API
        const name = this.state.gcode.name || 'program.nc';
        const rotatedName = name.replace(/\.(nc|gcode|g)$/i, '_rotated.$1') || `${name}_rotated`;

        // Get the current port from the controller
        const port = controller.port;
        if (!port) {
          console.warn('No controller port available to load rotated G-code');
          return;
        }

        // Use the same API mechanism as the workspace to properly load G-code
        api.loadGCode({ port, name: rotatedName, gcode: transformedGcode })
          .then((res) => {
            const { name: loadedName = '', gcode: loadedGcode = '' } = { ...res.body };
            pubsub.publish('gcode:load', { name: loadedName, gcode: loadedGcode });
            console.log(`Applied 2D rotation matrix (${(rotationAngleRadians * 180 / Math.PI).toFixed(2)}°) to G-code`);
            console.log(`Transformed G-code loaded as: ${loadedName}`);
          })
          .catch((res) => {
            console.error('Failed to load rotated G-code:', res);
          });
      },
      // Manual trigger for applying rotation matrix (useful when probe completes)
      applyRotationMatrixWithAngle: (angleRadians) => {
        // Store the angle for use by the matrix transformation
        this.lastCalculatedRotationAngle = angleRadians;
        this.actions.applyRotationMatrixToGcode();
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
        // Access the loaded G-code content from widget state
        const { gcode } = this.state;
        if (!gcode || !gcode.content) {
          console.warn('No G-code loaded to auto-detect limits');
          return;
        }

        const gcodeContent = gcode.content;
        const lines = gcodeContent.split('\n');

        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        // Parse G-code to find X and Y coordinate limits
        lines.forEach(line => {
          // Skip comments and empty lines
          const cleanLine = line.replace(/;.*$/, '').trim();
          if (!cleanLine) {
            return;
          }
          // Look for coordinate movements (G0, G1, G2, G3)
          if (/^[;\s]*G[0-3]/.test(cleanLine) && /[XY]/.test(cleanLine)) {
            // Extract X and Y coordinates
            const xMatch = cleanLine.match(/X(-?\d*\.?\d+)/i);
            const yMatch = cleanLine.match(/Y(-?\d*\.?\d+)/i);

            if (xMatch) {
              const x = parseFloat(xMatch[1]);
              if (!Number.isNaN(x)) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
              }
            }

            if (yMatch) {
              const y = parseFloat(yMatch[1]);
              if (!Number.isNaN(y)) {
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
              }
            }
          }
        });

        // Check if we found valid coordinates
        if (minX === Infinity || minY === Infinity) {
          console.warn('No valid X/Y coordinates found in G-code');
          return;
        }

        // Calculate width and height with some padding (5% margin)
        const width = maxX - minX;
        const height = maxY - minY;
        const padding = 0.05; // 5% padding

        const paddedMinX = minX - (width * padding);
        const paddedMinY = minY - (height * padding);
        const paddedWidth = width * (1 + 2 * padding);
        const paddedHeight = height * (1 + 2 * padding);

        // Update height map parameters
        this.setState({
          heightMapStartX: paddedMinX.toFixed(3),
          heightMapStartY: paddedMinY.toFixed(3),
          heightMapWidth: paddedWidth.toFixed(3),
          heightMapHeight: paddedHeight.toFixed(3)
        });

        console.log(`Auto-detected height map area: X=${paddedMinX.toFixed(3)} Y=${paddedMinY.toFixed(3)} W=${paddedWidth.toFixed(3)} H=${paddedHeight.toFixed(3)}`);
      },
      applyHeightMapToGcode: () => {
        // Access the loaded G-code content from widget state
        const { gcode } = this.state;
        if (!gcode || !gcode.content) {
          console.warn('No G-code loaded to apply height map');
          return;
        }

        const { heightMapData, heightMapStartX, heightMapStartY, heightMapWidth, heightMapHeight, heightMapGridSizeX, heightMapGridSizeY } = this.state;

        if (!heightMapData || heightMapData.length === 0) {
          console.warn('No height map data available. Generate or probe height map first.');
          return;
        }

        const startX = parseFloat(heightMapStartX) || 0;
        const startY = parseFloat(heightMapStartY) || 0;
        const width = parseFloat(heightMapWidth) || 100;
        const height = parseFloat(heightMapHeight) || 100;
        const gridX = parseInt(heightMapGridSizeX, 10) || 3;
        const gridY = parseInt(heightMapGridSizeY, 10) || 3;

        const originalGcode = gcode.content;
        const lines = originalGcode.split('\n');
        const compensatedLines = [];

        // Function to interpolate height at given X,Y coordinates
        const interpolateHeight = (x, y) => {
          // Convert world coordinates to grid coordinates
          const gridPosX = ((x - startX) / width) * (gridX - 1);
          const gridPosY = ((y - startY) / height) * (gridY - 1);

          // Clamp to grid boundaries
          const clampedX = Math.max(0, Math.min(gridX - 1, gridPosX));
          const clampedY = Math.max(0, Math.min(gridY - 1, gridPosY));

          // Get integer grid positions
          const x1 = Math.floor(clampedX);
          const y1 = Math.floor(clampedY);
          const x2 = Math.min(gridX - 1, x1 + 1);
          const y2 = Math.min(gridY - 1, y1 + 1);

          // Get fractional parts for interpolation
          const fx = clampedX - x1;
          const fy = clampedY - y1;

          // Bilinear interpolation
          const h11 = heightMapData[y1] && heightMapData[y1][x1] ? heightMapData[y1][x1] : 0;
          const h12 = heightMapData[y2] && heightMapData[y2][x1] ? heightMapData[y2][x1] : 0;
          const h21 = heightMapData[y1] && heightMapData[y1][x2] ? heightMapData[y1][x2] : 0;
          const h22 = heightMapData[y2] && heightMapData[y2][x2] ? heightMapData[y2][x2] : 0;

          const h1 = h11 * (1 - fx) + h21 * fx;
          const h2 = h12 * (1 - fx) + h22 * fx;
          const interpolatedHeight = h1 * (1 - fy) + h2 * fy;

          return interpolatedHeight;
        };

        // Regular expressions to match coordinate parameters
        const coordRegex = /([XYZ])(-?\d*\.?\d+)/gi;

        lines.forEach(line => {
          let compensatedLine = line;

          // Check if this line contains coordinate movements (G0, G1, G2, G3)
          if (/^[;\s]*G[0-3]/.test(line.trim()) && /[XYZ]/.test(line)) {
            let currentX = null;
            let currentY = null;
            let currentZ = null;
            let hasZ = false;

            // Extract current X, Y, and Z coordinates
            const matches = [...line.matchAll(coordRegex)];
            matches.forEach(match => {
              const axis = match[1].toUpperCase();
              const value = parseFloat(match[2]);

              if (axis === 'X') {
                currentX = value;
              } else if (axis === 'Y') {
                currentY = value;
              } else if (axis === 'Z') {
                currentZ = value;
                hasZ = true;
              }
            });

            // Apply height compensation if this move includes Z and has X,Y coordinates
            if (hasZ && currentX !== null && currentY !== null && currentZ !== null) {
              // Check if coordinates are within the height map area
              if (currentX >= startX && currentX <= startX + width &&
                  currentY >= startY && currentY <= startY + height) {
                const heightCompensation = interpolateHeight(currentX, currentY);
                const compensatedZ = currentZ + heightCompensation;

                // Replace Z coordinate in the line
                const zPattern = new RegExp(`Z${currentZ.toString().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
                compensatedLine = compensatedLine.replace(zPattern, `Z${compensatedZ.toFixed(6)}`);
              }
            }
          }

          compensatedLines.push(compensatedLine);
        });

        const compensatedGcode = compensatedLines.join('\n');

        // Reload the compensated G-code using the proper API
        const name = this.state.gcode.name || 'program.nc';
        const compensatedName = name.replace(/\.(nc|gcode|g)$/i, '_height_compensated.$1') || `${name}_height_compensated`;

        // Get the current port from the controller
        const port = controller.port;
        if (!port) {
          console.warn('No controller port available to load height compensated G-code');
          return;
        }

        // Use the same API mechanism as the workspace to properly load G-code
        api.loadGCode({ port, name: compensatedName, gcode: compensatedGcode })
          .then((res) => {
            const { name: loadedName = '', gcode: loadedGcode = '' } = { ...res.body };
            pubsub.publish('gcode:load', { name: loadedName, gcode: loadedGcode });
            console.log(`Applied height map compensation to G-code. Loaded as: ${loadedName}`);
          })
          .catch((res) => {
            console.error('Failed to load height compensated G-code:', res);
          });
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
        // Set probing state to false
        this.setState({ isProbing: false });

        // Send stop commands to controller
        controller.command('feedhold');
        controller.command('reset');
      },
      populateProbeCommands: () => {
        const { probeType } = this.state;

        // Handle different probe types
        if (probeType === PROBE_TYPE_EXTERNAL_EDGE) {
          return this.actions.generateExternalEdgeProbeCommands();
        }

        if (probeType === PROBE_TYPE_INTERNAL_EDGE) {
          return this.actions.generateInternalEdgeProbeCommands();
        }

        if (probeType === PROBE_TYPE_CENTER) {
          return this.actions.generateCenterProbeCommands();
        }

        if (probeType === PROBE_TYPE_ROTATION) {
          return this.actions.generateRotationProbeCommands();
        }

        if (probeType === PROBE_TYPE_HEIGHT_MAP) {
          return this.actions.generateHeightMapProbeCommands();
        }

        // Default to empty commands for config tab
        return [];
      },
      generateExternalEdgeProbeCommands: () => {
        const {
          selectedExternalEdge,
          probingDistance,
          searchFeedrate,
          latchFeedrate,
          latchDistance,
          rapidsFeedrate,
          probeDiameter,
          xyClearing,
          probeDepth
        } = this.state;

        if (!selectedExternalEdge) {
          return [];
        }

        const commands = [
          gcode('; External Edge Probing Sequence'),
          gcode(`#<_probe_clearance> = [${xyClearing} - [${probeDiameter} / 2]]`),
          gcode('G91') // Relative mode
        ];

        // Determine probe direction and positioning based on selection

        switch (selectedExternalEdge) {
        case EXTERNAL_EDGE_X_POSITIVE:
          // Right Edge - probe from right to left (X-)
          commands.push(
            gcode('; Probe Right-Edge'),
            gcode(`; Pull away from edge in X+ by ${xyClearing}`),
            gcode('G1', { X: xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z down by probing depth'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe X- (search + latch)'),
            gcode('G38.2', { X: -probingDistance, F: searchFeedrate }),
            gcode('G1', { X: latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { X: -latchDistance, F: latchFeedrate }),
            gcode('; Retract X'),
            gcode('G1', { X: xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to edge'),
            `G1 X-#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 X0'),
            gcode('G90')
          );
          break;
        case EXTERNAL_EDGE_X_NEGATIVE:
          // Left Edge - probe from left to right (X+)
          commands.push(
            gcode('; Probe Left-Edge'),
            gcode(`; Pull away from edge in X- by ${xyClearing}`),
            gcode('G1', { X: -xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z down by probing depth'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe X+ (search + latch)'),
            gcode('G38.2', { X: probingDistance, F: searchFeedrate }),
            gcode('G1', { X: -latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { X: latchDistance, F: latchFeedrate }),
            gcode('; Retract X'),
            gcode('G1', { X: -xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to edge'),
            `G1 X#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 X0'),
            gcode('G90')
          );
          break;
        case EXTERNAL_EDGE_Y_POSITIVE:
          // Top Edge - probe from top to bottom (Y-)
          commands.push(
            gcode('; Probe Top-Edge'),
            gcode(`; Pull away from edge in Y+ by ${xyClearing}`),
            gcode('G1', { Y: xyClearing, F: rapidsFeedrate }),
            gcode('; Z down'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe Y-'),
            gcode('G38.2', { Y: -probingDistance, F: searchFeedrate }),
            gcode('G1', { Y: latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { Y: -latchDistance, F: latchFeedrate }),
            gcode('; Retract'),
            gcode('G1', { Y: xyClearing, F: rapidsFeedrate }),
            gcode('; Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            `G1 Y-#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 Y0'),
            gcode('G90')
          );
          break;
        case EXTERNAL_EDGE_Y_NEGATIVE:
          // Bottom Edge - probe from bottom to top (Y+)
          commands.push(
            gcode('; Probe Bottom-Edge'),
            gcode(`; Pull away from edge in Y- by ${xyClearing}`),
            gcode('G1', { Y: -xyClearing, F: rapidsFeedrate }),
            gcode('; Z down'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe Y+'),
            gcode('G38.2', { Y: probingDistance, F: searchFeedrate }),
            gcode('G1', { Y: -latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { Y: latchDistance, F: latchFeedrate }),
            gcode('; Retract'),
            gcode('G1', { Y: -xyClearing, F: rapidsFeedrate }),
            gcode('; Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            `G1 Y#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 Y0'),
            gcode('G90')
          );
          break;
        case EXTERNAL_EDGE_Z_NEGATIVE:
          // Z- probing (height/surface probing)
          commands.push(
            gcode('; Probe Z- Surface'),
            gcode('G38.2', { Z: -probingDistance, F: searchFeedrate }),
            gcode('G1', { Z: latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { Z: -latchDistance, F: latchFeedrate }),
            gcode('G10 L20 P0 Z0'),
            gcode('G1', { Z: xyClearing, F: rapidsFeedrate }),
            gcode('G90')
          );
          break;
        case EXTERNAL_CORNER_X_POSITIVE_Y_POSITIVE:
          // Top-Right Corner
          commands.push(
            gcode('; Probe Top-Right Corner'),
            gcode('(--- 1 PROBE X ---)'),
            gcode('; Pull away from corner in X+ Y+ by xyClearing'),
            gcode('G1', { X: xyClearing, Y: xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z down by probing depth'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe X- (search + latch)'),
            gcode('G38.2', { X: -probingDistance, F: searchFeedrate }),
            gcode('G1', { X: latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { X: -latchDistance, F: latchFeedrate }),
            gcode('; Retract X'),
            gcode('G1', { X: xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            gcode('G1', { X: -xyClearing * 2, F: rapidsFeedrate }),
            gcode('(--- 2 PROBE Y ---)'),
            gcode('; Pull away again'),
            gcode('G1', { Y: -xyClearing * 2, F: rapidsFeedrate }),
            gcode('; Z down'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe Y-'),
            gcode('G38.2', { Y: -probingDistance, F: searchFeedrate }),
            gcode('G1', { Y: latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { Y: -latchDistance, F: latchFeedrate }),
            gcode('; Retract'),
            gcode('G1', { Y: xyClearing, F: rapidsFeedrate }),
            gcode('; Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            `G1 X#<_probe_clearance> Y#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 X0 Y0'),
            gcode('G90')
          );
          break;
        case EXTERNAL_CORNER_X_POSITIVE_Y_NEGATIVE:
          // Bottom-Right Corner
          commands.push(
            gcode('; Probe Bottom-Right Corner'),
            gcode('(--- 1 PROBE X ---)'),
            gcode('; Pull away from corner in X+ Y- by xyClearing'),
            gcode('G1', { X: xyClearing, Y: -xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z down by probing depth'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe X- (search + latch)'),
            gcode('G38.2', { X: -probingDistance, F: searchFeedrate }),
            gcode('G1', { X: latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { X: -latchDistance, F: latchFeedrate }),
            gcode('; Retract X'),
            gcode('G1', { X: xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            gcode('G1', { X: -xyClearing * 2, F: rapidsFeedrate }),
            gcode('(--- 2 PROBE Y ---)'),
            gcode('; Pull away again'),
            gcode('G1', { Y: xyClearing * 2, F: rapidsFeedrate }),
            gcode('; Z down'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe Y+'),
            gcode('G38.2', { Y: probingDistance, F: searchFeedrate }),
            gcode('G1', { Y: -latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { Y: latchDistance, F: latchFeedrate }),
            gcode('; Retract'),
            gcode('G1', { Y: -xyClearing, F: rapidsFeedrate }),
            gcode('; Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            `G1 X#<_probe_clearance> Y-#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 X0 Y0'),
            gcode('G90')
          );
          break;
        case EXTERNAL_CORNER_X_NEGATIVE_Y_POSITIVE:
          // Top-Left Corner
          commands.push(
            gcode('; Probe Top-Left Corner'),
            gcode('(--- 1 PROBE X ---)'),
            gcode('; Pull away from corner in X- Y+ by xyClearing'),
            gcode('G1', { X: -xyClearing, Y: xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z down by probing depth'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe X+ (search + latch)'),
            gcode('G38.2', { X: probingDistance, F: searchFeedrate }),
            gcode('G1', { X: -latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { X: latchDistance, F: latchFeedrate }),
            gcode('; Retract X'),
            gcode('G1', { X: -xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            gcode('G1', { X: xyClearing * 2, F: rapidsFeedrate }),
            gcode('(--- 2 PROBE Y ---)'),
            gcode('; Pull away again'),
            gcode('G1', { Y: -xyClearing * 2, F: rapidsFeedrate }),
            gcode('; Z down'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe Y-'),
            gcode('G38.2', { Y: -probingDistance, F: searchFeedrate }),
            gcode('G1', { Y: latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { Y: -latchDistance, F: latchFeedrate }),
            gcode('; Retract'),
            gcode('G1', { Y: xyClearing, F: rapidsFeedrate }),
            gcode('; Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            `G1 X-#<_probe_clearance> Y#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 X0 Y0'),
            gcode('G90')
          );
          break;
        case EXTERNAL_CORNER_X_NEGATIVE_Y_NEGATIVE:
          // Bottom-Left Corner
          commands.push(
            gcode('; Probe Bottom-Left Corner'),
            gcode('(--- 1 PROBE X ---)'),
            gcode('; Pull away from corner in X- Y- by xyClearing'),
            gcode('G1', { X: -xyClearing, Y: -xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z down by probing depth'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe X+ (search + latch)'),
            gcode('G38.2', { X: probingDistance, F: searchFeedrate }),
            gcode('G1', { X: -latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { X: latchDistance, F: latchFeedrate }),
            gcode('; Retract X'),
            gcode('G1', { X: -xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            gcode('G1', { X: xyClearing * 2, F: rapidsFeedrate }),
            gcode('(--- 2 PROBE Y ---)'),
            gcode('; Pull away again'),
            gcode('G1', { Y: xyClearing * 2, F: rapidsFeedrate }),
            gcode('; Z down'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe Y+'),
            gcode('G38.2', { Y: probingDistance, F: searchFeedrate }),
            gcode('G1', { Y: -latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { Y: latchDistance, F: latchFeedrate }),
            gcode('; Retract'),
            gcode('G1', { Y: -xyClearing, F: rapidsFeedrate }),
            gcode('; Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            `G1 X-#<_probe_clearance> Y-#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 X0 Y0'),
            gcode('G90')
          );
          break;
        default:
          return [];
        }

        return commands;
      },
      generateInternalEdgeProbeCommands: () => {
        const {
          selectedInternalEdge,
          probingDistance,
          searchFeedrate,
          latchFeedrate,
          latchDistance,
          rapidsFeedrate,
          probeDiameter,
          xyClearing,
          probeDepth
        } = this.state;

        if (!selectedInternalEdge) {
          return [];
        }

        const commands = [
          gcode('; Internal Edge Probing Sequence'),
          gcode(`#<_probe_clearance> = [${xyClearing} - [${probeDiameter} / 2]]`),
          gcode('G91') // Relative mode
        ];

        // Internal probing logic - probe from inside outward to edges

        switch (selectedInternalEdge) {
        case INTERNAL_EDGE_X_POSITIVE:
          // Right Internal Edge - probe from inside toward right wall (X+)
          commands.push(
            gcode('; Probe Internal Right-Edge'),
            gcode(`; Pull away from edge in X- by ${xyClearing}`),
            gcode('G1', { X: -xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z down by probing depth'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe X+ (search + latch)'),
            gcode('G38.2', { X: probingDistance, F: searchFeedrate }),
            gcode('G1', { X: -latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { X: latchDistance, F: latchFeedrate }),
            gcode('; Retract X'),
            gcode('G1', { X: -xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to edge'),
            `G1 X#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 X0'),
            gcode('G90')
          );
          break;
        case INTERNAL_EDGE_X_NEGATIVE:
          // Left Internal Edge - probe from inside toward left wall (X-)
          commands.push(
            gcode('; Probe Internal Left-Edge'),
            gcode(`; Pull away from edge in X+ by ${xyClearing}`),
            gcode('G1', { X: xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z down by probing depth'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe X- (search + latch)'),
            gcode('G38.2', { X: -probingDistance, F: searchFeedrate }),
            gcode('G1', { X: latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { X: -latchDistance, F: latchFeedrate }),
            gcode('; Retract X'),
            gcode('G1', { X: xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to edge'),
            `G1 X-#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 X0'),
            gcode('G90')
          );
          break;
        case INTERNAL_EDGE_Y_POSITIVE:
          // Top Internal Edge - probe from inside toward top wall (Y+)
          commands.push(
            gcode('; Probe Internal Top-Edge'),
            gcode(`; Pull away from edge in Y- by ${xyClearing}`),
            gcode('G1', { Y: -xyClearing, F: rapidsFeedrate }),
            gcode('; Z down'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe Y+'),
            gcode('G38.2', { Y: probingDistance, F: searchFeedrate }),
            gcode('G1', { Y: -latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { Y: latchDistance, F: latchFeedrate }),
            gcode('; Retract'),
            gcode('G1', { Y: -xyClearing, F: rapidsFeedrate }),
            gcode('; Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            `G1 Y#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 Y0'),
            gcode('G90')
          );
          break;
        case INTERNAL_EDGE_Y_NEGATIVE:
          // Bottom Internal Edge - probe from inside toward bottom wall (Y-)
          commands.push(
            gcode('; Probe Internal Bottom-Edge'),
            gcode(`; Pull away from edge in Y+ by ${xyClearing}`),
            gcode('G1', { Y: xyClearing, F: rapidsFeedrate }),
            gcode('; Z down'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe Y-'),
            gcode('G38.2', { Y: -probingDistance, F: searchFeedrate }),
            gcode('G1', { Y: latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { Y: -latchDistance, F: latchFeedrate }),
            gcode('; Retract'),
            gcode('G1', { Y: xyClearing, F: rapidsFeedrate }),
            gcode('; Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            `G1 Y-#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 Y0'),
            gcode('G90')
          );
          break;
        case INTERNAL_CORNER_X_POSITIVE_Y_POSITIVE:
          // Top-Right Internal Corner
          commands.push(
            gcode('; Probe Internal Top-Right Corner'),
            gcode('(--- 1 PROBE X ---)'),
            gcode('; Pull away from corner in X- Y- by xyClearing'),
            gcode('G1', { X: -xyClearing, Y: -xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z down by probing depth'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe X+ (search + latch)'),
            gcode('G38.2', { X: probingDistance, F: searchFeedrate }),
            gcode('G1', { X: -latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { X: latchDistance, F: latchFeedrate }),
            gcode('; Retract X'),
            gcode('G1', { X: -xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            gcode('G1', { X: xyClearing * 2, F: rapidsFeedrate }),
            gcode('(--- 2 PROBE Y ---)'),
            gcode('; Pull away again'),
            gcode('G1', { Y: xyClearing * 2, F: rapidsFeedrate }),
            gcode('; Z down'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe Y+'),
            gcode('G38.2', { Y: probingDistance, F: searchFeedrate }),
            gcode('G1', { Y: -latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { Y: latchDistance, F: latchFeedrate }),
            gcode('; Retract'),
            gcode('G1', { Y: -xyClearing, F: rapidsFeedrate }),
            gcode('; Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            `G1 X#<_probe_clearance> Y#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 X0 Y0'),
            gcode('G90')
          );
          break;
        case INTERNAL_CORNER_X_POSITIVE_Y_NEGATIVE:
          // Bottom-Right Internal Corner
          commands.push(
            gcode('; Probe Internal Bottom-Right Corner'),
            gcode('(--- 1 PROBE X ---)'),
            gcode('; Pull away from corner in X- Y+ by xyClearing'),
            gcode('G1', { X: -xyClearing, Y: xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z down by probing depth'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe X+ (search + latch)'),
            gcode('G38.2', { X: probingDistance, F: searchFeedrate }),
            gcode('G1', { X: -latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { X: latchDistance, F: latchFeedrate }),
            gcode('; Retract X'),
            gcode('G1', { X: -xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            gcode('G1', { X: xyClearing * 2, F: rapidsFeedrate }),
            gcode('(--- 2 PROBE Y ---)'),
            gcode('; Pull away again'),
            gcode('G1', { Y: -xyClearing * 2, F: rapidsFeedrate }),
            gcode('; Z down'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe Y-'),
            gcode('G38.2', { Y: -probingDistance, F: searchFeedrate }),
            gcode('G1', { Y: latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { Y: -latchDistance, F: latchFeedrate }),
            gcode('; Retract'),
            gcode('G1', { Y: xyClearing, F: rapidsFeedrate }),
            gcode('; Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            `G1 X#<_probe_clearance> Y-#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 X0 Y0'),
            gcode('G90')
          );
          break;
        case INTERNAL_CORNER_X_NEGATIVE_Y_POSITIVE:
          // Top-Left Internal Corner
          commands.push(
            gcode('; Probe Internal Top-Left Corner'),
            gcode('(--- 1 PROBE X ---)'),
            gcode('; Pull away from corner in X+ Y- by xyClearing'),
            gcode('G1', { X: xyClearing, Y: -xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z down by probing depth'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe X- (search + latch)'),
            gcode('G38.2', { X: -probingDistance, F: searchFeedrate }),
            gcode('G1', { X: latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { X: -latchDistance, F: latchFeedrate }),
            gcode('; Retract X'),
            gcode('G1', { X: xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            gcode('G1', { X: -xyClearing * 2, F: rapidsFeedrate }),
            gcode('(--- 2 PROBE Y ---)'),
            gcode('; Pull away again'),
            gcode('G1', { Y: xyClearing * 2, F: rapidsFeedrate }),
            gcode('; Z down'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe Y+'),
            gcode('G38.2', { Y: probingDistance, F: searchFeedrate }),
            gcode('G1', { Y: -latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { Y: latchDistance, F: latchFeedrate }),
            gcode('; Retract'),
            gcode('G1', { Y: -xyClearing, F: rapidsFeedrate }),
            gcode('; Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            `G1 X-#<_probe_clearance> Y#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 X0 Y0'),
            gcode('G90')
          );
          break;
        case INTERNAL_CORNER_X_NEGATIVE_Y_NEGATIVE:
          // Bottom-Left Internal Corner
          commands.push(
            gcode('; Probe Internal Bottom-Left Corner'),
            gcode('(--- 1 PROBE X ---)'),
            gcode('; Pull away from corner in X+ Y+ by xyClearing'),
            gcode('G1', { X: xyClearing, Y: xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z down by probing depth'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe X- (search + latch)'),
            gcode('G38.2', { X: -probingDistance, F: searchFeedrate }),
            gcode('G1', { X: latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { X: -latchDistance, F: latchFeedrate }),
            gcode('; Retract X'),
            gcode('G1', { X: xyClearing, F: rapidsFeedrate }),
            gcode('; Move Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            gcode('G1', { X: -xyClearing * 2, F: rapidsFeedrate }),
            gcode('(--- 2 PROBE Y ---)'),
            gcode('; Pull away again'),
            gcode('G1', { Y: -xyClearing * 2, F: rapidsFeedrate }),
            gcode('; Z down'),
            gcode('G1', { Z: -probeDepth, F: rapidsFeedrate }),
            gcode('; Probe Y-'),
            gcode('G38.2', { Y: -probingDistance, F: searchFeedrate }),
            gcode('G1', { Y: latchDistance, F: rapidsFeedrate }),
            gcode('G38.2', { Y: -latchDistance, F: latchFeedrate }),
            gcode('; Retract'),
            gcode('G1', { Y: xyClearing, F: rapidsFeedrate }),
            gcode('; Z up'),
            gcode('G1', { Z: probeDepth, F: rapidsFeedrate }),
            gcode('; Return to corner'),
            `G1 X-#<_probe_clearance> Y-#<_probe_clearance> F${rapidsFeedrate}`,
            gcode('; Finally zero out'),
            gcode('G10 L20 P0 X0 Y0'),
            gcode('G90')
          );
          break;
        default:
          return [];
        }

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
          searchFeedrate,
          rotationMethod
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
        );

        if (rotationMethod === ROTATION_METHOD_G68) {
          // Apply coordinate system rotation using G68
          commands.push(
            gcode('; Apply rotation to coordinate system'),
            gcode('G68 X0 Y0 R[#9 * 180 / 3.14159]') // Rotate coordinate system
          );
        } else if (rotationMethod === ROTATION_METHOD_MATRIX) {
          // For matrix method, we need to calculate and apply the transformation after probe completion
          // Add a special command that will trigger the matrix application after angle calculation
          commands.push(
            gcode('; Store rotation angle for G-code transformation'),
            gcode('(MSG, Rotation angle calculated: #9 radians)'),
            gcode('(MSG, Applying 2D rotation matrix to loaded G-code using X0 Y0 as center)'),
            // Use a special command that we can intercept to get the angle value
            gcode('(PROBE_ROTATION_MATRIX_APPLY)') // Special marker for post-processing
          );

          // Note: The actual matrix application will happen after this command sequence completes
          // and we can extract the calculated angle from the variables
        }

        commands.push(
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
        // Set probing state to true when starting probe commands
        this.setState({ isProbing: true });
        controller.command('gcode', commands);
      },
      startProbing: () => {
        const { showProbeModal } = this.state;

        // Set probing state to true
        this.setState({ isProbing: true });

        if (showProbeModal) {
          // Show modal preview
          this.actions.openModal(MODAL_PREVIEW);
        } else {
          // Execute directly
          // Get positioning commands first
          const positioningCommands = this.actions.generatePositioningCommands();
          // Get probe commands based on current probe type
          const probeCommands = this.actions.populateProbeCommands();
          // Combine positioning and probe commands
          const allCommands = [...positioningCommands, ...probeCommands];
          // Execute all commands
          controller.command('gcode', allCommands);
        }
      },
      generatePositioningCommands: () => {
        const {
          probeType,
          xyClearing,
          probeDepth
        } = this.state;

        // Skip positioning for height map as it manages its own positioning
        if (probeType === PROBE_TYPE_HEIGHT_MAP) {
          return [];
        }

        const commands = [
          gcode('; Positioning for probing'),
          gcode('G90'), // Absolute positioning
          gcode('#1 = [posx]'), // Store current X position
          gcode('#2 = [posy]'), // Store current Y position
          gcode('#3 = [posz]'), // Store current Z position
        ];

        // For edge, center, and rotation probing, move to XY clearance position
        if (probeType === PROBE_TYPE_EXTERNAL_EDGE ||
            probeType === PROBE_TYPE_INTERNAL_EDGE ||
            probeType === PROBE_TYPE_CENTER ||
            probeType === PROBE_TYPE_ROTATION) {
          commands.push(
            gcode('; Move to XY clearance position'),
            gcode('G91'), // Relative positioning
            gcode('G0', { X: xyClearing, Y: xyClearing }), // Move to clearance position
            gcode('G90'), // Back to absolute positioning
          );
        }

        // Move down by probe depth (clearance from surface)
        commands.push(
          gcode('; Move down to probing depth'),
          gcode('G91'), // Relative positioning
          gcode('G0', { Z: -probeDepth }), // Move down by probe depth
          gcode('G90') // Back to absolute positioning
        );

        return commands;
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
        this.setState(state => {
          const newState = {
            workflow: {
              state: workflowState
            }
          };

          // If workflow becomes idle and we were probing, mark probing as complete
          if (workflowState === WORKFLOW_STATE_IDLE && state.isProbing) {
            newState.isProbing = false;
          }

          return newState;
        });
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
      },
      'gcode:load': (name, gcode) => {
        this.setState({
          gcode: {
            content: gcode,
            name: name
          }
        });
      },
      'gcode:unload': () => {
        this.setState({
          gcode: {
            content: '',
            name: ''
          }
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
        rotationMethod,
        pauseBeforeProbing,
        setZZeroAtOrigin,
        heightMapGridSizeX,
        heightMapGridSizeY,
        showProbeModal
      } = this.state;

      // Save non-numeric config
      this.config.set('probeType', probeType);
      this.config.set('centerProbeType', centerProbeType);
      this.config.set('selectedExternalEdge', selectedExternalEdge);
      this.config.set('selectedInternalEdge', selectedInternalEdge);
      this.config.set('setCenterAsOrigin', setCenterAsOrigin);
      this.config.set('centerPasses', centerPasses);
      this.config.set('selectedRotationEdge', selectedRotationEdge);
      this.config.set('rotationMethod', rotationMethod);
      this.config.set('pauseBeforeProbing', pauseBeforeProbing);
      this.config.set('setZZeroAtOrigin', setZZeroAtOrigin);
      this.config.set('heightMapGridSizeX', heightMapGridSizeX);
      this.config.set('heightMapGridSizeY', heightMapGridSizeY);
      this.config.set('showProbeModal', showProbeModal);

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
        isProbing: false, // Track if probing is currently active
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
        showProbeModal: this.config.get('showProbeModal', false),

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
        rotationMethod: this.config.get('rotationMethod', ROTATION_METHOD_G68),

        // Height mapping
        heightMapStartX: Number(this.config.get('heightMapStartX') || 0).toFixed(3) * 1,
        heightMapStartY: Number(this.config.get('heightMapStartY') || 0).toFixed(3) * 1,
        heightMapWidth: Number(this.config.get('heightMapWidth') || 20).toFixed(3) * 1,
        heightMapHeight: Number(this.config.get('heightMapHeight') || 20).toFixed(3) * 1,
        heightMapGridSizeX: Number(this.config.get('heightMapGridSizeX') || 3),
        heightMapGridSizeY: Number(this.config.get('heightMapGridSizeY') || 3),
        heightMapData: [], // Initialize empty height map data
        pauseBeforeProbing: this.config.get('pauseBeforeProbing', false),
        setZZeroAtOrigin: this.config.get('setZZeroAtOrigin', true),

        // G-code storage for height mapping and auto-detect functionality
        gcode: {
          content: '',
          name: ''
        }
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

    canClickStart() {
      const { isProbing } = this.state;
      if (isProbing) {
        return false; // Disable start button when probing is active
      }
      return this.canClick();
    }

    canClickStop() {
      const { port, isProbing } = this.state;
      const controllerType = this.state.controller.type;

      if (!port) {
        return false;
      }
      if (!includes([GRBL, MARLIN, SMOOTHIE, TINYG], controllerType)) {
        return false;
      }

      // Enable stop button when probing is active OR when machine is generally available
      return isProbing || this.canClick();
    }

    render() {
      const { widgetId } = this.props;
      const { minimized, isFullscreen } = this.state;
      const isForkedWidget = widgetId.match(/\w+:[\w\-]+/);
      const state = {
        ...this.state,
        canClick: this.canClick(),
        canClickStart: this.canClickStart(),
        canClickStop: this.canClickStop()
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
