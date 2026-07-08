import { createRoot } from 'react-dom/client';
import React from 'react';
import ContentApp from './ContentApp';

// We import tailwind styles as an inline string using Vite's ?inline query
// This string will be injected into the Shadow DOM.
import styles from './index.css?inline';

// Ensure we only inject once
(function initZephyrExtension() {
  if (document.getElementById('zephyr-extension-root')) {
    return;
  }

  // Abort if this is not a standard HTML document (e.g. an SVG, XML, or JSON file)
  if (!document.body || document.contentType === 'image/svg+xml' || document.contentType === 'application/xml' || document.contentType === 'application/json' || document.contentType === 'text/plain') {
    console.log('Zephyr: Skipping injection on non-HTML document');
    return;
  }

  const container = document.createElement('div');
  container.id = 'zephyr-extension-root';
  // Use z-index that guarantees floating above everything
  container.style.position = 'fixed';
  container.style.zIndex = '2147483647'; // Max z-index
  container.style.top = '0';
  container.style.left = '0';
  container.style.right = '0';
  container.style.bottom = '0';
  container.style.visibility = 'visible';
  container.style.display = 'block';
  container.style.pointerEvents = 'none'; // Let clicks pass through except on children
  container.style.background = 'transparent';
  container.style.fontSize = '16px';
  container.style.margin = '0';
  container.style.padding = '0';
  
  const targetParent = document.documentElement || document.body;
  targetParent.appendChild(container);

  // Ensure it stays in the DOM (some SPAs might clear the body/html)
  const observer = new MutationObserver(() => {
    if (!document.getElementById('zephyr-extension-root')) {
      const parent = document.documentElement || document.body;
      parent.appendChild(container);
      
      // Re-observe body if it was replaced
      if (document.body) observer.observe(document.body, { childList: true });
    }
  });
  observer.observe(document.documentElement, { childList: true });
  if (document.body) observer.observe(document.body, { childList: true });

  const shadow = container.attachShadow({ mode: 'open' });
  
  // Inject Tailwind CSS
  const styleSlot = document.createElement('style');
  styleSlot.textContent = styles;
  shadow.appendChild(styleSlot);

  const reactRoot = document.createElement('div');
  reactRoot.id = 'zephyr-react-root';
  reactRoot.style.pointerEvents = 'auto'; // Re-enable pointer events for React children
  shadow.appendChild(reactRoot);

  createRoot(reactRoot).render(<ContentApp />);
})();
