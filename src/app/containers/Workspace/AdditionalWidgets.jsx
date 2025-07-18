import classNames from 'classnames';
import { ensureArray } from 'ensure-type';
import pubsub from 'pubsub-js';
import React, { PureComponent } from 'react';
import store from 'app/store';
import Widget from './Widget';
import styles from './widgets.styl';

class AdditionalWidgets extends PureComponent {
  pubsubTokens = [];

  state = {
    widgets: ensureArray(store.get('workspace.container.additional.widgets'))
  };

  subscribe() {
    const tokens = [
      pubsub.subscribe('updateAdditionalWidgets', (msg, widgets) => {
        this.setState({ widgets: widgets });
        store.set('workspace.container.additional.widgets', widgets);
      })
    ];
    this.pubsubTokens = this.pubsubTokens.concat(tokens);
  }

  unsubscribe() {
    this.pubsubTokens.forEach((token) => {
      pubsub.unsubscribe(token);
    });
    this.pubsubTokens = [];
  }

  componentDidMount() {
    this.subscribe();
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  // Widget operations
  collapseAll = () => {
    this.setState({ widgets: this.state.widgets });
  };

  expandAll = () => {
    this.setState({ widgets: this.state.widgets });
  };

  forkWidget = (widgetId) => () => {
    // Fork widget through parent handler
    this.props.onForkWidget(widgetId);
  };

  removeWidget = (widgetId) => () => {
    // Remove widget through parent handler
    this.props.onRemoveWidget(widgetId);
  };

  render() {
    const { className } = this.props;
    const { widgets } = this.state;
    const widgetElements = widgets.map(widgetId => (
      <div data-widget-id={widgetId} key={widgetId}>
        <Widget
          widgetId={widgetId}
          onFork={this.forkWidget(widgetId)}
          onRemove={this.removeWidget(widgetId)}
          sortable={{
            handleClassName: 'sortable-handle',
            filterClassName: 'sortable-filter'
          }}
        />
      </div>
    ));

    return (
      <div className={classNames(className, styles.widgets)}>
        {widgetElements}
      </div>
    );
  }
}

export default AdditionalWidgets;
