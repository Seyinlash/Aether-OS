(() => {
  'use strict';
  const OS = window.Aether, key = 'system:notifications';
  const button = document.createElement('button');
  button.id = 'notification-toggle'; button.className = 'tray-btn'; button.title = 'Notifications';
  button.setAttribute('aria-label', 'Notifications'); button.setAttribute('aria-expanded', 'false');
  button.textContent = '☷'; document.getElementById('tray').prepend(button);
  const panel = document.createElement('section'); panel.id = 'notification-center'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Notification center'); panel.setAttribute('role', 'dialog');
  panel.innerHTML = '<header><h2>Notifications</h2><button data-action="read">Mark all read</button><button data-action="clear">Clear</button><button data-action="close" aria-label="Close notifications">×</button></header><div class="notification-list"></div>';
  document.body.append(panel); button.setAttribute('aria-controls', panel.id);
  let sequence = 0;
  async function render() {
    const ticket = ++sequence;
    try {
      const items = await OS.Storage.data.get(key) || []; if(ticket !== sequence) return;
      const unread = items.filter(n => !n.read).length;
      button.textContent = unread ? `☷ ${unread}` : '☷'; button.setAttribute('aria-label', `Notifications, ${unread} unread`);
      const list = panel.querySelector('.notification-list'); list.replaceChildren();
      for(const n of items) {
        const row = document.createElement('article'); row.className = n.read ? '' : 'unread';
        const heading = document.createElement('strong'); heading.textContent = n.title;
        const text = document.createElement('p'); text.textContent = n.message;
        const time = document.createElement('small'); time.textContent = new Date(n.time).toLocaleString();
        const dismiss = document.createElement('button'); dismiss.textContent = 'Dismiss';
        dismiss.onclick = () => change(items => items.filter(item => item.id !== n.id));
        row.append(heading,text,time,dismiss); list.append(row);
      }
      if(!items.length) list.textContent = 'No notifications.';
    } catch(error) { OS.Toast.show(error.message); }
  }
  async function change(fn) { try { await OS.Storage.data.update(key, items => fn(items || [])); } catch(error) { OS.Toast.show(error.message); } }
  function close() { panel.hidden = true; button.setAttribute('aria-expanded','false'); }
  button.onclick = () => { panel.hidden = !panel.hidden; button.setAttribute('aria-expanded', String(!panel.hidden)); if(!panel.hidden){ OS.StartMenu?.close(false); render(); panel.querySelector('button').focus(); } };
  panel.querySelector('[data-action="read"]').onclick = () => change(items => items.map(n => ({...n,read:true})));
  panel.querySelector('[data-action="clear"]').onclick = () => change(() => []);
  panel.querySelector('[data-action="close"]').onclick = () => { close(); button.focus(); };
  document.addEventListener('pointerdown', e => { if(!panel.contains(e.target) && !button.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && !panel.hidden){close();button.focus();} });
  OS.Notifications = Object.freeze({
    async notify(value) {
      const n = typeof value === 'string' ? {message:value} : value || {};
      const record = {id:crypto.randomUUID(),title:String(n.title || 'Aether OS').slice(0,160),message:String(n.message || '').slice(0,2000),time:Date.now(),read:false};
      OS.Toast.show(`${record.title}: ${record.message}`);
      try { await OS.Storage.data.update(key, items => [record,...(items || [])].slice(0,100)); } catch(error) { OS.Toast.show('Notification history could not be saved.'); }
      return record.id;
    }
  });
  OS.notify = OS.Notifications.notify; window.notify = OS.notify;
  OS.Storage.subscribe(render); render();
})();