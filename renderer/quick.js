const $ = id => document.getElementById(id);
const KI = { app: '🧩', image: '🖼', folder: '📁', link: '🔗', note: '📝', doc: '📄', pdf: '📕', video: '🎬', audio: '🎵', archive: '🗜' };
const KC = { _group: '⚡ مجموعة', app: 'برامج', image: 'صور', folder: 'مجلدات', link: 'روابط', note: 'ملاحظات', doc: 'مستندات', pdf: 'PDF', video: 'فيديو', audio: 'صوت', archive: 'مضغوطات' };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => (s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
const STOP = new Set('ابي ابغي ابغى اريد برنامج تطبيق ملف يسوي يسوون شي شيء اللي يعني عندي في من على الى او مع هذا هذه كذا اسوي اعمل ممكن لو اني ابى'.split(' ').map(norm));
const stem = w => w.replace(/^(وال|بال|لل|ال)/, '');
const toks = s => norm(s).split(/[^a-z0-9ء-ي]+/).filter(w => w.length > 1 && !STOP.has(w)).map(stem).filter(w => w.length > 1);
let groups = [], items = [], sections = [], hasKey = false, list = [], sel = 0, why = {}, busy = false;
const lockedSec = id => { let g = 0; while (id && g++ < 30) { const s = sections.find(x => x.id === id); if (!s) return false; if (s.lock) return true; id = s.parent || ''; } return false; };
const secName = id => (sections.find(x => x.id === id) || {}).name || '';

function local(q) {
  const qt = toks(q); if (!qt.length) return [];
  const gs = groups.filter(g => qt.some(w => norm(g.name).includes(w))).map(g => ({ id: 'g:' + g.id, kind: '_group', name: (g.emoji || '⚡') + ' ' + g.name, desc: 'مجموعة: تفتح ' + (g.ids || []).length + ' عناصر', gid: g.id }));
  return gs.concat(items.map(i => {
    const hay = [i.name, i.desc, i.category, i.tags, KC[i.kind], secName(i.section)].join(' ');
    const name = norm(i.name), all = norm(hay), words = toks(hay);
    let s = 0;
    for (const w of qt) {
      if (name.includes(w)) s += 3;
      if (all.includes(w)) s += 1;
      else if (w.length >= 4 && words.some(x => x.length >= 4 && x.startsWith(w.slice(0, 4)))) s += .5;
    }
    if (s > 0 && i.pinned) s += .2;
    return { i, s };
  }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 8).map(x => x.i));
}
function pv(i) { return i.thumb ? `<img src="${esc(i.thumb)}" alt="">` : (KI[i.kind] || '📄'); }
function draw(msg) {
  let h = list.map((i, k) => `<div class="r ${k === sel ? 'on' : ''}" data-k="${k}"><div class="ic">${pv(i)}</div><div class="t"><div class="n">${i.pinned ? '⭐ ' : ''}${esc(i.name)}</div><div class="d">${esc(why[i.id] || i.desc || secName(i.section) || '')}</div></div><div class="k">${esc(KC[i.kind] || '')}</div></div>`).join('');
  if (msg) h += `<div class="msg">${esc(msg)}</div>`;
  $('res').innerHTML = h; $('foot').hidden = !h;
  requestAnimationFrame(() => window.api.quickSize(document.getElementById('box').offsetHeight + 2));
}
function update() {
  const q = $('q').value.trim(); why = {}; sel = 0;
  if (!q) { list = items.filter(i => i.pinned).slice(0, 8); draw(list.length ? '' : ''); return; }
  list = local(q);
  draw(list.length ? '' : (hasKey ? 'ما لقيت بالكلمات. اضغط Shift+Enter للبحث الذكي بوصفك.' : 'ما لقيت شي.'));
}
async function smart() {
  const q = $('q').value.trim(); if (!q || !hasKey || busy) return; busy = true; draw('⏳ يفكر…');
  const compact = items.slice(0, 800).map(i => ({ id: i.id, name: i.name, kind: i.kind, desc: (i.desc || '').slice(0, 160), cat: i.category, tags: i.tags, section: secName(i.section) }));
  const r = await window.api.aiSearch({ query: q, items: compact }); busy = false;
  if (r && r.ok) { const ms = r.data.matches || []; list = ms.map(m => items.find(i => i.id === m.id)).filter(Boolean).slice(0, 8); ms.forEach(m => why[m.id] = m.reason); sel = 0; draw(list.length ? '' : 'ما لقيت شي مناسب في خزنتك.'); }
  else draw('تعذّر البحث الذكي.');
}
async function reload() {
  try { const r = await window.api.load(); const l = r.items || []; const m = l.find(x => x && x.kind === '_meta') || {}; sections = m.sections || []; groups = m.groups || []; if (window.I18N) window.I18N.set((m.ui && m.ui.lang) || window.I18N.auto()); items = l.filter(x => x && x.kind !== '_meta' && !lockedSec(x.section)); hasKey = !!r.hasKey; } catch (e) {}
  $('q').value = ''; update(); $('q').focus();
}
function go(i) { if (!i) return; if (i.kind === '_group') { window.api.extRun(i.gid); window.api.quickHide(); return; } window.api.extOpen(i.id, i.kind === 'note'); window.api.quickHide(); }
$('q').addEventListener('input', update);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { window.api.quickHide(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); if (list.length) { sel = (sel + 1) % list.length; draw(); } }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (list.length) { sel = (sel - 1 + list.length) % list.length; draw(); } }
  else if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey || !list.length) smart(); else go(list[sel]); }
});
$('res').addEventListener('click', e => { const r = e.target.closest('.r'); if (r) go(list[+r.dataset.k]); });
window.api.onQuickReset(reload);
reload();
