import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import i18n from 'app/lib/i18n';
import styles from './index.styl';

class Overrides extends PureComponent {
    static propTypes = {
      ovF: PropTypes.number,
      ovR: PropTypes.number,
      ovS: PropTypes.number
    };

    render() {
      const { ovF, ovR, ovS } = this.props;

      return (
        <div className="row no-gutters" style={{ marginTop: 10 }}>
          <div className="col col-xs-4">
            <div className={styles['textbox-label']}>
              {i18n._('Overrides')}
            </div>
            <div className={styles.well}>
              <div className="row no-gutters">
                <div className="col col-xs-4" title={i18n._('Feed')}>
                  <div className={styles['textbox-label']}>
                    F
                  </div>
                  <div className={styles.textbox}>
                    {ovF}%
                  </div>
                </div>
                <div className="col col-xs-4" title={i18n._('Rapid')}>
                  <div className={styles['textbox-label']}>
                    R
                  </div>
                  <div className={styles.textbox}>
                    {ovR}%
                  </div>
                </div>
                <div className="col col-xs-4" title={i18n._('Spindle')}>
                  <div className={styles['textbox-label']}>
                    S
                  </div>
                  <div className={styles.textbox}>
                    {ovS}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
}

export default Overrides;