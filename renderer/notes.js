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
  const N = { host: null, ctx: null, cur: null, q: '', tag: '', prev: false, timer: null, picker: false, tplOpen: false, saved: true, wide: true };
  const list = () => N.ctx.get();
  const find = id => list().find(n => n.id === id);
  const plain = n => ((n.title || '') + ' ' + (n.body || '')).toLowerCase();
  const wc = s => (String(s).trim().match(/\S+/g) || []).length;
  const ago = ts => { const d = Date.now() - ts; if (d < 6e4) return 'الحين'; if (d < 36e5) return Math.floor(d / 6e4) + ' د'; if (d < 864e5) return Math.floor(d / 36e5) + ' س'; if (d < 7 * 864e5) return Math.floor(d / 864e5) + ' يوم'; return new Date(ts).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short' }); };
  const tags = n => String(n.tags || '').split(/[,،\s]+/).map(x => x.replace(/^#/, '').trim()).filter(Boolean);

  function md(src) {
    const lines = String(src || '').split('\n'); let out = '', inUl = false, inOl = false;
    const close = () => { if (inUl) { out += '</ul>'; inUl = false; } if (inOl) { out += '</ol>'; inOl = false; } };
    const inl = t => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" data-url="$1">$1</a>');
    lines.forEach((ln, k) => {
      let m;
      if ((m = /^\s*[-*]\s+\[( |x|X)\]\s?(.*)$/.exec(ln))) { if (!inUl) { close(); out += '<ul class="cl">'; inUl = true; } const on = m[1] !== ' '; out += `<li class="ck ${on ? 'on' : ''}"><input type="checkbox" data-ln="${k}" ${on ? 'checked' : ''}><span>${inl(m[2])}</span></li>`; return; }
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
    return list().filter(n => (!q || plain(n).includes(q) || tags(n).some(t => t.toLowerCase().includes(q))) && (!N.tag || tags(n).includes(N.tag)))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.updated || 0) - (a.updated || 0));
  }
  function allTags() { const c = {}; list().forEach(n => tags(n).forEach(t => c[t] = (c[t] || 0) + 1)); return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 14); }
  const vaultNotes = () => (N.ctx.items() || []).filter(i => i.kind === 'note' && !i._imp);

  function drawList() {
    const L = N.host.querySelector('#ntList'); const l = sorted();
    const tg = allTags();
    N.host.querySelector('#ntTags').innerHTML = tg.length ? `<button class="ntag ${N.tag ? '' : 'on'}" data-tag="">الكل</button>` + tg.map(([t, c]) => `<button class="ntag ${N.tag === t ? 'on' : ''}" data-tag="${esc(t)}">#${esc(t)} <i>${c}</i></button>`).join('') : '';
    let h = l.map(n => {
      const pre = (n.body || '').replace(/\[[ xX]\]/g, ' ').replace(/[#*>`\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
      return `<div class="nit ${N.cur === n.id ? 'on' : ''}" data-id="${n.id}" ${n.color ? `style="--nc:${n.color}"` : ''}><div class="nt1">${n.pinned ? '📌 ' : ''}<b>${esc(n.title || 'بدون عنوان')}</b><span class="nd">${ago(n.updated || n.created || Date.now())}</span></div><div class="nt2">${esc(pre) || '<i>فاضية</i>'}</div></div>`;
    }).join('');
    if (!l.length) h = `<div class="nempty">${list().length ? 'ما لقيت ملاحظة بهالبحث.' : 'ما عندك ملاحظات للحين.<br>اكتب أفكارك، مهامك، أي شي… وتنحفظ لحالها.'}</div>`;
    const vn = vaultNotes();
    if (vn.length) h += `<button class="nimp" id="ntImp">📥 استيراد ملاحظات الخزنة (${vn.length})</button>`;
    L.innerHTML = h;
  }

  function drawEditor() {
    const E = N.host.querySelector('#ntEd'); const n = find(N.cur);
    N.host.querySelector('.ntwrap').classList.toggle('hasCur', !!n);
    if (!n) { E.innerHTML = `<div class="nblank"><div class="nbi">📝</div><b>ملاحظاتي</b><div class="hint">اختر ملاحظة من القائمة أو ابدأ وحدة جديدة.<br>تدعم قوائم المهام ☑️ والعناوين والوسوم، وتقدر تربطها بأي عنصر في خزنتك.</div><div class="ntpl">${Object.entries(TPL).filter(([k]) => k !== 'blank').map(([k, v]) => `<button class="sm" data-tpl="${k}">${esc(v[0])}</button>`).join('')}<button class="sm pri" data-tpl="blank">+ ملاحظة فاضية</button></div></div>`; return; }
    const links = (n.links || []).map(id => N.ctx.items().find(i => i.id === id)).filter(Boolean);
    E.innerHTML = `<div class="nhead"><button class="sm nback" id="ntBack">‹ القائمة</button><input id="ntTitle" class="f" placeholder="العنوان" value="${esc(n.title || '')}">
      <div class="ntools"><button class="sm" data-fmt="h" title="عنوان">H</button><button class="sm" data-fmt="b" title="غامق"><b>B</b></button><button class="sm" data-fmt="ul" title="قائمة">•</button><button class="sm" data-fmt="ck" title="قائمة مهام">☑️</button><button class="sm" data-fmt="q" title="اقتباس">❝</button>
      <span class="sepv"></span><button class="sm" id="ntLink" title="اربط عنصر من الخزنة">🔗</button><button class="sm ${n.pinned ? 'act' : ''}" id="ntPin" title="تثبيت">📌</button><button class="sm ${N.prev ? 'act' : ''}" id="ntPrev" title="معاينة / تحرير">👁</button><button class="sm" id="ntDel" title="حذف">🗑️</button></div></div>
      <div class="nclr">${COLORS.map(c => `<button class="nsw ${n.color === c || (!n.color && !c) ? 'on' : ''}" data-c="${c}" style="${c ? 'background:' + c : ''}">${c ? '' : '∅'}</button>`).join('')}<input id="ntTagIn" class="f" placeholder="وسوم: عمل، فكرة، دراسة…" value="${esc(n.tags || '')}"></div>
      ${links.length ? `<div class="nlinks">${links.map(i => `<span class="nlk" data-open="${i.id}">🔗 ${esc(i.name)}<b data-unlink="${i.id}" title="فك الربط">×</b></span>`).join('')}</div>` : ''}
      ${N.prev ? `<div id="ntView" class="nview">${md(n.body) || '<i class="hint">فاضية</i>'}</div>` : `<textarea id="ntBody" class="f nbody" placeholder="اكتب هنا… (استخدم - [ ] لقائمة مهام، # لعنوان)" spellcheck="false">${esc(n.body || '')}</textarea>`}
      <div class="nfoot"><span id="ntInfo">${wc(n.body)} كلمة</span><span id="ntSaved">${N.saved ? '✓ محفوظ' : '…'}</span></div>
      ${N.picker ? pickerHTML('') : ''}`;
    if (!N.prev) { const t = E.querySelector('#ntBody'); if (t && N.focusBody) { t.focus(); const l = t.value.length; t.setSelectionRange(l, l); N.focusBody = false; } }
  }
  function pickerHTML(q) {
    const n = find(N.cur), have = new Set(n.links || []); q = (q || '').toLowerCase();
    const l = N.ctx.items().filter(i => i.kind !== 'note' || i.name).filter(i => !have.has(i.id) && (!q || (i.name + ' ' + (i.desc || '')).toLowerCase().includes(q))).slice(0, 30);
    return `<div class="npick" id="ntPick"><div class="npbox"><div class="nph"><b>اربط عنصر من الخزنة</b><button class="sm" id="ntPickX">✕</button></div><input id="ntPickQ" class="f" placeholder="ابحث…" value="${esc(q)}"><div class="npl">${l.map(i => `<div class="npi" data-pick="${i.id}">${esc(i.name)}<span class="hint">${esc(i.category || '')}</span></div>`).join('') || '<div class="hint" style="padding:10px">ما لقيت شي</div>'}</div></div></div>`;
  }
  function draw() { if (!N.host) return; N.host.querySelector('#ntSearch').value = N.q; drawList(); drawEditor(); }

  function persist() { N.saved = false; const s = N.host && N.host.querySelector('#ntSaved'); if (s) s.textContent = '…'; clearTimeout(N.timer); N.timer = setTimeout(async () => { await N.ctx.save(); N.saved = true; const s2 = N.host && N.host.querySelector('#ntSaved'); if (s2) s2.textContent = '✓ محفوظ'; }, 450); }
  function touch(n) { n.updated = Date.now(); persist(); }
  function create(tpl) {
    const t = TPL[tpl] || TPL.blank; const n = { id: uid(), title: t[0], body: t[1], color: '', pinned: false, tags: '', links: [], created: Date.now(), updated: Date.now() };
    list().unshift(n); N.cur = n.id; N.prev = false; N.q = ''; N.tag = ''; N.focusBody = true; persist(); draw(); const ti = N.host.querySelector('#ntTitle'); if (ti && !n.title) ti.focus();
    N.host.querySelector('.ntwrap').classList.add('hasCur');
  }
  function fmt(kind) {
    const t = N.host.querySelector('#ntBody'); const n = find(N.cur); if (!t || !n) return;
    const s = t.selectionStart, e = t.selectionEnd, v = t.value;
    const ls = v.lastIndexOf('\n', s - 1) + 1; let le = v.indexOf('\n', e); if (le < 0) le = v.length;
    let nv, ns = s, ne = e;
    if (kind === 'b') { const sel = v.slice(s, e) || 'نص'; nv = v.slice(0, s) + '**' + sel + '**' + v.slice(e); ns = s + 2; ne = ns + sel.length; }
    else { const pre = { h: '## ', ul: '- ', ck: '- [ ] ', q: '> ' }[kind]; const seg = v.slice(ls, le).split('\n').map(x => pre + x.replace(/^(#{1,3}\s|[-*]\s(\[[ xX]\]\s)?|>\s)/, '')).join('\n'); nv = v.slice(0, ls) + seg + v.slice(le); ns = ls; ne = ls + seg.length; }
    t.value = nv; t.focus(); t.setSelectionRange(ns, ne); n.body = nv; touch(n); upInfo();
  }
  const upInfo = () => { const n = find(N.cur), i = N.host.querySelector('#ntInfo'); if (n && i) i.textContent = wc(n.body) + ' كلمة'; };

  function mount(host, ctx) {
    N.host = host; N.ctx = ctx;
    host.innerHTML = `<div class="ntwrap"><div class="ntside"><div class="ntop"><input id="ntSearch" class="f" placeholder="🔎 ابحث في ملاحظاتك…"><div class="ntaddw"><button class="pri" id="ntNew">+ جديدة</button><div id="ntTplM" class="menu" hidden>${Object.entries(TPL).map(([k, v]) => `<button data-tpl="${k}">${k === 'blank' ? '📝 فاضية' : esc(v[0])}</button>`).join('')}</div></div></div><div id="ntTags" class="ntags"></div><div id="ntList" class="nlist"></div></div><div id="ntEd" class="nted"></div></div>`;
    host.addEventListener('input', e => {
      const n = find(N.cur);
      if (e.target.id === 'ntSearch') { N.q = e.target.value; drawList(); }
      else if (!n) return;
      else if (e.target.id === 'ntTitle') { n.title = e.target.value; touch(n); drawList(); }
      else if (e.target.id === 'ntBody') { n.body = e.target.value; touch(n); upInfo(); }
      else if (e.target.id === 'ntTagIn') { n.tags = e.target.value; touch(n); }
      else if (e.target.id === 'ntPickQ') { const p = host.querySelector('.npl'); const tmp = document.createElement('div'); tmp.innerHTML = pickerHTML(e.target.value); p.innerHTML = tmp.querySelector('.npl').innerHTML; }
    });
    host.addEventListener('keydown', e => {
      if (e.target.id === 'ntBody' && e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) { // continue list
        const t = e.target, v = t.value, s = t.selectionStart, ls = v.lastIndexOf('\n', s - 1) + 1, line = v.slice(ls, s); const m = /^(\s*(?:[-*]\s\[[ xX]\]\s|[-*]\s|\d+\.\s))(.*)$/.exec(line);
        if (m) { e.preventDefault(); if (!m[2].trim()) { t.value = v.slice(0, ls) + v.slice(s); t.setSelectionRange(ls, ls); } else { const pre = m[1].replace(/\[[xX]\]/, '[ ]').replace(/^(\s*)(\d+)\./, (a, b, c) => b + (+c + 1) + '.'); const ins = '\n' + pre; t.value = v.slice(0, s) + ins + v.slice(s); t.setSelectionRange(s + ins.length, s + ins.length); } const n = find(N.cur); n.body = t.value; touch(n); upInfo(); }
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'b' && e.target.id === 'ntBody') { e.preventDefault(); fmt('b'); }
    });
    host.addEventListener('change', e => {
      if (e.target.matches('#ntView input[type=checkbox]')) { const n = find(N.cur); const ls = n.body.split('\n'), k = +e.target.dataset.ln; ls[k] = ls[k].replace(/\[( |x|X)\]/, e.target.checked ? '[x]' : '[ ]'); n.body = ls.join('\n'); touch(n); e.target.closest('li').classList.toggle('on', e.target.checked); drawList(); }
    });
    host.addEventListener('click', async e => {
      const t = e.target;
      if (t.closest('#ntNew')) { host.querySelector('#ntTplM').hidden = !host.querySelector('#ntTplM').hidden; return; }
      const tp = t.closest('[data-tpl]'); if (tp) { host.querySelector('#ntTplM').hidden = true; create(tp.dataset.tpl); return; }
      host.querySelector('#ntTplM').hidden = true;
      const a = t.closest('a[data-url]'); if (a) { e.preventDefault(); N.ctx.url(a.dataset.url); return; }
      const tg = t.closest('[data-tag]'); if (tg) { N.tag = tg.dataset.tag; drawList(); return; }
      const it = t.closest('.nit'); if (it) { N.cur = it.dataset.id; N.prev = false; N.picker = false; draw(); return; }
      if (t.closest('#ntBack')) { N.cur = null; draw(); return; }
      if (t.closest('#ntImp')) { const c = N.ctx.importVault(vaultNotes()); N.ctx.toast('📥 انستوردت ' + c + ' ملاحظة'); draw(); return; }
      const n = find(N.cur); if (!n) return;
      const f = t.closest('[data-fmt]'); if (f) { if (N.prev) { N.prev = false; drawEditor(); } fmt(f.dataset.fmt); return; }
      const sw = t.closest('.nsw'); if (sw) { n.color = sw.dataset.c; touch(n); draw(); return; }
      if (t.closest('#ntPin')) { n.pinned = !n.pinned; touch(n); draw(); return; }
      if (t.closest('#ntPrev')) { N.prev = !N.prev; drawEditor(); return; }
      if (t.closest('#ntDel')) { if (await N.ctx.confirm('تحذف هذي الملاحظة؟')) { const i = list().findIndex(x => x.id === n.id); list().splice(i, 1); N.cur = null; persist(); draw(); } return; }
      if (t.closest('#ntLink')) { N.picker = true; drawEditor(); const q = host.querySelector('#ntPickQ'); if (q) q.focus(); return; }
      if (t.closest('#ntPickX') || t.id === 'ntPick') { N.picker = false; drawEditor(); return; }
      const pk = t.closest('[data-pick]'); if (pk) { (n.links = n.links || []).push(pk.dataset.pick); N.picker = false; touch(n); drawEditor(); return; }
      const ul = t.closest('[data-unlink]'); if (ul) { n.links = (n.links || []).filter(x => x !== ul.dataset.unlink); touch(n); drawEditor(); return; }
      const op = t.closest('[data-open]'); if (op) { const i = N.ctx.items().find(x => x.id === op.dataset.open); if (i) N.ctx.open(i); return; }
    });
    draw();
  }
  window.Notes = { mount, draw, create, count: () => list().length, list: () => (N.ctx ? list() : []), select(id) { N.cur = id; N.prev = false; draw(); } };
})();
