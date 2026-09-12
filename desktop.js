(function(){
"use strict";

/* ============================================================================
   AETHER OS - CORE MODULES
   Kept intentionally modular (IIFE namespaces on `Aether`) so Phase 2+
   (window manager, app framework, virtual filesystem) can hook in cleanly
   without touching this file's internals.
   ========================================================================== */
const Aether = window.Aether;

/* ----------------------------------------------------------------------
   Store - thin localStorage wrapper, namespaced. Structured data (files,
   notes, images) will move to IndexedDB in a later phase; this module is
   only for small settings/preferences, per the project's data plan.
   ---------------------------------------------------------------------- */
// Preferences are supplied by storage.js.

/* ----------------------------------------------------------------------
   Toast - lightweight notification pills. Real "Notifications" feature
   (history, actions) arrives in a later phase; this is the primitive.
   ---------------------------------------------------------------------- */
Aether.Toast = (function(){
  const container = document.getElementById("toast-container");
  function show(message, opts){
    opts = opts || {};
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = '<span class="dot"></span><span></span>';
    el.querySelector("span:last-child").textContent = message;
    container.appendChild(el);
    const life = opts.duration || 2600;
    setTimeout(() => {
      el.classList.add("leaving");
      setTimeout(() => el.remove(), 240);
    }, life);
  }
  return { show };
})();

/* ----------------------------------------------------------------------
   Wallpaper - a few preset gradient scenes, cycled from the context menu.
   ---------------------------------------------------------------------- */
Aether.Wallpaper = (function(){
  const presets = [
    { id:"nebula",  css:"radial-gradient(1200px 700px at 15% 10%, #232c52 0%, transparent 60%), radial-gradient(1000px 800px at 85% 90%, #1c2440 0%, transparent 55%), #06070d" },
    { id:"midnight",css:"radial-gradient(1100px 700px at 80% 15%, #1a1f38 0%, transparent 55%), radial-gradient(900px 900px at 10% 95%, #141a30 0%, transparent 60%), #05060b" },
    { id:"aurora",  css:"radial-gradient(1000px 650px at 20% 20%, #26325c 0%, transparent 55%), radial-gradient(1200px 900px at 90% 80%, #24254a 0%, transparent 55%), #07080f" },
    { id:"eclipse", css:"radial-gradient(900px 900px at 50% 30%, #202444 0%, transparent 60%), #060710" }
  ];
  const root = document.getElementById("wallpaper");
  let idx = 0;
  function apply(i){
    idx = ((i % presets.length) + presets.length) % presets.length;
    root.style.setProperty("--wp-base", presets[idx].css);
    root.style.background = presets[idx].css;
    Aether.Store.set("wallpaper", presets[idx].id);
  }
  function next(){
    apply(idx + 1);
    Aether.Toast.show("Wallpaper changed");
  }
  function init(){
    const saved = Aether.Store.get("wallpaper", presets[0].id);
    const i = presets.findIndex(p => p.id === saved);
    apply(i === -1 ? 0 : i);
  }
  return { init, next, presets: presets.map(p=>p.id) };
})();

/* ----------------------------------------------------------------------
   Icon glyphs - small inline line-icon set (no external deps).
   ---------------------------------------------------------------------- */
const GLYPHS = {
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
  terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3"/><path d="M13 15h4"/>',
  note: '<path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h5"/>',
  photo: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5.5-5.5L4 21"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.2 5.8-5.8 2.2 2.2-5.8 5.8-2.2Z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  gauge: '<path d="M12 15V9"/><path d="M8.5 15a3.5 3.5 0 1 1 7 0"/><circle cx="12" cy="15" r="7"/><path d="M12 4v2M4.9 7.9l1.4 1.4M19.1 7.9l-1.4 1.4"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.4-6.4L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.4 6.4L3 16"/><path d="M3 21v-5h5"/>',
  wallpaper: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  monitor: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-5M12 8h.01"/>',
  open: '<path d="M14 3h7v7"/><path d="M10 14 21 3"/><path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6"/>',
  pin: '<path d="M12 17v5"/><path d="M9 3h6l1 5-2 2v3H8v-3L6 8Z"/>',
  arrange: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
};
Aether.icon = svg;
function svg(name, extra){
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" '+(extra||'')+'>'+(GLYPHS[name]||'')+'</svg>';
}

/* ----------------------------------------------------------------------
   Icons - desktop launcher icons. Draggable, selectable, position saved.
   Launchers delegate all window behavior to the shared window manager.
   ---------------------------------------------------------------------- */
Aether.Icons = (function(){
  const layer = document.getElementById("icons-layer");
  const apps = () => Aether.Apps.list().map(app => ({ ...app, label: app.name, glyph: app.icon }));

  const GRID_X = 96, GRID_Y = 104, PAD = 22;
  let selected = null;

  function defaultPositions(){
    const pos = {};
    apps().forEach((app, i) => {
      pos[app.id] = { col: 0, row: i };
    });
    return pos;
  }

  function render(){
    const stored = Aether.Store.get("iconPositions", defaultPositions());
    const saved = stored && typeof stored === "object" ? stored : defaultPositions();
    layer.innerHTML = "";
    apps().forEach(app => {
      const p = saved[app.id] || { col:0, row:0 };
      const el = document.createElement("div");
      el.className = "icon";
      el.tabIndex = 0;
      el.dataset.app = app.id;
      el.style.left = (PAD + p.col * GRID_X) + "px";
      el.style.top  = (PAD + p.row * GRID_Y) + "px";
      el.innerHTML =
        '<div class="icon-glyph">'+ svg(app.glyph) +'</div>'+
        '<div class="icon-label">'+ app.label +'</div>';
      layer.appendChild(el);
      makeDraggable(el, app.id, saved);
    });
  }

  function select(el){
    if(selected) selected.classList.remove("selected");
    selected = el;
    if(el) el.classList.add("selected");
  }

  function openApp(id, label){
    return Aether.Apps.launch(id);
  }

  function makeDraggable(el, id, savedPositions){
    let dragging = false, moved = false;
    let startX=0, startY=0, origLeft=0, origTop=0;

    el.addEventListener("pointerdown", (e) => {
      if(e.button !== 0) return;
      select(el);
      dragging = true; moved = false;
      startX = e.clientX; startY = e.clientY;
      origLeft = el.offsetLeft; origTop = el.offsetTop;
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener("pointermove", (e) => {
      if(!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if(Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      if(!moved) return;
      el.classList.add("dragging");
      const desktop = document.getElementById("desktop");
      const maxLeft = desktop.clientWidth - el.offsetWidth - 4;
      const maxTop  = desktop.clientHeight - el.offsetHeight - 4;
      el.style.left = Math.max(4, Math.min(maxLeft, origLeft + dx)) + "px";
      el.style.top  = Math.max(4, Math.min(maxTop, origTop + dy)) + "px";
    });

    el.addEventListener("pointerup", (e) => {
      if(!dragging) return;
      dragging = false;
      el.classList.remove("dragging");
      if(moved){
        // snap to nearest grid cell
        const col = Math.round((el.offsetLeft - PAD) / GRID_X);
        const row = Math.round((el.offsetTop - PAD) / GRID_Y);
        el.style.left = (PAD + Math.max(0,col) * GRID_X) + "px";
        el.style.top  = (PAD + Math.max(0,row) * GRID_Y) + "px";
        savedPositions[id] = { col: Math.max(0,col), row: Math.max(0,row) };
        Aether.Store.set("iconPositions", savedPositions);
      } else {
        // treat as click -> double-click detection
        const now = Date.now();
        if(el._lastClick && now - el._lastClick < 380){
          const app = apps().find(a => a.id === id);
          openApp(id, app && app.label);
        }
        el._lastClick = now;
      }
    });

    el.addEventListener("keydown", (e) => {
      if(e.key === "Enter"){
        const app = apps().find(a => a.id === id);
        openApp(id, app && app.label);
      }
    });

    el.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      select(el);
      Aether.ContextMenu.openIconMenu(e.clientX, e.clientY, id);
    });
  }

  function autoArrange(){
    const pos = defaultPositions();
    Aether.Store.set("iconPositions", pos);
    render();
    Aether.Toast.show("Icons arranged");
  }

  function clearSelection(){ select(null); }
  function getApp(id){ return apps().find(a => a.id === id); }
  function openSelected(id){ const a = getApp(id); openApp(id, a && a.label); }

  return { render, autoArrange, clearSelection, getApp, openApp, openSelected, get APPS(){ return apps(); } };
})();

/* ----------------------------------------------------------------------
   ContextMenu - desktop background menu + per-icon menu.
   ---------------------------------------------------------------------- */
Aether.ContextMenu = (function(){
  const desktopMenu = document.getElementById("menu-desktop");
  const iconMenu = document.getElementById("menu-icon");
  const desktop = document.getElementById("desktop");

  function item(label, glyphName, onClick, extraHTML){
    const btn = document.createElement("button");
    btn.className = "menu-item";
    btn.type = "button";
    btn.setAttribute("role","menuitem");
    btn.innerHTML = svg(glyphName) + "<span>"+label+"</span>" + (extraHTML||"");
    btn.addEventListener("click", () => { close(); onClick && onClick(); });
    return btn;
  }
  function sep(){ const d = document.createElement("div"); d.className="menu-sep"; return d; }

  function place(menu, x, y){
    menu.hidden = false;
    const r = menu.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight - 60; // stay above taskbar
    menu.style.left = Math.min(x, vw - r.width - 8) + "px";
    menu.style.top  = Math.min(y, vh - r.height - 8) + "px";
  }

  function close(){
    desktopMenu.hidden = true;
    iconMenu.hidden = true;
  }

  function openDesktopMenu(x, y){
    close();
    desktopMenu.innerHTML = "";
    desktopMenu.appendChild(item("New Folder", "folder", () => {
      const name = prompt("Name for the new folder in Aether Home / Desktop:", "New Folder");
      if (name !== null) Aether.Storage.fs.create("desktop", name, "folder").then(() => Aether.Apps.launch("files", { folder: "desktop" })).catch(error => Aether.Toast.show(error.message));
    }));
    desktopMenu.appendChild(item("Refresh", "refresh", () => {
      Aether.Icons.render();
      Aether.Toast.show("Desktop refreshed");
    }));
    desktopMenu.appendChild(item("Auto-arrange Icons", "arrange", Aether.Icons.autoArrange));
    desktopMenu.appendChild(sep());
    desktopMenu.appendChild(item("Next Wallpaper", "wallpaper", Aether.Wallpaper.next));
    desktopMenu.appendChild(item("Display Settings", "monitor", () => {
      Aether.Apps.launch("settings");
    }));
    desktopMenu.appendChild(sep());
    desktopMenu.appendChild(item("About Aether OS", "info", Aether.About.open));
    place(desktopMenu, x, y);
  }

  function openIconMenu(x, y, appId){
    close();
    const app = Aether.Icons.getApp(appId);
    iconMenu.innerHTML = "";
    iconMenu.appendChild(item("Open", "open", () => Aether.Icons.openSelected(appId)));
    iconMenu.appendChild(item(Aether.Apps.isPinned(appId) ? "Unpin from Start" : "Pin to Start", "pin", () => {
      Aether.Apps.togglePin(appId);
    }));
    iconMenu.appendChild(sep());
    iconMenu.appendChild(item("Properties", "info", () => {
      Aether.Toast.show((app ? app.label : "This item") + " - properties arrive with the file manager");
    }));
    place(iconMenu, x, y);
  }

  desktop.addEventListener("contextmenu", (e) => {
    if(e.target.closest(".icon")) return; // handled by icon's own listener
    e.preventDefault();
    Aether.Icons.clearSelection();
    openDesktopMenu(e.clientX, e.clientY);
  });

  document.addEventListener("pointerdown", (e) => {
    if(!e.target.closest(".context-menu")) close();
  });
  window.addEventListener("blur", close);
  document.addEventListener("keydown", (e) => { if(e.key === "Escape") close(); });

  return { openIconMenu, openDesktopMenu, close };
})();

/* ----------------------------------------------------------------------
   Marquee selection - drag on empty desktop to select multiple icons
   (visual only for now; multi-select actions arrive with the file manager)
   ---------------------------------------------------------------------- */
(function(){
  const desktop = document.getElementById("desktop");
  const box = document.getElementById("select-box");
  let active = false, sx=0, sy=0;

  desktop.addEventListener("pointerdown", (e) => {
    if(e.button !== 0) return;
    if(e.target.closest(".icon") || e.target.closest(".context-menu")) return;
    active = true; sx = e.clientX; sy = e.clientY;
    box.style.left = sx+"px"; box.style.top = sy+"px";
    box.style.width = "0px"; box.style.height = "0px";
    box.style.display = "block";
    Aether.Icons.clearSelection();
  });
  desktop.addEventListener("pointermove", (e) => {
    if(!active) return;
    const x = Math.min(e.clientX, sx), y = Math.min(e.clientY, sy);
    const w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy);
    box.style.left = x+"px"; box.style.top = y+"px";
    box.style.width = w+"px"; box.style.height = h+"px";
  });
  window.addEventListener("pointerup", () => {
    if(!active) return;
    active = false;
    box.style.display = "none";
  });
})();

/* ----------------------------------------------------------------------
   About panel
   ---------------------------------------------------------------------- */
Aether.About = (function(){
  const panel = document.getElementById("about-panel");
  const scrim = document.getElementById("scrim");
  function open(){ panel.classList.add("open"); scrim.classList.add("open"); }
  function close(){ panel.classList.remove("open"); scrim.classList.remove("open"); }
  document.getElementById("about-close").addEventListener("click", close);
  scrim.addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if(e.key === "Escape") close(); });
  return { open, close };
})();

/* ----------------------------------------------------------------------
   Clock + Calendar popover
   ---------------------------------------------------------------------- */
Aether.Clock = (function(){
  const timeEl = document.getElementById("clock-time");
  const dateEl = document.getElementById("clock-date");
  const btn = document.getElementById("clock-btn");
  const pop = document.getElementById("calendar-popover");

  function tick(){
    const d = new Date();
    let h = d.getHours(); const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12; if(h === 0) h = 12;
    const m = String(d.getMinutes()).padStart(2,"0");
    timeEl.textContent = h + ":" + m + " " + ampm;
    dateEl.textContent = d.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
  }

  function renderCalendar(){
    const d = new Date();
    const monthEl = document.getElementById("cal-month");
    const grid = document.getElementById("cal-grid");
    monthEl.textContent = d.toLocaleDateString(undefined, { month:"long", year:"numeric" });
    grid.innerHTML = "";
    ["S","M","T","W","T","F","S"].forEach(dow => {
      const s = document.createElement("div"); s.className="dow"; s.textContent=dow; grid.appendChild(s);
    });
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    for(let i=0;i<startPad;i++){
      const p = document.createElement("div"); p.className="day pad"; grid.appendChild(p);
    }
    for(let day=1; day<=daysInMonth; day++){
      const cell = document.createElement("div");
      cell.className = "day" + (day === d.getDate() ? " today" : "");
      cell.textContent = day;
      grid.appendChild(cell);
    }
  }

  function toggle(){
    const isOpen = pop.classList.contains("open");
    Aether.Popovers.closeAll();
    if(isOpen) return;
    renderCalendar();
    Aether.Popovers.openNear(pop, btn);
  }

  btn.addEventListener("click", toggle);

  function init(){ tick(); setInterval(tick, 15000); }
  return { init };
})();

/* ----------------------------------------------------------------------
   Popovers helper - shared positioning + exclusive open/close
   ---------------------------------------------------------------------- */
Aether.Popovers = (function(){
  const all = [
    document.getElementById("volume-popover"),
    document.getElementById("calendar-popover")
  ];
  function closeAll(){ all.forEach(p => p.classList.remove("open")); }
  function openNear(pop, anchorEl){
    const r = anchorEl.getBoundingClientRect();
    pop.style.right = (window.innerWidth - r.right) + "px";
    pop.style.bottom = (window.innerHeight - r.top + 10) + "px";
    pop.style.left = "auto"; pop.style.top = "auto";
    pop.classList.add("open");
  }
  document.addEventListener("pointerdown", (e) => {
    if(e.target.closest(".popover") || e.target.closest("#tray-volume") || e.target.closest("#clock-btn")) return;
    closeAll();
  });
  document.addEventListener("keydown", (e) => { if(e.key === "Escape") closeAll(); });
  return { closeAll, openNear };
})();

/* ----------------------------------------------------------------------
   Tray - wifi (static), volume (functional slider + storage), battery
   ---------------------------------------------------------------------- */
Aether.Tray = (function(){
  const volBtn = document.getElementById("tray-volume");
  const volPop = document.getElementById("volume-popover");
  const volRange = document.getElementById("volume-range");
  const volVal = document.getElementById("volume-val");
  const battPct = document.getElementById("tray-battery-pct");
  const battFill = document.getElementById("battery-fill");
  const battWrap = document.getElementById("tray-battery");

  function initVolume(){
    const saved = Aether.Store.get("volume", 70);
    volRange.value = saved;
    volVal.textContent = saved + "%";
    volRange.addEventListener("input", () => {
      volVal.textContent = volRange.value + "%";
      Aether.Store.set("volume", Number(volRange.value));
    });
    volBtn.addEventListener("click", () => {
      const isOpen = volPop.classList.contains("open");
      Aether.Popovers.closeAll();
      if(!isOpen) Aether.Popovers.openNear(volPop, volBtn);
    });
  }

  function initBattery(){
    if(!("getBattery" in navigator)){ battWrap.style.display = "none"; return; }
    navigator.getBattery().then(bat => {
      function update(){
        const pct = Math.round(bat.level * 100);
        battPct.textContent = pct + "%";
        battFill.setAttribute("width", Math.max(1, Math.round(11 * bat.level)));
      }
      update();
      bat.addEventListener("levelchange", update);
      bat.addEventListener("chargingchange", update);
    }).catch(() => { battWrap.style.display = "none"; });
  }

  function initWifi(){
    const btn = document.getElementById("tray-wifi");
    btn.addEventListener("click", () => {
      Aether.Toast.show(navigator.onLine === false ? "No network connection" : "Network: Connected");
    });
  }

  function init(){ initVolume(); initBattery(); initWifi(); }
  return { init };
})();

/* ----------------------------------------------------------------------
   Boot
   ---------------------------------------------------------------------- */
function init(){
  Aether.applyAppearance();
  Aether.Icons.render();
  Aether.Clock.init();
  Aether.Tray.init();

  window.addEventListener("resize", () => {
    // keep icons within bounds on resize (simple re-clamp)
    document.querySelectorAll(".icon").forEach(el => {
      const desktop = document.getElementById("desktop");
      const maxLeft = desktop.clientWidth - el.offsetWidth - 4;
      const maxTop  = desktop.clientHeight - el.offsetHeight - 4;
      el.style.left = Math.max(4, Math.min(maxLeft, el.offsetLeft)) + "px";
      el.style.top  = Math.max(4, Math.min(maxTop, el.offsetTop)) + "px";
    });
  });

  setTimeout(() => {
    document.getElementById("boot-screen").remove();
  }, 2900);
}

document.addEventListener("DOMContentLoaded", init);
})();