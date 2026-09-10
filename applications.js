/* Application metadata, launch lifecycle, and OS service boundary. */
(() => {
  'use strict';
  const OS = window.Aether, registry = new Map();
  const events = new EventTarget();
  const stored = (key, fallback) => { const value = OS.Store.get(key, fallback); return Array.isArray(value) ? value.filter(id => typeof id === 'string') : fallback; };
  let pins = [...new Set(stored('pinnedApps', ['files', 'terminal', 'settings']))];
  let recent = [...new Set(stored('recentApps', []))].slice(0, 5);
  const announce = () => events.dispatchEvent(new Event('change'));
  // Apps receive capabilities, not references to other applications or window chrome.
  const services = Object.freeze({ notify: message => OS.Toast.show(String(message)),
    preferences: Object.freeze({ get: (appId, key, fallback) => OS.Store.get(`app:${appId}:${key}`, fallback), set: (appId, key, value) => OS.Store.set(`app:${appId}:${key}`, value) }) });
  function register(app) {
    if (!app || !/^[a-z][a-z0-9-]*$/.test(app.id) || registry.has(app.id) ||
      !['name', 'icon', 'version', 'description'].every(key => typeof app[key] === 'string' && app[key].trim()) || typeof app.launch !== 'function') throw new TypeError('Invalid or duplicate application');
    registry.set(app.id, Object.freeze({ ...app })); announce();
  }
  function launch(id) {
    const app = registry.get(id);
    if (!app) { services.notify('Application unavailable'); return null; }
    try {
      const result = app.launch(Object.freeze({ notify: services.notify, preferences: Object.freeze({ get: (key, fallback) => services.preferences.get(id, key, fallback), set: (key, value) => services.preferences.set(id, key, value) }) }));
      if (!result || !(result.content instanceof Node)) throw new TypeError('Application must return a content node');
      const windowId = OS.WindowManager.openWindow(app.name, { content: result.content });
      if (typeof result.dispose === 'function') document.getElementById(windowId).addEventListener('aether:close', result.dispose, { once: true });
      recent = [id, ...recent.filter(key => key !== id)].slice(0, 5);
      OS.Store.set('recentApps', recent); announce();
      return windowId;
    } catch (error) { console.error('Application launch failed:', id, error); services.notify(`Could not open ${app.name}`); return null; }
  }
  function togglePin(id) {
    if (!registry.has(id)) return;
    pins = pins.includes(id) ? pins.filter(key => key !== id) : [...pins, id];
    OS.Store.set('pinnedApps', pins); announce();
  }
  OS.Apps = Object.freeze({ register, launch, get: id => registry.get(id), list: () => [...registry.values()],
    pinned: () => pins.filter(id => registry.has(id)), recent: () => recent.filter(id => registry.has(id)),
    isPinned: id => pins.includes(id), togglePin,
    subscribe: listener => { events.addEventListener('change', listener); return () => events.removeEventListener('change', listener); }
  });
  for (const [id, name, icon, description] of [
    ['files', 'File Manager', 'folder', 'Browse and organize your files.'],
    ['terminal', 'Terminal', 'terminal', 'Work with a command-line interface.'],
    ['settings', 'Settings', 'settings', 'Personalize your Aether desktop.'],
    ['notes', 'Notes', 'note', 'Capture ideas and quick notes.'],
    ['photos', 'Photos', 'photo', 'View your image collection.'],
    ['monitor', 'System Monitor', 'gauge', 'Explore system activity.'],
    ['browser', 'Browser', 'compass', 'Browse the web inside Aether.']
  ]) register({ id, name, icon, version: '0.1.0', description, launch() {
    const content = document.createElement('div'); content.className = 'app-placeholder';
    const mark = document.createElement('div'); mark.className = 'app-placeholder-icon'; mark.innerHTML = OS.icon(icon);
    const heading = document.createElement('h2'); heading.textContent = name;
    const text = document.createElement('p'); text.textContent = 'This application is coming in a future phase.';
    content.append(mark, heading, text); return { content };
  } });
})();
