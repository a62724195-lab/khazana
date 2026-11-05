# 🗄️ خزنة (Khazana)

🌐 **Website / الموقع:** https://a62724195-lab.github.io/khazana/

تطبيق ويندوز مجاني ومفتوح المصدر: مكان واحد لكل ملفاتك وبرامجك وصورك وروابطك وملاحظاتك، مع أقسام وغرف، بحث بالوصف (بالذكاء الاصطناعي اختياري)، حاويات على سطح المكتب، مجموعات تشغيل، تذكيرات، وإحصائيات.

A free, open-source Windows desktop vault (Electron) for any file, program, image, folder, link or note — with nested sections, AI-assisted search (optional), desktop "fences", launch groups, reminders and stats.

## ✨ المميزات / Features
- أقسام وغرف متداخلة، ألوان، تثبيت ⭐، قفل بكلمة سر، سلة محذوفات (30 يوم) / Nested sections, colors, pins, password-locked sections, 30-day trash
- بحث ذكي بالوصف (اختياري) + بحث سريع Ctrl+Alt+F + لوحة أوامر Ctrl+K / AI search (optional), quick search, command palette
- حاويات سطح المكتب (Fences) عادية وذكية مع سحب وإفلات / Desktop fences (normal + smart) with drag & drop
- استيراد ألعاب Steam وEpic، مفضلة Chrome/Edge، برامج قائمة ابدأ / Import Steam & Epic games, browser bookmarks, Start-menu apps
- مجموعات تشغيل (بجدولة ووقت)، إحصائيات ووقت استخدام / Launch groups (scheduled), stats & usage time
- أيقونات احترافية موحّدة بدل الإيموجي (Lucide، مجانية) / Unified professional icon set replacing emoji (Lucide, ISC)
- شريط جانبي، حركات ناعمة، واجهة زجاجية، جولة ترحيب، وأيقونة تطبيق جديدة / Sidebar nav, smooth motion, glass UI, welcome tour, new app icon
- حاويات: تتبع ثيم التطبيق، زجاج أكريليك/ميكا (ويندوز 11)، ظهور بحركة، Dock مكبّر / Fences follow app theme, acrylic/mica glass (Win11), entrance motion, magnifying dock
- الشريط الممتد: حاوية على حافة الشاشة بتكبير مثل Dock ماك وإخفاء تلقائي / Edge bar fence: full-edge dock with macOS-style magnification and auto-hide
- الحاويات العادية: أيقونات 3D ملوّنة بميلان حسب الماوس وزجاج جديد لامع / Regular fences: 3D tilting icons and a new glossy glass design
- الحاويات: عدّاد، مؤشر تشغيل، لون تلقائي لكل حاوية، حرف ملوّن للبرامج بلا أيقونة، ثيمات للشريط / Fences: counter, running dot, per-fence color, letter tiles, bar themes
- بطاقات 3D بميلان، أقسام بأيقونات ملوّنة، وثيمات جاهزة بخلفيات / 3D tilting cards, colored section icons, ready-made wallpaper themes
- الحاويات: سحب الأيقونات لإعادة الترتيب بحركة، ومجلدات منبثقة من الشريط الممتد / Fences: drag to reorder with motion, pop-out folders from the edge bar
- ملفات شخصية (خزنة لكل غرض)، نسخ احتياطي يومي تلقائي، إضافة من الحافظة (Ctrl+Alt+V)، مراقبة مجلد التنزيلات
- حاويات سطح المكتب بـ 10 تصاميم (زجاجي، نيون، ورقي، Dock…) وألوان وشفافية وأحجام قابلة للتخصيص / Desktop fences with 10 designs and full customization
- تخصيص كامل للتطبيق: 15 ثيم، ألوان ولون مخصّص، زوايا، ستايلات بطاقات، خطوط، خلفيات (تدرّج أو صورتك)، حركات وزر عشوائي / Full app personalization: 15 themes, custom accent, corners, card styles, fonts, wallpapers, motion and a random button
- صفحة "اليوم" تفتح عند التشغيل، بحث شامل Ctrl+K (عناصر + ملاحظات + تذكيرات + لوحات)، ولوحة حرّة (Canvas) للأفكار مع خطوط ربط / Today page, universal search and a free-form canvas board
- ملاحظاتي: روابط [[ ]] بين الملاحظات، تذكير لأي سطر، قفل، صور، تصدير Markdown، ذكاء اصطناعي، مزامنة، وملاحظة سريعة Ctrl+Alt+N / Notes with [[links]], per-line reminders, lock, images, export, AI, sync, quick capture
- تذكيرات (ذكّرني) مع مزامنة اختيارية للجوال / Reminders with optional phone sync
- واجهة عربية وإنجليزية / Arabic & English UI

## ⬇️ تحميل سريع / Download
حمّل `Khazana-Windows.zip` من صفحة [Releases](../../releases/latest) ← فك الضغط ← شغّل `Khazana.exe`. ما يحتاج تثبيت ولا Node.js.
(ويندوز ممكن يعرض تحذير SmartScreen لأن التطبيق غير موقّع: اضغط «More info» ثم «Run anyway».)

## التشغيل من الكود / Build from source
1. ثبّت [Node.js LTS](https://nodejs.org)
2. شغّل `2-ابني-ملف-exe.bat` ← يطلع مجلد `Khazana-App` فيه `Khazana.exe`
3. اختياري: `3-اختصار-سطح-المكتب.bat`

## التحديث / Updating
من داخل التطبيق: **⋯ ← 🔄 تحديث التطبيق**. يجيب الملفات المتغيرة فقط من هذا المستودع.
بعد أي رفع على `main` يحدّث GitHub Actions ملف `update/manifest.json` تلقائياً.

## الخصوصية / Privacy
بياناتك محفوظة محلياً في `%APPDATA%\khazana`. مفتاح Anthropic (اختياري) مشفّر بحساب ويندوز.

## الترخيص / License
MIT

---
Icons: [Lucide](https://lucide.dev) (ISC License), packed into `renderer/kzicons.woff`.
Font: [IBM Plex Sans Arabic](https://github.com/IBM/plex) (SIL OFL 1.1).

- ودجت للحاويات (ساعة / تقويم / عبارة اليوم) + أوامر جماعية للحاويات (فتح/طيّ/توسيع/إغلاق الكل)، وCtrl+Alt+D يخفي/يظهر الأشرطة الممتدة أيضاً.

- استرجاع من النسخ الاحتياطية التلقائية (مع حفظ نسخة من الحالية قبل الاسترجاع)، وحاويات: ملاحظات سريعة + مهام اليوم.

- تجميل: لون البطاقة من أيقونتها، توهج يتبع المؤشر، انتقال ناعم بين الصفحات، ثيم حسب الوقت، خلفية متحركة، كونفيتي، نغمات تذكير، حلقات الوقت، وإحصائيات أغنى.
