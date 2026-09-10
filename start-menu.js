/* Start Menu is a registry client. It never creates application windows itself. */
(() => {
  'use strict';
  const OS = window.Aether, trigger = document.getElementById('start-btn');
  const panel = document.createElement('section'); panel.id = 'start-menu'; panel.className = 'glass-panel';
  panel.setAttribute('aria-label', 'Start'); panel.inert = true; panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `<header class="start-profile"><span class="profile-mark" aria-hidden="true">A</span><div><strong>Aether User</strong><span>Local desktop</span></div></header>
    <label class="start-search"><span class="sr-only">Search applications</span><input id="app-search" type="search" placeholder="Search applications" autocomplete="off"></label>
    <div class="start-scroll"><section data-section="pinned"><h2>Pinned</h2><div id="pinned-apps" class="pinned-grid"></div></section>
    <section data-section="recent"><h2>Recently opened</h2><div id="recent-apps"></div></section>
    <section><h2 id="app-list-heading">All applications</h2><div id="all-apps"></div><p id="search-status" role="status" class="start-empty"></p></section></div>
    <footer class="start-system"><button type="button" data-system="desktop">Show desktop</button><button type="button" data-system="restart">Restart Aether</button><button type="button" data-system="power">Power off</button></footer>`;
  document.body.append(panel);
  trigger.setAttribute('aria-controls', panel.id); trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-haspopup', 'dialog'); panel.setAttribute('role', 'dialog');
  const search = panel.querySelector('input'); let opened = false;
  function close(restoreFocus = true) {
    opened = false; panel.classList.remove('open'); panel.inert = true; panel.setAttribute('aria-hidden', 'true');
    trigger.classList.remove('active'); trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  }
  function open() {
    OS.ContextMenu.close(); OS.Popovers.closeAll(); search.value = ''; render();
    opened = true; panel.inert = false; panel.setAttribute('aria-hidden', 'false'); panel.classList.add('open');
    trigger.classList.add('active'); trigger.setAttribute('aria-expanded', 'true'); search.focus();
  }
  function row(app, pinned = false) {
    const wrapper = document.createElement('div'); wrapper.className = 'start-app-row';
    const launch = document.createElement('button'); launch.type = 'button'; launch.className = 'start-app'; launch.dataset.app = app.id;
    launch.innerHTML = OS.icon(app.icon);
    const label = document.createElement('span'); label.textContent = app.name; launch.append(label); launch.title = `${app.description} · v${app.version}`;
    launch.addEventListener('click', () => { close(false); OS.Apps.launch(app.id); });
    wrapper.append(launch);
    if (!pinned) {
      const pin = document.createElement('button'); pin.type = 'button'; pin.className = 'start-pin'; pin.innerHTML = OS.icon('pin');
      pin.setAttribute('aria-label', `${OS.Apps.isPinned(app.id) ? 'Unpin' : 'Pin'} ${app.name}`); pin.setAttribute('aria-pressed', String(OS.Apps.isPinned(app.id)));
      pin.addEventListener('click', () => { OS.Apps.togglePin(app.id); panel.querySelector(`#all-apps [data-app="${app.id}"]`)?.focus(); }); wrapper.append(pin);
    }
    return wrapper;
  }
  function render() {
    const query = search.value.trim().toLowerCase();
    for (const [name, ids] of [['pinned', OS.Apps.pinned()], ['recent', OS.Apps.recent()]]) {
      const list = panel.querySelector(`#${name}-apps`); list.replaceChildren(...ids.map(id => row(OS.Apps.get(id), true)));
      if (!ids.length) { const empty = document.createElement('p'); empty.className = 'start-empty'; empty.textContent = name === 'pinned' ? 'Pin applications from the list below.' : 'Applications you open will appear here.'; list.append(empty); }
      panel.querySelector(`[data-section="${name}"]`).hidden = !!query;
    }
    const matches = OS.Apps.list().filter(app => `${app.name} ${app.description} ${app.id}`.toLowerCase().includes(query));
    panel.querySelector('#all-apps').replaceChildren(...matches.map(app => row(app)));
    panel.querySelector('#app-list-heading').textContent = query ? 'Search results' : 'All applications';
    panel.querySelector('#search-status').textContent = matches.length ? (query ? `${matches.length} applications found` : '') : 'No applications found.';
  }
  trigger.addEventListener('click', () => opened ? close() : open()); search.addEventListener('input', render); OS.Apps.subscribe(render);
  document.addEventListener('pointerdown', e => { if (opened && !panel.contains(e.target) && !trigger.contains(e.target)) close(false); });
  document.addEventListener('keydown', e => { if (opened && e.key === 'Escape') { e.preventDefault(); close(); } });
  panel.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target === search) { e.preventDefault(); panel.querySelector('#all-apps .start-app')?.click(); }
    if (e.key === 'ArrowDown' && e.target === search) { e.preventDefault(); panel.querySelector('#all-apps .start-app')?.focus(); }
  });
  panel.addEventListener('focusout', () => { setTimeout(() => { if (opened && !panel.contains(document.activeElement) && document.activeElement !== trigger) close(false); }, 0); });
  function endSession(powerOff) {
    close(false);
    OS.WindowManager.listWindows().forEach(id => OS.WindowManager.closeWindow(id));
    if (!powerOff) { OS.Icons.render(); OS.Toast.show('Aether restarted'); trigger.focus(); return; }
    const cover = document.createElement('div'); cover.id = 'power-screen';
    cover.innerHTML = '<h1>Aether is powered off</h1><p>This browser desktop is paused.</p><button type="button">Start Aether</button>';
    const siblings = [...document.body.children].filter(el => el !== cover && !['SCRIPT'].includes(el.tagName));
    const prior = siblings.map(el => el.inert); siblings.forEach(el => el.inert = true);
    document.body.append(cover);
    cover.querySelector('button').addEventListener('click', () => { cover.remove(); siblings.forEach((el, i) => el.inert = prior[i]); trigger.focus(); });
    cover.querySelector('button').focus();
  }
  panel.querySelector('[data-system="desktop"]').addEventListener('click', () => { close(false); OS.WindowManager.listWindows().forEach(id => OS.WindowManager.minimizeWindow(id)); document.getElementById('desktop').focus(); });
  panel.querySelector('[data-system="restart"]').addEventListener('click', () => endSession(false));
  panel.querySelector('[data-system="power"]').addEventListener('click', () => endSession(true));
  OS.StartMenu = Object.freeze({ open, close }); render();
})();