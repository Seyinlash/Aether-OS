/* File Manager is a storage-service client; window lifecycle belongs to the OS. */
(() => {
  'use strict';
  const OS = window.Aether;
  OS.FileManager = Object.freeze({ launch(services) {
    const fs = services.storage.fs, content = document.createElement('div'); content.className = 'file-manager';
    content.innerHTML = `<div class="fm-navigation"><button data-action="back" title="Back" aria-label="Back">←</button><button data-action="forward" title="Forward" aria-label="Forward">→</button><nav class="fm-crumbs" aria-label="Folder path"></nav></div>
      <div class="fm-toolbar"><input class="fm-search" aria-label="Search this folder and subfolders" placeholder="Search this folder…" type="search"><select class="fm-sort" aria-label="Sort files"><option value="name">Name A–Z</option><option value="modified">Recently modified</option><option value="type">Type</option><option value="size">Size: largest first</option></select><button data-action="view" aria-label="Toggle grid/list view">List view</button></div>
      <div class="fm-create"><input class="fm-name" aria-label="File or folder name" placeholder="New name"><button data-action="folder">New folder</button><button data-action="file">New text file</button></div>
      <div class="fm-actions"><button data-action="open">Open</button><button data-action="rename">Rename</button><button data-action="copy">Copy</button><button data-action="cut">Cut</button><button data-action="paste">Paste</button><button data-action="delete">Delete</button><select class="fm-destination" aria-label="Move destination"></select><button data-action="move">Move to</button></div>
      <p class="fm-message" role="status"></p><div class="fm-list" aria-label="Files"></div>
      <section class="fm-editor" hidden><div class="fm-editor-heading"><strong></strong><button data-action="save">Save text</button><button data-action="close-editor">Close editor</button></div><textarea aria-label="File contents" spellcheck="false"></textarea><span class="fm-draft" role="status"></span></section>
      <footer class="fm-footer"><span class="fm-details">Select an item for details.</span><span class="fm-usage"></span></footer>`;
    const $ = selector => content.querySelector(selector), button = action => $(`[data-action="${action}"]`);
    let current = services.initialFolder || 'home', selected = null, history = [current], position = 0, disposed = false, renderId = 0, busy = false;
    let all = [], visible = [], editor = null, dirty = false;
    let view = services.preferences.get('view','grid'), sort = services.preferences.get('sort','name');
    if (!['grid','list'].includes(view)) view = 'grid'; if (!['name','modified','type','size'].includes(sort)) sort = 'name'; $('.fm-sort').value = sort;
    const size = n => n.type === 'file' ? new TextEncoder().encode(n.content).length : 0;
    const format = OS.formatBytes;
    const tell = message => $('.fm-message').textContent = message;
    const path = id => { const parts = []; let n = all.find(n => n.id === id); while (n) { parts.unshift(n); n = all.find(a => a.id === n.parent); } return parts; };
    function controls() {
      button('back').disabled = busy || position === 0; button('forward').disabled = busy || position === history.length - 1;
      for (const action of ['open','rename','copy','cut','delete','move']) button(action).disabled = busy || !selected;
      button('paste').disabled = busy || !fs.clipboard();
      for (const action of ['folder','file','save']) button(action).disabled = busy;
    }
    async function run(action) { if (busy) return; busy = true; controls(); tell(''); try { await action(); } catch (error) { tell(error.message); } finally { busy = false; if (!disposed) { controls(); } } }
    function select(id) {
      selected = id; const item = all.find(n => n.id === id);
      $('.fm-list').querySelectorAll('.fm-item').forEach(el => { el.classList.toggle('selected',el.dataset.id === id); el.setAttribute('aria-pressed',String(el.dataset.id === id)); });
      $('.fm-details').textContent = item ? `${item.name} · ${item.type === 'folder' ? 'Folder' : 'Text file · ' + format(size(item))} · Modified ${new Date(item.modified).toLocaleString()} · ${path(item.parent).map(n=>n.name).join(' / ')}` : 'Select an item for details.';
      controls();
    }
    async function render() {
      const token = ++renderId;
      try {
        const nodes = await fs.all(); if (disposed || token !== renderId) return; all = nodes;
        if (!all.some(n=>n.id === current)) { current = 'home'; history = ['home']; position = 0; }
        const query = $('.fm-search').value.trim().toLowerCase();
        const ids = new Set([current]); if (query) { let count; do { count = ids.size; all.forEach(n => { if (ids.has(n.parent)) ids.add(n.id); }); } while (count !== ids.size); }
        visible = all.filter(n => query ? n.id !== current && ids.has(n.id) && n.name.toLowerCase().includes(query) : n.parent === current);
        visible.sort((a,b) => (sort === 'modified' ? b.modified - a.modified : sort === 'size' ? size(b)-size(a) : sort === 'type' ? a.type.localeCompare(b.type) : 0) || a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'}));
        $('.fm-crumbs').replaceChildren(...path(current).map(n => { const b = document.createElement('button'); b.textContent = n.name; b.type = 'button'; b.addEventListener('click',()=>navigate(n.id)); return b; }));
        const list = $('.fm-list'); list.classList.toggle('list-view',view === 'list'); button('view').textContent = view === 'grid' ? 'List view' : 'Grid view'; list.replaceChildren();
        for (const item of visible) {
          const el = document.createElement('button'); el.type = 'button'; el.className = 'fm-item'; el.dataset.id = item.id;
          el.innerHTML = OS.icon(item.type === 'folder' ? 'folder' : 'note'); const name = document.createElement('span'); name.textContent = item.name;
          const detail = document.createElement('small'); detail.textContent = item.type === 'folder' ? 'Folder' : format(size(item)); el.append(name,detail);
          el.addEventListener('click',()=>select(item.id)); el.addEventListener('dblclick',()=>open(item.id)); el.addEventListener('keydown',e => { if (e.key === 'Enter') { e.preventDefault(); open(item.id); } }); list.append(el);
        }
        if (!visible.length) { const empty = document.createElement('p'); empty.className = 'fm-empty'; empty.textContent = query ? 'No matching files or folders.' : 'This folder is empty. Create a folder or text file above.'; list.append(empty); }
        const destination = $('.fm-destination'), prior = destination.value;
        destination.replaceChildren(...all.filter(n=>n.type==='folder').map(n=>{ const opt=document.createElement('option'); opt.value=n.id; opt.textContent=path(n.id).map(p=>p.name).join(' / '); return opt; }));
        destination.value = all.some(n=>n.id===prior) ? prior : 'home';
        if (!visible.some(n=>n.id===selected)) selected=null; select(selected);
        if (editor && !all.some(n=>n.id===editor.id)) { $('.fm-draft').textContent = 'This file was deleted. Copy any unsaved text before closing.'; button('save').disabled=true; }
        const usage = await services.storage.usage(); if (!disposed && token === renderId) $('.fm-usage').textContent = `Aether Volume · ${format(usage.volumeBytes + usage.contentBytes)} used · ${usage.files} files`;
      } catch (error) { if (!disposed) tell(error.message); }
    }
    function closeEditor() { if (dirty && !confirm('Discard unsaved changes to this text file?')) return false; editor=null; dirty=false; $('.fm-editor').hidden=true; return true; }
    async function navigate(id, remember = true) { if (!closeEditor()) return; try { const folder = await fs.get(id); if (folder.type !== 'folder') throw new Error('Folder no longer exists.'); } catch (error) { tell(error.message); return; } current=id; selected=null; $('.fm-search').value=''; if (remember) { history=history.slice(0,position+1); history.push(id); position=history.length-1; } await render(); }
    async function open(id) { try { const item = await fs.get(id); if (item.type==='folder') return navigate(id); if (!closeEditor()) return; editor=item; $('.fm-editor').hidden=false; $('.fm-editor strong').textContent=item.name; $('.fm-editor textarea').value=item.content; $('.fm-draft').textContent='Saved'; $('.fm-editor textarea').focus(); } catch(error) { tell(error.message); } }
    $('.fm-editor textarea').addEventListener('input',()=>{ dirty=true; $('.fm-draft').textContent='Unsaved changes'; });
    const actions = {
      folder:()=>run(async()=>{ await fs.create(current,$('.fm-name').value,'folder'); $('.fm-name').value=''; await render(); }),
      file:()=>run(async()=>{ const item=await fs.create(current,$('.fm-name').value,'file'); $('.fm-name').value=''; await render(); select(item.id); await open(item.id); }),
      rename:()=>run(async()=>{ await fs.rename(selected,$('.fm-name').value); $('.fm-name').value=''; await render(); }),
      delete:()=>run(async()=>{ const item=await fs.get(selected); if (confirm(`Delete “${item.name}”${item.type==='folder' ? ' and everything inside it' : ''} from Aether Volume? This cannot be undone.`)) { await fs.delete(selected); selected=null; await render(); } }),
      copy:()=>{ fs.setClipboard(selected); tell('Copied. Open a destination folder and choose Paste.'); },
      cut:()=>{ fs.setClipboard(selected,true); tell('Ready to move. Open a destination folder and choose Paste.'); },
      paste:()=>run(async()=>{ await fs.paste(current); await render(); }),
      move:()=>run(async()=>{ await fs.transfer(selected,$('.fm-destination').value); selected=null; await render(); }),
      open:()=>open(selected),
      back:async()=>{ const target=position-1; if(target<0)return; await navigate(history[target],false); if(current===history[target])position=target; controls(); },
      forward:async()=>{ const target=position+1; if(target>=history.length)return; await navigate(history[target],false); if(current===history[target])position=target; controls(); },
      view:()=>{ view=view==='grid'?'list':'grid'; services.preferences.set('view',view); render(); },
      save:()=>run(async()=>{ if (!editor) return; editor=await fs.write(editor.id,$('.fm-editor textarea').value,editor.modified); dirty=false; $('.fm-draft').textContent='Saved to Aether Volume'; await render(); }),
      'close-editor':closeEditor
    };
    content.querySelectorAll('[data-action]').forEach(el=>{el.type='button'; el.addEventListener('click',actions[el.dataset.action]);});
    $('.fm-search').addEventListener('input',()=>{selected=null;render();});
    $('.fm-sort').addEventListener('change',()=>{sort=$('.fm-sort').value;services.preferences.set('sort',sort);render();});
    const unsubscribe=fs.subscribe(render); controls(); render();
    return {content, beforeClose: () => !dirty || confirm('Close this window and discard unsaved text changes?'), dispose(){ disposed=true; unsubscribe(); }};
  } });
})();