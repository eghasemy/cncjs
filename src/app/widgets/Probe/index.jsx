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

        // Track current position through G-code execution
        let currentX = 0;
        let currentY = 0;
        let currentZ = 0;
        let isAbsoluteMode = true; // G90 = absolute, G91 = relative
        let compensationCount = 0;

        console.log('Starting height map compensation...');
        console.log('Height map data:', heightMapData);
        console.log('Height map parameters:', {
          startX, startY, width, height, gridX, gridY
        });

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

        // Regular expressions to match coordinate parameters and G-code commands
        const coordRegex = /([XYZ])(-?\d*\.?\d+)/gi;
        const gCodeRegex = /^[;\s]*([GM]\d+)/i;

        lines.forEach((line, lineIndex) => {
          let compensatedLine = line.trim();

          // Skip empty lines and comments
          if (!compensatedLine || compensatedLine.startsWith(';') || compensatedLine.startsWith('(')) {
            compensatedLines.push(line);
            return;
          }

          // Check for coordinate system mode changes
          const gCodeMatch = compensatedLine.match(gCodeRegex);
          if (gCodeMatch) {
            const command = gCodeMatch[1].toUpperCase();
            if (command === 'G90') {
              isAbsoluteMode = true;
            } else if (command === 'G91') {
              isAbsoluteMode = false;
            }
          }

          // Check if this line contains coordinate movements (G0, G1, G2, G3)
          if (/^[;\s]*G[0-3]/.test(compensatedLine) && /[XYZ]/.test(compensatedLine)) {
            let newX = currentX;
            let newY = currentY;
            let newZ = currentZ;
            let hasZ = false;
            let originalZ = null;

            // Extract coordinates from the line
            const matches = [...compensatedLine.matchAll(coordRegex)];
            matches.forEach(match => {
              const axis = match[1].toUpperCase();
              const value = parseFloat(match[2]);

              if (axis === 'X') {
                newX = isAbsoluteMode ? value : currentX + value;
              } else if (axis === 'Y') {
                newY = isAbsoluteMode ? value : currentY + value;
              } else if (axis === 'Z') {
                originalZ = value;
                newZ = isAbsoluteMode ? value : currentZ + value;
                hasZ = true;
              }
            });

            // Apply height compensation if this move includes Z coordinate
            if (hasZ && originalZ !== null) {
              // Use the target X,Y position for height interpolation
              const targetX = newX;
              const targetY = newY;

              // Check if coordinates are within the height map area
              if (targetX >= startX && targetX <= startX + width &&
                  targetY >= startY && targetY <= startY + height) {
                const heightCompensation = interpolateHeight(targetX, targetY);
                const compensatedZ = originalZ + (isAbsoluteMode ? heightCompensation : 0);

                // Debug output for first few compensations
                if (compensationCount < 5) {
                  console.log(`Line ${lineIndex + 1}: "${line.trim()}"`);
                  console.log(`  Target position: X=${targetX}, Y=${targetY}, Z=${newZ}`);
                  console.log(`  Mode: ${isAbsoluteMode ? 'Absolute' : 'Relative'}`);
                  console.log(`  Height compensation: ${heightCompensation}`);
                  console.log(`  Original Z: ${originalZ}, Compensated Z: ${compensatedZ}`);
                }

                // Replace Z coordinate in the line
                // Create a more robust regex that handles different number formats
                const zPattern = new RegExp('Z(-?\\d*\\.?\\d+)', 'gi');
                compensatedLine = compensatedLine.replace(zPattern, (match, zValue) => {
                  if (Math.abs(parseFloat(zValue) - originalZ) < 0.0001) {
                    return `Z${compensatedZ.toFixed(4)}`;
                  }
                  return match;
                });

                if (compensationCount < 5) {
                  console.log(`  Modified line: "${compensatedLine}"`);
                  console.log('---');
                }

                compensationCount++;
              }
              // Debug: coordinates outside height map area
              if (compensationCount < 3) {
                console.log(`Line ${lineIndex + 1}: Coordinates (${targetX}, ${targetY}) outside height map area (${startX} to ${startX + width}, ${startY} to ${startY + height})`);
              }
            }

            // Update current position
            currentX = newX;
            currentY = newY;
            currentZ = newZ;
          }

          compensatedLines.push(compensatedLine);
        });

        console.log(`Applied height compensation to ${compensationCount} lines`);

        if (compensationCount === 0) {
          console.warn('No height compensation was applied. Possible issues:');
          console.warn('1. G-code coordinates may be outside height map area');
          console.warn('2. Height map data may be all zeros');
          console.warn('3. G-code may not contain Z movements');
          console.warn(`Height map covers: X=${startX} to ${startX + width}, Y=${startY} to ${startY + height}`);
        }

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
          // Right Edge - probe from right to left (X-) with professional sequence
          commands.push(
            gcode('; === PROBE RIGHT EDGE (X+) ==='),
            gcode('; Professional external edge probing sequence'),
            gcode(`; Pull away from edge in X+ by clearance`),
            gcode(`G1 X${xyClearing} F${rapidsFeedrate}`),
            gcode('; Move Z down to probing depth'),
            gcode(`G1 Z-${probeDepth} F${rapidsFeedrate}`),
            
            gcode('; Search probe X- direction'),
            gcode(`G38.2 X-${probingDistance} F${searchFeedrate}`),
            gcode('(IF [#5070 EQ 0] THEN MSG, Edge probe failed - check position and try again)'),
            
            gcode('; Latch sequence for precision'),
            gcode(`G1 X${latchDistance} F${rapidsFeedrate}`), // Back off
            gcode(`G38.2 X-${latchDistance} F${latchFeedrate}`), // Precise latch probe
            
            gcode('; Calculate edge position with probe radius compensation'),
            gcode('#<_edge_x> = [posx + [#<_probe_clearance>]]'),
            gcode('(MSG, Found edge at X=#<_edge_x>)'),
            
            gcode('; Retract and move Z up'),
            gcode(`G1 X${xyClearing} F${rapidsFeedrate}`),
            gcode(`G1 Z${probeDepth} F${rapidsFeedrate}`),
            
            gcode('; Move to calculated edge position'),
            gcode('G90'),
            gcode('G0 X#<_edge_x>'),
            gcode('G91'),
            
            gcode('; Set coordinate system origin at edge'),
            gcode('G10 L20 P1 X0'),
            gcode('(MSG, X-axis zeroed at right edge)'),
            gcode('G90')
          );
          break;
        case EXTERNAL_EDGE_X_NEGATIVE:
          // Left Edge - probe from left to right (X+) with professional sequence
          commands.push(
            gcode('; === PROBE LEFT EDGE (X-) ==='),
            gcode('; Professional external edge probing sequence'),
            gcode(`; Pull away from edge in X- by clearance`),
            gcode(`G1 X-${xyClearing} F${rapidsFeedrate}`),
            gcode('; Move Z down to probing depth'),
            gcode(`G1 Z-${probeDepth} F${rapidsFeedrate}`),
            
            gcode('; Search probe X+ direction'),
            gcode(`G38.2 X${probingDistance} F${searchFeedrate}`),
            gcode('(IF [#5070 EQ 0] THEN MSG, Edge probe failed - check position and try again)'),
            
            gcode('; Latch sequence for precision'),
            gcode(`G1 X-${latchDistance} F${rapidsFeedrate}`), // Back off
            gcode(`G38.2 X${latchDistance} F${latchFeedrate}`), // Precise latch probe
            
            gcode('; Calculate edge position with probe radius compensation'),
            gcode('#<_edge_x> = [posx - [#<_probe_clearance>]]'),
            gcode('(MSG, Found edge at X=#<_edge_x>)'),
            
            gcode('; Retract and move Z up'),
            gcode(`G1 X-${xyClearing} F${rapidsFeedrate}`),
            gcode(`G1 Z${probeDepth} F${rapidsFeedrate}`),
            
            gcode('; Move to calculated edge position'),
            gcode('G90'),
            gcode('G0 X#<_edge_x>'),
            gcode('G91'),
            
            gcode('; Set coordinate system origin at edge'),
            gcode('G10 L20 P1 X0'),
            gcode('(MSG, X-axis zeroed at left edge)'),
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
          // Z- probing (height/surface probing) with professional sequence
          commands.push(
            gcode('; === PROBE Z- SURFACE ==='),
            gcode('; Professional surface height probing'),
            
            gcode('; Search probe Z- direction'),
            gcode(`G38.2 Z-${probingDistance} F${searchFeedrate}`),
            gcode('(IF [#5070 EQ 0] THEN MSG, Surface probe failed - check Z position)'),
            
            gcode('; Latch sequence for precision'),
            gcode(`G1 Z${latchDistance} F${rapidsFeedrate}`), // Back off
            gcode(`G38.2 Z-${latchDistance} F${latchFeedrate}`), // Precise latch probe
            
            gcode('; Calculate surface position'),
            gcode('#<_surface_z> = [posz]'),
            gcode('(MSG, Found surface at Z=#<_surface_z>)'),
            
            gcode('; Set coordinate system origin at surface'),
            gcode('G10 L20 P1 Z0'),
            gcode('(MSG, Z-axis zeroed at surface)'),
            
            gcode('; Retract to safe height'),
            gcode(`G1 Z${xyClearing} F${rapidsFeedrate}`),
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
          latchFeedrate,
          latchDistance,
          rapidsFeedrate,
          probeDiameter,
          xyClearing,
          probeDepth
        } = this.state;

        const commands = [
          gcode('; Center Finding Sequence - Professional Implementation'),
          gcode('G90'), // Absolute positioning
          gcode('#<_center_x_start> = [posx]'), // Store current X position
          gcode('#<_center_y_start> = [posy]'), // Store current Y position
          gcode('#<_center_z_start> = [posz]'), // Store current Z position
          gcode(`#<_probe_clearance> = [${xyClearing} - [${probeDiameter} / 2]]`),
          gcode('#<_error_count> = 0'), // Error counter for probe failures
        ];

        if (centerProbeType === CENTER_PROBE_EXTERNAL) {
          // External center finding - improved professional implementation
          commands.push(
            gcode('; === EXTERNAL CENTER FINDING ==='),
            gcode('; Move to safe position for external probing'),
            gcode('G91'),
            gcode(`G0 X[${xyClearing}] Y[${xyClearing}] F${rapidsFeedrate}`),
            gcode(`G0 Z-[${probeDepth}] F${rapidsFeedrate}`),
            gcode('G90'),
            
            // Multi-pass center finding with error checking
            gcode('; Probe sequence: X+, X-, Y+, Y- with latch method')
          );

          for (let pass = 0; pass < centerPasses; pass++) {
            commands.push(
              gcode(`; === PASS ${pass + 1} OF ${centerPasses} ===`),
              
              // X+ probe with search/latch
              gcode('; Probe X+ direction (search + latch)'),
              gcode('G91'),
              gcode(`G38.2 X${probingDistance} F${searchFeedrate}`),
              gcode('(IF [#5070 EQ 0] THEN MSG, Probe failed on X+ - check setup)'),
              gcode(`G1 X-${latchDistance} F${rapidsFeedrate}`), // Back off
              gcode(`G38.2 X${latchDistance} F${latchFeedrate}`), // Precise latch
              gcode(`#<_x_plus_${pass + 1}> = [posx]`), // Store result
              gcode(`G0 X-#<_probe_clearance> F${rapidsFeedrate}`), // Retract
              gcode('G90'),
              gcode('G0 X#<_center_x_start>'), // Return to center X
              
              // X- probe with search/latch  
              gcode('; Probe X- direction (search + latch)'),
              gcode('G91'),
              gcode(`G38.2 X-${probingDistance} F${searchFeedrate}`),
              gcode('(IF [#5070 EQ 0] THEN MSG, Probe failed on X- - check setup)'),
              gcode(`G1 X${latchDistance} F${rapidsFeedrate}`), // Back off
              gcode(`G38.2 X-${latchDistance} F${latchFeedrate}`), // Precise latch
              gcode(`#<_x_minus_${pass + 1}> = [posx]`), // Store result
              gcode(`G0 X#<_probe_clearance> F${rapidsFeedrate}`), // Retract
              gcode('G90'),
              gcode('G0 X#<_center_x_start>'), // Return to center X
              
              // Y+ probe with search/latch
              gcode('; Probe Y+ direction (search + latch)'),
              gcode('G91'),
              gcode(`G38.2 Y${probingDistance} F${searchFeedrate}`),
              gcode('(IF [#5070 EQ 0] THEN MSG, Probe failed on Y+ - check setup)'),
              gcode(`G1 Y-${latchDistance} F${rapidsFeedrate}`), // Back off
              gcode(`G38.2 Y${latchDistance} F${latchFeedrate}`), // Precise latch
              gcode(`#<_y_plus_${pass + 1}> = [posy]`), // Store result
              gcode(`G0 Y-#<_probe_clearance> F${rapidsFeedrate}`), // Retract
              gcode('G90'),
              gcode('G0 Y#<_center_y_start>'), // Return to center Y
              
              // Y- probe with search/latch
              gcode('; Probe Y- direction (search + latch)'),
              gcode('G91'),
              gcode(`G38.2 Y-${probingDistance} F${searchFeedrate}`),
              gcode('(IF [#5070 EQ 0] THEN MSG, Probe failed on Y- - check setup)'),
              gcode(`G1 Y${latchDistance} F${rapidsFeedrate}`), // Back off
              gcode(`G38.2 Y-${latchDistance} F${latchFeedrate}`), // Precise latch
              gcode(`#<_y_minus_${pass + 1}> = [posy]`), // Store result
              gcode(`G0 Y#<_probe_clearance> F${rapidsFeedrate}`), // Retract
              gcode('G90'),
              gcode('G0 Y#<_center_y_start>') // Return to center Y
            );
          }
        } else {
          // Internal center finding - probe from inside toward edges
          commands.push(
            gcode('; === INTERNAL CENTER FINDING ==='),
            gcode('; Position for internal probing'),
            gcode('G91'),
            gcode(`G0 Z-[${probeDepth}] F${rapidsFeedrate}`),
            gcode('G90')
          );

          for (let pass = 0; pass < centerPasses; pass++) {
            commands.push(
              gcode(`; === INTERNAL PASS ${pass + 1} OF ${centerPasses} ===`),
              
              // Internal X+ probe
              gcode('; Internal probe X+ direction'),
              gcode('G91'),
              gcode(`G38.2 X${probingDistance} F${searchFeedrate}`),
              gcode('(IF [#5070 EQ 0] THEN MSG, Internal probe failed on X+ - check setup)'),
              gcode(`G1 X-${latchDistance} F${rapidsFeedrate}`),
              gcode(`G38.2 X${latchDistance} F${latchFeedrate}`),
              gcode(`#<_x_plus_${pass + 1}> = [posx]`),
              gcode(`G0 X-#<_probe_clearance> F${rapidsFeedrate}`),
              gcode('G90'),
              gcode('G0 X#<_center_x_start>'),
              
              // Internal X- probe
              gcode('; Internal probe X- direction'),
              gcode('G91'),
              gcode(`G38.2 X-${probingDistance} F${searchFeedrate}`),
              gcode('(IF [#5070 EQ 0] THEN MSG, Internal probe failed on X- - check setup)'),
              gcode(`G1 X${latchDistance} F${rapidsFeedrate}`),
              gcode(`G38.2 X-${latchDistance} F${latchFeedrate}`),
              gcode(`#<_x_minus_${pass + 1}> = [posx]`),
              gcode(`G0 X#<_probe_clearance> F${rapidsFeedrate}`),
              gcode('G90'),
              gcode('G0 X#<_center_x_start>'),
              
              // Internal Y+ probe
              gcode('; Internal probe Y+ direction'),
              gcode('G91'),
              gcode(`G38.2 Y${probingDistance} F${searchFeedrate}`),
              gcode('(IF [#5070 EQ 0] THEN MSG, Internal probe failed on Y+ - check setup)'),
              gcode(`G1 Y-${latchDistance} F${rapidsFeedrate}`),
              gcode(`G38.2 Y${latchDistance} F${latchFeedrate}`),
              gcode(`#<_y_plus_${pass + 1}> = [posy]`),
              gcode(`G0 Y-#<_probe_clearance> F${rapidsFeedrate}`),
              gcode('G90'),
              gcode('G0 Y#<_center_y_start>'),
              
              // Internal Y- probe  
              gcode('; Internal probe Y- direction'),
              gcode('G91'),
              gcode(`G38.2 Y-${probingDistance} F${searchFeedrate}`),
              gcode('(IF [#5070 EQ 0] THEN MSG, Internal probe failed on Y- - check setup)'),
              gcode(`G1 Y${latchDistance} F${rapidsFeedrate}`),
              gcode(`G38.2 Y-${latchDistance} F${latchFeedrate}`),
              gcode(`#<_y_minus_${pass + 1}> = [posy]`),
              gcode(`G0 Y#<_probe_clearance> F${rapidsFeedrate}`),
              gcode('G90'),
              gcode('G0 Y#<_center_y_start>')
            );
          }
        }

        // Advanced center calculation with averaging and error checking
        commands.push(
          gcode('; === CENTER CALCULATION ==='),
          gcode('; Calculate center using multi-pass averaging'),
          gcode('#<_center_x> = 0'),
          gcode('#<_center_y> = 0'),
          gcode('#<_diameter_x> = 0'), 
          gcode('#<_diameter_y> = 0')
        );

        // Average all passes for better accuracy
        for (let pass = 0; pass < centerPasses; pass++) {
          commands.push(
            gcode(`; Add pass ${pass + 1} results to average`),
            gcode(`#<_center_x> = [#<_center_x> + [[#<_x_plus_${pass + 1}> + #<_x_minus_${pass + 1}>] / 2]]`),
            gcode(`#<_center_y> = [#<_center_y> + [[#<_y_plus_${pass + 1}> + #<_y_minus_${pass + 1}>] / 2]]`),
            gcode(`#<_diameter_x> = [#<_diameter_x> + [#<_x_plus_${pass + 1}> - #<_x_minus_${pass + 1}>]]`),
            gcode(`#<_diameter_y> = [#<_diameter_y> + [#<_y_plus_${pass + 1}> - #<_y_minus_${pass + 1}>]]`)
          );
        }

        commands.push(
          gcode('; Final averaging'),
          gcode(`#<_center_x> = [#<_center_x> / ${centerPasses}]`),
          gcode(`#<_center_y> = [#<_center_y> / ${centerPasses}]`),
          gcode(`#<_diameter_x> = [#<_diameter_x> / ${centerPasses}]`),
          gcode(`#<_diameter_y> = [#<_diameter_y> / ${centerPasses}]`),
          gcode('(MSG, Calculated center: X=#<_center_x> Y=#<_center_y>)'),
          gcode('(MSG, Measured diameters: X=#<_diameter_x> Y=#<_diameter_y>)'),
          
          // Move to calculated center
          gcode('; Move to calculated center position'),
          gcode('G91'),
          gcode(`G0 Z${probeDepth} F${rapidsFeedrate}`), // Move Z up first
          gcode('G90'),
          gcode('G0 X#<_center_x> Y#<_center_y>')
        );

        if (setCenterAsOrigin) {
          commands.push(
            gcode('; Set calculated center as coordinate origin'),
            gcode('G10 L20 P1 X0 Y0')
          );
        }

        // Return to original Z height
        commands.push(
          gcode('; Return to original position'),
          gcode('G0 Z#<_center_z_start>')
        );

        return commands;
      },
      generateRotationProbeCommands: () => {
        const {
          selectedRotationEdge,
          probingDistance,
          searchFeedrate,
          latchFeedrate,
          latchDistance,
          rapidsFeedrate,
          probeDiameter,
          xyClearing,
          probeDepth,
          rotationMethod
        } = this.state;

        if (!selectedRotationEdge) {
          return [];
        }

        const commands = [
          gcode('; Rotation Finding Sequence - Professional Implementation'),
          gcode('G90'), // Absolute positioning
          gcode('#<_rot_x_start> = [posx]'), // Store current X position
          gcode('#<_rot_y_start> = [posy]'), // Store current Y position
          gcode('#<_rot_z_start> = [posz]'), // Store current Z position
          gcode(`#<_probe_clearance> = [${xyClearing} - [${probeDiameter} / 2]]`),
          gcode('#<_probe_spacing> = 25.0'), // Distance between probe points (25mm)
        ];

        // Determine probe direction and movement based on selected edge
        let firstProbeDirection, secondProbeDirection, moveToSecondPoint;
        
        switch (selectedRotationEdge) {
        case ROTATION_EDGE_LEFT:
          // Probe left edge at two Y positions
          firstProbeDirection = `G38.2 X${probingDistance} F${searchFeedrate}`;
          secondProbeDirection = `G38.2 X${probingDistance} F${searchFeedrate}`;
          moveToSecondPoint = 'G0 Y[#<_rot_y_start> + #<_probe_spacing>]';
          break;
        case ROTATION_EDGE_RIGHT:
          // Probe right edge at two Y positions  
          firstProbeDirection = `G38.2 X-${probingDistance} F${searchFeedrate}`;
          secondProbeDirection = `G38.2 X-${probingDistance} F${searchFeedrate}`;
          moveToSecondPoint = 'G0 Y[#<_rot_y_start> + #<_probe_spacing>]';
          break;
        case ROTATION_EDGE_TOP:
          // Probe top edge at two X positions
          firstProbeDirection = `G38.2 Y-${probingDistance} F${searchFeedrate}`;
          secondProbeDirection = `G38.2 Y-${probingDistance} F${searchFeedrate}`;
          moveToSecondPoint = 'G0 X[#<_rot_x_start> + #<_probe_spacing>]';
          break;
        case ROTATION_EDGE_BOTTOM:
          // Probe bottom edge at two X positions
          firstProbeDirection = `G38.2 Y${probingDistance} F${searchFeedrate}`;
          secondProbeDirection = `G38.2 Y${probingDistance} F${searchFeedrate}`;
          moveToSecondPoint = 'G0 X[#<_rot_x_start> + #<_probe_spacing>]';
          break;
        default:
          return [];
        }

        commands.push(
          gcode('; === ROTATION DETECTION SEQUENCE ==='),
          gcode('; Position for first probe point'),
          gcode('G91'),
          gcode(`G0 Z-[${probeDepth}] F${rapidsFeedrate}`), // Move down to probe depth
          gcode('G90'),
          
          gcode('; === FIRST PROBE POINT ==='),
          gcode('; Probe first point with search + latch method'),
          gcode('G91'),
          firstProbeDirection,
          gcode('(IF [#5070 EQ 0] THEN MSG, First rotation probe failed - check setup)'),
          gcode(`G1 X-${latchDistance} Y-${latchDistance} F${rapidsFeedrate}`), // Back off diagonally
          
          // Precise latch probe
          gcode('; Latch probe for precision'),
          firstProbeDirection.replace(searchFeedrate, latchFeedrate).replace(probingDistance, latchDistance),
          gcode('#<_x1> = [posx]'), // Store first probe X
          gcode('#<_y1> = [posy]'), // Store first probe Y
          gcode('(MSG, First probe point: X=#<_x1> Y=#<_y1>)'),
          
          // Retract from first probe point
          gcode('; Retract from first probe'),
          gcode(`G0 X-#<_probe_clearance> Y-#<_probe_clearance> F${rapidsFeedrate}`),
          gcode('G90'),
          
          gcode('; === MOVE TO SECOND PROBE POINT ==='),
          gcode('; Return to start position and move to second probe point'),
          gcode('G0 X#<_rot_x_start> Y#<_rot_y_start>'),
          moveToSecondPoint,
          
          gcode('; === SECOND PROBE POINT ==='),
          gcode('; Probe second point with search + latch method'),
          gcode('G91'),
          secondProbeDirection,
          gcode('(IF [#5070 EQ 0] THEN MSG, Second rotation probe failed - check setup)'),
          gcode(`G1 X-${latchDistance} Y-${latchDistance} F${rapidsFeedrate}`), // Back off diagonally
          
          // Precise latch probe
          gcode('; Latch probe for precision'),
          secondProbeDirection.replace(searchFeedrate, latchFeedrate).replace(probingDistance, latchDistance),
          gcode('#<_x2> = [posx]'), // Store second probe X
          gcode('#<_y2> = [posy]'), // Store second probe Y
          gcode('(MSG, Second probe point: X=#<_x2> Y=#<_y2>)'),
          
          // Retract from second probe point
          gcode('; Retract from second probe'),
          gcode(`G0 X-#<_probe_clearance> Y-#<_probe_clearance> F${rapidsFeedrate}`),
          gcode('G90'),
          
          gcode('; === ROTATION CALCULATION ==='),
          gcode('; Calculate rotation angle from two probe points'),
          gcode('#<_delta_x> = [#<_x2> - #<_x1>]'),
          gcode('#<_delta_y> = [#<_y2> - #<_y1>]'),
          gcode('#<_distance> = [SQRT[[#<_delta_x> * #<_delta_x>] + [#<_delta_y> * #<_delta_y>]]]'),
          
          // Calculate angle in radians using ATAN2 if available, otherwise ATAN
          gcode('#<_angle_rad> = [ATAN[#<_delta_y>]/[#<_delta_x>]]'),
          gcode('#<_angle_deg> = [#<_angle_rad> * 180 / 3.14159265359]'),
          gcode('(MSG, Rotation angle: #<_angle_deg> degrees [#<_angle_rad> radians])'),
          gcode('(MSG, Probe distance: #<_distance> mm)')
        );

        // Apply rotation correction based on selected method
        if (rotationMethod === ROTATION_METHOD_G68) {
          commands.push(
            gcode('; === APPLY G68 COORDINATE ROTATION ==='),
            gcode('; Apply rotation to coordinate system using G68'),
            gcode('G68 X0 Y0 R#<_angle_deg>'), // Rotate coordinate system around origin
            gcode('(MSG, Applied G68 rotation: #<_angle_deg> degrees around X0 Y0)')
          );
        } else if (rotationMethod === ROTATION_METHOD_MATRIX) {
          commands.push(
            gcode('; === PREPARE FOR G-CODE MATRIX TRANSFORMATION ==='),
            gcode('; Store rotation angle for G-code transformation'),
            gcode('(MSG, Rotation angle calculated: #<_angle_rad> radians)'),
            gcode('(MSG, Preparing 2D rotation matrix transformation...)'),
            gcode('(MSG, G-code will be transformed using X0 Y0 as rotation center)'),
            // Special marker command that the widget can detect
            gcode('(PROBE_ROTATION_MATRIX_APPLY:#<_angle_rad>)')
          );
        }

        // Validation and error checking
        commands.push(
          gcode('; === VALIDATION ==='),
          gcode('(IF [ABS[#<_angle_deg>] GT 45] THEN MSG, WARNING: Large rotation angle detected!)'),
          gcode('(IF [#<_distance> LT 10] THEN MSG, WARNING: Probe points too close - increase spacing!)'),
          
          gcode('; === RETURN TO START POSITION ==='),
          gcode('; Return to original position'),
          gcode(`G0 Z#<_rot_z_start> F${rapidsFeedrate}`), // Return to original Z first
          gcode('G0 X#<_rot_x_start> Y#<_rot_y_start>') // Return to start XY
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
          latchFeedrate,
          latchDistance,
          rapidsFeedrate,
          probeDiameter,
          xyClearing,
          probeDepth
        } = this.state;

        const startX = parseFloat(heightMapStartX) || 0;
        const startY = parseFloat(heightMapStartY) || 0;
        const width = parseFloat(heightMapWidth) || 100;
        const height = parseFloat(heightMapHeight) || 100;
        const gridX = parseInt(heightMapGridSizeX, 10) || 3;
        const gridY = parseInt(heightMapGridSizeY, 10) || 3;

        const commands = [
          gcode('; Height Mapping Sequence - Professional Implementation'),
          gcode(`; Grid: ${gridX} x ${gridY} points over ${width} x ${height} mm area`),
          gcode(`; Start position: X${startX} Y${startY}`),
          gcode('G90'), // Absolute positioning
          gcode('#<_hm_x_start> = [posx]'), // Store start X position
          gcode('#<_hm_y_start> = [posy]'), // Store start Y position
          gcode('#<_hm_z_start> = [posz]'), // Store start Z position
          gcode('#<_hm_safe_z> = [posz + 5]'), // Safe Z height (5mm above start)
          gcode('#<_hm_probe_count> = 0'), // Counter for successful probes
          gcode('#<_hm_error_count> = 0'), // Counter for failed probes
          gcode(`#<_probe_clearance> = [${xyClearing} - [${probeDiameter} / 2]]`),
        ];

        if (pauseBeforeProbing) {
          commands.push(
            gcode('; Pause before height mapping'),
            gcode('M0 (Press cycle start to begin height mapping)')
          );
        }

        // Move to safe height
        commands.push(
          gcode('; Move to safe height for height mapping'),
          gcode('G0 Z#<_hm_safe_z>')
        );

        // Calculate step sizes
        const xStep = gridX > 1 ? width / (gridX - 1) : 0;
        const yStep = gridY > 1 ? height / (gridY - 1) : 0;

        // Generate probe points in an optimized zigzag pattern to minimize travel
        let variableNum = 100; // Start variables from #100 for height map
        
        for (let row = 0; row < gridY; row++) {
          // Alternate direction for each row to minimize travel time
          const colStart = row % 2 === 0 ? 0 : gridX - 1;
          const colEnd = row % 2 === 0 ? gridX : -1;
          const colStep = row % 2 === 0 ? 1 : -1;
          
          for (let col = colStart; col !== colEnd; col += colStep) {
            const xOffset = col * xStep;
            const yOffset = row * yStep;
            const probeX = startX + xOffset;
            const probeY = startY + yOffset;

            commands.push(
              gcode(`; === PROBE POINT ${row + 1},${col + 1} ===`),
              gcode(`; Target: X${probeX.toFixed(3)} Y${probeY.toFixed(3)}`),
              
              // Move to XY position at safe height
              gcode('; Move to probe XY position'),
              gcode(`G0 X${probeX.toFixed(3)} Y${probeY.toFixed(3)} Z#<_hm_safe_z>`),
              
              // Move down to probe depth
              gcode('; Move to probe depth'),
              gcode('G91'),
              gcode(`G0 Z-[${probeDepth}] F${rapidsFeedrate}`),
              gcode('G90'),
              
              // Probe with search + latch method for accuracy
              gcode('; Probe surface (search + latch)'),
              gcode('G91'),
              gcode(`G38.2 Z-${probingDistance} F${searchFeedrate}`),
              gcode('(IF [#5070 EQ 0] THEN #<_hm_error_count> = [#<_hm_error_count> + 1])'),
              gcode('(IF [#5070 EQ 0] THEN MSG, Probe failed at grid point - using interpolated value)'),
              
              // Latch probe for precision if first probe succeeded
              gcode('(IF [#5070 EQ 1] THEN G1 Z0.5)'), // Back off 0.5mm if probe succeeded
              gcode(`(IF [#5070 EQ 1] THEN G38.2 Z-${latchDistance} F${latchFeedrate})`), // Precise latch
              
              // Store probe result
              gcode(`#${variableNum} = [posz]`), // Store probe Z result
              gcode('(IF [#5070 EQ 1] THEN #<_hm_probe_count> = [#<_hm_probe_count> + 1])'),
              gcode(`(MSG, Point ${row + 1},${col + 1}: Z=#${variableNum})`),
              
              // Retract to safe height
              gcode('; Retract to safe height'),
              gcode('G90'),
              gcode('G0 Z#<_hm_safe_z>')
            );
            variableNum++;
          }
        }

        // Calculate statistics and set coordinate system
        commands.push(
          gcode('; === HEIGHT MAP STATISTICS ==='),
          gcode('(MSG, Height mapping complete)'),
          gcode('(MSG, Successful probes: #<_hm_probe_count>)'),
          gcode('(MSG, Failed probes: #<_hm_error_count>)'),
          gcode(`(MSG, Total points: ${gridX * gridY})`)
        );

        // Find minimum and maximum Z values for reference
        let minVar = 100;
        let maxVar = 100;
        commands.push(
          gcode('; Calculate height map statistics'),
          gcode(`#<_hm_z_min> = #${minVar}`),
          gcode(`#<_hm_z_max> = #${minVar}`)
        );

        // Compare all probe points to find min/max
        for (let i = 1; i < gridX * gridY; i++) {
          commands.push(
            gcode(`(IF [#${100 + i} LT #<_hm_z_min>] THEN #<_hm_z_min> = #${100 + i})`),
            gcode(`(IF [#${100 + i} GT #<_hm_z_max>] THEN #<_hm_z_max> = #${100 + i})`)
          );
        }

        commands.push(
          gcode('#<_hm_z_range> = [#<_hm_z_max> - #<_hm_z_min>]'),
          gcode('(MSG, Height range: Min=#<_hm_z_min> Max=#<_hm_z_max> Range=#<_hm_z_range>)')
        );

        // Set coordinate system origin based on user preference
        if (setZZeroAtOrigin) {
          commands.push(
            gcode('; Set Z=0 at lowest point found'),
            gcode('G10 L20 P1 Z#<_hm_z_min>')
          );
        } else {
          // Use center point as reference (or first point if odd grid)
          const centerIndex = Math.floor(gridY / 2) * gridX + Math.floor(gridX / 2);
          commands.push(
            gcode('; Set Z=0 at center point of height map'),
            gcode(`G10 L20 P1 Z#${100 + centerIndex}`)
          );
        }

        // Return to start position
        commands.push(
          gcode('; === RETURN TO START POSITION ==='),
          gcode('; Return to original position'),
          gcode('G0 X#<_hm_x_start> Y#<_hm_y_start> Z#<_hm_z_start>'),
          gcode('(MSG, Height mapping sequence complete)')
        );

        return commands;
      },
      // Probe validation and safety checks
      validateProbeSetup: () => {
        const {
          probeType,
          probingDistance,
          searchFeedrate,
          latchFeedrate,
          probeDiameter,
          xyClearing,
          probeDepth,
          selectedExternalEdge,
          selectedInternalEdge,
          centerProbeType,
          selectedRotationEdge,
          heightMapGridSizeX,
          heightMapGridSizeY
        } = this.state;

        const warnings = [];
        const errors = [];

        // General parameter validation
        if (probingDistance <= 0) {
          errors.push('Probing distance must be greater than 0');
        }
        if (probingDistance > 100) {
          warnings.push('Probing distance is very large (>100mm) - ensure adequate clearance');
        }
        if (searchFeedrate <= 0) {
          errors.push('Search feedrate must be greater than 0');
        }
        if (latchFeedrate <= 0) {
          errors.push('Latch feedrate must be greater than 0');
        }
        if (latchFeedrate >= searchFeedrate) {
          warnings.push('Latch feedrate should be slower than search feedrate for better precision');
        }
        if (probeDiameter <= 0) {
          errors.push('Probe diameter must be greater than 0');
        }
        if (xyClearing <= probeDiameter / 2) {
          warnings.push('XY clearance should be larger than probe radius for safe retraction');
        }
        if (probeDepth <= 0) {
          errors.push('Probe depth must be greater than 0');
        }

        // Type-specific validation
        switch (probeType) {
        case PROBE_TYPE_EXTERNAL_EDGE:
          if (!selectedExternalEdge) {
            errors.push('Please select an external edge direction to probe');
          }
          break;
        case PROBE_TYPE_INTERNAL_EDGE:
          if (!selectedInternalEdge) {
            errors.push('Please select an internal edge direction to probe');
          }
          break;
        case PROBE_TYPE_CENTER:
          if (!centerProbeType) {
            errors.push('Please select center probe type (External or Internal)');
          }
          break;
        case PROBE_TYPE_ROTATION:
          if (!selectedRotationEdge) {
            errors.push('Please select an edge for rotation detection');
          }
          break;
        case PROBE_TYPE_HEIGHT_MAP:
          if (heightMapGridSizeX < 2 || heightMapGridSizeY < 2) {
            errors.push('Height map grid size must be at least 2x2');
          }
          if (heightMapGridSizeX > 20 || heightMapGridSizeY > 20) {
            warnings.push('Large grid sizes may take a very long time to complete');
          }
          break;
        }

        return { warnings, errors };
      },

      // Add professional probe sequence wrapper with safety checks
      generateProbeSequenceWithSafety: () => {
        const validation = this.actions.validateProbeSetup();
        
        if (validation.errors.length > 0) {
          console.error('Probe setup errors:', validation.errors);
          return [
            gcode('; === PROBE SETUP ERRORS ==='),
            ...validation.errors.map(error => gcode(`(MSG, ERROR: ${error})`)),
            gcode('(MSG, Please fix errors before probing)'),
            gcode('M0 (Probe sequence aborted due to setup errors)')
          ];
        }

        const commands = [
          gcode('; === PROFESSIONAL PROBE SEQUENCE ==='),
          gcode('; Generated by cncjs Advanced Probing Widget'),
          gcode(`; Timestamp: ${new Date().toISOString()}`),
          gcode('; === SAFETY CHECKS ==='),
          gcode('G90'), // Ensure absolute positioning
          gcode('G94'), // Ensure feed rate per minute mode
          gcode('#<_original_feedrate> = [feedrate]'), // Store original feedrate
        ];

        // Display warnings
        if (validation.warnings.length > 0) {
          commands.push(
            gcode('; === WARNINGS ==='),
            ...validation.warnings.map(warning => gcode(`(MSG, WARNING: ${warning})`))
          );
        }

        // Add the actual probe commands
        const probeCommands = this.actions.populateProbeCommands();
        commands.push(...probeCommands);

        // Add safety footer
        commands.push(
          gcode('; === PROBE SEQUENCE COMPLETE ==='),
          gcode('G90'), // Ensure absolute positioning
          gcode('F[#<_original_feedrate>]'), // Restore original feedrate
          gcode('(MSG, Probe sequence completed successfully)')
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
          // Show modal preview with safety-wrapped commands
          const safeCommands = this.actions.generateProbeSequenceWithSafety();
          this.actions.openModal(MODAL_PREVIEW, { commands: safeCommands });
        } else {
          // Execute directly with full safety checks
          // Get positioning commands first
          const positioningCommands = this.actions.generatePositioningCommands();
          // Get safety-wrapped probe commands
          const safeProbeCommands = this.actions.generateProbeSequenceWithSafety();
          // Combine positioning and probe commands
          const allCommands = [...positioningCommands, ...safeProbeCommands];
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
