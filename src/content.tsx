import { createRoot } from 'react-dom/client';
import React from 'react';
import ContentApp from './ContentApp';

// We import tailwind styles as an inline string using Vite's ?inline query
// This string will be injected into the Shadow DOM.
import styles from './index.css?inline';

// Ensure we only inject once
if (!document.getElementById('zephyr-extension-root')) {
  const container = document.createElement('div');
  container.id = 'zephyr-extension-root';
  // Use z-index that guarantees floating above everything
  container.style.position = 'absolute';
  container.style.zIndex = '2147483647'; // Max z-index
  container.style.top = '0';
  container.style.left = '0';
  container.style.pointerEvents = 'none'; // Let clicks pass through except on children
  document.body.appendChild(container);

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
}
