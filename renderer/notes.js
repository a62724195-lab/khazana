/* ملاحظاتي: محرر ملاحظات وأفكار داخل خزنة (ماركداون خفيف، قوائم مهام، وسوم، ربط بعناصر الخزنة) */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const COLORS = ['', '#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#6366f1', '#d946ef'];
  const TPL = {
    blank: ['', ''],
    todo: ['قائمة مهام', '- [ ] \n- [ ] \n- [ ] '],
    idea: ['💡 فكرة', '## الفكرة\n\n## ليش هي مهمة؟\n\n## الخطوة الجاية\n- [ ] '],
    meet: ['📅 ملاحظات اجتماع', '## الحضور\n\n## النقاط\n- \n\n## القرارات\n\n## المهام\n- [ ] '],
    daily: ['📓 يومية', '## اليوم\n\n## شكرًا لـ\n- \n\n## بكرة\n- [ ] ']
  };
  const N = { host: null, ctx: null, cur: null, q: '', tag: '', prev: false, timer: null, ov: null, saved: true, unlocked: new Set(), dirty: new Set(), gone: [], ac: null, undo: null, busy: false };
  const list = () => N.ctx.get();
  const find = id => list().find(n => n.id === id);
  const plain = n => ((n.title || '') + ' ' + (n.body || '')).toLowerCase();
  const titleExists = t => !!list().find(n => (n.title || '').trim().toLowerCase() === String(t).trim().toLowerCase());
  const byTitle = t => list().find(n => (n.title || '').trim().toLowerCase() === String(t).trim().toLowerCase());
  const wc = s => (String(s).trim().match(/\S+/g) || []).length;
  const ago = ts => { const d = Date.now() - ts; if (d < 6e4) return 'الحين'; if (d < 36e5) return Math.floor(d / 6e4) + ' د'; if (d < 864e5) return Math.floor(d / 36e5) + ' س'; if (d < 7 * 864e5) return Math.floor(d / 864e5) + ' يوم'; return new Date(ts).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short' }); };
  const tags = n => String(n.tags || '').split(/[,،\s]+/).map(x => x.replace(/^#/, '').trim()).filter(Boolean);

  function md(src, note) {
    const lines = String(src || '').split('\n'); let out = '', inUl = false, inOl = false;
    const close = () => { if (inUl) { out += '</ul>'; inUl = false; } if (inOl) { out += '</ol>'; inOl = false; } };
    const inl = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/!\[\]\(img:([a-z0-9]+)\)/g, (a, id) => (note && note.imgs && note.imgs[id]) ? `<img class="nimg" src="${note.imgs[id]}">` : '').replace(/\[\[([^\]\n]+)\]\]/g, (a, t) => `<a class="wl ${titleExists(t) ? '' : 'miss'}" data-wl="${t}">${t}</a>`).replace(/(https?:\/\/[^\s<"]+)/g, '<a href="$1" data-url="$1">$1</a>');
    lines.forEach((ln, k) => {
      let m;
      if ((m = /^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/.exec(ln))) { if (!inUl) { close(); out += '<ul class="cl">'; inUl = true; } const on = m[1] !== ' '; out += `<li class="ck ${on ? 'on' : ''}"><input type="checkbox" data-ln="${k}" ${on ? 'checked' : ''}><span>${inl(m[2])}</span><button class="rmb" data-rm="${k}" title="ذكّرني">⏰</button></li>`; return; }
      if ((m = /^\s*[-*•]\s+(.*)$/.exec(ln))) { if (!inUl) { close(); out += '<ul>'; inUl = true; } out += `<li>${inl(m[1])}</li>`; return; }
      if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(ln))) { if (!inOl) { close(); out += '<ol>'; inOl = true; } out += `<li>${inl(m[1])}</li>`; return; }
      close();
      if ((m = /^(#{1,3})\s+(.*)$/.exec(ln))) out += `<h${m[1].length + 1}>${inl(m[2])}</h${m[1].length + 1}>`;
      else if (/^---+$/.test(ln.trim())) out += '<hr>';
      else if ((m = /^>\s?(.*)$/.exec(ln))) out += `<blockquote>${inl(m[1])}</blockquote>`;
      else if (!ln.trim()) out += '<div class="sp"></div>';
      else out += `<p>${inl(ln)}</p>`;
    });
    close(); return out;
  }

  function sorted() {
    const q = N.q.trim().toLowerCase();
    const hit = n => !q || (n.lock ? (n.title || '').toLowerCase().includes(q) : plain(n).includes(q)) || tags(n).some(t => t.toLowerCase().includes(q));
    return list().filter(n => hit(n) && (!N.tag || tags(n).includes(N.tag)))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || 0) - (a.updated || 0));
  }
  function allTags() { const c = {}; list().forEach(n => tags(n).forEach(t => c[t] = (c[t] || 0) + 1)); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 14); }
  const vaultNotes = () => (N.ctx.items() || []).filter(i => i.kind === 'note' && !i._imp);
  const locked = n => n && n.lock && !N.unlocked.has(n.id);
  const backlinks = n => { const t = (n.title || '').trim().toLowerCase(); if (!t) return []; return list().filter(x => x.id !== n.id && !x.lock && (x.body || '').toLowerCase().includes('[[' + t + ']]')); };

  function drawList() {
    const L = N.host.querySelector('#ntList'); const l = sorted();
    const tg = allTags();
    N.host.querySelector('#ntTags').innerHTML = tg.length ? `<button class="ntag ${N.tag ? '' : 'on'}" data-tag="">الكل</button>` + tg.map(([t, c]) => `<button class="ntag ${N.tag === t ? 'on' : ''}" data-tag="${esc(t)}">#${esc(t)} <i>${c}</i></button>`).join('') : '';
    let h = l.map(n => {
      const pre = n.lock ? '🔒 محمية بكلمة سر' : (n.body || '').replace(/!\[\]\(img:[a-z0-9]+\)/g, ' 🖼️ ').replace(/\[\[|\]\]/g, '').replace(/\[[ xX]\]/g, ' ').replace(/[#*>`\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
      return `<div class="nit ${N.cur === n.id ? 'on' : ''}" data-id="${n.id}" ${n.color ? `style="--nc:${n.color}"` : ''}><div class="nt1">${n.pinned ? '📌 ' : ''}${n.lock ? '🔒 ' : ''}<b>${esc(n.title || 'بدون عنوان')}</b><span class="nd">${ago(n.updated || n.created || Date.now())}</span></div><div class="nt2">${esc(pre) || '<i>فاضية</i>'}</div></div>`;
    }).join('');
    if (!l.length) h = `<div class="nempty">${list().length ? 'ما لقيت ملاحظة بهالبحث.' : 'ما عندك ملاحظات للحين.<br>اكتب أفكارك، مهامك، أي شي… وتنحفظ لحالها.'}</div>`;
    const vn = vaultNotes();
    if (vn.length) h += `<button class="nimp" id="ntImp">📥 استيراد ملاحظات الخزنة (${vn.length})</button>`;
    if (list().length) h += `<button class="nimp" id="ntExpAll">⬇️ تصدير كل الملاحظات (Markdown)</button>`;
    L.innerHTML = h;
  }

  const OV = {
    pick(n, q) {
      const have = new Set(n.links || []); q = (q || '').toLowerCase();
      const l = N.ctx.items().filter(i => !have.has(i.id) && (!q || (i.name + ' ' + (i.desc || '')).toLowerCase().includes(q))).slice(0, 30);
      return `<div class="npick" data-ov="1"><div class="npbox"><div class="nph"><b>اربط عنصر من الخزنة</b><button class="sm" data-ovx="1">✕</button></div><input id="ntPickQ" class="f" placeholder="ابحث…" value="${esc(q)}"><div class="npl">${l.map(i => `<div class="npi" data-pick="${i.id}">${esc(i.name)}<span class="hint">${esc(i.category || '')}</span></div>`).join('') || '<div class="hint" style="padding:10px">ما لقيت شي</div>'}</div></div></div>`;
    },
    rem(n) {
      const t = new Date(); const pad = x => String(x).padStart(2, '0'); const dv = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const def = new Date(Date.now() + 36e5);
      return `<div class="npick" data-ov="1"><div class="npbox"><div class="nph"><b>⏰ ذكّرني بهذا السطر</b><button class="sm" data-ovx="1">✕</button></div><div class="hint remtxt">${esc(N.ov.text)}</div>
        <div class="npl" style="flex-direction:row;flex-wrap:wrap;gap:6px"><button class="sm" data-rp="60">بعد ساعة</button><button class="sm" data-rp="tonight">الليلة ٨</button><button class="sm" data-rp="tom">بكرة ٩ الصبح</button><button class="sm" data-rp="week">بعد أسبوع</button></div>
        <input id="ntRemT" type="datetime-local" class="f" value="${dv(def)}"><button class="pri" id="ntRemGo">إضافة التذكير</button></div></div>`;
    },
    lock(n) {
      return `<div class="npick" data-ov="1"><div class="npbox"><div class="nph"><b>🔒 ${n.lock ? 'حماية الملاحظة' : 'حماية بكلمة سر'}</b><button class="sm" data-ovx="1">✕</button></div>
        ${n.lock ? `<div class="hint">هذي الملاحظة محمية.</div><button class="sm" id="ntRelock">أقفلها الحين</button><button class="sm" id="ntUnlockAll" style="color:#ef4444">إزالة الحماية</button>` : `<div class="hint">اكتب كلمة سر. (حماية خفيفة تخفي الملاحظة داخل البرنامج، الملف نفسه غير مشفّر. لا تنسى الكلمة!)</div><input id="ntLkP" type="password" class="f" placeholder="كلمة السر"><button class="pri" id="ntLkSet">حماية</button>`}<div id="ntLkErr" class="lkerr"></div></div></div>`;
    },
    exp() {
      return `<div class="npick" data-ov="1"><div class="npbox"><div class="nph"><b>⬇️ تصدير الملاحظة</b><button class="sm" data-ovx="1">✕</button></div><button class="sm" id="ntExpMd">حفظ كملف Markdown (.md)</button><button class="sm" id="ntExpCopy">نسخ النص للحافظة</button></div></div>`;
    },
    ai() {
      return `<div class="npick" data-ov="1"><div class="npbox"><div class="nph"><b>✨ ذكاء اصطناعي</b><button class="sm" data-ovx="1">✕</button></div>
        <button class="sm" data-ai="summarize">📝 لخّص</button><button class="sm" data-ai="tasks">☑️ استخرج المهام</button><button class="sm" data-ai="tags">🏷️ اقترح وسوم</button><button class="sm" data-ai="improve">🪄 حسّن الصياغة</button>
        <div class="hint">${N.busy ? '⏳ يفكر…' : 'يحتاج مفتاح Anthropic (من الإعدادات ← الذكاء). تنرسل هذي الملاحظة بس.'}</div></div></div>`;
    }
  };
  function overlayHTML(n) { return N.ov ? OV[N.ov.t](n) : ''; }

  function drawEditor() {
    const E = N.host.querySelector('#ntEd'); const n = find(N.cur);
    N.host.querySelector('.ntwrap').classList.toggle('hasCur', !!n);
    if (!n) { E.innerHTML = `<div class="nblank"><div class="nbi">📝</div><b>ملاحظاتي</b><div class="hint">اختر ملاحظة من القائمة أو ابدأ وحدة جديدة.<br>اربط الملاحظات ببعض بـ [[اسم ملاحظة]]، وحط تذكير لأي سطر ⏰، والصق صور مباشرة.<br>ملاحظة سريعة من أي مكان: <b>Ctrl+Alt+N</b></div><div class="ntpl">${Object.entries(TPL).filter(([k]) => k !== 'blank').map(([k, v]) => `<button class="sm" data-tpl="${k}">${esc(v[0])}</button>`).join('')}<button class="sm pri" data-tpl="blank">+ ملاحظة فاضية</button></div></div>`; return; }
    if (locked(n)) {
      E.innerHTML = `<div class="nblank"><div class="nbi">🔒</div><b>${esc(n.title || 'ملاحظة محمية')}</b><div class="hint">اكتب كلمة السر لعرضها</div><div class="lrow"><input id="ntUnP" type="password" class="f" autocomplete="off" placeholder="كلمة السر"><button class="pri" id="ntUnGo">فتح</button></div><div id="ntUnErr" class="lkerr"></div><button class="sm nback" id="ntBack">‹ القائمة</button></div>`; return;
    }
    const links = (n.links || []).map(id => N.ctx.items().find(i => i.id === id)).filter(Boolean);
    const bl = backlinks(n);
    E.innerHTML = `<div class="nhead"><button class="sm nback" id="ntBack">‹ القائمة</button><input id="ntTitle" class="f" placeholder="العنوان" value="${esc(n.title || '')}">
      <div class="ntools"><button class="sm" data-fmt="h" title="عنوان">H</button><button class="sm" data-fmt="b" title="غامق"><b>B</b></button><button class="sm" data-fmt="ul" title="قائمة">•</button><button class="sm" data-fmt="ck" title="قائمة مهام">☑️</button><button class="sm" data-fmt="q" title="اقتباس">❝</button><button class="sm" data-fmt="wl" title="رابط لملاحظة [[ ]]">[[ ]]</button>
      <span class="sepv"></span><button class="sm" id="ntRem" title="ذكّرني بالسطر الحالي">⏰</button><button class="sm" id="ntLink" title="اربط عنصر من الخزنة">🔗</button><button class="sm" id="ntAi" title="ذكاء اصطناعي">✨</button><button class="sm ${n.lock ? 'act' : ''}" id="ntLock" title="حماية بكلمة سر">${n.lock ? '🔒' : '🔓'}</button><button class="sm" id="ntExp" title="تصدير">⬇️</button>
      <button class="sm ${n.pinned ? 'act' : ''}" id="ntPin" title="تثبيت">📌</button><button class="sm ${N.prev ? 'act' : ''}" id="ntPrev" title="معاينة / تحرير">👁</button><button class="sm" id="ntDel" title="حذف">🗑️</button></div></div>
      <div class="nclr">${COLORS.map(c => `<button class="nsw ${n.color === c || (!n.color && !c) ? 'on' : ''}" data-c="${c}" style="${c ? 'background:' + c : ''}">${c ? '' : '∅'}</button>`).join('')}<input id="ntTagIn" class="f" placeholder="وسوم: عمل، فكرة، دراسة…" value="${esc(n.tags || '')}"></div>
      ${links.length ? `<div class="nlinks">${links.map(i => `<span class="nlk" data-open="${i.id}">🔗 ${esc(i.name)}<b data-unlink="${i.id}" title="فك الربط">×</b></span>`).join('')}</div>` : ''}
      ${N.undo && N.undo.id === n.id ? `<div class="nundo">تم التحسين <button class="sm" id="ntUndo">↶ تراجع</button></div>` : ''}
      ${N.prev ? `<div id="ntView" class="nview">${md(n.body, n) || '<i class="hint">فاضية</i>'}</div>` : `<div class="nbw"><textarea id="ntBody" class="f nbody" placeholder="اكتب هنا… (- [ ] قائمة مهام، # عنوان، [[ ]] رابط لملاحظة، الصق صورة بـ Ctrl+V)" spellcheck="false">${esc(n.body || '')}</textarea><div id="ntAc" class="nac" hidden></div></div>`}
      ${bl.length ? `<div class="nbl">🔙 مشار لها من: ${bl.map(x => `<span class="nlk" data-go="${x.id}">${esc(x.title || 'بدون عنوان')}</span>`).join('')}</div>` : ''}
      <div class="nfoot"><span id="ntInfo">${wc(n.body)} كلمة</span><span id="ntSaved">${N.saved ? '✓ محفوظ' : '…'}</span></div>
      ${overlayHTML(n)}`;
    if (!N.prev) { const t = E.querySelector('#ntBody'); if (t && N.focusBody) { t.focus(); const l = t.value.length; t.setSelectionRange(l, l); N.focusBody = false; } }
  }
  function draw() { if (!N.host) return; N.host.querySelector('#ntSearch').value = N.q; drawList(); drawEditor(); }

  /* ---------- الحفظ والمزامنة ---------- */
  function docOf(n) { const { _undo, ...d } = n; return d; }
  async function pushDocs() {
    if (!N.ctx.signedIn()) { N.dirty.clear(); N.gone.length = 0; return; }
    for (const id of [...N.dirty]) { const n = find(id); if (n) await N.ctx.setDoc('note-' + id, docOf(n), false); N.dirty.delete(id); }
    while (N.gone.length) { const id = N.gone.pop(); await N.ctx.setDoc('note-' + id, { id, updated: Date.now() }, true); }
  }
  function persist() { N.saved = false; const s = N.host && N.host.querySelector('#ntSaved'); if (s) s.textContent = '…'; clearTimeout(N.timer); N.timer = setTimeout(async () => { await N.ctx.save(); try { await pushDocs(); } catch (e) {} N.saved = true; const s2 = N.host && N.host.querySelector('#ntSaved'); if (s2) s2.textContent = '✓ محفوظ'; }, 450); }
  function touch(n) { n.updated = Date.now(); N.dirty.add(n.id); persist(); }
  function mergeDocs() {
    if (!N.ctx.signedIn()) return; let ch = false; const L = list();
    N.ctx.docs().forEach(d => {
      const id = d.id.replace(/^note-/, ''); const i = L.findIndex(n => n.id === id);
      if (d.deleted) { if (i >= 0 && (L[i].updated || 0) <= d.updated) { L.splice(i, 1); if (N.cur === id) N.cur = null; ch = true; } return; }
      const rd = d.data && d.data.data; if (!rd || !rd.id) return;
      if (i < 0) { L.push(rd); ch = true; } else if ((rd.updated || 0) > (L[i].updated || 0)) { L[i] = rd; ch = true; }
    });
    L.forEach(n => { const d = N.ctx.docs().find(x => x.id === 'note-' + n.id); if (!d || (!d.deleted && (n.updated || 0) > ((d.data && d.data.data && d.data.data.updated) || 0))) N.dirty.add(n.id); });
    if (ch) { N.ctx.save(); draw(); } if (N.dirty.size) pushDocs().catch(() => {});
  }
  function create(tpl, o) {
    const t = TPL[tpl] || TPL.blank; const n = { id: uid(), title: t[0], body: t[1], color: '', pinned: false, tags: '', links: [], created: Date.now(), updated: Date.now(), ...(o || {}) };
    list().unshift(n); N.cur = n.id; N.prev = false; N.q = ''; N.tag = ''; N.ov = null; N.focusBody = true; N.dirty.add(n.id); persist(); draw(); const ti = N.host.querySelector('#ntTitle'); if (ti && !n.title) ti.focus();
    return n;
  }
  function quick(text, tg) { const ls = String(text).trim().split('\n'); const title = ls[0].replace(/^#+\s*/, '').slice(0, 80); const body = ls.slice(1).join('\n').trim(); const n = { id: uid(), title, body, color: '', pinned: false, tags: tg || '', links: [], created: Date.now(), updated: Date.now() }; list().unshift(n); N.dirty.add(n.id); persist(); if (N.host) draw(); return n; }

  function fmt(kind) {
    const t = N.host.querySelector('#ntBody'); const n = find(N.cur); if (!t || !n) return;
    const s = t.selectionStart, e = t.selectionEnd, v = t.value;
    const ls = v.lastIndexOf('\n', s - 1) + 1; let le = v.indexOf('\n', e); if (le < 0) le = v.length;
    let nv, ns = s, ne = e;
    if (kind === 'b') { const sel = v.slice(s, e) || 'نص'; nv = v.slice(0, s) + '**' + sel + '**' + v.slice(e); ns = s + 2; ne = ns + sel.length; }
    else if (kind === 'wl') { const sel = v.slice(s, e); nv = v.slice(0, s) + '[[' + sel + ']]' + v.slice(e); ns = ne = s + 2 + sel.length; if (!sel) ns = ne = s + 2; }
    else { const pre = { h: '## ', ul: '- ', ck: '- [ ] ', q: '> ' }[kind]; const seg = v.slice(ls, le).split('\n').map(x => pre + x.replace(/^(#{1,3}\s|[-*]\s(\[[ xX]\]\s)?|>\s)/, '')).join('\n'); nv = v.slice(0, ls) + seg + v.slice(le); ns = ls; ne = ls + seg.length; }
    t.value = nv; t.focus(); t.setSelectionRange(ns, ne); n.body = nv; touch(n); upInfo(); if (kind === 'wl') acCheck();
  }
  const upInfo = () => { const n = find(N.cur), i = N.host.querySelector('#ntInfo'); if (n && i) i.textContent = wc(n.body) + ' كلمة'; };

  /* ---------- إكمال [[ ]] ---------- */
  function acCheck() {
    const t = N.host.querySelector('#ntBody'), box = N.host.querySelector('#ntAc'); if (!t || !box) return;
    const before = t.value.slice(0, t.selectionStart); const m = /\[\[([^\]\n]*)$/.exec(before);
    if (!m) { N.ac = null; box.hidden = true; return; }
    const q = m[1].toLowerCase(); const cur = find(N.cur);
    const l = list().filter(x => x.id !== cur.id && x.title && (!q || x.title.toLowerCase().includes(q))).slice(0, 6);
    if (!l.length) { N.ac = null; box.hidden = true; return; }
    N.ac = { l, i: 0, start: t.selectionStart - m[1].length }; drawAc();
  }
  function drawAc() { const box = N.host.querySelector('#ntAc'); if (!box || !N.ac) return; box.hidden = false; box.innerHTML = N.ac.l.map((x, k) => `<div class="nai ${k === N.ac.i ? 'on' : ''}" data-ac="${k}">${esc(x.title)}</div>`).join(''); }
  function acPick(k) {
    const t = N.host.querySelector('#ntBody'), n = find(N.cur), a = N.ac; if (!t || !a) return; const it = a.l[k]; if (!it) return;
    const v = t.value, end = t.selectionStart; const after = v.slice(end).startsWith(']]') ? 2 : 0;
    t.value = v.slice(0, a.start) + it.title + ']]' + v.slice(end + after); const p = a.start + it.title.length + 2; t.setSelectionRange(p, p); t.focus();
    n.body = t.value; touch(n); upInfo(); N.ac = null; N.host.querySelector('#ntAc').hidden = true;
  }

  /* ---------- صور ---------- */
  function addImage(file) {
    const n = find(N.cur); const t = N.host.querySelector('#ntBody'); if (!n || !t || !file) return;
    const fr = new FileReader(); fr.onload = () => { const im = new Image(); im.onload = () => {
      const k = Math.min(1, 1000 / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5); (n.imgs = n.imgs || {})[id] = c.toDataURL('image/jpeg', 0.8);
      const s = t.selectionStart, ins = `\n![](img:${id})\n`; t.value = t.value.slice(0, s) + ins + t.value.slice(t.selectionEnd); t.setSelectionRange(s + ins.length, s + ins.length);
      n.body = t.value; touch(n); upInfo(); N.ctx.toast('🖼️ انضافت الصورة (اضغط 👁 للمعاينة)');
    }; im.src = fr.result; }; fr.readAsDataURL(file);
  }

  /* ---------- تصدير ---------- */
  function mdExport(n) { let b = n.body || ''; b = b.replace(/!\[\]\(img:([a-z0-9]+)\)/g, (a, id) => n.imgs && n.imgs[id] ? `![](${n.imgs[id]})` : ''); return `# ${n.title || 'بدون عنوان'}\n\n${n.tags ? 'الوسوم: ' + tags(n).map(t => '#' + t).join(' ') + '\n\n' : ''}${b}\n`; }
  function download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  const fname = s => { const a = String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60); const d = new Date(); const p = x => String(x).padStart(2, '0'); return (/^[\x20-\x7e]+$/.test(a) && a ? a : 'khazana-note-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes())) + '.md'; };

  /* ---------- تذكير ---------- */
  function lineAtCaret() { const t = N.host.querySelector('#ntBody'); if (!t) return { text: '', k: -1 }; const before = t.value.slice(0, t.selectionStart); const k = before.split('\n').length - 1; return { text: t.value.split('\n')[k] || '', k }; }
  const cleanLine = s => String(s).replace(/^\s*(?:[-*]\s\[[ xX]\]\s|[-*•]\s|\d+[.)]\s|#{1,3}\s|>\s)/, '').replace(/⏰.*$/, '').trim();
  function whenOf(kind) { const d = new Date(); if (kind === 'tonight') { d.setHours(20, 0, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); return d.getTime(); } if (kind === 'tom') { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.getTime(); } if (kind === 'week') { d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d.getTime(); } return Date.now() + (+kind) * 6e4; }
  async function addReminder(when) {
    const n = find(N.cur); const line = cleanLine(N.ov.text) || n.title || 'ملاحظة';
    await N.ctx.remind(line, when, n.id);
    if (N.ov.k >= 0) { const ls = (n.body || '').split('\n'); if (ls[N.ov.k] != null && !/⏰/.test(ls[N.ov.k])) { ls[N.ov.k] += ' ⏰'; n.body = ls.join('\n'); touch(n); } }
    N.ov = null; drawEditor(); N.ctx.toast('⏰ انضاف التذكير: ' + line.slice(0, 40));
  }

  function mount(host, ctx) {
    N.host = host; N.ctx = ctx;
    host.innerHTML = `<div class="ntwrap"><div class="ntside"><div class="ntop"><input id="ntSearch" class="f" placeholder="🔎 ابحث في ملاحظاتك…"><div class="ntaddw"><button class="pri" id="ntNew">+ جديدة</button><div id="ntTplM" class="menu" hidden>${Object.entries(TPL).map(([k, v]) => `<button data-tpl="${k}">${k === 'blank' ? '📝 فاضية' : esc(v[0])}</button>`).join('')}</div></div></div><div id="ntTags" class="ntags"></div><div id="ntList" class="nlist"></div></div><div id="ntEd" class="nted"></div></div>`;
    host.addEventListener('input', e => {
      const n = find(N.cur);
      if (e.target.id === 'ntSearch') { N.q = e.target.value; drawList(); }
      else if (!n) return;
      else if (e.target.id === 'ntTitle') { n.title = e.target.value; touch(n); drawList(); }
      else if (e.target.id === 'ntBody') { n.body = e.target.value; N.undo = null; touch(n); upInfo(); acCheck(); }
      else if (e.target.id === 'ntTagIn') { n.tags = e.target.value; touch(n); }
      else if (e.target.id === 'ntPickQ') { const p = host.querySelector('.npl'); const tmp = document.createElement('div'); tmp.innerHTML = OV.pick(n, e.target.value); p.innerHTML = tmp.querySelector('.npl').innerHTML; }
    });
    host.addEventListener('keydown', e => {
      if (e.target.id === 'ntBody' && N.ac && !host.querySelector('#ntAc').hidden) {
        if (e.key === 'ArrowDown') { e.preventDefault(); N.ac.i = (N.ac.i + 1) % N.ac.l.length; drawAc(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); N.ac.i = (N.ac.i - 1 + N.ac.l.length) % N.ac.l.length; drawAc(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); acPick(N.ac.i); return; }
        if (e.key === 'Escape') { N.ac = null; host.querySelector('#ntAc').hidden = true; e.stopPropagation(); return; }
      }
      if (e.target.id === 'ntBody' && e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
        const t = e.target, v = t.value, s = t.selectionStart, ls = v.lastIndexOf('\n', s - 1) + 1, line = v.slice(ls, s); const m = /^(\s*(?:[-*]\s\[[ xX]\]\s|[-*]\s|\d+\.\s))(.*)$/.exec(line);
        if (m) { e.preventDefault(); if (!m[2].trim()) { t.value = v.slice(0, ls) + v.slice(s); t.setSelectionRange(ls, ls); } else { const pre = m[1].replace(/\[[xX]\]/, '[ ]').replace(/^(\s*)(\d+)\./, (a, b, c) => b + (+c + 1) + '.'); const ins = '\n' + pre; t.value = v.slice(0, s) + ins + v.slice(s); t.setSelectionRange(s + ins.length, s + ins.length); } const n = find(N.cur); n.body = t.value; touch(n); upInfo(); }
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'b' && e.target.id === 'ntBody') { e.preventDefault(); fmt('b'); }
      if (e.key === 'Enter' && e.target.id === 'ntUnP') unlockGo();
      if (e.key === 'Enter' && e.target.id === 'ntLkP') host.querySelector('#ntLkSet').click();
      if (e.key === 'Escape' && N.ov) { N.ov = null; drawEditor(); e.stopPropagation(); }
    });
    host.addEventListener('change', e => {
      if (e.target.matches('#ntView input[type=checkbox]')) { const n = find(N.cur); const ls = n.body.split('\n'), k = +e.target.dataset.ln; ls[k] = ls[k].replace(/\[( |x|X)\]/, e.target.checked ? '[x]' : '[ ]'); n.body = ls.join('\n'); touch(n); e.target.closest('li').classList.toggle('on', e.target.checked); drawList(); }
    });
    host.addEventListener('paste', e => {
      if (e.target.id !== 'ntBody') return; const it = [...(e.clipboardData && e.clipboardData.items || [])].find(x => x.type.startsWith('image/')); if (it) { e.preventDefault(); addImage(it.getAsFile()); }
    });
    host.addEventListener('dragover', e => { if (e.target.id === 'ntBody' && [...(e.dataTransfer.types || [])].includes('Files')) e.preventDefault(); });
    host.addEventListener('drop', e => { if (e.target.id !== 'ntBody') return; const f = [...(e.dataTransfer.files || [])].find(x => x.type.startsWith('image/')); if (f) { e.preventDefault(); addImage(f); } });
    host.addEventListener('mousedown', e => { const a = e.target.closest('[data-ac]'); if (a) { e.preventDefault(); acPick(+a.dataset.ac); } });
    async function unlockGo() {
      const n = find(N.cur), p = host.querySelector('#ntUnP').value; if (!n || !n.lock) return;
      if ((await N.ctx.hash(p, n.lock.salt)) === n.lock.hash) { N.unlocked.add(n.id); draw(); } else { host.querySelector('#ntUnErr').textContent = 'كلمة السر غلط'; }
    }
    host.addEventListener('click', async e => {
      const t = e.target;
      if (t.closest('#ntNew')) { host.querySelector('#ntTplM').hidden = !host.querySelector('#ntTplM').hidden; return; }
      const tp = t.closest('[data-tpl]'); if (tp) { host.querySelector('#ntTplM').hidden = true; create(tp.dataset.tpl); return; }
      host.querySelector('#ntTplM').hidden = true;
      const a = t.closest('a[data-url]'); if (a) { e.preventDefault(); N.ctx.url(a.dataset.url); return; }
      const wl = t.closest('a[data-wl]'); if (wl) { e.preventDefault(); const nm = wl.dataset.wl; const f = byTitle(nm); if (f) { N.cur = f.id; N.prev = false; N.ov = null; draw(); } else { create('blank', { title: nm }); N.ctx.toast('📝 انسوّت ملاحظة جديدة: ' + nm); } return; }
      const tg = t.closest('[data-tag]'); if (tg) { N.tag = tg.dataset.tag; drawList(); return; }
      const it = t.closest('.nit'); if (it) { N.cur = it.dataset.id; N.prev = false; N.ov = null; draw(); return; }
      if (t.closest('#ntBack')) { N.cur = null; draw(); return; }
      if (t.closest('#ntImp')) { const c = N.ctx.importVault(vaultNotes()); N.ctx.toast('📥 انستوردت ' + c + ' ملاحظة'); draw(); return; }
      if (t.closest('#ntExpAll')) { download('khazana-notes.md', list().filter(n => !n.lock).map(mdExport).join('\n---\n\n')); N.ctx.toast('⬇️ انحفظ الملف (مجلد التنزيلات). الملاحظات المحمية ما تنصدّر.'); return; }
      if (t.closest('#ntUnGo')) { unlockGo(); return; }
      const n = find(N.cur); if (!n) return;
      const go = t.closest('[data-go]'); if (go) { N.cur = go.dataset.go; N.prev = false; draw(); return; }
      const f = t.closest('[data-fmt]'); if (f) { if (N.prev) { N.prev = false; drawEditor(); } fmt(f.dataset.fmt); return; }
      const sw = t.closest('.nsw'); if (sw) { n.color = sw.dataset.c; touch(n); draw(); return; }
      if (t.closest('#ntPin')) { n.pinned = !n.pinned; touch(n); draw(); return; }
      if (t.closest('#ntPrev')) { N.prev = !N.prev; drawEditor(); return; }
      if (t.closest('#ntDel')) { if (await N.ctx.confirm('تحذف هذي الملاحظة؟')) { const i = list().findIndex(x => x.id === n.id); list().splice(i, 1); N.gone.push(n.id); N.dirty.delete(n.id); N.cur = null; persist(); draw(); } return; }
      if (t.closest('#ntLink')) { N.ov = { t: 'pick' }; drawEditor(); const q = host.querySelector('#ntPickQ'); if (q) q.focus(); return; }
      if (t.closest('#ntRem')) { const L = N.prev ? { text: n.title, k: -1 } : lineAtCaret(); N.ov = { t: 'rem', text: cleanLine(L.text) || n.title || '', k: L.k }; drawEditor(); return; }
      const rm = t.closest('[data-rm]'); if (rm) { const k = +rm.dataset.rm; N.ov = { t: 'rem', text: cleanLine((n.body || '').split('\n')[k] || ''), k }; drawEditor(); return; }
      if (t.closest('#ntLock')) { N.ov = { t: 'lock' }; drawEditor(); const p = host.querySelector('#ntLkP'); if (p) p.focus(); return; }
      if (t.closest('#ntExp')) { N.ov = { t: 'exp' }; drawEditor(); return; }
      if (t.closest('#ntAi')) { N.ov = { t: 'ai' }; drawEditor(); return; }
      if (t.closest('[data-ovx]') || (t.dataset && t.dataset.ov)) { N.ov = null; drawEditor(); return; }
      const pk = t.closest('[data-pick]'); if (pk) { (n.links = n.links || []).push(pk.dataset.pick); N.ov = null; touch(n); drawEditor(); return; }
      const ul = t.closest('[data-unlink]'); if (ul) { n.links = (n.links || []).filter(x => x !== ul.dataset.unlink); touch(n); drawEditor(); return; }
      const op = t.closest('[data-open]'); if (op) { const i = N.ctx.items().find(x => x.id === op.dataset.open); if (i) N.ctx.open(i); return; }
      const rp = t.closest('[data-rp]'); if (rp) { await addReminder(whenOf(rp.dataset.rp)); return; }
      if (t.closest('#ntRemGo')) { const v = host.querySelector('#ntRemT').value; const w = v ? new Date(v).getTime() : 0; if (!w || w < Date.now() - 6e4) { N.ctx.toast('اختر وقت جاي'); return; } await addReminder(w); return; }
      if (t.closest('#ntLkSet')) { const p = host.querySelector('#ntLkP').value; if (p.length < 3) { host.querySelector('#ntLkErr').textContent = 'كلمة السر 3 أحرف على الأقل'; return; } const salt = N.ctx.salt(); n.lock = { salt, hash: await N.ctx.hash(p, salt) }; N.unlocked.add(n.id); touch(n); N.ov = null; draw(); N.ctx.toast('🔒 انحمت الملاحظة'); return; }
      if (t.closest('#ntRelock')) { N.unlocked.delete(n.id); N.ov = null; draw(); N.ctx.toast('انقفلت 🔒'); return; }
      if (t.closest('#ntUnlockAll')) { delete n.lock; touch(n); N.ov = null; draw(); N.ctx.toast('انشالت الحماية'); return; }
      if (t.closest('#ntExpMd')) { download(fname(n.title), mdExport(n)); N.ov = null; drawEditor(); N.ctx.toast('⬇️ انحفظ الملف (مجلد التنزيلات)'); return; }
      if (t.closest('#ntExpCopy')) { try { await navigator.clipboard.writeText(mdExport(n)); N.ctx.toast('📋 اننسخت'); } catch (er) { N.ctx.toast('تعذّر النسخ'); } N.ov = null; drawEditor(); return; }
      if (t.closest('#ntUndo')) { if (N.undo && N.undo.id === n.id) { n.body = N.undo.body; N.undo = null; touch(n); drawEditor(); } return; }
      const ai = t.closest('[data-ai]'); if (ai && !N.busy) {
        N.busy = true; drawEditor(); const act = ai.dataset.ai;
        const r = await N.ctx.ai({ action: act, title: n.title, text: n.body }); N.busy = false; N.ov = null;
        if (!r || !r.ok) { drawEditor(); N.ctx.toast(r && r.error === 'no_key' ? 'فعّل مفتاح الذكاء الاصطناعي من الإعدادات ← الذكاء' : 'تعذّر: ' + ((r && r.error) || '')); return; }
        const d = r.data || {};
        if (act === 'summarize' && d.text) { n.body += '\n\n---\n## ملخص\n' + d.text; }
        else if (act === 'tasks') { const ts = (d.tasks || []).filter(Boolean); if (!ts.length) { drawEditor(); N.ctx.toast('ما لقيت مهام'); return; } n.body += '\n\n## المهام\n' + ts.map(x => '- [ ] ' + x).join('\n'); }
        else if (act === 'tags' && d.tags) { const have = new Set(tags(n)); const add = String(d.tags).split(/[,،\s]+/).map(x => x.replace(/^#/, '')).filter(x => x && !have.has(x)); n.tags = (n.tags ? n.tags + ' ' : '') + add.join(' '); }
        else if (act === 'improve' && d.text) { N.undo = { id: n.id, body: n.body }; n.body = d.text; }
        else { drawEditor(); N.ctx.toast('ما رجع شي مفيد'); return; }
        touch(n); N.prev = act === 'summarize' || act === 'tasks' ? N.prev : N.prev; drawEditor(); drawList(); N.ctx.toast('✨ تم'); return;
      }
    });
    N.ctx.onDocs && N.ctx.onDocs(mergeDocs);
    draw();
  }
  window.Notes = { mount, draw, create, quick, merge: mergeDocs, count: () => list().length, list: () => (N.ctx ? list() : []), select(id) { N.cur = id; N.prev = false; draw(); } };
})();
