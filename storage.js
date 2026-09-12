/* Central persistence boundary. Only this module accesses browser storage. */
(() => {
  'use strict';
  const OS = window.Aether = window.Aether || {}, NS = 'aether:';
  const events = new EventTarget();
  const emit = () => events.dispatchEvent(new Event('change'));
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('aether-storage') : null;
  if (channel) channel.onmessage = emit;
  function changed() { emit(); channel?.postMessage('change'); }
  const settings = Object.freeze({
    get(key, fallback) { try { const raw = localStorage.getItem(NS + key); return raw === null ? fallback : JSON.parse(raw); } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch { OS.Toast?.show('Preference could not be saved: browser storage is unavailable or full.'); return false; } return true; },
    remove(key) { localStorage.removeItem(NS + key); },
    exportAll() { const out = Object.create(null); for (const key of Object.keys(localStorage)) if (key.startsWith(NS)) out[key.slice(NS.length)] = JSON.parse(localStorage.getItem(key)); return out; }
  });
  const roots = ['Desktop', 'Documents', 'Downloads', 'Pictures', 'Videos', 'Music'];
  const seed = () => { const now = Date.now(); return [{ id:'home', parent:null, name:'Home', type:'folder', created:now, modified:now }, ...roots.map(name => ({ id:name.toLowerCase(), parent:'home', name, type:'folder', created:now, modified:now }))]; };
  let opening;
  function db() {
    if (!opening) opening = new Promise((resolve, reject) => {
      if (!window.indexedDB) return reject(new Error('IndexedDB is unavailable in this browser.'));
      const request = indexedDB.open('aether-volume', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('volume'); request.result.createObjectStore('content'); };
      request.onerror = () => { opening = null; reject(new Error('Unable to open Aether storage. Check browser storage permissions.')); };
      request.onblocked = () => OS.Toast?.show('Close other Aether tabs to update storage.');
      request.onsuccess = () => { const database = request.result; database.onversionchange = () => { database.close(); opening = null; }; resolve(database); };
    });
    return opening;
  }
  // Read-modify-write stays in one IndexedDB transaction, including across tabs.
  async function transact(edit, write = false) {
    const database = await db();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('volume', write ? 'readwrite' : 'readonly'), store = tx.objectStore('volume'); let result, failure;
      const request = store.get('nodes');
      request.onsuccess = () => { try { const nodes = request.result || seed(); result = edit(nodes); if (write) store.put(nodes, 'nodes'); } catch (error) { failure = error; tx.abort(); } };
      tx.oncomplete = () => { if (write) changed(); resolve(result); };
      tx.onabort = tx.onerror = () => reject(failure || new Error(tx.error?.name === 'QuotaExceededError' ? 'Browser storage is full. Export or delete some Aether data.' : 'Storage operation failed. Your change was not saved.'));
    });
  }
  const ready = transact(() => undefined, true);
  ready.catch(() => {});
  function node(nodes, id) { const found = nodes.find(n => n.id === id); if (!found) throw new Error('This item no longer exists.'); return found; }
  function folder(nodes, id) { const found = node(nodes, id); if (found.type !== 'folder') throw new Error('Choose a folder.'); return found; }
  function nameOK(name) { if (typeof name !== 'string' || !name.trim() || name !== name.trim() || name.length > 120 || /[\\/\u0000-\u001f]/.test(name) || ['.', '..'].includes(name)) throw new Error('Use a name of 1–120 characters, without slashes or surrounding spaces.'); }
  function unique(nodes, parent, name, except) { nameOK(name); if (nodes.some(n => n.parent === parent && n.id !== except && n.name.toLowerCase() === name.toLowerCase())) throw new Error('An item with that name already exists in this folder.'); }
  function descendants(nodes, id) { const ids = new Set([id]); let previous; do { previous = ids.size; nodes.forEach(n => { if (ids.has(n.parent)) ids.add(n.id); }); } while (previous !== ids.size); return ids; }
  function protectedNode(id) { if (id === 'home' || roots.some(name => name.toLowerCase() === id)) throw new Error('Default volume folders cannot be renamed, moved, or deleted.'); }
  let clipboard = null, wasReplaced = false;
  const fs = Object.freeze({
    ready,
    list: parent => transact(nodes => nodes.filter(n => n.parent === parent)),
    all: () => transact(nodes => nodes),
    get: id => transact(nodes => node(nodes, id)),
    create: (parent, name, type = 'file', content = '') => transact(nodes => {
      folder(nodes, parent); unique(nodes, parent, name);
      if (!['file', 'folder'].includes(type) || typeof content !== 'string') throw new Error('Unsupported file type.');
      const now = Date.now(), item = { id:crypto.randomUUID(), parent, name, type, created:now, modified:now, ...(type === 'file' ? { content, mime:'text/plain' } : {}) }; nodes.push(item); return item;
    }, true),
    rename: (id, name) => transact(nodes => { protectedNode(id); const item = node(nodes, id); unique(nodes, item.parent, name, id); item.name = name; item.modified = Date.now(); }, true),
    write: (id, content, expectedModified) => transact(nodes => { const item = node(nodes, id); if (item.type !== 'file' || typeof content !== 'string') throw new Error('Choose a text file.'); if (expectedModified !== undefined && item.modified !== expectedModified) throw new Error('This file changed in another window. Reopen it before saving.'); item.content = content; item.modified = Math.max(Date.now(), item.modified + 1); return item; }, true),
    delete: id => transact(nodes => { protectedNode(id); node(nodes, id); const ids = descendants(nodes, id); for (let i = nodes.length - 1; i >= 0; i--) if (ids.has(nodes[i].id)) nodes.splice(i, 1); }, true),
    transfer: (id, parent, copy = false) => transact(nodes => {
      const source = node(nodes, id); folder(nodes, parent); if (!copy) protectedNode(id);
      const ids = descendants(nodes, id); if (ids.has(parent)) throw new Error('A folder cannot be placed inside itself.');
      if (!copy && source.parent === parent) return source.id;
      let name = source.name;
      if (copy) { let i = 1; while (nodes.some(n => n.parent === parent && n.name.toLowerCase() === name.toLowerCase())) name = source.name.slice(0, 100) + ` (copy ${i++})`; }
      unique(nodes, parent, name);
      if (!copy) { source.parent = parent; source.modified = Date.now(); return source.id; }
      const mapping = new Map([...ids].map(key => [key, crypto.randomUUID()]));
      const now = Date.now(); nodes.push(...nodes.filter(n => ids.has(n.id)).map(n => ({ ...n, id:mapping.get(n.id), parent:n.id === id ? parent : mapping.get(n.parent), name:n.id === id ? name : n.name, created:now, modified:now })));
      return mapping.get(id);
    }, true),
    search: (query, parent = 'home') => transact(nodes => { const ids = descendants(nodes, parent); return nodes.filter(n => n.id !== parent && ids.has(n.id) && n.name.toLowerCase().includes(query.trim().toLowerCase())); }),
    setClipboard(id, cut = false) { clipboard = { id, cut }; changed(); },
    clipboard: () => clipboard ? { ...clipboard } : null,
    async paste(parent) { if (!clipboard) throw new Error('Copy or cut an item first.'); const clip = clipboard; const id = await fs.transfer(clip.id, parent, !clip.cut); if (clip.cut && clipboard === clip) clipboard = null; changed(); return id; },
    subscribe(listener) { events.addEventListener('change', listener); return () => events.removeEventListener('change', listener); }
  });
  // General structured data store for future Notes, Photos, and other applications.
  async function dataOperation(method, key, value) { const database = await db(); return new Promise((resolve, reject) => { const tx = database.transaction('content', method === 'get' ? 'readonly' : 'readwrite'); const request = tx.objectStore('content')[method](...(method === 'put' ? [value, key] : [key])); tx.oncomplete = () => { if (method !== 'get') changed(); resolve(request.result); }; tx.onerror = tx.onabort = () => reject(new Error('Could not access application data.')); }); }
  async function snapshot() { const database = await db(); return new Promise((resolve, reject) => { const tx = database.transaction(['volume','content']); const nodes = tx.objectStore('volume').get('nodes'), keys = tx.objectStore('content').getAllKeys(), values = tx.objectStore('content').getAll(); tx.oncomplete = () => resolve({ nodes:nodes.result || seed(), data:keys.result.map((key, i) => [key, values.result[i]]) }); tx.onerror = () => reject(tx.error); }); }
  function validate(backup) {
    if (!backup || backup.format !== 'aether-backup' || backup.version !== 1 || !Array.isArray(backup.nodes) || backup.nodes.length > 100000 || !Array.isArray(backup.data) || !backup.settings || typeof backup.settings !== 'object' || Array.isArray(backup.settings)) throw new Error('This is not a supported Aether backup.');
    const ids = new Set(), siblings = new Set();
    for (const n of backup.nodes) {
      if (!n || typeof n.id !== 'string' || !n.id || ids.has(n.id) || !['folder','file'].includes(n.type) || !Number.isFinite(n.created) || !Number.isFinite(n.modified) || (n.type === 'file' && typeof n.content !== 'string')) throw new Error('Backup contains invalid file records.');
      nameOK(n.name); ids.add(n.id); const key = JSON.stringify([n.parent,n.name.toLowerCase()]); if (siblings.has(key)) throw new Error('Backup contains duplicate names.'); siblings.add(key);
    }
    const home = node(backup.nodes, 'home'); if (home.parent !== null || home.name !== 'Home' || home.type !== 'folder') throw new Error('Backup has an invalid Home folder.');
    for (const n of backup.nodes) { const seen = new Set([n.id]); let current = n; while (current.id !== 'home') { current = folder(backup.nodes, current.parent); if (seen.has(current.id)) throw new Error('Backup has a folder cycle.'); seen.add(current.id); } }
    for (const name of roots) { const n = folder(backup.nodes, name.toLowerCase()); if (n.parent !== 'home' || n.name !== name) throw new Error('Backup is missing a default folder.'); }
    const keys = new Set(); for (const entry of backup.data) { if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || keys.has(entry[0])) throw new Error('Invalid application data.'); keys.add(entry[0]); }
    for (const key of Object.keys(backup.settings)) if (['__proto__','constructor','prototype'].includes(key)) throw new Error('Invalid preference key.');
    return backup;
  }
  // Browser localStorage and IndexedDB have no shared transaction. Restore preferences
  // if the database transaction fails; only validated backups reach this boundary.
  async function replace(backup) {
    validate(backup); const database = await db(), previous = settings.exportAll();
    function putSettings(values) { Object.keys(localStorage).filter(k => k.startsWith(NS)).forEach(k => localStorage.removeItem(k)); for (const [k,v] of Object.entries(values)) localStorage.setItem(NS + k, JSON.stringify(v)); }
    try { putSettings(backup.settings); } catch { try { putSettings(previous); } catch {} throw new Error('Not enough browser storage to import preferences.'); }
    try { await new Promise((resolve, reject) => { const tx = database.transaction(['volume','content'],'readwrite'); tx.objectStore('volume').put(backup.nodes,'nodes'); const content = tx.objectStore('content'); content.clear(); backup.data.forEach(([k,v]) => content.put(v,k)); tx.oncomplete = resolve; tx.onerror = tx.onabort = () => reject(new Error('Aether data could not be replaced.')); }); }
    catch (error) { putSettings(previous); throw error; }
    clipboard = null; wasReplaced = true; changed();
  }
  const bytes = value => new TextEncoder().encode(JSON.stringify(value)).length;
  OS.Store = settings;
  OS.Storage = Object.freeze({ settings, fs, ready, get wasReplaced() { return wasReplaced; },
    data: Object.freeze({ get:key => dataOperation('get',key), set:(key,value) => { if (typeof key !== 'string') throw new Error('Use a string data key.'); JSON.stringify(value); return dataOperation('put',key,JSON.parse(JSON.stringify(value))); }, delete:key => dataOperation('delete',key) }),
    async usage() { const snap = await snapshot(); let estimate = {}; try { estimate = await navigator.storage?.estimate() || {}; } catch {} return { volumeBytes:bytes(snap.nodes), contentBytes:bytes(snap.data), settingsBytes:bytes(settings.exportAll()), fileBytes:snap.nodes.filter(n=>n.type==='file').reduce((sum,n)=>sum + new TextEncoder().encode(n.content).length,0), files:snap.nodes.filter(n=>n.type==='file').length, folders:snap.nodes.filter(n=>n.type==='folder').length, browserUsage:estimate.usage, browserQuota:estimate.quota }; },
    async exportData() { return { format:'aether-backup', version:1, exportedAt:new Date().toISOString(), ...await snapshot(), settings:settings.exportAll() }; },
    validateBackup:validate,
    importData:replace,
    reset:() => replace({format:'aether-backup',version:1,nodes:seed(),data:[],settings:{}}),
    subscribe:fs.subscribe
  });
})();