import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import i18n from 'app/lib/i18n';
import {
  METRIC_UNITS
} from '../../constants';
import {
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
  CENTER_PROBE_INTERNAL,
  ROTATION_EDGE_LEFT,
  ROTATION_EDGE_RIGHT,
  ROTATION_EDGE_TOP,
  ROTATION_EDGE_BOTTOM
} from './constants';

class Probe extends PureComponent {
    static propTypes = {
      state: PropTypes.object,
      actions: PropTypes.object
    };

    render() {
      const { state, actions } = this.props;
      const {
        canClick,
        units
      } = state;
      const displayUnits = (units === METRIC_UNITS) ? i18n._('mm') : i18n._('in');
      const feedrateUnits = (units === METRIC_UNITS) ? i18n._('mm/min') : i18n._('in/min');
      const step = (units === METRIC_UNITS) ? 1 : 0.1;

      return (
        <div>
          {/* Probe Type Tabs */}
          <div className="form-group">
            <div className="btn-toolbar" role="toolbar" style={{ marginBottom: 5 }}>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': state.probeType === PROBE_TYPE_CONFIG }
                  )}
                  title={i18n._('Probe Configuration')}
                  onClick={() => actions.changeProbeType(PROBE_TYPE_CONFIG)}
                >
                  {i18n._('Configuration')}
                </button>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': state.probeType === PROBE_TYPE_EXTERNAL_EDGE }
                  )}
                  title={i18n._('External Edge Probing')}
                  onClick={() => actions.changeProbeType(PROBE_TYPE_EXTERNAL_EDGE)}
                >
                  {i18n._('External Edge')}
                </button>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': state.probeType === PROBE_TYPE_INTERNAL_EDGE }
                  )}
                  title={i18n._('Internal Edge Probing')}
                  onClick={() => actions.changeProbeType(PROBE_TYPE_INTERNAL_EDGE)}
                >
                  {i18n._('Internal Edge')}
                </button>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': state.probeType === PROBE_TYPE_CENTER }
                  )}
                  title={i18n._('Center Finding')}
                  onClick={() => actions.changeProbeType(PROBE_TYPE_CENTER)}
                >
                  {i18n._('Center')}
                </button>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': state.probeType === PROBE_TYPE_ROTATION }
                  )}
                  title={i18n._('Rotation Correction')}
                  onClick={() => actions.changeProbeType(PROBE_TYPE_ROTATION)}
                >
                  {i18n._('Rotation')}
                </button>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': state.probeType === PROBE_TYPE_HEIGHT_MAP }
                  )}
                  title={i18n._('Height Mapping')}
                  onClick={() => actions.changeProbeType(PROBE_TYPE_HEIGHT_MAP)}
                >
                  {i18n._('Height Map')}
                </button>
              </div>
            </div>
          </div>

          {/* Probe Configuration Tab */}
          {state.probeType === PROBE_TYPE_CONFIG && this.renderConfigurationTab(state, actions, displayUnits, feedrateUnits, step)}

          {/* External Edge Probing Tab */}
          {state.probeType === PROBE_TYPE_EXTERNAL_EDGE && this.renderExternalEdgeTab(state, actions, canClick)}

          {/* Internal Edge Probing Tab */}
          {state.probeType === PROBE_TYPE_INTERNAL_EDGE && this.renderInternalEdgeTab(state, actions, canClick)}

          {/* Center Finding Tab */}
          {state.probeType === PROBE_TYPE_CENTER && this.renderCenterTab(state, actions, displayUnits, step, canClick)}

          {/* Rotation Tab */}
          {state.probeType === PROBE_TYPE_ROTATION && this.renderRotationTab(state, actions, canClick)}

          {/* Height Map Tab */}
          {state.probeType === PROBE_TYPE_HEIGHT_MAP && this.renderHeightMapTab(state, actions, displayUnits, step, canClick)}
        </div>
      );
    }

    renderConfigurationTab(state, actions, displayUnits, feedrateUnits, step) {
      const {
        probeDiameter,
        touchPlateHeight,
        rapidsFeedrate,
        searchFeedrate,
        latchFeedrate,
        probingDistance,
        latchDistance,
        xyClearing,
        probeOffset,
        probeDepth
      } = state;

      return (
        <div>
          {/* Probe Tip/Tool Section */}
          <div className="form-group">
            <label className="control-label">{i18n._('Probe Tip/Tool')}</label>
            <div className="row no-gutters">
              <div className="col-xs-12">
                <div className="form-group">
                  <label className="control-label">{i18n._('Diameter')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={probeDiameter}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleProbeDiameterChange}
                    />
                    <div className="input-group-addon">{displayUnits}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Touch Plate/Fixture Heights Section */}
          <div className="form-group">
            <label className="control-label">{i18n._('Touch Plate/Fixture Heights')}</label>
            <div className="row no-gutters">
              <div className="col-xs-12">
                <div className="form-group">
                  <label className="control-label">{i18n._('Height')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={touchPlateHeight}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleTouchPlateHeightChange}
                    />
                    <span className="input-group-addon">{displayUnits}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Probing Distances and Speed Section */}
          <div className="form-group">
            <label className="control-label">{i18n._('Probing Distances and Speed')}</label>
            <div className="row no-gutters">
              <div className="col-xs-6" style={{ paddingRight: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('Rapids Feed Rate')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={rapidsFeedrate}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleRapidsFeedrateChange}
                    />
                    <span className="input-group-addon">{feedrateUnits}</span>
                  </div>
                </div>
              </div>
              <div className="col-xs-6" style={{ paddingLeft: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('Search Feed Rate')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={searchFeedrate}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleSearchFeedrateChange}
                    />
                    <span className="input-group-addon">{feedrateUnits}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="row no-gutters">
              <div className="col-xs-6" style={{ paddingRight: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('Latch Feed Rate')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={latchFeedrate}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleLatchFeedrateChange}
                    />
                    <span className="input-group-addon">{feedrateUnits}</span>
                  </div>
                </div>
              </div>
              <div className="col-xs-6" style={{ paddingLeft: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('Probing Distance')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={probingDistance}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleProbingDistanceChange}
                    />
                    <div className="input-group-addon">{displayUnits}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="row no-gutters">
              <div className="col-xs-12">
                <div className="form-group">
                  <label className="control-label">{i18n._('Latch Distance')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={latchDistance}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleLatchDistanceChange}
                    />
                    <div className="input-group-addon">{displayUnits}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Probing Clearances Section */}
          <div className="form-group">
            <label className="control-label">{i18n._('Probing Clearances')}</label>
            <div className="row no-gutters">
              <div className="col-xs-6" style={{ paddingRight: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('XY Clearance')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={xyClearing}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleXyClearanceChange}
                    />
                    <div className="input-group-addon">{displayUnits}</div>
                  </div>
                </div>
              </div>
              <div className="col-xs-6" style={{ paddingLeft: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('Offset')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={probeOffset}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleProbeOffsetChange}
                    />
                    <div className="input-group-addon">{displayUnits}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="row no-gutters">
              <div className="col-xs-12">
                <div className="form-group">
                  <label className="control-label">{i18n._('Depth')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={probeDepth}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleProbeDepthChange}
                    />
                    <div className="input-group-addon">{displayUnits}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    renderExternalEdgeTab(state, actions, canClick) {
      const { selectedExternalEdge } = state;

      return (
        <div>
          <div className="form-group">
            <label className="control-label">{i18n._('External Edge Direction')}</label>
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              {/* Top row */}
              <div style={{ marginBottom: '10px' }}>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    'btn-lg',
                    { 'btn-select': selectedExternalEdge === EXTERNAL_EDGE_Y_POSITIVE }
                  )}
                  style={{ margin: '5px', width: '60px', height: '60px', fontSize: '24px' }}
                  title={i18n._('Y+ Edge')}
                  onClick={() => actions.selectExternalEdge(EXTERNAL_EDGE_Y_POSITIVE)}
                >
                  ↑
                </button>
              </div>
              {/* Middle row */}
              <div style={{ marginBottom: '10px' }}>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    'btn-lg',
                    { 'btn-select': selectedExternalEdge === EXTERNAL_EDGE_X_NEGATIVE }
                  )}
                  style={{ margin: '5px', width: '60px', height: '60px', fontSize: '24px' }}
                  title={i18n._('X- Edge')}
                  onClick={() => actions.selectExternalEdge(EXTERNAL_EDGE_X_NEGATIVE)}
                >
                  ←
                </button>
                <span style={{ display: 'inline-block', width: '60px', height: '60px', margin: '5px', lineHeight: '60px', fontSize: '24px' }}>○</span>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    'btn-lg',
                    { 'btn-select': selectedExternalEdge === EXTERNAL_EDGE_X_POSITIVE }
                  )}
                  style={{ margin: '5px', width: '60px', height: '60px', fontSize: '24px' }}
                  title={i18n._('X+ Edge')}
                  onClick={() => actions.selectExternalEdge(EXTERNAL_EDGE_X_POSITIVE)}
                >
                  →
                </button>
              </div>
              {/* Bottom row */}
              <div style={{ marginBottom: '10px' }}>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    'btn-lg',
                    { 'btn-select': selectedExternalEdge === EXTERNAL_EDGE_Y_NEGATIVE }
                  )}
                  style={{ margin: '5px', width: '60px', height: '60px', fontSize: '24px' }}
                  title={i18n._('Y- Edge')}
                  onClick={() => actions.selectExternalEdge(EXTERNAL_EDGE_Y_NEGATIVE)}
                >
                  ↓
                </button>
              </div>
              {/* Z direction */}
              <div style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    'btn-lg',
                    { 'btn-select': selectedExternalEdge === EXTERNAL_EDGE_Z_NEGATIVE }
                  )}
                  style={{ margin: '5px', width: '80px', height: '40px', fontSize: '16px' }}
                  title={i18n._('Z- Edge')}
                  onClick={() => actions.selectExternalEdge(EXTERNAL_EDGE_Z_NEGATIVE)}
                >
                  Z-
                </button>
              </div>
            </div>
          </div>
          {this.renderProbeControls(actions, canClick)}
        </div>
      );
    }

    renderInternalEdgeTab(state, actions, canClick) {
      const { selectedInternalEdge } = state;

      return (
        <div>
          <div className="form-group">
            <label className="control-label">{i18n._('Internal Edge Direction')}</label>
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              {/* Top row */}
              <div style={{ marginBottom: '10px' }}>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    'btn-lg',
                    { 'btn-select': selectedInternalEdge === INTERNAL_EDGE_Y_POSITIVE }
                  )}
                  style={{ margin: '5px', width: '60px', height: '60px', fontSize: '24px' }}
                  title={i18n._('Y+ Internal Edge')}
                  onClick={() => actions.selectInternalEdge(INTERNAL_EDGE_Y_POSITIVE)}
                >
                  ↑
                </button>
              </div>
              {/* Middle row */}
              <div style={{ marginBottom: '10px' }}>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    'btn-lg',
                    { 'btn-select': selectedInternalEdge === INTERNAL_EDGE_X_NEGATIVE }
                  )}
                  style={{ margin: '5px', width: '60px', height: '60px', fontSize: '24px' }}
                  title={i18n._('X- Internal Edge')}
                  onClick={() => actions.selectInternalEdge(INTERNAL_EDGE_X_NEGATIVE)}
                >
                  ←
                </button>
                <span style={{ display: 'inline-block', width: '60px', height: '60px', margin: '5px', lineHeight: '60px', fontSize: '24px' }}>○</span>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    'btn-lg',
                    { 'btn-select': selectedInternalEdge === INTERNAL_EDGE_X_POSITIVE }
                  )}
                  style={{ margin: '5px', width: '60px', height: '60px', fontSize: '24px' }}
                  title={i18n._('X+ Internal Edge')}
                  onClick={() => actions.selectInternalEdge(INTERNAL_EDGE_X_POSITIVE)}
                >
                  →
                </button>
              </div>
              {/* Bottom row */}
              <div style={{ marginBottom: '10px' }}>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    'btn-lg',
                    { 'btn-select': selectedInternalEdge === INTERNAL_EDGE_Y_NEGATIVE }
                  )}
                  style={{ margin: '5px', width: '60px', height: '60px', fontSize: '24px' }}
                  title={i18n._('Y- Internal Edge')}
                  onClick={() => actions.selectInternalEdge(INTERNAL_EDGE_Y_NEGATIVE)}
                >
                  ↓
                </button>
              </div>
            </div>
          </div>
          {this.renderProbeControls(actions, canClick)}
        </div>
      );
    }

    renderCenterTab(state, actions, displayUnits, step, canClick) {
      const {
        centerProbeType,
        setCenterAsOrigin,
        centerSizeX,
        centerSizeY,
        centerPasses,
        xyClearing
      } = state;

      // Validation: XY clearance must be less than half of X and Y size
      const xySizeError = (centerSizeX > 0 && xyClearing >= centerSizeX / 2) ||
                          (centerSizeY > 0 && xyClearing >= centerSizeY / 2);

      return (
        <div>
          <div className="form-group">
            <label className="control-label">{i18n._('Center Probe Type')}</label>
            <div className="btn-toolbar" role="toolbar" style={{ marginBottom: 5 }}>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': centerProbeType === CENTER_PROBE_EXTERNAL }
                  )}
                  title={i18n._('External center finding')}
                  onClick={() => actions.changeCenterProbeType(CENTER_PROBE_EXTERNAL)}
                >
                  {i18n._('External')}
                </button>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': centerProbeType === CENTER_PROBE_INTERNAL }
                  )}
                  title={i18n._('Internal center finding')}
                  onClick={() => actions.changeCenterProbeType(CENTER_PROBE_INTERNAL)}
                >
                  {i18n._('Internal')}
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <div className="checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={setCenterAsOrigin}
                  onChange={actions.toggleSetCenterAsOrigin}
                />
                {i18n._('Set center as X0, Y0')}
              </label>
            </div>
          </div>

          <div className="form-group">
            <label className="control-label">{i18n._('Feature Size')}</label>
            <div className="row no-gutters">
              <div className="col-xs-6" style={{ paddingRight: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('X Size')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className={classNames('form-control', { 'has-error': xySizeError })}
                      value={centerSizeX}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleCenterSizeXChange}
                    />
                    <div className="input-group-addon">{displayUnits}</div>
                  </div>
                </div>
              </div>
              <div className="col-xs-6" style={{ paddingLeft: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('Y Size')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className={classNames('form-control', { 'has-error': xySizeError })}
                      value={centerSizeY}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleCenterSizeYChange}
                    />
                    <div className="input-group-addon">{displayUnits}</div>
                  </div>
                </div>
              </div>
            </div>
            {xySizeError ? (
              <p className="text-danger">
                <small>{i18n._('XY Clearance must be less than half of X and Y size to prevent collisions')}</small>
              </p>
) : null}
          </div>

          <div className="form-group">
            <label className="control-label">{i18n._('Number of Passes')}</label>
            <div className="input-group input-group-sm">
              <input
                type="number"
                className="form-control"
                value={centerPasses}
                placeholder="1"
                min={1}
                max={10}
                step={1}
                onChange={actions.handleCenterPassesChange}
              />
            </div>
          </div>

          {this.renderProbeControls(actions, canClick && !xySizeError)}
        </div>
      );
    }

    renderRotationTab(state, actions, canClick) {
      const { selectedRotationEdge } = state;

      return (
        <div>
          <div className="form-group">
            <label className="control-label">{i18n._('Select Edge for Rotation Probing')}</label>
            <div className="btn-toolbar" role="toolbar" style={{ marginBottom: 5 }}>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': selectedRotationEdge === ROTATION_EDGE_LEFT }
                  )}
                  title={i18n._('Left Edge')}
                  onClick={() => actions.selectRotationEdge(ROTATION_EDGE_LEFT)}
                >
                  {i18n._('Left')}
                </button>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': selectedRotationEdge === ROTATION_EDGE_RIGHT }
                  )}
                  title={i18n._('Right Edge')}
                  onClick={() => actions.selectRotationEdge(ROTATION_EDGE_RIGHT)}
                >
                  {i18n._('Right')}
                </button>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': selectedRotationEdge === ROTATION_EDGE_TOP }
                  )}
                  title={i18n._('Top Edge')}
                  onClick={() => actions.selectRotationEdge(ROTATION_EDGE_TOP)}
                >
                  {i18n._('Top')}
                </button>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': selectedRotationEdge === ROTATION_EDGE_BOTTOM }
                  )}
                  title={i18n._('Bottom Edge')}
                  onClick={() => actions.selectRotationEdge(ROTATION_EDGE_BOTTOM)}
                >
                  {i18n._('Bottom')}
                </button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <p className="help-block">
              {i18n._('Rotation will be calculated using X0 and Y0 as the rotation center and applied to the loaded G-code.')}
            </p>
          </div>

          {this.renderProbeControls(actions, canClick)}

          <div className="row no-gutters" style={{ marginTop: '10px' }}>
            <div className="col-xs-12">
              <button
                type="button"
                className="btn btn-sm btn-warning"
                onClick={actions.applyRotationToGcode}
                disabled={!canClick || !selectedRotationEdge}
              >
                {i18n._('Apply Rotation to G-code')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    renderHeightMapTab(state, actions, displayUnits, step, canClick) {
      const {
        heightMapStartX,
        heightMapStartY,
        heightMapWidth,
        heightMapHeight,
        heightMapGridSizeX,
        heightMapGridSizeY,
        pauseBeforeProbing,
        setZZeroAtOrigin
      } = state;

      return (
        <div>
          {/* Area to Probe Section */}
          <div className="form-group">
            <label className="control-label">{i18n._('Area to Probe')}</label>
            <div className="row no-gutters">
              <div className="col-xs-6" style={{ paddingRight: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('X Starting Point')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={heightMapStartX}
                      placeholder="0.00"
                      step={step}
                      onChange={actions.handleHeightMapStartXChange}
                    />
                    <div className="input-group-addon">{displayUnits}</div>
                  </div>
                </div>
              </div>
              <div className="col-xs-6" style={{ paddingLeft: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('Y Starting Point')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={heightMapStartY}
                      placeholder="0.00"
                      step={step}
                      onChange={actions.handleHeightMapStartYChange}
                    />
                    <div className="input-group-addon">{displayUnits}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="row no-gutters">
              <div className="col-xs-6" style={{ paddingRight: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('Width of Area')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={heightMapWidth}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleHeightMapWidthChange}
                    />
                    <div className="input-group-addon">{displayUnits}</div>
                  </div>
                </div>
              </div>
              <div className="col-xs-6" style={{ paddingLeft: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('Height of Area')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={heightMapHeight}
                      placeholder="0.00"
                      min={0}
                      step={step}
                      onChange={actions.handleHeightMapHeightChange}
                    />
                    <div className="input-group-addon">{displayUnits}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="row no-gutters">
              <div className="col-xs-12">
                <button
                  type="button"
                  className="btn btn-sm btn-default"
                  onClick={actions.autoDetectHeightMapArea}
                  disabled={!canClick}
                >
                  {i18n._('Auto-determine from Program Limits')}
                </button>
              </div>
            </div>
          </div>

          {/* Grid Size Section */}
          <div className="form-group">
            <label className="control-label">{i18n._('Grid Size')}</label>
            <div className="row no-gutters">
              <div className="col-xs-6" style={{ paddingRight: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('X Grid Size')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={heightMapGridSizeX}
                      placeholder="3"
                      min={2}
                      max={20}
                      step={1}
                      onChange={actions.handleHeightMapGridSizeXChange}
                    />
                  </div>
                </div>
              </div>
              <div className="col-xs-6" style={{ paddingLeft: 5 }}>
                <div className="form-group">
                  <label className="control-label">{i18n._('Y Grid Size')}</label>
                  <div className="input-group input-group-sm">
                    <input
                      type="number"
                      className="form-control"
                      value={heightMapGridSizeY}
                      placeholder="3"
                      min={2}
                      max={20}
                      step={1}
                      onChange={actions.handleHeightMapGridSizeYChange}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="form-group">
            <div className="checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={pauseBeforeProbing}
                  onChange={actions.togglePauseBeforeProbing}
                />
                {i18n._('Pause before probing')}
              </label>
            </div>
            <div className="checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={setZZeroAtOrigin}
                  onChange={actions.toggleSetZZeroAtOrigin}
                />
                {i18n._('Set Z = 0 at X0Y0')}
              </label>
            </div>
          </div>

          {this.renderProbeControls(actions, canClick)}

          <div className="row no-gutters" style={{ marginTop: '10px' }}>
            <div className="col-xs-12">
              <button
                type="button"
                className="btn btn-sm btn-warning"
                onClick={actions.applyHeightMapToGcode}
                disabled={!canClick}
              >
                {i18n._('Apply Height Map to G-code')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    renderProbeControls(actions, canClick) {
      return (
        <div className="row no-gutters" style={{ marginTop: '20px' }}>
          <div className="col-xs-6" style={{ paddingRight: 5 }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => {
                actions.openModal(MODAL_PREVIEW);
              }}
              disabled={!canClick}
            >
              {i18n._('Start')}
            </button>
          </div>
          <div className="col-xs-6" style={{ paddingLeft: 5 }}>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={actions.stopProbing}
              disabled={!canClick}
            >
              {i18n._('Stop')}
            </button>
          </div>
        </div>
      );
    }
}

export default Probe;
