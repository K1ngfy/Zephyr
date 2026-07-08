// This file must be imported first to patch the DOM in non-HTML environments
// where document.createElement('div') might not have a style property.
// This prevents react-dom from throwing an error during initialization.
try {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const testDiv = document.createElement('div');
    if (!('style' in testDiv)) {
      const originalCreateElement = document.createElement;
      document.createElement = function(tagName, options) {
        const el = originalCreateElement.call(document, tagName, options);
        if (!('style' in el)) {
          Object.defineProperty(el, 'style', {
            value: {},
            writable: true,
            enumerable: true,
            configurable: true
          });
        }
        return el;
      };
    }
  }
} catch (e) {
  // Ignore errors during patch
}
