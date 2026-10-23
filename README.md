# 🗄️ خزنة (Khazana)

تطبيق ويندوز مجاني ومفتوح المصدر: مكان واحد لكل ملفاتك وبرامجك وصورك وروابطك وملاحظاتك، مع أقسام وغرف، بحث بالوصف (بالذكاء الاصطناعي اختياري)، حاويات على سطح المكتب، مجموعات تشغيل، تذكيرات، وإحصائيات.

A free, open-source Windows desktop vault (Electron) for any file, program, image, folder, link or note — with nested sections, AI-assisted search (optional), desktop "fences", launch groups, reminders and stats.

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
