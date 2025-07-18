import cx from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import Space from 'app/components/Space';
import Widget from 'app/components/Widget';
import i18n from 'app/lib/i18n';
import WidgetConfig from '../WidgetConfig';
import Gamepad from './Gamepad';
import styles from './index.styl';

class GamepadWidget extends PureComponent {
    static propTypes = {
        widgetId: PropTypes.string.isRequired,
        onFork: PropTypes.func.isRequired,
        onRemove: PropTypes.func.isRequired,
        sortable: PropTypes.object
    };

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
        }
    };

    getInitialState() {
        return {
            minimized: this.config.get('minimized', false),
            isFullscreen: false
        };
    }

    componentDidUpdate() {
        const { minimized } = this.state;
        this.config.set('minimized', minimized);
    }

    render() {
        const { widgetId } = this.props;
        const { minimized, isFullscreen } = this.state;
        const isForkedWidget = widgetId.match(/\w+:[\w\-]+/);
        const actions = { ...this.actions };

        return (
          <Widget fullscreen={isFullscreen}>
            <Widget.Header>
              <Widget.Title>
                <Widget.Sortable className={this.props.sortable.handleClassName}>
                  <i className="fa fa-bars" />
                  <Space width="8" />
                </Widget.Sortable>
                {isForkedWidget ? <i className="fa fa-code-fork" style={{ marginRight: 5 }} /> : null}
                {i18n._('Gamepad')}
              </Widget.Title>
              <Widget.Controls className={this.props.sortable.filterClassName}>
                <Widget.Button
                  disabled={isFullscreen}
                  title={minimized ? i18n._('Expand') : i18n._('Collapse')}
                  onClick={actions.toggleMinimized}
                >
                  <i className={cx('fa', { 'fa-chevron-up': !minimized, 'fa-chevron-down': minimized })} />
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
                    <i className={cx('fa', 'fa-fw', { 'fa-expand': !isFullscreen }, { 'fa-compress': isFullscreen })} />
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
            <Widget.Content className={cx(styles.widgetContent, { [styles.hidden]: minimized })}>
              <Gamepad />
            </Widget.Content>
          </Widget>
        );
    }
}

export default GamepadWidget;
