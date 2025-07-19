const tap = require('tap');

// Mock the gamepad component methods we need to test
class MockGamepad {
    constructor() {
        this.continuousJogState = {
            activeAxes: new Set(),
            lastCommandTime: {},
            jogCancelTimeout: null
        };
    }

    // Extract axis and direction from jog action (e.g., 'jog-x+' -> { axis: 'X', direction: '+' })
    getAxisAndDirectionFromAction(action) {
        if (typeof action !== 'string') {
            return null;
        }

        const jogMatch = action.match(/^jog-([xyzabc])([+-])$/i);
        if (jogMatch) {
            return {
                axis: jogMatch[1].toUpperCase(),
                direction: jogMatch[2]
            };
        }
        return null;
    }

    // Legacy method for backward compatibility
    getAxisFromAction(action) {
        const result = this.getAxisAndDirectionFromAction(action);
        return result ? result.axis : null;
    }

    handleContinuousJog(axis, direction, magnitude) {
        const axisKey = `${axis}${direction}`;
        const isActive = magnitude > 0.5;
        const wasActive = this.continuousJogState.activeAxes.has(axisKey);

        if (isActive && !wasActive) {
            // Start continuous jog
            this.continuousJogState.activeAxes.add(axisKey);
            return 'start';
        } else if (!isActive && wasActive) {
            // Stop continuous jog
            this.continuousJogState.activeAxes.delete(axisKey);
            return 'stop';
        } else if (isActive && wasActive) {
            // Update continuous jog
            return 'update';
        }
        return 'none';
    }
}

tap.test('Gamepad continuous jogging fixes', (t) => {
    const gamepad = new MockGamepad();

    t.test('getAxisAndDirectionFromAction should extract axis and direction correctly', (st) => {
        const testCases = [
            { action: 'jog-x+', expected: { axis: 'X', direction: '+' } },
            { action: 'jog-x-', expected: { axis: 'X', direction: '-' } },
            { action: 'jog-y+', expected: { axis: 'Y', direction: '+' } },
            { action: 'jog-y-', expected: { axis: 'Y', direction: '-' } },
            { action: 'jog-z+', expected: { axis: 'Z', direction: '+' } },
            { action: 'jog-z-', expected: { axis: 'Z', direction: '-' } },
            { action: 'invalid-action', expected: null },
            { action: null, expected: null },
            { action: undefined, expected: null }
        ];

        testCases.forEach(({ action, expected }) => {
            const result = gamepad.getAxisAndDirectionFromAction(action);
            if (expected === null) {
                st.equal(result, null, `${action} should return null`);
            } else {
                st.equal(result.axis, expected.axis, `${action} should return axis ${expected.axis}`);
                st.equal(result.direction, expected.direction, `${action} should return direction ${expected.direction}`);
            }
        });

        st.end();
    });

    t.test('handleContinuousJog should properly start and stop jogging', (st) => {
        // Reset state
        gamepad.continuousJogState.activeAxes.clear();

        // Test starting jog
        let result = gamepad.handleContinuousJog('X', '+', 0.8);
        st.equal(result, 'start', 'Should start jogging when magnitude > 0.5');
        st.ok(gamepad.continuousJogState.activeAxes.has('X+'), 'X+ should be in active axes');

        // Test stopping jog
        result = gamepad.handleContinuousJog('X', '+', 0.0);
        st.equal(result, 'stop', 'Should stop jogging when magnitude drops to 0');
        st.notOk(gamepad.continuousJogState.activeAxes.has('X+'), 'X+ should not be in active axes');

        // Test updating jog
        gamepad.handleContinuousJog('X', '+', 0.8); // Start again
        result = gamepad.handleContinuousJog('X', '+', 0.9);
        st.equal(result, 'update', 'Should update jogging when magnitude changes while active');

        st.end();
    });

    t.test('continuous jogging scenario: normal configuration', (st) => {
        // Reset state
        gamepad.continuousJogState.activeAxes.clear();

        // Simulate user configuration: right stick -> jog-x+, left stick -> jog-x-
        const positiveAction = gamepad.getAxisAndDirectionFromAction('jog-x+');
        const negativeAction = gamepad.getAxisAndDirectionFromAction('jog-x-');

        // User pushes joystick right (val = 0.8)
        let posResult = gamepad.handleContinuousJog(positiveAction.axis, positiveAction.direction, 0.8);
        let negResult = gamepad.handleContinuousJog(negativeAction.axis, negativeAction.direction, 0);

        st.equal(posResult, 'start', 'Positive action should start');
        st.equal(negResult, 'none', 'Negative action should do nothing');
        st.ok(gamepad.continuousJogState.activeAxes.has('X+'), 'X+ should be active');

        // User centers joystick (val = 0.0)
        posResult = gamepad.handleContinuousJog(positiveAction.axis, positiveAction.direction, 0);
        negResult = gamepad.handleContinuousJog(negativeAction.axis, negativeAction.direction, 0);

        st.equal(posResult, 'stop', 'Positive action should stop');
        st.equal(negResult, 'none', 'Negative action should do nothing');
        st.equal(gamepad.continuousJogState.activeAxes.size, 0, 'No axes should be active');

        // User pushes joystick left (val = -0.8)
        posResult = gamepad.handleContinuousJog(positiveAction.axis, positiveAction.direction, 0);
        negResult = gamepad.handleContinuousJog(negativeAction.axis, negativeAction.direction, 0.8);

        st.equal(posResult, 'none', 'Positive action should do nothing');
        st.equal(negResult, 'start', 'Negative action should start');
        st.ok(gamepad.continuousJogState.activeAxes.has('X-'), 'X- should be active');

        st.end();
    });

    t.test('continuous jogging scenario: inverted configuration', (st) => {
        // Reset state
        gamepad.continuousJogState.activeAxes.clear();

        // Simulate inverted user configuration: right stick -> jog-x-, left stick -> jog-x+
        const positiveAction = gamepad.getAxisAndDirectionFromAction('jog-x-'); // User wants X- when stick goes right
        const negativeAction = gamepad.getAxisAndDirectionFromAction('jog-x+'); // User wants X+ when stick goes left

        // User pushes joystick right (val = 0.8) but wants X- movement
        let posResult = gamepad.handleContinuousJog(positiveAction.axis, positiveAction.direction, 0.8);
        let negResult = gamepad.handleContinuousJog(negativeAction.axis, negativeAction.direction, 0);

        st.equal(posResult, 'start', 'Should start X- movement when stick goes right');
        st.equal(negResult, 'none', 'X+ action should do nothing');
        st.ok(gamepad.continuousJogState.activeAxes.has('X-'), 'X- should be active (not X+)');

        // User centers joystick
        posResult = gamepad.handleContinuousJog(positiveAction.axis, positiveAction.direction, 0);
        negResult = gamepad.handleContinuousJog(negativeAction.axis, negativeAction.direction, 0);

        st.equal(posResult, 'stop', 'Should stop X- movement');
        st.equal(gamepad.continuousJogState.activeAxes.size, 0, 'No axes should be active');

        // User pushes joystick left (val = -0.8) but wants X+ movement
        posResult = gamepad.handleContinuousJog(positiveAction.axis, positiveAction.direction, 0);
        negResult = gamepad.handleContinuousJog(negativeAction.axis, negativeAction.direction, 0.8);

        st.equal(posResult, 'none', 'X- action should do nothing');
        st.equal(negResult, 'start', 'Should start X+ movement when stick goes left');
        st.ok(gamepad.continuousJogState.activeAxes.has('X+'), 'X+ should be active (not X-)');

        st.end();
    });

    t.end();
});
