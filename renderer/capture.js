const $ = id => document.getElementById(id);
async function ini() { try { const r = await window.api.load(); const m = (r.items || []).find(x => x && x.kind === '_meta') || {}; const u = m.ui || {}; if (u.accent) document.documentElement.style.setProperty('--acc', u.accent); if (window.I18N) window.I18N.set(u.lang || window.I18N.auto()); } catch (e) {} }
function reset() { $('t').value = ''; $('tg').value = ''; $('ok').hidden = true; $('t').focus(); }
async function save() {
  const text = $('t').value.trim(); if (!text) { window.api.capHide(); return; }
  await window.api.capSave({ text, tags: $('tg').value.trim() });
  $('ok').hidden = false; setTimeout(reset, 400);
}
$('sv').onclick = save;
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') window.api.capHide();
  else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); }
});
window.api.onCapReset(() => { ini(); reset(); });
window.api.onCapBlur(() => { if ($('t').value.trim()) save(); else window.api.capHide(); });
ini(); $('t').focus();
