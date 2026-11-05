/* لمسات التصميم: رسومات للحالات الفارغة + جولة الترحيب (تشتغل فوق التطبيق بدون ما تغيّر منطقه) */
(() => {
  const IC = {"vault": "<rect width=\"20\" height=\"5\" x=\"2\" y=\"3\" rx=\"1\"/><path d=\"M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8\"/><path d=\"M10 12h4\"/>", "note": "<path d=\"M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4\"/><path d=\"M2 6h4\"/><path d=\"M2 10h4\"/><path d=\"M2 14h4\"/><path d=\"M2 18h4\"/><path d=\"M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z\"/>", "bell": "<path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\"/><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\"/>", "folder": "<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\"/>"};
  const art = k => `<svg class="eart" viewBox="0 0 120 96" aria-hidden="true"><ellipse cx="60" cy="86" rx="34" ry="5" class="sh"/><circle cx="60" cy="46" r="38" class="bl"/><rect x="34" y="20" width="52" height="52" rx="14" class="cd"/><g transform="translate(46 32) scale(1)" class="gl" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${IC[k]}</g><path class="sp" d="M96 18v8M92 22h8M20 58v6M17 61h6" /><circle cx="24" cy="28" r="2.5" class="dt"/><circle cx="100" cy="64" r="2" class="dt"/></svg>`;
  const kindOf = el => {
    const t = el.textContent || '';
    if (el.classList.contains('nempty')) return 'note';
    if (/تذكير|reminder/i.test(t)) return 'bell';
    if (/ملاحظ|note/i.test(t)) return 'note';
    return 'vault';
  };
  function decorate(root) {
    root.querySelectorAll && root.querySelectorAll('.empty:not([data-art]),.nempty:not([data-art]),.zk-mut:not([data-art])').forEach(el => {
      el.setAttribute('data-art', '1');
      if (el.classList.contains('zk-mut') && !/^\s*(ما فيه|ما عندك|لا يوجد|No |Nothing)/i.test(el.textContent || '')) return; // بس رسائل «فاضي»، مو العناوين والتواريخ
      el.insertAdjacentHTML('afterbegin', art(kindOf(el)));
    });
  }
  new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(n => n.nodeType === 1 && (decorate(n), n.matches && n.matches('.empty,.nempty,.zk-mut') && decorate(n.parentNode))); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => decorate(document));

  /* ---------- جولة الترحيب ---------- */
  const T = {
    ar: [
      ['vault', 'خزنتك لكل شي', 'ملفات، برامج، صور، مجلدات وروابط في مكان واحد. اسحبها وأفلتها وخلاص، وابحث فيها بالكلام العادي.'],
      ['note', 'ملاحظات وتذكيرات ولوحة', 'اكتب ملاحظاتك، ضبط تذكيرات، وارسم أفكارك على لوحة حرة تربط فيها الملفات والملاحظات.'],
      ['palette', 'سوّه على ذوقك', 'اختر شكل البرنامج من الحين. تقدر تغيّره بعدين من الإعدادات ← التصميم.']
    ],
    en: [
      ['vault', 'Your vault for everything', 'Files, apps, images, folders and links in one place. Drag & drop them in and search in plain words.'],
      ['note', 'Notes, reminders & a canvas', 'Write notes, set reminders, and sketch ideas on a free board linking files and notes together.'],
      ['palette', 'Make it yours', 'Pick a look now. You can change it anytime from Settings → Design.']
    ]
  };
  const LOOKS = [['', '#2f6b5b'], ['midnight', '#6c8cff'], ['sunset', '#ff8a5c'], ['glass', '#8be9fd']];
  const PAL = '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>';
  IC.palette = PAL;
  function show() {
    const L = (typeof ui !== 'undefined' && ui.lang) === 'en' ? 'en' : 'ar'; const S = T[L]; let i = 0;
    const d = document.createElement('div'); d.id = 'tour'; d.dir = L === 'en' ? 'ltr' : 'rtl';
    const done = () => { d.classList.add('out'); setTimeout(() => d.remove(), 350); };
    function draw() {
      const [k, t, p] = S[i];
      d.innerHTML = `<div class="tbox"><div class="tart">${art(k)}</div><h2>${t}</h2><p>${p}</p>` +
        (i === 2 ? `<div class="tlooks">${LOOKS.map(([pr, c]) => `<button data-pr="${pr}" style="--c:${c}" class="${(ui.preset || '') === pr ? 'on' : ''}"></button>`).join('')}</div>` : '') +
        `<div class="tdots">${S.map((_, j) => `<i class="${j === i ? 'on' : ''}"></i>`).join('')}</div>` +
        `<div class="tbtn"><button class="tskip">${L === 'en' ? 'Skip' : 'تخطّي'}</button><button class="tnext">${i === 2 ? (L === 'en' ? 'Start' : 'يلا نبدأ') : (L === 'en' ? 'Next' : 'التالي')}</button></div></div>`;
      d.querySelector('.tskip').onclick = done;
      d.querySelector('.tnext').onclick = () => { if (i === 2) done(); else { i++; draw(); } };
      d.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => { ui.preset = b.dataset.pr; try { applyAppearance(); persist(); } catch (e) {} d.querySelectorAll('[data-pr]').forEach(x => x.classList.toggle('on', x === b)); });
    }
    draw(); document.body.appendChild(d);
  }
  window.Tour = { show };

  /* ميلان 3D لبطاقات الخزنة مع الماوس */
  const out = document.getElementById('out');
  if (out) {
    const reset = t => ['--rx', '--ry', '--px', '--py', '--gx', '--gy'].forEach(k => t.style.removeProperty(k));
    out.addEventListener('mousemove', e => {
      if (document.documentElement.dataset.mo === 'off') return;
      const t = e.target.closest('.tile'); out.querySelectorAll('.tile.tl').forEach(x => { if (x !== t) { x.classList.remove('tl'); reset(x); } });
      if (!t || t.classList.contains('sel')) return;
      const r = t.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      t.classList.add('tl'); t.style.setProperty('--ry', (px * 9) + 'deg'); t.style.setProperty('--rx', (-py * 9) + 'deg');
      t.style.setProperty('--px', (px * 10) + 'px'); t.style.setProperty('--py', (py * 8) + 'px'); t.style.setProperty('--gx', (px + .5) * 100 + '%'); t.style.setProperty('--gy', (py + .5) * 100 + '%');
    });
    out.addEventListener('mouseleave', () => out.querySelectorAll('.tile.tl').forEach(x => { x.classList.remove('tl'); reset(x); }));
  }
})();

/* توهج يتبع المؤشر على البطاقات */
(() => {
  let raf = 0, ev = null;
  document.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return; ev = e; if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; const t = ev.target && ev.target.closest && ev.target.closest('.tile,.wg'); if (!t) return; const r = t.getBoundingClientRect(); t.style.setProperty('--mx', (ev.clientX - r.left) + 'px'); t.style.setProperty('--my', (ev.clientY - r.top) + 'px'); });
  }, { passive: true });
})();

/* كونفيتي */
window.Fx = window.Fx || {};
window.Fx.confetti = function (x, y) {
  if (matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const cv = document.createElement('canvas'); cv.className = 'fxc'; cv.width = innerWidth; cv.height = innerHeight; document.body.appendChild(cv);
  const g = cv.getContext('2d'), acc = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#2f7a5e';
  const cols = [acc, '#f59e0b', '#ec4899', '#3b82f6', '#22c55e', '#facc15'], ox = x ?? innerWidth / 2, oy = y ?? innerHeight * .35;
  const P = Array.from({ length: 110 }, () => { const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 9; return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, w: 5 + Math.random() * 6, h: 3 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[Math.random() * cols.length | 0] }; });
  const t0 = performance.now();
  (function step(t) {
    const k = (t - t0) / 1700; g.clearRect(0, 0, cv.width, cv.height);
    P.forEach(p => { p.vy += .28; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.globalAlpha = Math.max(0, 1 - k * k); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); });
    if (k < 1) requestAnimationFrame(step); else cv.remove();
  })(t0);
};

/* نغمات التذكير (مركّبة بـ WebAudio، بدون ملفات) */
window.Fx.tone = function (name) {
  try {
    const A = window.Fx._ac = window.Fx._ac || new (window.AudioContext || window.webkitAudioContext)(); A.resume && A.resume();
    const M = { bell: [[1318.5, 0, 1.4], [1568, .16, 1.4], [2093, .32, 1.8]], chime: [[523.3, 0, .5], [659.3, .14, .5], [784, .28, .5], [1046.5, .42, 1]], drop: [[880, 0, .5], [660, .12, .8]], soft: [[392, 0, .9], [523.3, .22, 1.2]] };
    (M[name] || M.bell).forEach(([f, t, d]) => {
      const t0 = A.currentTime + t;
      [[1, .22], [2, .07], [3.01, .03]].forEach(([m, v]) => { const o = A.createOscillator(), g = A.createGain(); o.type = 'sine'; o.frequency.value = f * m; o.connect(g); g.connect(A.destination); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + .015); g.gain.exponentialRampToValueAtTime(.0001, t0 + d); o.start(t0); o.stop(t0 + d + .05); });
    });
  } catch (e) {}
};
