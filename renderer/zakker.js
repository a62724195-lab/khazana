/* ذكّرني: تذكيرات + ملفات + نصوص + مزامنة (Supabase). يشتغل على ويندوز (Electron) وعلى الجوال (PWA) بنفس الملف */
(function () {
  'use strict';
  const SQL = `create table if not exists public.zk_items (
  id text primary key,
  user_id uuid not null default auth.uid(),
  data jsonb not null,
  updated_at bigint not null,
  deleted boolean not null default false
);
alter table public.zk_items enable row level security;
create policy "zk own rows" on public.zk_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists zk_items_user_updated on public.zk_items (user_id, updated_at);

insert into storage.buckets (id, name, public) values ('zk-files', 'zk-files', false)
  on conflict (id) do nothing;
create policy "zk files read" on storage.objects for select to authenticated
  using (bucket_id = 'zk-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "zk files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'zk-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "zk files update" on storage.objects for update to authenticated
  using (bucket_id = 'zk-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "zk files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'zk-files' and (storage.foldername(name))[1] = auth.uid()::text);`;

  const MAX_FILE = 20 * 1024 * 1024;
  const T = { items: [], root: null, opts: {}, cfg: {}, ringing: null, beepT: null, actx: null, syncing: false, status: '', tab: 'r', whenTs: null, dayOff: 0, rep: 0, urls: {}, fetching: new Set(), started: false, syncT: 0 };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = ts => new Date(ts).toLocaleString('ar-SA-u-ca-gregory', { weekday: 'short', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' });
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
  const q = s => T.root && T.root.querySelector(s);
  const vis = () => T.items.filter(i => !i.deleted);

  /* ---------- تخزين محلي (IndexedDB) ---------- */
  let _db;
  const db = () => _db || (_db = new Promise((res, rej) => {
    const r = indexedDB.open('zakker', 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('items')) d.createObjectStore('items', { keyPath: 'id' }); if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const tx = (store, mode, fn) => db().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, mode); const rq = fn(t.objectStore(store));
    t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
  const idbAll = s => tx(s, 'readonly', o => o.getAll());
  const idbGet = (s, k) => tx(s, 'readonly', o => o.get(k));
  const idbPut = (s, v, k) => tx(s, 'readwrite', o => k === undefined ? o.put(v) : o.put(v, k));
  const idbDel = (s, k) => tx(s, 'readwrite', o => o.delete(k));
  const saveItem = it => idbPut('items', it);

  async function addItem(o) {
    const it = { id: uid(), ts: Date.now(), updated: Date.now(), dirty: 1, deleted: false, ...o };
    T.items.push(it); await saveItem(it); render(); scheduleSync(); return it;
  }
  async function updItem(id, patch) {
    const it = T.items.find(i => i.id === id); if (!it) return;
    Object.assign(it, patch, { updated: Date.now(), dirty: 1 }); await saveItem(it); render(); scheduleSync();
  }
  async function delItem(id) {
    const it = T.items.find(i => i.id === id); if (!it) return;
    Object.assign(it, { deleted: true, updated: Date.now(), dirty: 1 });
    if (it.type === 'file') { try { await idbDel('blobs', id); } catch (e) {} if (T.urls[id]) { URL.revokeObjectURL(T.urls[id]); delete T.urls[id]; } }
    await saveItem(it); render(); scheduleSync();
  }

  /* ---------- محلل الجمل العربية ---------- */
  function parse(s) {
    s = s.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/^\s*(ذكرني|ذكّرني|نبهني|نبّهني)\s*/, '');
    let ts = null, m, day = null, rest = s;
    if (m = rest.match(/بعد\s*(\d+)?\s*(ساعتين|نص\s*ساعة|نصف\s*ساعة|دقيقتين|دقيقة|دقايق|دقائق|ساعات|ساعة|ساعه)/)) {
      const n = m[1] ? +m[1] : 1, u = m[2];
      const mins = /ساعتين/.test(u) ? 120 : /نص/.test(u) ? 30 : /دقيقتين/.test(u) ? 2 : /دق/.test(u) ? n : n * 60;
      ts = Date.now() + mins * 60000; rest = rest.replace(m[0], ' ');
    } else {
      if (/بعد\s*(بكرة|بكره|غدا|غداً)/.test(rest)) { day = 2; rest = rest.replace(/بعد\s*(بكرة|بكره|غدا|غداً)/, ' '); }
      else if (/(بكرة|بكره|غدا|غداً)/.test(rest)) { day = 1; rest = rest.replace(/(بكرة|بكره|غدا|غداً)/, ' '); }
      else if (/اليوم/.test(rest)) { day = 0; rest = rest.replace(/اليوم/, ' '); }
      const c = rest.match(/(?:الساعة|الساعه)\s*(\d{1,2})(?::(\d{2}))?\s*(صباحا|صباحاً|الصبح|الفجر|ص|العصر|عصرا|مساء|مساءً|المغرب|الليل|ليلا|بعد الظهر|الظهر|م)?/);
      if (c) {
        let h = +c[1], mi = c[2] ? +c[2] : 0; const k = c[3] || ''; const d = new Date(); d.setSeconds(0, 0);
        const pm = /عصر|مساء|المغرب|الليل|ليلا|بعد الظهر|^م$/.test(k), am = /صباح|الصبح|الفجر|^ص$/.test(k);
        if (pm && h < 12) h += 12; if (am && h == 12) h = 0; if (/^الظهر$/.test(k) && h < 11) h += 12;
        d.setDate(d.getDate() + (day || 0)); d.setHours(h, mi);
        if (!pm && !am && h < 12 && day === null) { if (d.getTime() <= Date.now()) d.setHours(h + 12); }
        if (d.getTime() <= Date.now() && !day) d.setDate(d.getDate() + 1);
        ts = d.getTime(); rest = rest.replace(c[0], ' ');
      } else if (day) { const d = new Date(); d.setSeconds(0, 0); d.setDate(d.getDate() + day); d.setHours(9, 0); ts = d.getTime(); }
    }
    const title = rest.replace(/\s+/g, ' ').trim();
    return { ts, title: title || s };
  }
  const nextState = r => { if (r.rep) { let w = r.when; while (w <= Date.now()) w += r.rep * 864e5; return { when: w, done: false }; } return { done: true }; };

  /* ---------- المنبّه ---------- */
  function beep() {
    try { T.actx = T.actx || new (window.AudioContext || window.webkitAudioContext)(); const o = T.actx.createOscillator(), g = T.actx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(T.actx.destination); g.gain.setValueAtTime(.3, T.actx.currentTime); o.start(); o.stop(T.actx.currentTime + .25); } catch (_) {}
    try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (_) {}
  }
  async function notify(title) {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      let reg = null; try { reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); } catch (_) {}
      if (reg && reg.showNotification) reg.showNotification('⏰ ' + title, { body: 'ذكّرني', vibrate: [300, 150, 300], tag: 'zk', renotify: true });
      else new Notification('⏰ ' + title);
    } catch (_) {}
  }
  function ringEl() {
    let el = document.getElementById('zk-ring');
    if (!el) {
      el = document.createElement('div'); el.id = 'zk-ring';
      el.innerHTML = '<div class="zk-ringbox"><div style="font-size:48px">⏰</div><h2 id="zk-rn"></h2><div class="zk-rbtns"><button class="zk-btn" id="zk-rok">تم</button><button class="zk-btn zk-alt" id="zk-rsn">أجّل ١٠ دقايق</button></div></div>';
      document.body.appendChild(el);
      el.querySelector('#zk-rok').onclick = async () => { const r = T.ringing; stopRing(); if (r) await updItem(r.id, nextState(r)); };
      el.querySelector('#zk-rsn').onclick = async () => { const r = T.ringing; stopRing(); if (r) await updItem(r.id, { when: Date.now() + 600000, done: false }); };
    }
    return el;
  }
  function ring(r) {
    T.ringing = r; const el = ringEl(); el.querySelector('#zk-rn').textContent = r.title; el.style.display = 'flex';
    beep(); clearInterval(T.beepT); T.beepT = setInterval(beep, 1000); notify(r.title);
    try { T.opts.onRing && T.opts.onRing(r); } catch (_) {}
  }
  function stopRing() { clearInterval(T.beepT); T.ringing = null; const el = document.getElementById('zk-ring'); if (el) el.style.display = 'none'; }
  function tick() {
    if (T.ringing) {
      const cur = T.items.find(i => i.id === T.ringing.id);
      if (!cur || cur.deleted || cur.done || cur.when > Date.now()) stopRing();
      return;
    }
    const due = vis().find(i => i.type === 'reminder' && !i.done && i.when <= Date.now() && Date.now() - i.when < 6 * 3600e3);
    if (due) ring(due);
  }

  /* ---------- المزامنة (Supabase) ---------- */
  const loadCfg = () => { try { T.cfg = JSON.parse(localStorage.getItem('zk.cfg')) || {}; } catch (e) { T.cfg = {}; } };
  const saveCfg = () => { try { localStorage.setItem('zk.cfg', JSON.stringify(T.cfg)); } catch (e) {} };
  const base = () => T.cfg.url.replace(/\/+$/, '');
  function setStatus(s) { T.status = s; const el = document.getElementById('zk-st'); if (el) el.textContent = s; try { T.opts.onStatus && T.opts.onStatus(s); } catch (_) {} }
  const errMsg = async r => { let t = ''; try { const j = await r.json(); t = j.message || j.msg || j.error_description || j.error || JSON.stringify(j); } catch (e) { t = 'HTTP ' + r.status; } return t; };
  function normUrl(u) { u = (u || '').trim().replace(/\/+$/, '').replace(/\/(rest|auth|storage)\/v1.*$/, ''); if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u; return u; }
  async function authCall(kind, email, password) {
    const r = await fetch(base() + (kind === 'signup' ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password'), { method: 'POST', headers: { apikey: T.cfg.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!r.ok) throw new Error(await errMsg(r));
    const j = await r.json();
    if (!j.access_token) throw new Error('انعمل الحساب لكن Supabase يطلب تأكيد البريد. من لوحة Supabase: Authentication ← Sign In / Providers ← Email ← أوقف «Confirm email» ثم اضغط «دخول».');
    return { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000, uid: j.user.id };
  }
  async function refreshTok() {
    const r = await fetch(base() + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: T.cfg.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: T.cfg.session.refresh }) });
    if (!r.ok) { T.cfg.session = null; saveCfg(); throw new Error('انتهت الجلسة، سجّل دخولك من جديد'); }
    const j = await r.json(); T.cfg.session = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000, uid: T.cfg.session.uid }; saveCfg();
  }
  async function api(path, opts = {}) {
    if (!T.cfg.session) throw new Error('غير مسجّل');
    if (Date.now() > T.cfg.session.exp - 60000) await refreshTok();
    const r = await fetch(base() + path, { ...opts, headers: { apikey: T.cfg.key, Authorization: 'Bearer ' + T.cfg.session.access, ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(await errMsg(r));
    return r;
  }
  const remoteKey = it => T.cfg.session.uid + '/' + it.id;
  async function push() {
    const dirty = T.items.filter(i => i.dirty); if (!dirty.length) return;
    const rows = [];
    for (const it of dirty) {
      if (it.type === 'file' && !it.deleted && !it.uploaded) {
        const blob = await idbGet('blobs', it.id);
        if (blob) { await api('/storage/v1/object/zk-files/' + remoteKey(it), { method: 'POST', headers: { 'x-upsert': 'true', 'Content-Type': it.ctype || 'application/octet-stream' }, body: blob }); it.uploaded = 1; }
      }
      if (it.type === 'file' && it.deleted && it.uploaded) { try { await api('/storage/v1/object/zk-files/' + remoteKey(it), { method: 'DELETE' }); it.uploaded = 0; } catch (e) {} }
      const { dirty: _d, uploaded: _u, ...data } = it;
      rows.push({ id: it.id, data, updated_at: it.updated, deleted: !!it.deleted });
    }
    await api('/rest/v1/zk_items?on_conflict=id', { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows) });
    for (const it of dirty) { const cur = T.items.find(i => i.id === it.id); if (cur && cur.updated === it.updated) { cur.dirty = 0; cur.uploaded = it.uploaded; await saveItem(cur); } }
  }
  async function pull() {
    let since = Math.max(0, (T.cfg.cursor || 0) - 600000), changed = false;
    for (let loop = 0; loop < 20; loop++) {
      const r = await api('/rest/v1/zk_items?select=id,data,updated_at,deleted&updated_at=gt.' + since + '&order=updated_at.asc&limit=1000');
      const rows = await r.json();
      for (const row of rows) {
        const local = T.items.find(i => i.id === row.id);
        if (!local || row.updated_at > local.updated) {
          const it = { ...row.data, id: row.id, updated: row.updated_at, deleted: !!row.deleted, dirty: 0, uploaded: row.data.type === 'file' ? 1 : 0 };
          if (local) T.items[T.items.indexOf(local)] = it; else T.items.push(it);
          if (it.deleted && it.type === 'file') { try { await idbDel('blobs', it.id); } catch (e) {} }
          await saveItem(it); changed = true;
        }
        T.cfg.cursor = Math.max(T.cfg.cursor || 0, row.updated_at);
      }
      if (rows.length < 1000) break; since = rows[rows.length - 1].updated_at;
    }
    saveCfg(); if (changed) { render(); try { T.opts.onDocs && T.opts.onDocs(); } catch (_) {} }
  }
  async function sync() {
    if (T.syncing || !T.cfg.session) return; T.syncing = true; setStatus('جاري المزامنة…');
    try { await push(); await pull(); setStatus('☁️ متزامن ' + new Date().toLocaleTimeString('ar-SA-u-ca-gregory', { hour: 'numeric', minute: '2-digit' })); }
    catch (e) { setStatus('⚠️ ' + (e.message || 'فشلت المزامنة')); }
    finally { T.syncing = false; }
  }
  function scheduleSync() { if (!T.cfg.session) return; clearTimeout(T.syncT); T.syncT = setTimeout(sync, 1500); }


  /* ---------- تطبيق أندرويد (Capacitor): إشعارات مجدولة ترن والتطبيق مسكّر ---------- */
  const NAT = () => (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ? window.Capacitor.Plugins : null;
  const nid = (id, k) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000000; return h * 20 + k; };
  async function nativeInit() {
    const P = NAT(); if (!P || !P.LocalNotifications) return; const LN = P.LocalNotifications;
    try {
      await LN.requestPermissions();
      await LN.createChannel({ id: 'zk-alarm', name: 'تذكيرات ذكّرني', description: 'تنبيهات التذكيرات', importance: 5, visibility: 1, vibration: true, lights: true });
      try { const s = await LN.checkExactNotificationSetting(); if (s && s.exact_alarm === 'denied') await LN.changeExactNotificationSetting(); } catch (e) {}
    } catch (e) {}
  }
  let nsT = 0;
  function scheduleNative() {
    const P = NAT(); if (!P || !P.LocalNotifications) return; clearTimeout(nsT);
    nsT = setTimeout(async () => {
      try {
        const LN = P.LocalNotifications; const pend = await LN.getPending();
        if (pend && pend.notifications && pend.notifications.length) await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
        const list = [], now = Date.now();
        for (const r of vis().filter(i => i.type === 'reminder' && !i.done)) {
          const times = [];
          if (r.when > now) times.push(r.when);
          if (r.rep) { let w = r.when; while (w <= now) w += r.rep * 864e5; for (let k = 0; k < (r.rep == 1 ? 14 : 8); k++) { if (!times.includes(w)) times.push(w); w += r.rep * 864e5; } }
          times.slice(0, 15).forEach((t, k) => list.push({ id: nid(r.id, k), title: '⏰ ' + r.title, body: 'ذكّرني', schedule: { at: new Date(t), allowWhileIdle: true }, channelId: 'zk-alarm' }));
        }
        if (list.length) await LN.schedule({ notifications: list });
      } catch (e) {}
    }, 800);
  }
  const blobB64 = b => new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(',')[1]); f.onerror = () => rej(f.error); f.readAsDataURL(b); });

  /* ---------- الملفات ---------- */
  async function getBlob(it) {
    let b = await idbGet('blobs', it.id); if (b) return b;
    if (!it.uploaded || !T.cfg.session) return null;
    const r = await api('/storage/v1/object/authenticated/zk-files/' + remoteKey(it));
    b = await r.blob(); await idbPut('blobs', b, it.id); return b;
  }
  async function ensureImg(it) {
    if (T.urls[it.id] || T.fetching.has(it.id)) return; T.fetching.add(it.id);
    try { if (!(await idbGet('blobs', it.id)) && (it.size || 0) > 4 * 1024 * 1024) return; const b = await getBlob(it); if (b) { T.urls[it.id] = URL.createObjectURL(b); const im = q('[data-img="' + it.id + '"]'); if (im) { im.src = T.urls[it.id]; im.hidden = false; } } } catch (e) {} finally { T.fetching.delete(it.id); }
  }
  async function openFile(it, btn) {
    const old = btn && btn.textContent; if (btn) btn.textContent = 'جاري…';
    try {
      const b = await getBlob(it); if (!b) throw new Error('الملف مو موجود هنا ولا على الحساب');
      const P = NAT();
      if (P && P.Filesystem && P.Share) {
        const r = await P.Filesystem.writeFile({ path: 'zk-' + it.name.replace(/[\\/:*?"<>|]/g, '_'), data: await blobB64(b), directory: 'CACHE' });
        await P.Share.share({ title: it.name, url: r.uri }); return;
      }
      const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = it.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000);
      if (/^image\//.test(it.ctype || '')) render();
    } catch (e) { msg('تعذّر فتح الملف: ' + e.message); } finally { if (btn) btn.textContent = old; }
  }
  const size = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const msg = t => { const el = q('#zk-msg'); if (el) el.textContent = t || ''; };
  const alarmHref = r => { const d = new Date(r.when); return 'intent:#Intent;action=android.intent.action.SET_ALARM;i.android.intent.extra.alarm.HOUR=' + d.getHours() + ';i.android.intent.extra.alarm.MINUTES=' + d.getMinutes() + ';S.android.intent.extra.alarm.MESSAGE=' + encodeURIComponent(r.title.replace(/;/g, ' ')) + ';end'; };

  /* ---------- الواجهة ---------- */
  function render() {
    try { T.opts.onChange && T.opts.onChange({ overdue: vis().filter(i => i.type === 'reminder' && !i.done && i.when < Date.now()).length }); } catch (_) {}
    scheduleNative();
    if (!T.root) return;
    const rs = vis().filter(i => i.type === 'reminder').sort((a, b) => (a.done - b.done) || a.when - b.when);
    q('#zk-rl').innerHTML = rs.length ? rs.map(r => {
      const soon = T.opts.platform === 'phone' && !NAT() && !r.done && r.when > Date.now() && r.when - Date.now() < 864e5;
      return `<div class="zk-card zk-row"><div class="${r.done ? 'zk-done' : ''}"><b>${esc(r.title)}</b><div class="zk-mut ${!r.done && r.when < Date.now() ? 'zk-due' : ''}">${fmt(r.when)}${r.rep ? ' · 🔁 ' + (r.rep == 1 ? 'كل يوم' : 'كل أسبوع') : ''}</div></div><div class="zk-acts">${soon ? `<a class="zk-btn zk-g" href="${esc(alarmHref(r))}" title="يحطها في ساعة الجوال">⏰ منبّه</a>` : ''}${!r.done ? `<button class="zk-btn zk-g" data-done="${r.id}">✓ تم</button>` : ''}<button class="zk-btn zk-g zk-red" data-del="${r.id}">حذف</button></div></div>`;
    }).join('') : '<div class="zk-mut">ما فيه تذكيرات.</div>';
    const fs = vis().filter(i => i.type !== 'reminder' && i.type !== 'notedoc').sort((a, b) => b.ts - a.ts);
    q('#zk-fl').innerHTML = fs.length ? fs.map(f => f.type === 'file'
      ? `<div class="zk-card"><div class="zk-row"><div><b>📎 ${esc(f.name)}</b><div class="zk-mut">${fmt(f.ts)}${f.size ? ' · ' + size(f.size) : ''}${!f.uploaded && T.cfg.session ? ' · ⏳ ينرفع' : ''}</div></div><button class="zk-btn zk-g zk-red" data-del="${f.id}">حذف</button></div>${/^image\//.test(f.ctype || '') ? `<img data-img="${f.id}" ${T.urls[f.id] ? `src="${T.urls[f.id]}"` : 'hidden'} class="zk-img" alt="">` : ''}<div style="margin-top:8px"><button class="zk-btn" data-open="${f.id}">فتح / تنزيل</button></div></div>`
      : `<div class="zk-card"><div class="zk-row"><b>📝 ${esc(f.name)}</b><button class="zk-btn zk-g zk-red" data-del="${f.id}">حذف</button></div><div class="zk-body">${esc(f.body)}</div><button class="zk-btn" style="margin-top:8px" data-copy="${f.id}">نسخ</button></div>`).join('') : '<div class="zk-mut">ما فيه ملفات أو نصوص بعد.</div>';
    fs.filter(f => f.type === 'file' && /^image\//.test(f.ctype || '')).forEach(ensureImg);
    const st = document.getElementById('zk-st'); if (st) st.textContent = T.status || (T.cfg.session ? '☁️' : 'مزامنة');
  }
  function setWhen(ts) { T.whenTs = ts; const el = q('#zk-pv'); if (el) el.textContent = ts ? 'راح أذكرك: ' + fmt(ts) : ''; }
  function fromTime() { const v = q('#zk-tm').value; if (!v) return; const [h, m] = v.split(':').map(Number); const d = new Date(); d.setSeconds(0, 0); d.setDate(d.getDate() + T.dayOff); d.setHours(h, m); if (d.getTime() <= Date.now() && T.dayOff == 0) d.setDate(d.getDate() + 1); setWhen(d.getTime()); }
  const clearOn = sel => q(sel).querySelectorAll('.on').forEach(b => b.classList.remove('on'));
  function showTab(t) { T.tab = t; q('#zk-p1').hidden = t !== 'r'; q('#zk-p2').hidden = t !== 'f'; q('#zk-t1').classList.toggle('on', t === 'r'); q('#zk-t2').classList.toggle('on', t === 'f'); }

  const SKELETON = `<div class="zk">
  <div class="zk-tabs"><button id="zk-t1" class="on">🔔 التذكيرات</button><button id="zk-t2">📎 الملفات والنصوص</button><button id="zk-t3" class="zk-sync">☁️ <span id="zk-st">مزامنة</span></button></div>
  <div id="zk-msg" class="zk-mut"></div>
  <section id="zk-p1">
    <div class="zk-card">
      <input id="zk-rt" class="zk-in" placeholder="اكتب مثلاً: بعد ساعة أشرب شاي ☕">
      <div class="zk-mut">متى؟</div>
      <div class="zk-chips" id="zk-cr"><button data-min="5">٥ دقايق</button><button data-min="10">١٠ دقايق</button><button data-min="30">نص ساعة</button><button data-min="60">ساعة</button><button data-min="120">ساعتين</button></div>
      <div class="zk-mut">أو وقت محدد:</div>
      <div class="zk-chips" id="zk-cd"><button data-day="0" class="on">اليوم</button><button data-day="1">بكرة</button><button data-day="2">بعد بكرة</button></div>
      <input id="zk-tm" class="zk-in" type="time">
      <div class="zk-mut">التكرار:</div>
      <div class="zk-chips" id="zk-cp"><button data-rep="0" class="on">مرة وحدة</button><button data-rep="1">كل يوم</button><button data-rep="7">كل أسبوع</button></div>
      <div id="zk-pv" class="zk-pv"></div>
      <button class="zk-btn" id="zk-radd">أضف التذكير</button>
    </div>
    <div id="zk-rl"></div>
  </section>
  <section id="zk-p2" hidden>
    <div class="zk-card"><input type="file" id="zk-fi" multiple><div class="zk-mut">PDF، صور، مستندات… (حتى 20 ميجا للملف)</div></div>
    <div class="zk-card"><input id="zk-nt" class="zk-in" placeholder="عنوان النص"><textarea id="zk-nb" class="zk-in" rows="3" placeholder="اكتب أو الصق نص هنا"></textarea><button class="zk-btn" id="zk-nadd">احفظ النص</button></div>
    <div id="zk-fl"></div>
  </section>
</div>`;

  function mount(root) {
    T.root = root; root.innerHTML = SKELETON;
    root.onclick = async e => {
      const b = e.target.closest('button,a'); if (!b) return; const d = b.dataset || {};
      try {
        if (b.id === 'zk-t1') showTab('r'); else if (b.id === 'zk-t2') showTab('f'); else if (b.id === 'zk-t3') openSync();
        else if (d.del) { if (confirm('حذف؟')) await delItem(d.del); }
        else if (d.done) { const it = T.items.find(i => i.id === d.done); if (it) await updItem(it.id, nextState(it)); }
        else if (d.copy) { await navigator.clipboard.writeText(T.items.find(i => i.id === d.copy).body); b.textContent = 'تم النسخ ✓'; }
        else if (d.open) openFile(T.items.find(i => i.id === d.open), b);
        else if (d.min !== undefined && b.parentElement.id === 'zk-cr') { root.querySelectorAll('#zk-cr button').forEach(x => x.classList.toggle('on', x === b)); q('#zk-tm').value = ''; setWhen(Date.now() + d.min * 60000); }
        else if (d.day !== undefined) { T.dayOff = +d.day; root.querySelectorAll('#zk-cd button').forEach(x => x.classList.toggle('on', x === b)); clearOn('#zk-cr'); fromTime(); }
        else if (d.rep !== undefined) { T.rep = +d.rep; root.querySelectorAll('#zk-cp button').forEach(x => x.classList.toggle('on', x === b)); }
        else if (b.id === 'zk-radd') await addReminder();
        else if (b.id === 'zk-nadd') {
          const t = q('#zk-nt').value.trim() || 'بدون عنوان', body = q('#zk-nb').value.trim(); if (!body) return;
          await addItem({ type: 'note', name: t, body }); q('#zk-nt').value = ''; q('#zk-nb').value = '';
        }
      } catch (err) { msg('صار خطأ: ' + (err.message || err)); }
    };
    q('#zk-tm').onchange = () => { clearOn('#zk-cr'); fromTime(); };
    q('#zk-rt').oninput = () => { const p = parse(q('#zk-rt').value); if (p.ts) { clearOn('#zk-cr'); setWhen(p.ts); q('#zk-pv').textContent += ' ← «' + p.title + '»'; } };
    q('#zk-fi').onchange = async e => {
      for (const f of e.target.files) {
        if (f.size > MAX_FILE) { msg('«' + f.name + '» أكبر من 20 ميجا'); continue; }
        try { const it = await addItem({ type: 'file', name: f.name, ctype: f.type || 'application/octet-stream', size: f.size, uploaded: 0 }); await idbPut('blobs', f, it.id); render(); scheduleSync(); }
        catch (err) { msg('ما انحفظ ' + f.name + ': ' + err.message); }
      }
      e.target.value = '';
    };
    render();
  }
  async function addReminder() {
    let t = q('#zk-rt').value.trim(), w = T.whenTs; const p = parse(t); if (p.ts) { w = p.ts; t = p.title; }
    if (!t || !w) { msg('اكتب التذكير واختر الوقت'); return; }
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (_) {}
    try { T.actx = T.actx || new (window.AudioContext || window.webkitAudioContext)(); T.actx.resume && T.actx.resume(); } catch (_) {}
    await addItem({ type: 'reminder', title: t, when: w, rep: T.rep, done: false });
    q('#zk-rt').value = ''; T.rep = 0; T.dayOff = 0; q('#zk-cp').querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i == 0)); q('#zk-cd').querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i == 0));
    setWhen(null); q('#zk-tm').value = ''; clearOn('#zk-cr'); msg('');
  }

  /* ---------- نافذة المزامنة ---------- */
  function openSync() {
    let el = document.getElementById('zk-sync');
    if (!el) { el = document.createElement('div'); el.id = 'zk-sync'; document.body.appendChild(el); }
    const c = T.cfg, on = !!c.session;
    el.innerHTML = `<div class="zk-sbox"><b>☁️ المزامنة بين الجوال والكمبيوتر</b>
      <p class="zk-mut">حسابك مجاني على Supabase (بدون بطاقة). تذكيراتك وملاحظاتك وملفاتك تظهر في كل أجهزتك. خزنة ويندوز نفسها (الملفات والبرامج) ما تتزامن.</p>
      ${on ? `<div class="zk-card">مسجّل دخول: <b dir="ltr">${esc(c.email || '')}</b></div><div class="zk-rbtns"><button class="zk-btn" id="zk-now">زامن الحين</button><button class="zk-btn zk-g zk-red" id="zk-out">تسجيل خروج</button><button class="zk-btn zk-g" id="zk-x">إغلاق</button></div>`
        : `<label>رابط المشروع (Project URL)</label><input id="zk-u" class="zk-in" dir="ltr" placeholder="https://xxxx.supabase.co" value="${esc(c.url || '')}">
      <label>المفتاح العام (anon public key)</label><input id="zk-k" class="zk-in" dir="ltr" value="${esc(c.key || '')}">
      <label>البريد</label><input id="zk-e" class="zk-in" dir="ltr" type="email" value="${esc(c.email || '')}">
      <label>كلمة المرور (٦ أحرف على الأقل)</label><input id="zk-p" class="zk-in" type="password" dir="ltr">
      <div id="zk-smsg" class="zk-due"></div>
      <div class="zk-rbtns"><button class="zk-btn" id="zk-in">دخول</button><button class="zk-btn zk-alt" id="zk-up">حساب جديد</button><button class="zk-btn zk-g" id="zk-x">إغلاق</button></div>`}
      <details><summary>أول مرة؟ خطوات الإعداد (٥ دقايق)</summary>
        <ol class="zk-mut"><li>ادخل supabase.com وسجّل بحساب جوجل أو قيت هاب، ثم New project (الخطة المجانية).</li><li>من القائمة: SQL Editor ← New query ← الصق الكود تحت واضغط Run.</li><li>من Authentication ← Sign In / Providers ← Email: أوقف «Confirm email».</li><li>من Project Settings ← API: انسخ Project URL ومفتاح anon public والصقهم فوق.</li><li>اكتب بريد وكلمة مرور واضغط «حساب جديد»، وفي الجهاز الثاني نفس البيانات واضغط «دخول».</li></ol>
        <button class="zk-btn zk-g" id="zk-cp2">نسخ كود SQL</button><pre class="zk-sql" dir="ltr">${esc(SQL)}</pre></details></div>`;
    el.style.display = 'flex';
    const $ = id => el.querySelector('#' + id);
    const close = () => { el.style.display = 'none'; };
    $('zk-x').onclick = close; el.onclick = e => { if (e.target === el) close(); };
    $('zk-cp2').onclick = async () => { try { await navigator.clipboard.writeText(SQL); $('zk-cp2').textContent = 'تم النسخ ✓'; } catch (e) { $('zk-cp2').textContent = 'انسخه يدوياً من الصندوق'; } };
    if (on) {
      $('zk-now').onclick = () => { sync(); close(); };
      $('zk-out').onclick = () => { T.cfg.session = null; T.cfg.cursor = 0; saveCfg(); setStatus('غير متصل بحساب'); close(); render(); };
    } else {
      const go = async kind => {
        const sm = $('zk-smsg'); sm.textContent = '';
        T.cfg.url = normUrl($('zk-u').value); T.cfg.key = $('zk-k').value.trim(); T.cfg.email = $('zk-e').value.trim();
        if (!T.cfg.url || !T.cfg.key || !T.cfg.email || !$('zk-p').value) { sm.textContent = 'عبّ كل الحقول'; return; }
        try { sm.textContent = 'لحظة…'; T.cfg.session = await authCall(kind, T.cfg.email, $('zk-p').value); T.cfg.cursor = 0; saveCfg(); for (const it of T.items) { it.dirty = 1; await saveItem(it); } close(); sync(); }
        catch (e) { T.cfg.session = null; saveCfg(); sm.textContent = e.message; }
      };
      $('zk-in').onclick = () => go('login'); $('zk-up').onclick = () => go('signup');
    }
  }

  /* ---------- التشغيل ---------- */
  async function init(opts) {
    if (T.started) return; T.started = true; T.opts = opts || {}; loadCfg();
    try { T.items = await idbAll('items'); } catch (e) { T.items = []; }
    try { if ('Notification' in window && Notification.permission === 'default' && T.opts.platform === 'desktop') Notification.requestPermission(); } catch (_) {}
    document.addEventListener('click', () => { try { T.actx = T.actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {} }, { once: true });
    setInterval(tick, 5000); tick();
    setInterval(() => sync(), 20000);
    window.addEventListener('online', sync); window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { sync(); tick(); } });
    nativeInit(); setStatus(T.cfg.session ? '☁️' : 'مزامنة'); render(); if (T.cfg.session) sync();
  }
  /* مزامنة وثائق (الملاحظات) عبر نفس الجدول */
  const getDocs = () => T.items.filter(i => i.type === 'notedoc');
  async function setDoc(id, data, deleted) {
    const cur = T.items.find(i => i.id === id && i.type === 'notedoc');
    if (cur) { Object.assign(cur, { data, deleted: !!deleted, updated: Date.now(), dirty: 1 }); await saveItem(cur); scheduleSync(); return cur; }
    const it = { id, type: 'notedoc', ts: Date.now(), updated: Date.now(), dirty: 1, deleted: !!deleted, data }; T.items.push(it); await saveItem(it); scheduleSync(); return it;
  }
  window.Zakker = { getDocs, setDoc, signedIn: () => !!(T.cfg && T.cfg.session), init, mount, openSync, parse, sync, addRem: (title, when, extra) => addItem({ type: 'reminder', title, when, rep: 0, done: false, ...(extra || {}) }), _T: T };
})();
