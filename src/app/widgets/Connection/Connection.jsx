import find from 'lodash/find';
import get from 'lodash/get';
import includes from 'lodash/includes';
import map from 'lodash/map';
import cx from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Select from 'react-select';
import Space from 'app/components/Space';
import { ToastNotification } from 'app/components/Notifications';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import {
  GRBL,
  GRBLHAL,
  MARLIN,
  SMOOTHIE,
  TINYG
} from '../../constants';

class Connection extends PureComponent {
    static propTypes = {
      state: PropTypes.object,
      actions: PropTypes.object
    };

    isPortInUse = (port) => {
      const { state } = this.props;
      port = port || state.port;
      const o = find(state.ports, { port }) || {};
      return !!(o.inuse);
    };

    renderPortOption = (option) => {
      const { label, inuse, manufacturer } = option;
      const styles = {
        option: {
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden'
        }
      };

      return (
        <div style={styles.option} title={label}>
          <div>
            {inuse && (
              <span>
                <i className="fa fa-lock" />
                <Space width="8" />
              </span>
            )}
            {label}
          </div>
          {manufacturer &&
            <i>{i18n._('Manufacturer: {{manufacturer}}', { manufacturer })}</i>
          }
        </div>
      );
    };

    renderPortValue = (option) => {
      const { state } = this.props;
      const { label, inuse } = option;
      const notLoading = !(state.loading);
      const canChangePort = notLoading;
      const style = {
        color: canChangePort ? '#333' : '#ccc',
        textOverflow: 'ellipsis',
        overflow: 'hidden'
      };
      return (
        <div style={style} title={label}>
          {inuse && (
            <span>
              <i className="fa fa-lock" />
              <Space width="8" />
            </span>
          )}
          {label}
        </div>
      );
    };

    renderBaudrateValue = (option) => {
      const { state } = this.props;
      const notLoading = !(state.loading);
      const notInUse = !(this.isPortInUse(state.port));
      const canChangeBaudrate = notLoading && notInUse;
      const style = {
        color: canChangeBaudrate ? '#333' : '#ccc',
        textOverflow: 'ellipsis',
        overflow: 'hidden'
      };
      return (
        <div style={style} title={option.label}>{option.label}</div>
      );
    };

    render() {
      const { state, actions } = this.props;
      const {
        loading, connecting, connected,
        controllerType,
        ports, baudrates,
        port, baudrate,
        autoReconnect,
        connection,
        alertMessage
      } = state;
      const pin = get(connection, 'serial.pin');
      // Set or clear the DTR line immediately upon opening. No action will be taken if the state is not a boolean type.
      const enableDTRPin = (typeof pin?.dtr === 'boolean');
      // Set or clear the RTS line immediately upon opening. No action will be taken if the state is not a boolean type.
      const enableRTSPin = (typeof pin?.rts === 'boolean');
      const enableRTSCTSFlowControl = get(connection, 'serial.rtscts', false);
      const canSelectControllers = (controller.loadedControllers.length > 1);
      const hasGrblController = includes(controller.loadedControllers, GRBL);
      const hasGrblHALController = includes(controller.loadedControllers, GRBLHAL);
      const hasMarlinController = includes(controller.loadedControllers, MARLIN);
      const hasSmoothieController = includes(controller.loadedControllers, SMOOTHIE);
      const hasTinyGController = includes(controller.loadedControllers, TINYG);
      const notLoading = !loading;
      const notConnecting = !connecting;
      const notConnected = !connected;
      const canRefresh = notLoading && notConnected;
      const canChangeController = notLoading && notConnected;
      const canChangePort = notLoading && notConnected;
      const canChangeBaudrate = notLoading && notConnected && (!(this.isPortInUse(port)));
      const canOpenPort = port && baudrate && notConnecting && notConnected;
      const canClosePort = connected;

      return (
        <div>
          {alertMessage && (
            <ToastNotification
              style={{ margin: '-10px -10px 10px -10px' }}
              type="error"
              onDismiss={actions.clearAlert}
            >
              {alertMessage}
            </ToastNotification>
          )}
          {canSelectControllers && (
            <div className="form-group">
              <div className="input-group input-group-sm">
                <div className="input-group-btn">
                  {hasGrblController && (
                    <button
                      type="button"
                      className={cx(
                        'btn',
                        'btn-default',
                        { 'btn-select': controllerType === GRBL }
                      )}
                      disabled={!canChangeController}
                      onClick={() => {
                        actions.changeController(GRBL);
                      }}
                    >
                      {GRBL}
                    </button>
                  )}
                  {hasGrblHALController && (
                    <button
                      type="button"
                      className={cx(
                        'btn',
                        'btn-default',
                        { 'btn-select': controllerType === GRBLHAL }
                      )}
                      disabled={!canChangeController}
                      onClick={() => {
                        actions.changeController(GRBLHAL);
                      }}
                    >
                      {GRBLHAL}
                    </button>
                  )}
                  {hasMarlinController && (
                    <button
                      type="button"
                      className={cx(
                        'btn',
                        'btn-default',
                        { 'btn-select': controllerType === MARLIN }
                      )}
                      disabled={!canChangeController}
                      onClick={() => {
                        actions.changeController(MARLIN);
                      }}
                    >
                      {MARLIN}
                    </button>
                  )}
                  {hasSmoothieController && (
                    <button
                      type="button"
                      className={cx(
                        'btn',
                        'btn-default',
                        { 'btn-select': controllerType === SMOOTHIE }
                      )}
                      disabled={!canChangeController}
                      onClick={() => {
                        actions.changeController(SMOOTHIE);
                      }}
                    >
                      {SMOOTHIE}
                    </button>
                  )}
                  {hasTinyGController && (
                    <button
                      type="button"
                      className={cx(
                        'btn',
                        'btn-default',
                        { 'btn-select': controllerType === TINYG }
                      )}
                      disabled={!canChangeController}
                      onClick={() => {
                        actions.changeController(TINYG);
                      }}
                    >
                      {TINYG}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="form-group">
            <label className="control-label">{i18n._('Port')}</label>
            <div className="input-group input-group-sm">
              <Select
                backspaceRemoves={false}
                className="sm"
                clearable={false}
                disabled={!canChangePort}
                name="port"
                noResultsText={i18n._('No ports available')}
                onChange={actions.onChangePortOption}
                optionRenderer={this.renderPortOption}
                options={map(ports, (o) => ({
                  value: o.port,
                  label: o.port,
                  manufacturer: o.manufacturer,
                  inuse: o.inuse
                }))}
                placeholder={i18n._('Choose a port')}
                searchable={false}
                value={port}
                valueRenderer={this.renderPortValue}
              />
              <div className="input-group-btn">
                <button
                  type="button"
                  className="btn btn-default"
                  name="btn-refresh"
                  title={i18n._('Refresh')}
                  onClick={actions.handleRefreshPorts}
                  disabled={!canRefresh}
                >
                  <i
                    className={cx(
                      'fa',
                      'fa-refresh',
                      { 'fa-spin': loading }
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
          <div className="form-group">
            <label className="control-label">{i18n._('Baud rate')}</label>
            <Select
              backspaceRemoves={false}
              className="sm"
              clearable={false}
              disabled={!canChangeBaudrate}
              menuContainerStyle={{ zIndex: 5 }}
              name="baudrate"
              onChange={actions.onChangeBaudrateOption}
              options={map(baudrates, (value) => ({
                value: value,
                label: Number(value).toString()
              }))}
              placeholder={i18n._('Choose a baud rate')}
              searchable={false}
              value={baudrate}
              valueRenderer={this.renderBaudrateValue}
            />
          </div>
          <div
            className={cx('checkbox', {
              'disabled': connected,
            })}
          >
            <label>
              <input
                type="checkbox"
                defaultChecked={enableDTRPin}
                onChange={actions.toggleDTRPin}
                disabled={connected}
              />
              {i18n._('Set DTR line status upon opening')}
            </label>
          </div>
          {enableDTRPin && (
            <div style={{ marginLeft: 20 }}>
              <div className="input-group input-group-xs">
                <div className="input-group-btn">
                  <button
                    type="button"
                    className={cx(
                      'btn',
                      'btn-default',
                      { 'btn-select': !!pin.dtr }
                    )}
                    onClick={actions.setDTR}
                  >
                    {i18n._('SET')}
                  </button>
                  <button
                    type="button"
                    className={cx(
                      'btn',
                      'btn-default',
                      { 'btn-select': !pin.dtr }
                    )}
                    onClick={actions.clearDTR}
                  >
                    {i18n._('CLR')}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div
            className={cx('checkbox', {
              'disabled': connected,
            })}
          >
            <label>
              <input
                type="checkbox"
                defaultChecked={enableRTSPin}
                onChange={actions.toggleRTSPin}
                disabled={connected}
              />
              {i18n._('Set RTS line status upon opening')}
            </label>
          </div>
          {enableRTSPin && (
            <div style={{ marginLeft: 20 }}>
              <div className="input-group input-group-xs">
                <div className="input-group-btn">
                  <button
                    type="button"
                    className={cx(
                      'btn',
                      'btn-default',
                      { 'btn-select': !!pin.rts }
                    )}
                    onClick={actions.setRTS}
                  >
                    {i18n._('SET')}
                  </button>
                  <button
                    type="button"
                    className={cx(
                      'btn',
                      'btn-default',
                      { 'btn-select': !pin.rts }
                    )}
                    onClick={actions.clearRTS}
                  >
                    {i18n._('CLR')}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div
            className={cx('checkbox', {
              'disabled': connected,
            })}
          >
            <label>
              <input
                type="checkbox"
                defaultChecked={enableRTSCTSFlowControl}
                onChange={actions.toggleRTSCTSFlowControl}
                disabled={connected}
              />
              {i18n._('Use RTS/CTS flow control')}
            </label>
          </div>
          <div className="checkbox">
            <label>
              <input
                type="checkbox"
                defaultChecked={autoReconnect}
                onChange={actions.toggleAutoReconnect}
              />
              {i18n._('Connect automatically')}
            </label>
          </div>
          <div className="btn-group btn-group-sm">
            {notConnected && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canOpenPort}
                onClick={actions.handleOpenPort}
              >
                <i className="fa fa-toggle-off" />
                <Space width="8" />
                {i18n._('Open')}
              </button>
            )}
            {connected && (
              <button
                type="button"
                className="btn btn-danger"
                disabled={!canClosePort}
                onClick={actions.handleClosePort}
              >
                <i className="fa fa-toggle-on" />
                <Space width="8" />
                {i18n._('Close')}
              </button>
            )}
          </div>
        </div>
      );
    }
}

export default Connection;
