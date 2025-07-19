import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import i18n from 'app/lib/i18n';

class Gamepad extends PureComponent {
    static propTypes = {
        selectedIndex: PropTypes.number,
        onSelectIndex: PropTypes.func
    };

    static defaultProps = {
        selectedIndex: 0,
        onSelectIndex: () => {}
    };
    state = {
        gamepads: []
    };

    raf = 0;

    componentDidMount() {
        this.updateGamepads();
        this.pollGamepads();
        window.addEventListener('gamepadconnected', this.updateGamepads);
        window.addEventListener('gamepaddisconnected', this.updateGamepads);
    }

    componentWillUnmount() {
        window.removeEventListener('gamepadconnected', this.updateGamepads);
        window.removeEventListener('gamepaddisconnected', this.updateGamepads);
        cancelAnimationFrame(this.raf);
    }

    pollGamepads = () => {
        this.updateGamepads();
        this.raf = requestAnimationFrame(this.pollGamepads);
    };

    updateGamepads = () => {
        if (typeof navigator.getGamepads !== 'function') {
            this.setState({ gamepads: [] });
            return;
        }

        const pads = Array.from(navigator.getGamepads()).filter(pad => pad);
        this.setState({ gamepads: pads });
        const { selectedIndex, onSelectIndex } = this.props;
        if (!pads.some(p => p.index === selectedIndex)) {
            onSelectIndex(pads.length ? pads[0].index : -1);
        }
    };

    render() {
        const { gamepads } = this.state;
        const { selectedIndex, onSelectIndex } = this.props;
        return (
            <div>
                {gamepads.length === 0 && (
                    <div>{i18n._('No gamepad connected')}</div>
                )}
                {gamepads.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                        <select
                          className="form-control"
                          value={selectedIndex}
                          onChange={e => onSelectIndex(Number(e.target.value))}
                        >
                          {gamepads.map(pad => (
                              <option key={pad.index} value={pad.index}>{pad.id}</option>
                          ))}
                        </select>
                    </div>
                )}
                {gamepads.map(pad => (
                    <div key={pad.index} style={{ marginBottom: 10 }}>
                        <strong>{pad.id}</strong>
                        <div>{i18n._('Buttons')}: {pad.buttons.length}</div>
                        <div>{i18n._('Axes')}: {pad.axes.length}</div>
                    </div>
                ))}
            </div>
        );
    }
}

export default Gamepad;
