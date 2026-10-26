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
