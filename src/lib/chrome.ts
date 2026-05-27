// Mocks for Chrome APIs allowing the app to run in the local web preview (AI Studio)

export const storage = {
  get: async (keys: string | string[] | Record<string, any> | null): Promise<any> => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return chrome.storage.sync.get(keys);
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
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return chrome.storage.sync.set(items);
    }
    
    // Mock for web preview
    const local = localStorage.getItem('mock_storage');
    const store = local ? JSON.parse(local) : {};
    Object.assign(store, items);
    localStorage.setItem('mock_storage', JSON.stringify(store));
  }
};

export const runtime = {
  openOptionsPage: () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      console.log("[Mock Chrome] openOptionsPage called.");
    }
  },
  sendMessage: async (message: any) => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      return chrome.runtime.sendMessage(message);
    }
    console.log("[Mock Chrome] sendMessage:", message);
    return { status: 'mock' };
  },
  addMessageListener: (callback: any) => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(callback);
    }
  }
}
