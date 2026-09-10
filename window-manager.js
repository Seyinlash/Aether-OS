/* Reusable window chrome. Applications supply content; this module owns lifecycle. */
(() => {
  'use strict';
  const Aether = window.Aether;
  const layer = document.createElement('div');
  layer.id = 'windows-layer';
  document.body.append(layer);
  const tasks = document.getElementById('task-items');
  const windows = new Map();
  let order = [], active = null, serial = 0, gesture = null;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const area = () => ({ width: layer.clientWidth, height: layer.clientHeight });
  const number = (n, fallback) => Number.isFinite(n) ? n : fallback;

  function fit(rect, record) {
    const a = area();
    const width = clamp(rect.width, Math.min(record.minWidth, a.width), a.width);
    const height = clamp(rect.height, Math.min(record.minHeight, a.height), a.height);
    return { x: clamp(rect.x, 0, a.width - width), y: clamp(rect.y, 0, a.height - height), width, height };
  }
  function render(record) {
    const a = area();
    const r = record.maximized ? { x: 0, y: 0, ...a } : record.rect;
    Object.assign(record.element.style, { left: r.x + 'px', top: r.y + 'px', width: r.width + 'px', height: r.height + 'px' });
    record.element.classList.toggle('maximized', record.maximized);
    record.element.hidden = record.minimized;
    record.element.inert = record.minimized;
    record.task.classList.toggle('minimized', record.minimized);
    record.maxButton.setAttribute('aria-label', record.maximized ? 'Restore' : 'Maximize');
    record.maxButton.title = record.maximized ? 'Restore' : 'Maximize';
    record.maxButton.innerHTML = icon(record.maximized ? 'restore' : 'maximize');
  }
  function sync() {
    order.forEach((id, i) => {
      const r = windows.get(id);
      r.element.style.zIndex = i + 1;
      r.element.classList.toggle('focused', id === active);
      r.task.classList.toggle('active', id === active);
      r.task.setAttribute('aria-pressed', String(id === active));
    });
    tasks.querySelector('.task-hint').hidden = windows.size > 0;
  }
  function focusWindow(id, moveFocus = true) {
    const r = windows.get(id);
    if (!r || r.minimized) return false;
    active = id;
    order = order.filter(key => key !== id).concat(id);
    sync();
    if (moveFocus) (r.lastFocus?.isConnected && !r.lastFocus.disabled ? r.lastFocus : r.element).focus({ preventScroll: true });
    return true;
  }
  function focusNext() {
    active = null;
    const next = [...order].reverse().find(id => !windows.get(id).minimized);
    if (next) focusWindow(next);
    else { sync(); document.getElementById('desktop').focus({ preventScroll: true }); }
  }
  function animate(r, frames) {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      r.element.getAnimations().forEach(a => a.cancel());
      r.element.animate(frames, { duration: 150, easing: 'ease-out' });
    }
  }
  function endGesture() {
    if (!gesture) return;
    const { element, pointerId } = gesture;
    gesture = null;
    element.classList.remove('interacting');
    if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
  }
  function closeWindow(id) {
    const r = windows.get(id);
    if (!r) return false;
    if (gesture?.id === id) endGesture();
    windows.delete(id);
    order = order.filter(key => key !== id);
    r.task.remove();
    // A noninteractive visual copy lets lifecycle cleanup happen immediately.
    if (!r.minimized && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const ghost = r.element.cloneNode(true);
      ghost.removeAttribute('id');
      ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      ghost.inert = true;
      ghost.setAttribute('aria-hidden', 'true');
      ghost.style.pointerEvents = 'none';
      layer.append(ghost);
      ghost.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.98)' }], { duration: 130 }).finished.finally(() => ghost.remove());
    }
    r.element.remove();
    if (active === id) focusNext(); else sync();
    r.element.dispatchEvent(new CustomEvent('aether:close'));
    return true;
  }
  function minimizeWindow(id) {
    const r = windows.get(id);
    if (!r || r.minimized) return false;
    if (gesture?.id === id) endGesture();
    r.minimized = true;
    render(r);
    r.task.animate([{ opacity: .4, transform: 'translateY(-3px)' }, { opacity: 1, transform: 'none' }], { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150 });
    if (active === id) focusNext(); else sync();
    return true;
  }
  function restoreWindow(id) {
    const r = windows.get(id);
    if (!r) return false;
    if (gesture?.id === id) endGesture();
    if (r.minimized) r.minimized = false;
    else r.maximized = false;
    r.rect = fit(r.rect, r);
    render(r); focusWindow(id);
    animate(r, [{ opacity: .65, transform: 'scale(.99)' }, { opacity: 1, transform: 'none' }]);
    return true;
  }
  function maximizeWindow(id) {
    const r = windows.get(id);
    if (!r) return false;
    if (gesture?.id === id) endGesture();
    r.minimized = false; r.maximized = true;
    render(r); focusWindow(id);
    animate(r, [{ opacity: .8 }, { opacity: 1 }]);
    return true;
  }
  function toggleMaximize(id) {
    return windows.get(id)?.maximized ? restoreWindow(id) : maximizeWindow(id);
  }
  function icon(name) {
    const paths = { minimize: '<path d="M5 12h14"/>', maximize: '<rect x="5" y="5" width="14" height="14" rx="1"/>', restore: '<path d="M9 5V3h12v12h-2"/><rect x="3" y="9" width="12" height="12" rx="1"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>' };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${paths[name]}</svg>`;
  }
  function openWindow(title, options = {}) {
    const id = 'aether-window-' + ++serial;
    const element = document.createElement('section');
    element.className = 'os-window'; element.id = id; element.tabIndex = -1;
    element.setAttribute('role', 'dialog'); element.setAttribute('aria-labelledby', id + '-title');
    element.innerHTML = '<header class="window-titlebar"><span class="window-title"></span><div class="window-controls"></div></header><div class="window-content"></div>';
    const titleEl = element.querySelector('.window-title');
    titleEl.id = id + '-title'; titleEl.textContent = String(title);
    const content = element.querySelector('.window-content');
    if (options.content instanceof Node) content.append(options.content);
    else { const p = document.createElement('p'); p.className = 'window-placeholder'; p.textContent = 'This application is coming in a future phase.'; content.append(p); }
    const task = document.createElement('button');
    task.type = 'button'; task.className = 'window-task'; task.textContent = String(title); task.title = String(title);
    task.setAttribute('aria-controls', id);
    const r = { id, element, content, task, minWidth: Math.max(240, number(options.minWidth, 320)), minHeight: Math.max(120, number(options.minHeight, 200)), minimized: false, maximized: false, lastFocus: null };
    r.rect = fit({ x: number(options.x, 140 + (serial - 1) % 8 * 28), y: number(options.y, 48 + (serial - 1) % 8 * 28), width: number(options.width, 640), height: number(options.height, 420) }, r);
    for (const [name, action] of [['minimize', minimizeWindow], ['maximize', toggleMaximize], ['close', closeWindow]]) {
      const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'window-control ' + name;
      btn.title = name[0].toUpperCase() + name.slice(1); btn.setAttribute('aria-label', btn.title); btn.innerHTML = icon(name);
      btn.addEventListener('click', () => action(id));
      element.querySelector('.window-controls').append(btn);
      if (name === 'maximize') r.maxButton = btn;
    }
    for (const edge of ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw']) {
      const handle = document.createElement('div'); handle.className = 'resize-handle ' + edge; handle.dataset.edge = edge; handle.setAttribute('aria-hidden', 'true'); element.append(handle);
    }
    element.addEventListener('focusin', e => { if (e.target !== element) r.lastFocus = e.target; if (active !== id) focusWindow(id, false); });
    element.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      focusWindow(id, false);
      const edge = e.target.closest('.resize-handle')?.dataset.edge;
      if (!edge && (!e.target.closest('.window-titlebar') || e.target.closest('button'))) return;
      if (r.maximized || gesture) return;
      e.preventDefault(); element.focus({ preventScroll: true });
      gesture = { id, element, pointerId: e.pointerId, edge, x: e.clientX, y: e.clientY, rect: { ...r.rect } };
      element.classList.add('interacting');
    });
    element.addEventListener('dblclick', e => { if (e.target.closest('.window-titlebar') && !e.target.closest('button')) toggleMaximize(id); });
    element.addEventListener('lostpointercapture', endGesture);
    task.addEventListener('click', () => r.minimized ? restoreWindow(id) : active === id ? minimizeWindow(id) : focusWindow(id));
    windows.set(id, r); order.push(id); layer.append(element); tasks.append(task);
    render(r); focusWindow(id);
    animate(r, [{ opacity: 0, transform: 'translateY(6px) scale(.985)' }, { opacity: 1, transform: 'none' }]);
    return id;
  }
  window.addEventListener('pointermove', e => {
    const g = gesture;
    if (!g || e.pointerId !== g.pointerId) return;
    const r = windows.get(g.id), a = area(), b = g.rect;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.element.hasPointerCapture(e.pointerId)) {
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
      g.element.setPointerCapture(e.pointerId);
    }
    if (!g.edge) r.rect = fit({ ...b, x: b.x + dx, y: b.y + dy }, r);
    else {
      let left = b.x, top = b.y, right = b.x + b.width, bottom = b.y + b.height;
      const mw = Math.min(r.minWidth, a.width), mh = Math.min(r.minHeight, a.height);
      if (g.edge.includes('w')) left = clamp(b.x + dx, 0, right - mw);
      if (g.edge.includes('e')) right = clamp(right + dx, left + mw, a.width);
      if (g.edge.includes('n')) top = clamp(b.y + dy, 0, bottom - mh);
      if (g.edge.includes('s')) bottom = clamp(bottom + dy, top + mh, a.height);
      r.rect = { x: left, y: top, width: right - left, height: bottom - top };
    }
    render(r);
  });
  for (const event of ['pointerup', 'pointercancel']) window.addEventListener(event, e => { if (e.pointerId === gesture?.pointerId) endGesture(); });
  window.addEventListener('blur', endGesture);
  window.addEventListener('resize', () => { endGesture(); windows.forEach(r => { r.rect = fit(r.rect, r); render(r); }); });
  document.getElementById('desktop').addEventListener('pointerdown', () => { active = null; sync(); });
  Aether.WindowManager = Object.freeze({ openWindow, closeWindow, minimizeWindow, maximizeWindow, restoreWindow, focusWindow,
    getWindow: id => { const r = windows.get(id); return r ? { id, content: r.content, minimized: r.minimized, maximized: r.maximized, focused: active === id, bounds: { ...r.rect } } : null; },
    listWindows: () => [...order]
  });
  window.openWindow = openWindow;
  window.closeWindow = closeWindow;
})();

