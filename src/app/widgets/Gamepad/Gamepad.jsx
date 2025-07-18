import React, { useEffect, useState } from 'react';
import i18n from 'app/lib/i18n';

const Gamepad = () => {
    const [gamepads, setGamepads] = useState([]);

    const updateGamepads = () => {
        if (typeof navigator.getGamepads !== 'function') {
            setGamepads([]);
            return;
        }
        const pads = Array.from(navigator.getGamepads()).filter(pad => pad);
        setGamepads(pads);
    };

    useEffect(() => {
        window.addEventListener('gamepadconnected', updateGamepads);
        window.addEventListener('gamepaddisconnected', updateGamepads);
        updateGamepads();
        return () => {
            window.removeEventListener('gamepadconnected', updateGamepads);
            window.removeEventListener('gamepaddisconnected', updateGamepads);
        };
    }, []);

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
};

// No props are currently used

export default Gamepad;
