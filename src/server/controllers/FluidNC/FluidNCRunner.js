import FluidNCLineParser from './FluidNCLineParser';

class FluidNCRunner {
    parser = new FluidNCLineParser();

    state = {
      status: {},
      parserstate: {},
      parameters: {}
    };

    parse(data) {
      data = ('' + data).replace(/\s+$/, '');
      if (!data) {
        return;
      }

      this.emit('raw', { raw: data });

      const result = this.parser.parse(data) || {};
      const { type, payload } = result;

      // Debug logging for FluidNC runner
      if (type) {
        console.log(`FluidNC parsed event: ${type}, payload:`, payload);
      } else {
        console.log(`FluidNC unrecognized data: ${JSON.stringify(data)}`);
      }

      if (type === FluidNCLineParser.TYPE_STATUS) {
        this.state.status = { ...payload };
        this.emit('status', payload);
        return;
      }
      if (type === FluidNCLineParser.TYPE_OK) {
        this.emit('ok', payload);
        return;
      }
      if (type === FluidNCLineParser.TYPE_ERROR) {
        this.emit('error', payload);
        return;
      }
      if (type === FluidNCLineParser.TYPE_ALARM) {
        this.emit('alarm', payload);
        return;
      }
      if (type === FluidNCLineParser.TYPE_PARSERSTATE) {
        this.state.parserstate = { ...payload };
        this.emit('parserstate', payload);
        return;
      }
      if (type === FluidNCLineParser.TYPE_PARAMETERS) {
        this.state.parameters = { ...payload };
        this.emit('parameters', payload);
        return;
      }
      if (type === FluidNCLineParser.TYPE_FEEDBACK) {
        this.emit('feedback', payload);
        return;
      }
      if (type === FluidNCLineParser.TYPE_SETTINGS) {
        this.emit('settings', payload);
        return;
      }
      if (type === FluidNCLineParser.TYPE_STARTUP) {
        this.emit('startup', payload);
        return;
      }
      if (type === FluidNCLineParser.TYPE_OTHERS) {
        this.emit('others', payload);
        return;
      }
    }

    on(eventName, listener) {
      const object = this;
      object._events = object._events || {};

      if (typeof listener !== 'function') {
        throw new TypeError('listener must be a function');
      }

      if (!object._events[eventName]) {
        object._events[eventName] = [];
      }

      object._events[eventName].push(listener);

      return object;
    }

    off(eventName, listenerToRemove) {
      const object = this;

      if (!object._events) {
        return object;
      }

      const list = object._events[eventName];
      if (!list) {
        return object;
      }

      if (arguments.length === 1) {
        delete object._events[eventName];
        return object;
      }

      for (let i = list.length - 1; i >= 0; i--) {
        const listener = list[i];
        if (listener === listenerToRemove) {
          list.splice(i, 1);
          break;
        }
      }

      if (list.length === 0) {
        delete object._events[eventName];
      }

      return object;
    }

    removeAllListeners(eventName) {
      const object = this;

      if (!object._events) {
        return object;
      }

      if (arguments.length === 0) {
        object._events = {};
        return object;
      }

      const list = object._events[eventName];
      if (list) {
        delete object._events[eventName];
      }

      return object;
    }

    emit(eventName, ...args) {
      const object = this;

      if (!object._events) {
        return false;
      }

      if (eventName === 'error' && (!object._events || !object._events.error)) {
        throw args[0]; // Unhandled 'error' event
      }

      const list = object._events[eventName];
      if (!list) {
        return false;
      }

      list.forEach((listener) => {
        listener.apply(object, args);
      });

      return true;
    }
}

export default FluidNCRunner;
