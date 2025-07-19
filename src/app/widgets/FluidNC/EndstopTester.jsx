import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Button } from 'app/components/Buttons';
import i18n from 'app/lib/i18n';
import controller from 'app/lib/controller';
import styles from './index.styl';

class EndstopTester extends PureComponent {
    static propTypes = {
      status: PropTypes.object.isRequired,
      onRefresh: PropTypes.func.isRequired
    };

    state = {
      testing: false,
      testResults: {}
    };

    testEndstop = (axis, direction) => {
      this.setState({ testing: true });
      
      // Send a small movement command to test endstop
      const distance = direction === 'positive' ? 1 : -1;
      const command = `G91 G1 ${axis.toUpperCase()}${distance} F100`;
      
      controller.command('gcode', command);
      
      // Check status after movement
      setTimeout(() => {
        controller.command('gcode', '?');
        setTimeout(() => {
          this.setState({ testing: false });
          this.props.onRefresh();
        }, 500);
      }, 1000);
    };

    homeAxis = (axis) => {
      if (window.confirm(i18n._('Home {{axis}} axis?', { axis: axis.toUpperCase() }))) {
        controller.command('gcode', `$H${axis.toUpperCase()}`);
      }
    };

    homeAllAxes = () => {
      if (window.confirm(i18n._('Home all axes?'))) {
        controller.command('gcode', '$H');
      }
    };

    render() {
      const { status, onRefresh } = this.props;
      const { testing } = this.state;

      const axes = ['x', 'y', 'z'];
      const endstopStates = {
        x: { min: false, max: false },
        y: { min: false, max: false },
        z: { min: false, max: false },
        ...status
      };

      return (
        <div className={styles.endstopTester}>
          <div className="row">
            <div className="col-sm-12">
              <div className="pull-right" style={{ marginBottom: 10 }}>
                <Button
                  btnSize="sm"
                  onClick={onRefresh}
                  disabled={testing}
                >
                  <i className="fa fa-refresh" />
                  <span className="space" />
                  {i18n._('Refresh Status')}
                </Button>
                <span className="space" />
                <Button
                  btnSize="sm"
                  btnStyle="primary"
                  onClick={this.homeAllAxes}
                  disabled={testing}
                >
                  <i className="fa fa-home" />
                  <span className="space" />
                  {i18n._('Home All Axes')}
                </Button>
              </div>
            </div>
          </div>

          <div className={styles.endstopGrid}>
            <h5>{i18n._('Endstop Status')}</h5>
            <p className="text-muted">
              {i18n._('Monitor endstop switches and test homing functionality')}
            </p>

            {axes.map(axis => (
              <div key={axis} className={styles.axisSection}>
                <h6>{i18n._('{{axis}} Axis', { axis: axis.toUpperCase() })}</h6>
                
                <div className="row">
                  <div className="col-sm-6">
                    <div className={styles.endstopStatus}>
                      <div className={styles.endstopIndicator}>
                        <span className={styles.label}>Min Endstop:</span>
                        <span className={`${styles.status} ${endstopStates[axis]?.min ? styles.triggered : styles.open}`}>
                          <i className={`fa ${endstopStates[axis]?.min ? 'fa-circle' : 'fa-circle-o'}`} />
                          <span className="space" />
                          {endstopStates[axis]?.min ? i18n._('Triggered') : i18n._('Open')}
                        </span>
                      </div>
                      
                      <div className={styles.endstopIndicator}>
                        <span className={styles.label}>Max Endstop:</span>
                        <span className={`${styles.status} ${endstopStates[axis]?.max ? styles.triggered : styles.open}`}>
                          <i className={`fa ${endstopStates[axis]?.max ? 'fa-circle' : 'fa-circle-o'}`} />
                          <span className="space" />
                          {endstopStates[axis]?.max ? i18n._('Triggered') : i18n._('Open')}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="col-sm-6">
                    <div className={styles.testControls}>
                      <Button
                        btnSize="xs"
                        onClick={() => this.testEndstop(axis, 'negative')}
                        disabled={testing}
                        title={i18n._('Test movement towards min endstop')}
                      >
                        <i className="fa fa-arrow-left" />
                        <span className="space" />
                        {i18n._('Test Min')}
                      </Button>
                      <span className="space" />
                      <Button
                        btnSize="xs"
                        onClick={() => this.testEndstop(axis, 'positive')}
                        disabled={testing}
                        title={i18n._('Test movement towards max endstop')}
                      >
                        <i className="fa fa-arrow-right" />
                        <span className="space" />
                        {i18n._('Test Max')}
                      </Button>
                      <span className="space" />
                      <Button
                        btnSize="xs"
                        btnStyle="primary"
                        onClick={() => this.homeAxis(axis)}
                        disabled={testing}
                        title={i18n._('Home this axis')}
                      >
                        <i className="fa fa-home" />
                        <span className="space" />
                        {i18n._('Home')}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className={styles.helpSection}>
            <h6>{i18n._('Endstop Configuration Help')}</h6>
            <ul>
              <li>{i18n._('Endstops should be "Open" when not pressed and "Triggered" when pressed')}</li>
              <li>{i18n._('Test buttons will move the axis slightly to verify endstop functionality')}</li>
              <li>{i18n._('Homing will move the axis until it hits the endstop switch')}</li>
              <li>{i18n._('Ensure endstops are properly wired and configured before using')}</li>
            </ul>
            
            <div className={styles.warningBox}>
              <i className="fa fa-exclamation-triangle" />
              <span className="space" />
              <strong>{i18n._('Warning:')}</strong>
              <span className="space" />
              {i18n._('Always ensure endstops are working properly before running any automated movements.')}
            </div>
          </div>
        </div>
      );
    }
}

export default EndstopTester;