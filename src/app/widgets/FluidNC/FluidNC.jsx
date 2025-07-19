import _ from 'lodash';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { ProgressBar } from 'react-bootstrap';
import mapGCodeToText from 'app/lib/gcode-text';
import i18n from 'app/lib/i18n';
import Panel from 'app/components/Panel';
import Toggler from 'app/components/Toggler';
import Overrides from './Overrides';
import styles from './index.styl';

class FluidNC extends PureComponent {
    static propTypes = {
      state: PropTypes.object,
      actions: PropTypes.object
    };

    // FluidNC buffer settings (similar to GRBL)
    plannerBufferMax = 0;

    plannerBufferMin = 0;

    receiveBufferMax = 128;

    receiveBufferMin = 0;

    render() {
      const { state, actions } = this.props;
      const none = '–';
      const panel = state.panel;
      const controllerState = state.controller.state || {};
      const parserState = _.get(controllerState, 'parserstate', {});
      const activeState = _.get(controllerState, 'status.activeState') || none;
      const feedrate = _.get(controllerState, 'status.feedrate', _.get(parserState, 'feedrate', none));
      const spindle = _.get(controllerState, 'status.spindle', _.get(parserState, 'spindle', none));
      const tool = _.get(parserState, 'tool', none);
      const ov = _.get(controllerState, 'status.ov', []);
      const [ovF = 0, ovR = 0, ovS = 0] = ov;
      const buf = _.get(controllerState, 'status.buf', {});
      const modal = _.mapValues(parserState.modal || {}, mapGCodeToText);
      const receiveBufferStyle = ((rx) => {
        // danger: 0-7
        // warning: 8-15
        // info: >=16
        rx = Number(rx) || 0;
        if (rx >= 16) {
          return 'info';
        }
        if (rx >= 8) {
          return 'warning';
        }
        return 'danger';
      })(buf.rx);
      const plannerBufferStyle = ((planner) => {
        // danger: 0-7
        // warning: 8-15
        // info: >=16
        planner = Number(planner) || 0;
        if (planner >= 16) {
          return 'info';
        }
        if (planner >= 8) {
          return 'warning';
        }
        return 'danger';
      })(buf.planner);

      return (
        <div>
          <Panel className={styles.panel}>
            <Panel.Heading className={styles['panel-heading']}>
              <Toggler
                className="clearfix"
                onToggle={() => {
                  actions.toggleQueueReports();
                }}
                title={panel.queueReports.expanded ? i18n._('Hide') : i18n._('Show')}
              >
                <div className="pull-left">{i18n._('Queue Reports')}</div>
                <Toggler.Icon
                  className="pull-right"
                  expanded={panel.queueReports.expanded}
                />
              </Toggler>
            </Panel.Heading>
            {panel.queueReports.expanded ? (
              <Panel.Body>
                <div className="row no-gutters">
                  <div className="col col-xs-4">
                    <div className={styles['textbox-label']}>
                      {i18n._('Planner Buffer')}
                    </div>
                    <div className={styles.textbox}>
                      {buf.planner || 0}
                    </div>
                    <ProgressBar
                      style={{ marginBottom: 0 }}
                      bsStyle={plannerBufferStyle}
                      min={this.plannerBufferMin}
                      max={this.plannerBufferMax}
                      now={buf.planner || 0}
                    />
                  </div>
                  <div className="col col-xs-4">
                    <div className={styles['textbox-label']}>
                      {i18n._('Receive Buffer')}
                    </div>
                    <div className={styles.textbox}>
                      {buf.rx || 0}
                    </div>
                    <ProgressBar
                      style={{ marginBottom: 0 }}
                      bsStyle={receiveBufferStyle}
                      min={this.receiveBufferMin}
                      max={this.receiveBufferMax}
                      now={buf.rx || 0}
                    />
                  </div>
                  <div className="col col-xs-4">
                    <div className={styles['textbox-label']}>
                      {i18n._('Active State')}
                    </div>
                    <div className={styles.textbox} title={activeState}>
                      {activeState}
                    </div>
                  </div>
                </div>
              </Panel.Body>
) : null}
          </Panel>
          <Panel className={styles.panel}>
            <Panel.Heading className={styles['panel-heading']}>
              <Toggler
                className="clearfix"
                onToggle={() => {
                  actions.toggleStatusReports();
                }}
                title={panel.statusReports.expanded ? i18n._('Hide') : i18n._('Show')}
              >
                <div className="pull-left">{i18n._('Status Reports')}</div>
                <Toggler.Icon
                  className="pull-right"
                  expanded={panel.statusReports.expanded}
                />
              </Toggler>
            </Panel.Heading>
            {panel.statusReports.expanded ? (
              <Panel.Body>
                <div className="row no-gutters">
                  <div className="col col-xs-4">
                    <div className={styles['textbox-label']}>
                      {i18n._('Feed Rate')}
                    </div>
                    <div className={styles.textbox} title={feedrate}>
                      {feedrate}
                    </div>
                  </div>
                  <div className="col col-xs-4">
                    <div className={styles['textbox-label']}>
                      {i18n._('Spindle')}
                    </div>
                    <div className={styles.textbox} title={spindle}>
                      {spindle}
                    </div>
                  </div>
                  <div className="col col-xs-4">
                    <div className={styles['textbox-label']}>
                      {i18n._('Tool Number')}
                    </div>
                    <div className={styles.textbox} title={tool}>
                      {tool}
                    </div>
                  </div>
                </div>
                <Overrides ovF={ovF} ovR={ovR} ovS={ovS} />
              </Panel.Body>
) : null}
          </Panel>
          <Panel className={styles.panel}>
            <Panel.Heading className={styles['panel-heading']}>
              <Toggler
                className="clearfix"
                onToggle={() => {
                  actions.toggleModalGroups();
                }}
                title={panel.modalGroups.expanded ? i18n._('Hide') : i18n._('Show')}
              >
                <div className="pull-left">{i18n._('Modal Groups')}</div>
                <Toggler.Icon
                  className="pull-right"
                  expanded={panel.modalGroups.expanded}
                />
              </Toggler>
            </Panel.Heading>
            {panel.modalGroups.expanded ? (
              <Panel.Body>
                <div className="row no-gutters">
                  <div className="col col-xs-6">
                    <div className={styles['textbox-label']}>
                      {i18n._('Motion')}
                    </div>
                    <div className={styles.textbox} title={modal.motion}>
                      {modal.motion || none}
                    </div>
                  </div>
                  <div className="col col-xs-6">
                    <div className={styles['textbox-label']}>
                      {i18n._('Coordinate')}
                    </div>
                    <div className={styles.textbox} title={modal.wcs}>
                      {modal.wcs || none}
                    </div>
                  </div>
                </div>
                <div className="row no-gutters">
                  <div className="col col-xs-6">
                    <div className={styles['textbox-label']}>
                      {i18n._('Plane')}
                    </div>
                    <div className={styles.textbox} title={modal.plane}>
                      {modal.plane || none}
                    </div>
                  </div>
                  <div className="col col-xs-6">
                    <div className={styles['textbox-label']}>
                      {i18n._('Distance')}
                    </div>
                    <div className={styles.textbox} title={modal.distance}>
                      {modal.distance || none}
                    </div>
                  </div>
                </div>
                <div className="row no-gutters">
                  <div className="col col-xs-6">
                    <div className={styles['textbox-label']}>
                      {i18n._('Feed Rate')}
                    </div>
                    <div className={styles.textbox} title={modal.feedrate}>
                      {modal.feedrate || none}
                    </div>
                  </div>
                  <div className="col col-xs-6">
                    <div className={styles['textbox-label']}>
                      {i18n._('Units')}
                    </div>
                    <div className={styles.textbox} title={modal.units}>
                      {modal.units || none}
                    </div>
                  </div>
                </div>
                <div className="row no-gutters">
                  <div className="col col-xs-6">
                    <div className={styles['textbox-label']}>
                      {i18n._('Program')}
                    </div>
                    <div className={styles.textbox} title={modal.program}>
                      {modal.program || none}
                    </div>
                  </div>
                  <div className="col col-xs-6">
                    <div className={styles['textbox-label']}>
                      {i18n._('Spindle')}
                    </div>
                    <div className={styles.textbox} title={modal.spindle}>
                      {modal.spindle || none}
                    </div>
                  </div>
                </div>
                <div className="row no-gutters">
                  <div className="col col-xs-6">
                    <div className={styles['textbox-label']}>
                      {i18n._('Coolant')}
                    </div>
                    <div className={styles.textbox} title={modal.coolant}>
                      {modal.coolant || none}
                    </div>
                  </div>
                </div>
              </Panel.Body>
) : null}
          </Panel>
        </div>
      );
    }
}

export default FluidNC;
