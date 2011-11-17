(function() {
  var Promise, Proxy, as, asyncMap, convert, convertValue, convertedMap, creatingActions, currentPromises, ensureBoundFunction, inspectArgs, inspectFunction, inspectObj, inspectPromise, inspectPromiseNoValue, makeProxy, map, promiseValue, runParallel, runPromise, runPromises;
  var __slice = Array.prototype.slice;
  Proxy = require('node-proxy');
  currentPromises = [];
  creatingActions = false;
  as = module.exports = function() {
    var actions, createActions, objects, runActions, _i;
    objects = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), actions = arguments[_i++];
    createActions = function() {
      var args, oldCurrentPromises, ps, ret;
      args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      oldCurrentPromises = currentPromises;
      currentPromises = [];
      creatingActions = true;
      ret = actions.apply(null, objects.map(convert).concat(args.map(convertValue)));
      ps = currentPromises;
      currentPromises = oldCurrentPromises;
      creatingActions = false;
      return [ret, ps];
    };
    return runActions = function() {
      var args, cb, converted, ps, ret, _j, _ref;
      args = 2 <= arguments.length ? __slice.call(arguments, 0, _j = arguments.length - 1) : (_j = 0, []), cb = arguments[_j++];
      if (creatingActions) {
        converted = convert(runActions);
        return converted.apply(null, args.concat(cb));
      }
      _ref = createActions.apply(null, args), ret = _ref[0], ps = _ref[1];
      if (!(cb != null)) {
        throw new Error("Tried to call async block with no callback");
      }
      runPromises(ps.concat(), function(err) {
        if (err) {
          return cb(err);
        }
        return cb(null, promiseValue(ret));
      });
    };
  };
  as.convert = convert = function(obj) {
    var key, promiser, value;
    if (typeof obj === "function") {
      return function() {
        var args, p;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        p = Promise.Normal(obj, args);
        currentPromises.push(p);
        return makeProxy(p);
      };
    } else if (typeof obj === "object") {
      promiser = {};
      for (key in obj) {
        value = obj[key];
        promiser[key] = convert(value);
      }
      return promiser;
    } else {
      return convertValue(obj);
    }
  };
  convertValue = function(obj) {
    var p;
    p = Promise.Value(obj);
    currentPromises.push(p);
    return makeProxy(p);
  };
  runPromises = function(ps, cb) {
    var flushParallels, next, parallels;
    parallels = [];
    flushParallels = function(cb) {
      runParallel(parallels, cb);
      return parallels = [];
    };
    next = function(err) {
      var p;
      if (err) {
        return cb(err);
      }
      p = ps.shift();
      if (!(p != null)) {
        return flushParallels(cb);
      }
      if (p.parallel) {
        parallels.push(p);
        return next();
      }
      return flushParallels(function(err) {
        if (err) {
          return cb(err);
        }
        return runPromise(p, next);
      });
    };
    return next();
  };
  runParallel = function(ps, cb) {
    var remaining;
    if (ps.length === 0) {
      return cb();
    }
    remaining = ps.length;
    return ps.forEach(function(p) {
      return runPromise(p, function(err) {
        if (err) {
          return cb(err);
        }
        if (--remaining === 0) {
          return cb();
        }
      });
    });
  };
  runPromise = function(p, cb) {
    var args, callback, finished, parentValue, ret;
    p = p.source();
    finished = false;
    callback = function(err, result) {
      if (finished) {
        throw new Error("Promise both returned and called back, or called back twice");
      }
      finished = true;
      p.value = result;
      return process.nextTick(function() {
        return cb(err);
      });
    };
    callback.inspect = function() {
      return "";
    };
    args = p.args.concat();
    args.push(callback);
    args = args.map(promiseValue);
    if (p.type === "NORMAL") {
      ret = p.action.apply(p, args);
      if (ret != null) {
        return callback(null, ret);
      }
    } else {
      parentValue = p.parent.value || {};
      ret = (function() {
        switch (p.type) {
          case "GET":
            return parentValue[p.property];
          case "SET":
            return parentValue[p.property] = promiseValue(p.setTo);
          case "CALL":
            return parentValue.apply(p.parent.parent.value, args);
          case "VALUE":
            return p.value;
          default:
            throw new Error("Bad Promise Type");
        }
      })();
      return callback(null, ret);
    }
  };
  promiseValue = function(p) {
    var prop, val;
    if ((p != null) && p.isPromise) {
      return p.source().value;
    }
    for (prop in p) {
      val = p[prop];
      if (val.isPromise) {
        p[prop] = val.source().value;
      }
    }
    return p;
  };
  makeProxy = function(p) {
    var handler, proxy;
    handler = {
      get: function(r, n) {
        var getter;
        if (p[n] != null) {
          return ensureBoundFunction(p, p[n]);
        } else if (n === "forEach" || n === "map") {
          return map(p);
        } else {
          getter = Promise.Getter(p, n);
          currentPromises.push(getter);
          return makeProxy(getter);
        }
      },
      set: function(r, n, v) {
        var setter;
        setter = Promise.Setter(p, n, v);
        return currentPromises.push(setter);
      },
      call: function() {
        var args, caller;
        args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        caller = Promise.Caller(p, args);
        currentPromises.push(caller);
        return makeProxy(caller);
      }
    };
    return proxy = Proxy.createFunction(handler, handler.call);
  };
  Promise = (function() {
    function Promise() {
      this.parent = {};
      this.args = [];
      this.value = null;
      this.parallel = false;
      this.action = null;
      this.type = null;
      this.property = null;
      this.setTo = null;
    }
    Promise.prototype.isPromise = true;
    Promise.prototype.p = function() {
      this.parallel = true;
      return this;
    };
    Promise.prototype.source = function() {
      return this;
    };
    Promise.prototype.inspect = function() {
      return inspectPromise(this);
    };
    return Promise;
  })();
  Promise.Getter = function(parent, n) {
    var p;
    p = new Promise();
    p.parent = parent;
    p.type = "GET";
    p.property = n;
    return p;
  };
  Promise.Setter = function(parent, n, v) {
    var p;
    p = new Promise();
    p.type = "SET";
    p.parent = parent;
    p.property = n;
    p.setTo = v;
    return p;
  };
  Promise.Caller = function(parent, args) {
    var p;
    p = new Promise();
    p.type = "CALL";
    p.parent = parent;
    p.args = args;
    return p;
  };
  Promise.Normal = function(action, args) {
    var p;
    p = new Promise();
    p.type = "NORMAL";
    p.args = args;
    p.action = action;
    return p;
  };
  Promise.Value = function(value) {
    var p;
    p = new Promise();
    p.type = "VALUE";
    p.value = value;
    return p;
  };
  map = function(arrayPromise) {
    var callMap;
    return callMap = function(f) {
      return convertedMap(arrayPromise, as(f));
    };
  };
  asyncMap = function(vs, f, cb) {
    var next, results;
    results = [];
    vs = vs.concat();
    next = function(err) {
      var v;
      v = vs.shift();
      if (!(v != null)) {
        return cb(null, results);
      }
      return f(v, function(err, res) {
        if (err != null) {
          return cb(err);
        }
        results.push(res);
        return next();
      });
    };
    return next();
  };
  convertedMap = convert(asyncMap);
  ensureBoundFunction = function(p, value) {
    if (value instanceof Function) {
      value = value.bind(p);
    }
    return value;
  };
  inspectObj = function(arg) {
    if (arg.inspect != null) {
      return arg.inspect();
    } else if (typeof arg === 'function') {
      return inspectFunction(arg, []);
    } else {
      return arg;
    }
  };
  inspectArgs = function(args) {
    return args.map(inspectObj).join(',');
  };
  inspectFunction = function(f, args) {
    return f.toString().replace(/function\s*(\w*).*?\s*\{[\s\S]+/, "$1") + "(" + inspectArgs(args) + ")";
  };
  inspectPromise = function(p) {
    var out;
    out = "";
    out += inspectPromiseNoValue(p);
    if (p.value != null) {
      out += " = " + inspectObj(p.value);
    }
    return out;
  };
  inspectPromiseNoValue = function(p) {
    var out;
    if (!(p instanceof Promise)) {
      return "";
    }
    out = "";
    if (p.parent != null) {
      out += inspectPromiseNoValue(p.parent);
    }
    switch (p.type) {
      case "NORMAL":
        if (p.action != null) {
          out += inspectFunction(p.action, p.args);
        }
        break;
      case "GET":
        out += "." + p.property;
        break;
      case "CALL":
        out += "(" + inspectArgs(p.args) + ")";
        break;
      case "SET":
        out += "." + p.property + " = " + p.setTo;
        break;
      case "VALUE":
        out += "val";
        break;
      default:
        throw new Error("Unknown p.type");
    }
    return out;
  };
}).call(this);
