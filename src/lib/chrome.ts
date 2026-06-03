// Mocks for Chrome APIs allowing the app to run in the local web preview (AI Studio)

export const storage = {
  get: async (keys: string | string[] | Record<string, any> | null): Promise<any> => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return await chrome.storage.local.get(keys);
      }
    } catch(e: any) {
      if (!e.message?.includes('Extension context invalidated')) {
        console.error("Chrome storage get error", e);
      }
      return {};
    }
    
    // Mock for web preview
    const local = localStorage.getItem('mock_storage');
    const store = local ? JSON.parse(local) : {};
    const result: Record<string, any> = {};
    
    if (typeof keys === 'string') {
      result[keys] = store[keys];
    } else if (Array.isArray(keys)) {
      keys.forEach(k => result[k] = store[k]);
    } else if (keys !== null && typeof keys === 'object') {
      Object.keys(keys).forEach(k => {
        result[k] = store[k] !== undefined ? store[k] : keys[k];
      });
    } else {
      return store;
    }
    return result;
  },
  set: async (items: Record<string, any>): Promise<void> => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        return await chrome.storage.local.set(items);
      }
    } catch(e: any) {
      if (!e.message?.includes('Extension context invalidated')) {
        console.error("Chrome storage set error", e);
      }
      return;
    }
    
    // Mock for web preview
    const local = localStorage.getItem('mock_storage');
    const store = local ? JSON.parse(local) : {};
    Object.assign(store, items);
    localStorage.setItem('mock_storage', JSON.stringify(store));
  }
};

export const isExtension = typeof chrome !== 'undefined' && !!chrome.runtime && !!chrome.runtime.id;

type MessageListener = (req: any, sender: any, sendResponse: (res: any) => void) => void;
const runtimeListeners: MessageListener[] = [];
const tabsListeners: MessageListener[] = [];

export const runtime = {
  openOptionsPage: () => {
    if (isExtension) {
      chrome.runtime.openOptionsPage();
    } else {
      console.log("[Mock Chrome] openOptionsPage called.");
    }
  },
  sendMessage: (message: any) => {
    if (isExtension) {
      try {
        const result = chrome.runtime.sendMessage(message);
        if (result && typeof result.catch === 'function') {
           result.catch((e: any) => {
             if (!e.message?.includes('Extension context invalidated')) {
               console.error("Chrome sendMessage returned error", e);
             }
           });
        }
        return result;
      } catch (e: any) {
        if (!e.message?.includes('Extension context invalidated')) {
          console.error("Chrome sendMessage sync error", e);
        }
        return Promise.resolve();
      }
    }
    console.log("[Mock Chrome] runtime.sendMessage:", message);
    runtimeListeners.forEach(l => l(message, { tab: { id: 1 } }, () => {}));
    return Promise.resolve({ status: 'mock' });
  },
  onMessage: {
    addListener: (callback: MessageListener) => {
      if (isExtension) {
        chrome.runtime.onMessage.addListener(callback);
      } else {
        runtimeListeners.push(callback);
      }
    },
    removeListener: (callback: MessageListener) => {
      if (isExtension && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(callback);
      } else if (!isExtension) {
        const i = runtimeListeners.indexOf(callback);
        if (i >= 0) runtimeListeners.splice(i, 1);
      }
    }
  }
};

export const tabs = {
  sendMessage: (tabId: number, message: any) => {
    if (isExtension) {
      try {
        const result = chrome.tabs.sendMessage(tabId, message);
        if (result && typeof result.catch === 'function') {
           result.catch((e: any) => {
             if (!e.message?.includes('Extension context invalidated')) {
               console.error("Chrome tabs.sendMessage returned error", e);
             }
           });
        }
        return result;
      } catch (e: any) {
        if (!e.message?.includes('Extension context invalidated')) {
          console.error("Chrome tabs.sendMessage sync error", e);
        }
        return Promise.resolve();
      }
    }
    console.log("[Mock Chrome] tabs.sendMessage:", message);
    tabsListeners.forEach(l => l(message, { tab: { id: 1 } }, () => {}));
    return Promise.resolve();
  },
  onMessage: {
    addListener: (callback: MessageListener) => {
      if (isExtension) {
        // Technically content scripts listen on runtime.onMessage, not tabs.onMessage
        chrome.runtime.onMessage.addListener(callback);
      } else {
        tabsListeners.push(callback);
      }
    },
    removeListener: (callback: MessageListener) => {
      if (isExtension && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(callback);
      } else if (!isExtension) {
        const i = tabsListeners.indexOf(callback);
        if (i >= 0) tabsListeners.splice(i, 1);
      }
    }
  }
};
