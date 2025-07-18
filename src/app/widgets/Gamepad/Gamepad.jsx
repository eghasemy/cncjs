import React, { PureComponent } from 'react';
import i18n from 'app/lib/i18n';

class Gamepad extends PureComponent {
    state = {
        gamepads: []
    };

    componentDidMount() {
        this.updateGamepads();
        window.addEventListener('gamepadconnected', this.updateGamepads);
        window.addEventListener('gamepaddisconnected', this.updateGamepads);
    }

    componentWillUnmount() {
        window.removeEventListener('gamepadconnected', this.updateGamepads);
        window.removeEventListener('gamepaddisconnected', this.updateGamepads);
    }

    updateGamepads = () => {
        if (typeof navigator.getGamepads !== 'function') {
            this.setState({ gamepads: [] });
            return;
        }

        const pads = Array.from(navigator.getGamepads()).filter(pad => pad);
        this.setState({ gamepads: pads });
    };

    render() {
        const { gamepads } = this.state;
        return (
            <div>
                {gamepads.length === 0 && (
                    <div>{i18n._('No gamepad connected')}</div>
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

// No props are currently used

export default Gamepad;
