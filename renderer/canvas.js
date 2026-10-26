/* اللوحة الحرّة: ملاحظات وصور وعناصر الخزنة على لوحة واسعة مع خطوط ربط */
(function () {
  'use strict';
  const C = { ctx: null, host: null, cur: '', sel: null, selE: null, link: null, tool: '' };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const COLORS = ['', '#fde68a', '#fecaca', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fbcfe8', '#fed7aa'];
  const boards = () => C.ctx.get();
  const board = () => boards().find(b => b.id === C.cur) || null;
  const save = () => C.ctx.save();
  const $ = s => C.host.querySelector(s);

  function ensure() {
    if (!boards().length) boards().push({ id: uid(), name: 'لوحتي', nodes: [], edges: [], vx: 0, vy: 0, z: 1 });
    if (!board()) C.cur = boards()[0].id;
  }
  function draw() {
    if (!C.ctx) return; ensure();
    const bs = boards();
    C.host.innerHTML = `<div class="cvbar">
      <select id="cvSel">${bs.map(b => `<option value="${b.id}" ${b.id === C.cur ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
      <button class="sm" id="cvNew" title="لوحة جديدة">+ لوحة</button><button class="sm" id="cvRen" title="إعادة تسمية">✏️</button><button class="sm" id="cvDel" title="حذف اللوحة">🗑️</button>
      <span class="cvsep"></span>
      <button class="sm" id="cvTxt">📝 نص</button><button class="sm" id="cvImg">🖼️ صورة</button><button class="sm" id="cvItem">🗄️ عنصر</button><button class="sm" id="cvNote">📓 ملاحظة</button>
      <span class="cvsep"></span>
      <span id="cvCols" class="cvcols">${COLORS.map(c => `<button class="cvc" data-c="${c}" style="background:${c || 'var(--card)'}"></button>`).join('')}</span>
      <button class="sm" id="cvRm" title="حذف المحدد (Delete)">❌</button>
      <span class="cvsep"></span>
      <button class="sm" id="cvZo">−</button><button class="sm" id="cvZi">+</button><button class="sm" id="cvFit">⤢ عرض الكل</button>
      <span class="hint" id="cvHint">اسحب الخلفية للتحريك · عجلة الماوس للتقريب · اسحب النقطة ● لربط بطاقتين · ضغطتين على الخلفية = نص جديد</span></div>
      <div class="cvstage" id="cvStage"><div class="cvworld" id="cvWorld"><svg class="cvedges" id="cvEdges" width="1" height="1"></svg><div id="cvNodes"></div></div></div>
      <div class="cvpick" id="cvPick" hidden></div>`;
    paint(); wire();
  }
  function applyView() { const b = board(); if (!b) return; $('#cvWorld').style.transform = `translate(${b.vx}px,${b.vy}px) scale(${b.z})`; }
  function nodeHtml(n) {
    const sel = C.sel === n.id ? 'sel' : '';
    const st = `left:${n.x}px;top:${n.y}px;width:${n.w}px;${n.t === 'text' ? 'height:' + n.h + 'px;' : ''}${n.c ? '--nc:' + n.c : ''}`;
    let inner = '';
    if (n.t === 'text') inner = `<div class="cvtx" data-edit="${n.id}">${esc(n.txt || '').replace(/\n/g, '<br>')}</div>`;
    else if (n.t === 'img') inner = `<img src="${n.src}" draggable="false">`;
    else if (n.t === 'item') {
      const it = C.ctx.items().find(i => i.id === n.ref);
      inner = it ? `<div class="cvref">${it.thumb ? `<img src="${it.thumb}" draggable="false">` : '<span class="cvem">📄</span>'}<b>${esc(it.name)}</b><small>${esc(it.category || '')}</small><button class="sm cvopen" data-open="${n.id}">فتح</button></div>` : '<div class="cvref"><i>العنصر محذوف</i></div>';
    } else if (n.t === 'note') {
      const nt = C.ctx.notes().find(i => i.id === n.ref);
      inner = nt ? `<div class="cvref"><span class="cvem">📓</span><b>${esc(nt.title || 'بدون عنوان')}</b><small>${nt.lock ? '🔒' : esc((nt.body || '').replace(/[#*>\[\]`-]/g, '').slice(0, 90))}</small><button class="sm cvopen" data-open="${n.id}">فتح</button></div>` : '<div class="cvref"><i>الملاحظة محذوفة</i></div>';
    }
    return `<div class="cvn ${n.t} ${sel}" data-n="${n.id}" style="${st}">${inner}<i class="cvdot" data-dot="${n.id}" title="اسحب لربط"></i><i class="cvrs" data-rs="${n.id}"></i></div>`;
  }
  function nodeEl(id) { return C.host.querySelector(`[data-n="${id}"]`); }
  function center(n) { const el = nodeEl(n.id); const h = el ? el.offsetHeight : n.h; return { x: n.x + n.w / 2, y: n.y + h / 2, w: n.w, h }; }
  function edgePath(a, b) {
    const A = center(a), B = center(b); const dx = B.x - A.x, dy = B.y - A.y;
    let x1, y1, x2, y2, c1x, c1y, c2x, c2y;
    if (Math.abs(dx) > Math.abs(dy)) { const s = dx > 0 ? 1 : -1; x1 = A.x + s * A.w / 2; y1 = A.y; x2 = B.x - s * B.w / 2; y2 = B.y; c1x = x1 + s * 60; c1y = y1; c2x = x2 - s * 60; c2y = y2; }
    else { const s = dy > 0 ? 1 : -1; x1 = A.x; y1 = A.y + s * A.h / 2; x2 = B.x; y2 = B.y - s * B.h / 2; c1x = x1; c1y = y1 + s * 60; c2x = x2; c2y = y2 - s * 60; }
    return `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
  }
  function paintEdges() {
    const b = board(), svg = $('#cvEdges'); if (!b || !svg) return;
    svg.innerHTML = '<defs><marker id="cvar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>' +
      b.edges.map(e => { const a = b.nodes.find(n => n.id === e.a), c = b.nodes.find(n => n.id === e.b); if (!a || !c) return ''; const d = edgePath(a, c); return `<path d="${d}" class="cve hit" data-e="${e.id}"/><path d="${d}" class="cve ${C.selE === e.id ? 'sel' : ''}" marker-end="url(#cvar)"/>`; }).join('');
  }
  function paint() {
    const b = board(); if (!b) return;
    $('#cvNodes').innerHTML = b.nodes.map(nodeHtml).join('');
    applyView(); paintEdges();
    $('#cvCols').style.visibility = C.sel ? 'visible' : 'hidden';
  }
  function toWorld(cx, cy) { const b = board(), r = $('#cvStage').getBoundingClientRect(); return { x: (cx - r.left - b.vx) / b.z, y: (cy - r.top - b.vy) / b.z }; }
  function addNode(n) { const b = board(); const st = $('#cvStage'); const p = toWorld(st.getBoundingClientRect().left + st.clientWidth / 2 + (Math.random() * 60 - 30), st.getBoundingClientRect().top + st.clientHeight / 2 + (Math.random() * 60 - 30)); const node = { id: uid(), x: Math.round(n.x != null ? n.x : p.x - (n.w || 180) / 2), y: Math.round(n.y != null ? n.y : p.y - 50), w: 180, h: 110, c: '', ...n }; b.nodes.push(node); C.sel = node.id; C.selE = null; save(); paint(); return node; }
  function editText(id) {
    const b = board(), n = b.nodes.find(x => x.id === id); const el = nodeEl(id); if (!n || !el || n.t !== 'text') return;
    const ta = document.createElement('textarea'); ta.className = 'cvta'; ta.value = n.txt || ''; const box = el.querySelector('.cvtx'); box.replaceWith(ta); ta.focus();
    const done = () => { if (ta._d) return; ta._d = 1; ta.onblur = null; n.txt = ta.value; save(); setTimeout(paint, 0); };
    ta.onblur = done; ta.onkeydown = e => { if (e.key === 'Escape') { ta.blur(); } e.stopPropagation(); };
    ta.onpointerdown = e => e.stopPropagation();
  }
  function fitAll() {
    const b = board(), st = $('#cvStage'); if (!b.nodes.length) { b.vx = 0; b.vy = 0; b.z = 1; applyView(); return; }
    const xs = b.nodes.map(n => n.x), ys = b.nodes.map(n => n.y), xe = b.nodes.map(n => n.x + n.w), ye = b.nodes.map(n => { const el = nodeEl(n.id); return n.y + (el ? el.offsetHeight : n.h); });
    const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xe), y1 = Math.max(...ye);
    const z = Math.max(.2, Math.min(1.2, Math.min((st.clientWidth - 80) / (x1 - x0), (st.clientHeight - 80) / (y1 - y0))));
    b.z = z; b.vx = (st.clientWidth - (x1 - x0) * z) / 2 - x0 * z; b.vy = (st.clientHeight - (y1 - y0) * z) / 2 - y0 * z; applyView(); save();
  }
  function zoomAt(f, cx, cy) {
    const b = board(), st = $('#cvStage'), r = st.getBoundingClientRect(); cx = cx == null ? r.left + st.clientWidth / 2 : cx; cy = cy == null ? r.top + st.clientHeight / 2 : cy;
    const p = toWorld(cx, cy); b.z = Math.max(.2, Math.min(2.5, b.z * f)); b.vx = cx - r.left - p.x * b.z; b.vy = cy - r.top - p.y * b.z; applyView();
  }
  function picker(kind) {
    const pk = $('#cvPick'); const list = kind === 'item' ? C.ctx.items().map(i => ({ id: i.id, t: i.name, s: i.category || '' })) : C.ctx.notes().map(n => ({ id: n.id, t: n.title || 'بدون عنوان', s: n.lock ? '🔒' : '' }));
    pk.hidden = false;
    pk.innerHTML = `<div class="cvpb"><div class="cvph"><b>${kind === 'item' ? 'اختر عنصر من الخزنة' : 'اختر ملاحظة'}</b><button class="sm" id="cvPx">✕</button></div><input id="cvPq" placeholder="ابحث…" autocomplete="off"><div id="cvPl"></div></div>`;
    const lst = () => { const q = $('#cvPq').value.trim().toLowerCase(); $('#cvPl').innerHTML = list.filter(x => !q || x.t.toLowerCase().includes(q)).slice(0, 60).map(x => `<div class="cvpi" data-id="${x.id}"><b>${esc(x.t)}</b><small>${esc(x.s)}</small></div>`).join('') || '<div class="hint" style="padding:10px">ما فيه شي</div>'; };
    lst(); $('#cvPq').oninput = lst; $('#cvPq').focus(); $('#cvPx').onclick = () => { pk.hidden = true; };
    pk.onclick = e => { if (e.target === pk) pk.hidden = true; const r = e.target.closest('.cvpi'); if (r) { pk.hidden = true; addNode({ t: kind, ref: r.dataset.id, w: 190, h: 120 }); } };
  }
  function ask(title, def, cb) {
    const pk = $('#cvPick'); pk.hidden = false;
    pk.innerHTML = `<div class="cvpb"><div class="cvph"><b>${esc(title)}</b><button class="sm" id="cvPx">✕</button></div><input id="cvPq" autocomplete="off"><button class="sm pri" id="cvPok" style="margin-top:8px">حفظ</button></div>`;
    const q = $('#cvPq'); q.value = def || ''; q.focus(); q.select();
    const ok = () => { const v = q.value.trim(); pk.hidden = true; if (v) cb(v); };
    $('#cvPok').onclick = ok; q.onkeydown = e => { if (e.key === 'Enter') ok(); else if (e.key === 'Escape') pk.hidden = true; };
    $('#cvPx').onclick = () => { pk.hidden = true; }; pk.onclick = e => { if (e.target === pk) pk.hidden = true; };
  }
  function addImageFile(file, at) {
    if (!file || !/^image\//.test(file.type)) return;
    const rd = new FileReader(); rd.onload = () => { const im = new Image(); im.onload = () => {
      const k = Math.min(1, 900 / im.width), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      addNode({ t: 'img', src: c.toDataURL('image/jpeg', .75), w: Math.min(300, c.width), h: 200, ...(at || {}) });
    }; im.src = rd.result; }; rd.readAsDataURL(file);
  }
  function wire() {
    const st = $('#cvStage'), b = board();
    $('#cvSel').onchange = e => { C.cur = e.target.value; C.sel = null; C.selE = null; draw(); };
    $('#cvNew').onclick = () => ask('اسم اللوحة', '', nm => { const nb = { id: uid(), name: nm, nodes: [], edges: [], vx: 0, vy: 0, z: 1 }; boards().push(nb); C.cur = nb.id; save(); draw(); });
    $('#cvRen').onclick = () => ask('اسم اللوحة', b.name, nm => { b.name = nm; save(); draw(); });
    $('#cvDel').onclick = async () => { if (!(await C.ctx.confirm('تحذف اللوحة «' + b.name + '» بكل محتواها؟'))) return; const i = boards().indexOf(b); boards().splice(i, 1); C.cur = ''; C.sel = null; save(); draw(); };
    $('#cvTxt').onclick = () => { const n = addNode({ t: 'text', txt: '', c: '#fde68a' }); editText(n.id); };
    $('#cvImg').onclick = () => { const f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.onchange = () => addImageFile(f.files[0]); f.click(); };
    $('#cvItem').onclick = () => picker('item'); $('#cvNote').onclick = () => picker('note');
    $('#cvZi').onclick = () => { zoomAt(1.2); save(); }; $('#cvZo').onclick = () => { zoomAt(1 / 1.2); save(); }; $('#cvFit').onclick = fitAll;
    $('#cvRm').onclick = removeSel;
    $('#cvCols').onclick = e => { const c = e.target.closest('.cvc'); if (!c || !C.sel) return; const n = b.nodes.find(x => x.id === C.sel); if (n) { n.c = c.dataset.c; save(); paint(); } };
    st.onwheel = e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY); clearTimeout(C.wt); C.wt = setTimeout(save, 400); };
    st.ondblclick = e => { if (e.target.closest('.cvn')) { const t = e.target.closest('[data-edit]'); if (t) editText(t.dataset.edit); return; } if (e.target.closest('.cve')) return; const p = toWorld(e.clientX, e.clientY); const n = addNode({ t: 'text', txt: '', x: Math.round(p.x - 90), y: Math.round(p.y - 40), c: '#fde68a' }); editText(n.id); };
    st.ondragover = e => e.preventDefault();
    st.ondrop = e => { e.preventDefault(); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) { const p = toWorld(e.clientX, e.clientY); addImageFile(f, { x: Math.round(p.x), y: Math.round(p.y) }); } };
    st.onclick = e => {
      const op = e.target.closest('[data-open]'); if (op) { const n = b.nodes.find(x => x.id === op.dataset.open); if (n) { n.t === 'item' ? C.ctx.open(n.ref) : C.ctx.openNote(n.ref); } return; }
    };
    st.onpointerdown = e => {
      if (e.button !== 0 || e.target.closest('textarea') || e.target.closest('.cvopen')) return;
      const dot = e.target.closest('[data-dot]'), rs = e.target.closest('[data-rs]'), nd = e.target.closest('.cvn'), ed = e.target.closest('[data-e]');
      if (dot) { startLink(e, dot.dataset.dot); return; }
      if (rs) { startResize(e, rs.dataset.rs); return; }
      if (nd) { startDrag(e, nd.dataset.n); return; }
      if (ed) { C.selE = ed.dataset.e; C.sel = null; paint(); return; }
      if (C.sel || C.selE) { C.sel = null; C.selE = null; paint(); }
      startPan(e);
    };
  }
  function startPan(e) {
    const b = board(), st = $('#cvStage'); const sx = e.clientX, sy = e.clientY, vx = b.vx, vy = b.vy; st.classList.add('pan');
    const mv = ev => { b.vx = vx + ev.clientX - sx; b.vy = vy + ev.clientY - sy; applyView(); };
    const up = () => { st.classList.remove('pan'); window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); save(); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function startDrag(e, id) {
    const b = board(), n = b.nodes.find(x => x.id === id); if (!n) return; if (C.sel !== id) { C.sel = id; C.selE = null; C.host.querySelectorAll('.cvn.sel').forEach(x => x.classList.remove('sel')); nodeEl(id).classList.add('sel'); $('#cvCols').style.visibility = 'visible'; paintEdges(); }
    const el = nodeEl(id), sx = e.clientX, sy = e.clientY, ox = n.x, oy = n.y; let moved = false;
    const mv = ev => { const dx = (ev.clientX - sx) / b.z, dy = (ev.clientY - sy) / b.z; if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return; moved = true; n.x = Math.round(ox + dx); n.y = Math.round(oy + dy); el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; paintEdges(); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) save(); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function startResize(e, id) {
    e.stopPropagation(); const b = board(), n = b.nodes.find(x => x.id === id), el = nodeEl(id); const sx = e.clientX, sy = e.clientY, w0 = n.w, h0 = el.offsetHeight;
    const mv = ev => { n.w = Math.max(90, Math.round(w0 + (ev.clientX - sx) / b.z)); n.h = Math.max(50, Math.round(h0 + (ev.clientY - sy) / b.z)); el.style.width = n.w + 'px'; if (n.t === 'text') el.style.height = n.h + 'px'; paintEdges(); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); save(); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function startLink(e, id) {
    e.stopPropagation(); const b = board(), a = b.nodes.find(x => x.id === id); const svg = $('#cvEdges'); const ln = document.createElementNS('http://www.w3.org/2000/svg', 'path'); ln.setAttribute('class', 'cve tmp'); svg.appendChild(ln);
    const A = center(a);
    const mv = ev => { const p = toWorld(ev.clientX, ev.clientY); ln.setAttribute('d', `M${A.x},${A.y} L${p.x},${p.y}`); };
    const up = ev => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); ln.remove();
      const t = document.elementFromPoint(ev.clientX, ev.clientY), tn = t && t.closest && t.closest('.cvn');
      if (tn && tn.dataset.n !== id && !b.edges.some(x => (x.a === id && x.b === tn.dataset.n) || (x.a === tn.dataset.n && x.b === id))) { b.edges.push({ id: uid(), a: id, b: tn.dataset.n }); save(); paintEdges(); }
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function removeSel() {
    const b = board(); if (!b) return;
    if (C.sel) { b.nodes = b.nodes.filter(n => n.id !== C.sel); b.edges = b.edges.filter(e => e.a !== C.sel && e.b !== C.sel); C.sel = null; }
    else if (C.selE) { b.edges = b.edges.filter(e => e.id !== C.selE); C.selE = null; } else return;
    save(); paint();
  }
  function mount(host, ctx) {
    C.host = host; C.ctx = ctx;
    document.addEventListener('keydown', e => {
      if (host.hidden || e.target.closest('textarea,input,select')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); }
    });
    document.addEventListener('paste', e => {
      if (host.hidden || e.target.closest('textarea,input')) return;
      const it = [...(e.clipboardData && e.clipboardData.items || [])].find(x => /^image\//.test(x.type));
      if (it) { e.preventDefault(); addImageFile(it.getAsFile()); return; }
      const tx = e.clipboardData && e.clipboardData.getData('text'); if (tx && tx.trim()) { e.preventDefault(); addNode({ t: 'text', txt: tx.trim().slice(0, 2000), c: '#fde68a' }); }
    });
  }
  window.Canvas = { mount, draw, open(id) { C.cur = id; draw(); }, count: () => (C.ctx ? boards().reduce((s, b) => s + b.nodes.length, 0) : 0) };
})();
