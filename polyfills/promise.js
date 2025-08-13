// Tiny pre-module polyfill loader for Promise.
// Loaded via Metro getPolyfills so it runs before any other bundles.
(function ensurePromise() {
  var needsPolyfill =
    typeof globalThis.Promise !== 'function' ||
    !globalThis.Promise ||
    typeof globalThis.Promise.resolve !== 'function' ||
    typeof globalThis.Promise.reject !== 'function' ||
    typeof globalThis.Promise.prototype?.then !== 'function';

  if (needsPolyfill) {
    try {
      var ES6Promise = require('es6-promise').Promise;
      if (typeof ES6Promise === 'function') {
        globalThis.Promise = ES6Promise;
      } else {
        require('es6-promise/auto');
      }
    } catch (e) {
      // last resort: minimal no-op shim to prevent crashes (not spec compliant)
      function NoopPromise(executor) {
        var t = this;
        var callbacks = [];
        try { executor(function(){ callbacks.forEach(function(c){ c(); }); }, function(){ callbacks.forEach(function(c){ c(); }); }); } catch {}
        t.then = function(cb){ if (typeof cb === 'function') callbacks.push(cb); return t; };
        t.catch = function(){ return t; };
        t.finally = function(cb){ if (typeof cb === 'function') cb(); return t; };
      }
      NoopPromise.resolve = function(){ return new NoopPromise(function(res){ res(); }); };
      NoopPromise.reject = function(){ return new NoopPromise(function(_, rej){ rej(); }); };
      globalThis.Promise = NoopPromise;
    }
  }
})();
