import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import i18n from 'app/lib/i18n';
import {
  METRIC_UNITS
} from '../../constants';
import {
  MODAL_PREVIEW,
  PROBE_TYPE_BASIC,
  PROBE_TYPE_EDGE,
  PROBE_TYPE_CENTER,
  PROBE_TYPE_ROTATION,
  PROBE_TYPE_HEIGHT_MAP,
  EDGE_PROBE_EXTERNAL_X_POSITIVE,
  EDGE_PROBE_EXTERNAL_X_NEGATIVE,
  EDGE_PROBE_EXTERNAL_Y_POSITIVE,
  EDGE_PROBE_EXTERNAL_Y_NEGATIVE,
  EDGE_PROBE_INTERNAL_X_POSITIVE,
  EDGE_PROBE_INTERNAL_X_NEGATIVE,
  EDGE_PROBE_INTERNAL_Y_POSITIVE,
  EDGE_PROBE_INTERNAL_Y_NEGATIVE,
  CENTER_PROBE_EXTERNAL,
  CENTER_PROBE_INTERNAL
} from './constants';
import styles from './index.styl';

class Probe extends PureComponent {
    static propTypes = {
      state: PropTypes.object,
      actions: PropTypes.object
    };

    render() {
      const { state, actions } = this.props;
      const {
        canClick,
        units,
        probeAxis,
        probeCommand,
        probeDepth,
        probeFeedrate,
        touchPlateHeight,
        retractionDistance
      } = state;
      const displayUnits = (units === METRIC_UNITS) ? i18n._('mm') : i18n._('in');
      const feedrateUnits = (units === METRIC_UNITS) ? i18n._('mm/min') : i18n._('in/min');
      const step = (units === METRIC_UNITS) ? 1 : 0.1;

      return (
        <div>
          <div className="form-group">
            <label className="control-label">{i18n._('Probe Type')}</label>
            <div className="btn-toolbar" role="toolbar" style={{ marginBottom: 5 }}>
              <div className="btn-group btn-group-sm">
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': state.probeType === PROBE_TYPE_BASIC }
                  )}
                  title={i18n._('Basic single-axis probing')}
                  onClick={() => actions.changeProbeType(PROBE_TYPE_BASIC)}
                >
                  {i18n._('Basic')}
                </button>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': state.probeType === PROBE_TYPE_EDGE }
                  )}
                  title={i18n._('Edge finding probing')}
                  onClick={() => actions.changeProbeType(PROBE_TYPE_EDGE)}
                >
                  {i18n._('Edge')}
                </button>
                <button
                  type="button"
                  className={classNames(
                    'btn',
                    'btn-default',
                    { 'btn-select': state.probeType === PROBE_TYPE_CENTER }
                  )}
                  title={i18n._('Center finding probing')}
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
                  title={i18n._('Rotation finding probing')}
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
                  title={i18n._('Height mapping probing')}
                  onClick={() => actions.changeProbeType(PROBE_TYPE_HEIGHT_MAP)}
                >
                  {i18n._('Height Map')}
                </button>
              </div>
            </div>
          </div>

          {state.probeType === PROBE_TYPE_BASIC && (
            <div>
              <div className="form-group">
                <label className="control-label">{i18n._('Probe Axis')}</label>
                <div className="btn-toolbar" role="toolbar" style={{ marginBottom: 5 }}>
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className={classNames(
                        'btn',
                        'btn-default',
                        { 'btn-select': probeAxis === 'Z' }
                      )}
                      title={i18n._('Probe Z Axis')}
                      onClick={() => actions.changeProbeAxis('Z')}
                    >
                      Z
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        'btn',
                        'btn-default',
                        { 'btn-select': probeAxis === 'X' }
                      )}
                      title={i18n._('Probe X Axis')}
                      onClick={() => actions.changeProbeAxis('X')}
                    >
                      X
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        'btn',
                        'btn-default',
                        { 'btn-select': probeAxis === 'Y' }
                      )}
                      title={i18n._('Probe Y Axis')}
                      onClick={() => actions.changeProbeAxis('Y')}
                    >
                      Y
                    </button>
                  </div>
                </div>
                <p className={styles.probeAxisDescription}>
                  {probeAxis === 'Z' &&
                    <i>{i18n._('Probe Z Axis')}</i>
                  }
                  {probeAxis === 'X' &&
                    <i>{i18n._('Probe X Axis')}</i>
                  }
                  {probeAxis === 'Y' &&
                    <i>{i18n._('Probe Y Axis')}</i>
                  }
                </p>
              </div>
              <div className="form-group">
                <label className="control-label">{i18n._('Probe Command')}</label>
                <div className="btn-toolbar" role="toolbar" style={{ marginBottom: 5 }}>
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className={classNames(
                        'btn',
                        'btn-default',
                        { 'btn-select': probeCommand === 'G38.2' }
                      )}
                      title={i18n._('G38.2 probe toward workpiece, stop on contact, signal error if failure')}
                      onClick={() => actions.changeProbeCommand('G38.2')}
                    >
                      G38.2
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        'btn',
                        'btn-default',
                        { 'btn-select': probeCommand === 'G38.3' }
                      )}
                      title={i18n._('G38.3 probe toward workpiece, stop on contact')}
                      onClick={() => actions.changeProbeCommand('G38.3')}
                    >
                      G38.3
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        'btn',
                        'btn-default',
                        { 'btn-select': probeCommand === 'G38.4' }
                      )}
                      title={i18n._('G38.4 probe away from workpiece, stop on loss of contact, signal error if failure')}
                      onClick={() => actions.changeProbeCommand('G38.4')}
                    >
                      G38.4
                    </button>
                    <button
                      type="button"
                      className={classNames(
                        'btn',
                        'btn-default',
                        { 'btn-select': probeCommand === 'G38.5' }
                      )}
                      title={i18n._('G38.5 probe away from workpiece, stop on loss of contact')}
                      onClick={() => actions.changeProbeCommand('G38.5')}
                    >
                      G38.5
                    </button>
                  </div>
                </div>
                <p className={styles.probeCommandDescription}>
                  {probeCommand === 'G38.2' &&
                    <i>{i18n._('G38.2 probe toward workpiece, stop on contact, signal error if failure')}</i>
                  }
                  {probeCommand === 'G38.3' &&
                    <i>{i18n._('G38.3 probe toward workpiece, stop on contact')}</i>
                  }
                  {probeCommand === 'G38.4' &&
                    <i>{i18n._('G38.4 probe away from workpiece, stop on loss of contact, signal error if failure')}</i>
                  }
                  {probeCommand === 'G38.5' &&
                    <i>{i18n._('G38.5 probe away from workpiece, stop on loss of contact')}</i>
                  }
                </p>
              </div>
            </div>
          )}

          {state.probeType === PROBE_TYPE_EDGE && (
            <div className="form-group">
              <label className="control-label">{i18n._('Edge Probe Type')}</label>
              <div className="btn-toolbar" role="toolbar" style={{ marginBottom: 5 }}>
                <div className="btn-group btn-group-sm">
                  <button
                    type="button"
                    className={classNames(
                      'btn',
                      'btn-default',
                      { 'btn-select': state.edgeProbeType === EDGE_PROBE_EXTERNAL_X_POSITIVE }
                    )}
                    title={i18n._('External X+ edge')}
                    onClick={() => actions.changeEdgeProbeType(EDGE_PROBE_EXTERNAL_X_POSITIVE)}
                  >
                    X+ Ext
                  </button>
                  <button
                    type="button"
                    className={classNames(
                      'btn',
                      'btn-default',
                      { 'btn-select': state.edgeProbeType === EDGE_PROBE_EXTERNAL_X_NEGATIVE }
                    )}
                    title={i18n._('External X- edge')}
                    onClick={() => actions.changeEdgeProbeType(EDGE_PROBE_EXTERNAL_X_NEGATIVE)}
                  >
                    X- Ext
                  </button>
                  <button
                    type="button"
                    className={classNames(
                      'btn',
                      'btn-default',
                      { 'btn-select': state.edgeProbeType === EDGE_PROBE_EXTERNAL_Y_POSITIVE }
                    )}
                    title={i18n._('External Y+ edge')}
                    onClick={() => actions.changeEdgeProbeType(EDGE_PROBE_EXTERNAL_Y_POSITIVE)}
                  >
                    Y+ Ext
                  </button>
                  <button
                    type="button"
                    className={classNames(
                      'btn',
                      'btn-default',
                      { 'btn-select': state.edgeProbeType === EDGE_PROBE_EXTERNAL_Y_NEGATIVE }
                    )}
                    title={i18n._('External Y- edge')}
                    onClick={() => actions.changeEdgeProbeType(EDGE_PROBE_EXTERNAL_Y_NEGATIVE)}
                  >
                    Y- Ext
                  </button>
                </div>
              </div>
              <div className="btn-toolbar" role="toolbar" style={{ marginBottom: 5 }}>
                <div className="btn-group btn-group-sm">
                  <button
                    type="button"
                    className={classNames(
                      'btn',
                      'btn-default',
                      { 'btn-select': state.edgeProbeType === EDGE_PROBE_INTERNAL_X_POSITIVE }
                    )}
                    title={i18n._('Internal X+ edge')}
                    onClick={() => actions.changeEdgeProbeType(EDGE_PROBE_INTERNAL_X_POSITIVE)}
                  >
                    X+ Int
                  </button>
                  <button
                    type="button"
                    className={classNames(
                      'btn',
                      'btn-default',
                      { 'btn-select': state.edgeProbeType === EDGE_PROBE_INTERNAL_X_NEGATIVE }
                    )}
                    title={i18n._('Internal X- edge')}
                    onClick={() => actions.changeEdgeProbeType(EDGE_PROBE_INTERNAL_X_NEGATIVE)}
                  >
                    X- Int
                  </button>
                  <button
                    type="button"
                    className={classNames(
                      'btn',
                      'btn-default',
                      { 'btn-select': state.edgeProbeType === EDGE_PROBE_INTERNAL_Y_POSITIVE }
                    )}
                    title={i18n._('Internal Y+ edge')}
                    onClick={() => actions.changeEdgeProbeType(EDGE_PROBE_INTERNAL_Y_POSITIVE)}
                  >
                    Y+ Int
                  </button>
                  <button
                    type="button"
                    className={classNames(
                      'btn',
                      'btn-default',
                      { 'btn-select': state.edgeProbeType === EDGE_PROBE_INTERNAL_Y_NEGATIVE }
                    )}
                    title={i18n._('Internal Y- edge')}
                    onClick={() => actions.changeEdgeProbeType(EDGE_PROBE_INTERNAL_Y_NEGATIVE)}
                  >
                    Y- Int
                  </button>
                </div>
              </div>
            </div>
          )}

          {state.probeType === PROBE_TYPE_CENTER && (
            <div className="form-group">
              <label className="control-label">{i18n._('Center Probe Type')}</label>
              <div className="btn-toolbar" role="toolbar" style={{ marginBottom: 5 }}>
                <div className="btn-group btn-group-sm">
                  <button
                    type="button"
                    className={classNames(
                      'btn',
                      'btn-default',
                      { 'btn-select': state.centerProbeType === CENTER_PROBE_EXTERNAL }
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
                      { 'btn-select': state.centerProbeType === CENTER_PROBE_INTERNAL }
                    )}
                    title={i18n._('Internal center finding')}
                    onClick={() => actions.changeCenterProbeType(CENTER_PROBE_INTERNAL)}
                  >
                    {i18n._('Internal')}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="row no-gutters">
            <div className="col-xs-6" style={{ paddingRight: 5 }}>
              <div className="form-group">
                <label className="control-label">{i18n._('Probe Depth')}</label>
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
            <div className="col-xs-6" style={{ paddingLeft: 5 }}>
              <div className="form-group">
                <label className="control-label">{i18n._('Probe Feedrate')}</label>
                <div className="input-group input-group-sm">
                  <input
                    type="number"
                    className="form-control"
                    value={probeFeedrate}
                    placeholder="0.00"
                    min={0}
                    step={step}
                    onChange={actions.handleProbeFeedrateChange}
                  />
                  <span className="input-group-addon">{feedrateUnits}</span>
                </div>
              </div>
            </div>
            <div className="col-xs-6" style={{ paddingRight: 5 }}>
              <div className="form-group">
                <label className="control-label">{i18n._('Touch Plate Thickness')}</label>
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
            <div className="col-xs-6" style={{ paddingLeft: 5 }}>
              <div className="form-group">
                <label className="control-label">{i18n._('Retraction Distance')}</label>
                <div className="input-group input-group-sm">
                  <input
                    type="number"
                    className="form-control"
                    value={retractionDistance}
                    placeholder="0.00"
                    min={0}
                    step={step}
                    onChange={actions.handleRetractionDistanceChange}
                  />
                  <span className="input-group-addon">{displayUnits}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="row no-gutters">
            <div className="col-xs-12">
              <button
                type="button"
                className="btn btn-sm btn-default"
                onClick={() => {
                  actions.openModal(MODAL_PREVIEW);
                }}
                disabled={!canClick}
              >
                {i18n._('Probe')}
              </button>
            </div>
          </div>
        </div>
      );
    }
}

export default Probe;
