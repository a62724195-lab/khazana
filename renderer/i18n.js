/* واجهة إنجليزية: يترجم النصوص العربية (حسب قاموس) تلقائياً، ويرجّعها عربي عند الطلب */
(function () {
  const D = {
    "الإعدادات": "Settings",
    "البيانات والنسخ": "Data & backup",
    "الاستيراد": "Import",
    "الأدوات": "Tools",
    "سطح المكتب": "Desktop",
    "حول والتحديث": "About & updates",
    "اللغة": "Language",
    "لغة واجهة التطبيق.": "The app interface language.",
    "الثيم": "Theme",
    "شكل التطبيق الكامل.": "The overall look of the app.",
    "فاتح أو داكن أو حسب الويندوز (للثيم الأساسي).": "Light, dark or follow Windows (for the default theme).",
    "لون التطبيق": "App color",
    "اللون الرئيسي للأزرار والتحديد.": "The main color for buttons and selection.",
    "شكل العرض الافتراضي": "Default view",
    "بطاقات كبيرة أو صغيرة أو قائمة (سطر لكل عنصر).": "Large cards, small cards or a list (one row per item).",
    "الوصف تحت اسم العنصر.": "The description under the item name.",
    "الشارات الصغيرة على البطاقة.": "The small badges on the card.",
    "نسخة احتياطية الآن": "Back up now",
    "احفظ نسخة كاملة من خزنتك في ملف.": "Save a full copy of your vault to a file.",
    "حفظ نسخة": "Save a copy",
    "استعادة نسخة": "Restore a backup",
    "ادمج عناصر من ملف نسخة احتياطية.": "Merge items from a backup file.",
    "اختيار ملف": "Choose file",
    "النسخ التلقائي اليومي": "Daily automatic backup",
    "تُحفظ نسخة كل يوم وتبقى آخر 14. (تشغيله وإيقافه من أيقونة التراي)": "A copy is saved every day and the last 14 are kept. (Toggle it from the tray icon)",
    "فتح المجلد": "Open folder",
    "مكان النسخ التلقائية": "Auto-backup location",
    "غيّره إلى OneDrive أو فلاشة مثلاً.": "Change it to OneDrive or a USB drive, for example.",
    "تغيير المجلد": "Change folder",
    "المحذوفات تبقى 30 يوم قبل ما تُمسح.": "Deleted items stay 30 days before being erased.",
    "فتح السلة": "Open trash",
    "خزنة منفصلة لكل غرض (دراسة، عمل، ألعاب).": "A separate vault for each purpose (study, work, games).",
    "إدارة": "Manage",
    "برامجي المثبتة": "My installed programs",
    "من قائمة ابدأ مع أيقوناتها.": "From the Start menu, with their icons.",
    "استيراد": "Import",
    "ألعاب Steam و Epic": "Steam & Epic games",
    "تُضاف بأغلفتها لقسم «ألعاب».": "Added with their covers to a “Games” section.",
    "مفضلة Chrome و Edge": "Chrome & Edge bookmarks",
    "روابطك في قسم مع غرفة لكل مجلد.": "Your links in a section with a room per folder.",
    "يعيد قراءة أيقونات وصور الملفات.": "Re-reads file icons and images.",
    "تحديث": "Refresh",
    "بالذكاء الاصطناعي (يحتاج مفتاح).": "With AI (needs a key).",
    "تعبئة": "Fill",
    "اعثر على الملفات المفقودة والمكررات ونظّفها.": "Find missing files and duplicates, and clean them up.",
    "فحص": "Scan",
    "الأكثر فتحاً، ووقت الاستخدام، وآخر 7 أيام.": "Most opened, usage time, and the last 7 days.",
    "اكتب أي أمر أو عنصر وانفّذه (Ctrl+K).": "Type any command or item and run it (Ctrl+K).",
    "فتح": "Open",
    "لوحة الأوامر": "Command palette",
    "المجموعات": "Groups",
    "افتح عدة عناصر بضغطة، مع جدولة بوقت.": "Open several items in one click, with optional scheduling.",
    "مراقبة مجلد": "Watch a folder",
    "إشعار لكل ملف جديد في مجلد (مثل التنزيلات).": "A notification for each new file in a folder (like Downloads).",
    "اختيار مجلد": "Choose folder",
    "تتعبّى لحالها.": "Fills itself.",
    "أكثر ما تفتحه.": "What you open most.",
    "آخر ما أضفته.": "What you added last.",
    "عناصرك المثبّتة ⭐.": "Your pinned items ⭐.",
    "تشغيل / إيقاف": "Toggle",
    "حاوية لقسم": "Fence for a section",
    "من القائمة الجانبية: حط الماوس على أي قسم واضغط 🪟.": "From the sidebar: hover any section and click 🪟.",
    "اختصارات لوحة المفاتيح": "Keyboard shortcuts",
    "Ctrl+Alt+Space فتح خزنة · Ctrl+Alt+F بحث سريع · Ctrl+Alt+D إظهار الحاويات · Ctrl+Alt+V إضافة من الحافظة · Ctrl+K لوحة الأوامر": "Ctrl+Alt+Space open Khazana · Ctrl+Alt+F quick search · Ctrl+Alt+D show fences · Ctrl+Alt+V add from clipboard · Ctrl+K command palette",
    "مفتاح Anthropic API (اختياري)": "Anthropic API key (optional)",
    "بدون مفتاح كل شي يشتغل بالكلمات. بالمفتاح: تعرّف تلقائي على الملفات وبحث بالوصف. المفتاح مشفّر على جهازك.": "Without a key everything works with keywords. With a key: automatic file recognition and search by description. The key is encrypted on your device.",
    "إدارة المفتاح": "Manage key",
    "يجيب أحدث الملفات من GitHub ويعيد التشغيل.": "Fetches the latest files from GitHub and restarts.",
    "تحقق من التحديث": "Check for updates",
    "مزامنة ذكّرني مع الجوال": "Sync reminders with your phone",
    "حساب Supabase مجاني (اختياري).": "A free Supabase account (optional).",
    "إعداد المزامنة": "Set up sync",
    "خزنة مفتوحة المصدر ومجانية": "Khazana is free & open source",
    "الكود والتحميل والتحديثات على GitHub.": "Code, downloads and updates are on GitHub.",
    "فتح GitHub": "Open GitHub",
    "إغلاق (Esc)": "Close (Esc)",
    "✕ إغلاق": "Close",
    'اربط الملاحظات ببعض بـ [[اسم ملاحظة]]، وحط تذكير لأي سطر ⏰، والصق صور مباشرة.': 'Link notes with [[note name]], add a reminder to any line ⏰, and paste images directly.', 'ملاحظة سريعة من أي مكان:': 'Quick note from anywhere:', 'اكتب هنا… (- [ ] قائمة مهام، # عنوان، [[ ]] رابط لملاحظة، الصق صورة بـ Ctrl+V)': 'Write here… (- [ ] checklist, # heading, [[ ]] note link, paste an image with Ctrl+V)',
    'رابط لملاحظة [[ ]]': 'Link to a note [[ ]]', 'ذكّرني بالسطر الحالي': 'Remind me about the current line', 'ذكاء اصطناعي': 'AI', 'حماية بكلمة سر': 'Password protect', 'تصدير': 'Export', 'تثبيت': 'Pin', 'معاينة / تحرير': 'Preview / edit', 'حذف': 'Delete', 'عنوان': 'Heading', 'غامق': 'Bold', 'قائمة': 'List', 'اقتباس': 'Quote',
    '🔙 مشار لها من:': '🔙 Linked from:', '⏰ ذكّرني بهذا السطر': '⏰ Remind me about this line', 'بعد ساعة': 'In 1 hour', 'الليلة ٨': 'Tonight 8 PM', 'بكرة ٩ الصبح': 'Tomorrow 9 AM', 'بعد أسبوع': 'In a week', 'إضافة التذكير': 'Add reminder', 'اختر وقت جاي': 'Pick a future time',
    'كلمة السر': 'Password', 'حماية': 'Protect', 'أقفلها الحين': 'Lock now', 'إزالة الحماية': 'Remove protection', 'هذي الملاحظة محمية.': 'This note is protected.', 'اكتب كلمة السر لعرضها': 'Enter the password to view it', 'فتح': 'Open', 'كلمة السر غلط': 'Wrong password', 'كلمة السر 3 أحرف على الأقل': 'Password must be at least 3 characters', '🔒 محمية بكلمة سر': '🔒 Password protected', 'ملاحظة محمية': 'Protected note',
    '⬇️ تصدير الملاحظة': '⬇️ Export note', 'حفظ كملف Markdown (.md)': 'Save as Markdown (.md)', 'نسخ النص للحافظة': 'Copy text to clipboard', '⬇️ تصدير كل الملاحظات (Markdown)': '⬇️ Export all notes (Markdown)', '✨ ذكاء اصطناعي': '✨ AI', '📝 لخّص': '📝 Summarize', '☑️ استخرج المهام': '☑️ Extract tasks', '🏷️ اقترح وسوم': '🏷️ Suggest tags', '🪄 حسّن الصياغة': '🪄 Improve writing', 'تم التحسين': 'Improved', '↶ تراجع': '↶ Undo',
    '📝 ملاحظة سريعة': '📝 Quick note', 'اكتب فكرتك… (السطر الأول يصير العنوان)': 'Write your idea… (first line becomes the title)', 'وسوم (اختياري): فكرة، عمل…': 'Tags (optional): idea, work…', 'حفظ ✓': 'Save ✓', '✓ انحفظت في ملاحظاتي': '✓ Saved to My notes', 'Ctrl+Enter حفظ · Esc إغلاق': 'Ctrl+Enter save · Esc close', '📝 انحفظت الملاحظة': '📝 Note saved',
    '🖼️ انضافت الصورة (اضغط 👁 للمعاينة)': '🖼️ Image added (press 👁 to preview)', '⏰ انضاف التذكير': '⏰ Reminder added', '🔒 انحمت الملاحظة': '🔒 Note protected', 'انقفلت 🔒': 'Locked 🔒', 'انشالت الحماية': 'Protection removed', '📋 اننسخت': '📋 Copied', '✨ تم': '✨ Done', 'ما لقيت مهام': 'No tasks found', 'ما رجع شي مفيد': 'Nothing useful came back',
    '↑↓ تنقّل · Enter فتح · Shift+Enter بحث ذكي · Esc إغلاق': '↑↓ navigate · Enter open · Shift+Enter smart search · Esc close',
    "التصميم": "Design", "الثيمات": "Themes", "اختر شكل التطبيق الكامل.": "Pick the look of the whole app.", "اختر من الألوان أو اصنع لونك من القوس الملوّن.": "Pick a color or make your own with the rainbow dot.", "لون مخصّص": "Custom color", "زوايا البطاقات": "Card corners", "حادة أو دائرية أو كبسولة.": "Sharp, rounded or pill.", "عادي": "Normal", "حادة": "Sharp", "دائرية": "Round", "كبسولة": "Pill", "ستايل البطاقات": "Card style", "شكل البطاقة نفسها.": "The look of the card itself.", "مسطّح": "Flat", "إطار": "Outline", "ظل": "Shadow", "تدرّج": "Gradient", "زجاج": "Glass", "بارز": "Raised", "شريط": "Accent bar", "الكثافة": "Density", "المسافات بين العناصر.": "Spacing between items.", "مضغوط": "Compact", "واسع": "Roomy", "حجم البطاقات الكبيرة": "Big card width", "عرض البطاقة في العرض الكبير.": "Card width in the big view.", "نوع الخط": "Font", "خطوط موجودة في ويندوز.": "Fonts built into Windows.", "تاهوما": "Tahoma", "ناعم": "Soft", "كلاسيكي": "Classic", "يدوي": "Handwritten", "برمجي": "Code", "حجم الخط": "Font size", "كبّر أو صغّر كل النصوص.": "Make all text bigger or smaller.", "الخلفية": "Wallpaper", "تدرّج أو صورتك. تتغطّى بالبطاقات الشفافة.": "A gradient or your own picture. Cards turn slightly transparent.", "بدون": "None", "🖼️ صورتي": "\ud83d\uddbc\ufe0f My picture", "🖼️ انضافت الخلفية": "\ud83d\uddbc\ufe0f Wallpaper added", "تغبيش الخلفية": "Wallpaper blur", "يخلي الصورة ناعمة.": "Makes the picture soft.", "تعتيم الخلفية": "Wallpaper dimming", "يحسّن قراءة النص فوق الصورة.": "Helps text stay readable over a picture.", "حركة الماوس على البطاقة": "Card hover effect", "وش يصير لما تمرّر الماوس.": "What happens when you hover.", "ارتفاع": "Lift", "توهّج": "Glow", "تكبير": "Zoom", "ميلان": "Tilt", "الحركات": "Animations", "سلسة أو نطّاطة أو بدون حركات (للأجهزة الضعيفة).": "Smooth, bouncy, or none (for weak PCs).", "نطّاط": "Bouncy", "مفاجأة": "Surprise me", "ثيم ولون وستايل عشوائي. جرّب أكثر من مرة!": "A random theme, color and style. Try it a few times!", "🎲 عشوائي": "\ud83c\udfb2 Random", "رجّع الافتراضي": "Reset to default", "يرجّع كل التصميم لأصله (بياناتك ما تتأثر).": "Resets the whole design (your data is untouched).", "إعادة ضبط": "Reset", "🎨 رجع التصميم الافتراضي": "\ud83c\udfa8 Default design restored", "محيط": "Ocean", "غابة": "Forest", "موكا": "Mocha", "منتصف الليل": "Midnight", "ريترو تيرمنال": "Retro terminal", "وردي": "Rose", "لافندر": "Lavender", "نعناع": "Mint", "سماء": "Sky",
    "🏠 اليوم": "🏠 Today", "🎨 لوحتي": "🎨 My board", "🏠 صفحة اليوم": "🏠 Today page", "🔔 تذكيرات اليوم": "🔔 Today's reminders", "📝 ملاحظاتك": "📝 Your notes", "⭐ الأكثر استخداماً": "⭐ Most used", "🕘 فتحتها مؤخراً": "🕘 Opened recently", "🌙 سهران؟": "🌙 Up late?", "☀️ صباح الخير": "☀️ Good morning", "🌤️ طاب يومك": "🌤️ Good afternoon", "🌆 مساء الخير": "🌆 Good evening", "🌙 تصبح على خير": "🌙 Good night", "📝 ملاحظة سريعة": "📝 Quick note", "➕ إضافة عنصر": "➕ Add item", "🔔 تذكير": "🔔 Reminder", "🔎 بحث شامل (Ctrl+K)": "🔎 Universal search (Ctrl+K)", "ما عندك تذكيرات اليوم 🎉": "No reminders today 🎉", "لسا ما كتبت ملاحظات.": "No notes yet.", "افتح عناصرك وبتظهر هنا.": "Open your items and they will show up here.", "ما فتحت شي لسا.": "You haven't opened anything yet.", "يفتح على صفحة اليوم": "Open on the Today page", "أول ما تفتح البرنامج تشوف ملخص يومك.": "See your day summary when the app opens.", "+ لوحة": "+ Board", "لوحة جديدة": "New board", "📝 نص": "📝 Text", "🖼️ صورة": "🖼️ Image", "🗄️ عنصر": "🗄️ Item", "📓 ملاحظة": "📓 Note", "⤢ عرض الكل": "⤢ Fit all", "اسم اللوحة": "Board name", "حفظ": "Save", "اسحب الخلفية للتحريك · عجلة الماوس للتقريب · اسحب النقطة ● لربط بطاقتين · ضغطتين على الخلفية = نص جديد": "Drag background to pan · wheel to zoom · drag the ● dot to link two cards · double-click background = new text", "اختر عنصر من الخزنة": "Pick an item from the vault", "اختر ملاحظة": "Pick a note", "ابحث…": "Search…", "ما فيه شي": "Nothing here", "العنصر محذوف": "Item deleted", "الملاحظة محذوفة": "Note deleted", "لوحتي": "My board", "اسحب للتحريك": "Drag to pan", "إعادة تسمية": "Rename", "حذف اللوحة": "Delete board", "حذف المحدد (Delete)": "Delete selected (Delete)", "اسحب لربط": "Drag to link",
    "🔧 إصلاح تلقائي": "🔧 Auto-fix", "📂 اختر المجلد اللي نقلتهم له": "📂 Choose the folder you moved them to", "🧹 تفاصيل": "🧹 Details", "إخفاء": "Hide", "📂 دوّر في مجلد…": "📂 Search in a folder…", "يطبّق على اللي تحدده، وإذا ما حددت شي يطبّق على الكل": "Applies to what you select, or to all if nothing is selected", "🔍 أدوّر على الملفات اللي انتقلت…": "🔍 Looking for the files that moved…", "تعذّر البحث": "Search failed", "ما لقيتهم. جرّب «اختر المجلد» ودلّني وين نقلتهم": "Not found. Try “Choose the folder” and show me where you moved them",
    "🔄 فيه تحديث جديد للتطبيق": "🔄 A new app update is available", "حدّث الحين": "Update now", "لاحقاً": "Later", "⏳ أنزّل التحديث…": "⏳ Downloading update…", "✅ تم! يعيد التشغيل…": "✅ Done! Restarting…",
    '🎨 التصميم': '🎨 Design', 'اللون': 'Color', 'الشفافية': 'Opacity', 'استدارة الزوايا': 'Corner radius', 'حجم الأيقونات': 'Icon size', 'طريقة العرض': 'Layout', 'صغير': 'Small', 'وسط': 'Medium', 'كبير': 'Large', 'شبكة': 'Grid', 'قائمة': 'List', 'شريط Dock': 'Dock bar', 'الأسماء ظاهرة': 'Names shown', 'بدون أسماء': 'No names', 'طبّق على كل الحاويات': 'Apply to all fences', 'إعادة الضبط': 'Reset', '✓ تم': '✓ Done', 'تلقائي': 'Auto', 'تصميم الحاوية': 'Fence design',
    'زجاجي': 'Glass', 'ليلي': 'Night', 'ورقي': 'Paper', 'نيون': 'Neon', 'شفق': 'Aurora', 'بسيط': 'Minimal', 'لاصقة': 'Sticky', 'ريترو': 'Retro', 'غروب': 'Sunset', 'ميكا': 'Mica',
    'ملاحظاتي': 'My notes', '🔎 ابحث في ملاحظاتك…': '🔎 Search your notes…', '+ جديدة': '+ New', 'فاضية': 'Empty', 'بدون عنوان': 'Untitled', 'قائمة مهام': 'Checklist', '💡 فكرة': '💡 Idea', '📅 ملاحظات اجتماع': '📅 Meeting notes', '📓 يومية': '📓 Daily journal', '📝 فاضية': '📝 Blank', '+ ملاحظة فاضية': '+ Blank note', 'العنوان': 'Title', 'وسوم: عمل، فكرة، دراسة…': 'Tags: work, idea, study…', 'اكتب هنا… (استخدم - [ ] لقائمة مهام، # لعنوان)': 'Write here… (use - [ ] for a checklist, # for a heading)', 'اربط عنصر من الخزنة': 'Link a vault item', 'ابحث…': 'Search…', 'ما لقيت شي': 'Nothing found', '✓ محفوظ': '✓ Saved', 'تحذف هذي الملاحظة؟': 'Delete this note?', 'ملاحظة جديدة': 'New note', 'قائمة مهام جديدة': 'New checklist', 'فكرة جديدة': 'New idea', '‹ القائمة': '‹ List', 'الحين': 'now',
    'ما لقيت ملاحظة بهالبحث.': 'No notes match this search.', 'اختر ملاحظة من القائمة أو ابدأ وحدة جديدة.': 'Pick a note from the list or start a new one.',
    'خزنة': 'Khazana', 'الخزنة': 'Vault', 'الكل': 'All', 'غير مرتبة': 'Unsorted', 'أضف ملاحظة': 'Add note', 'ذكّرني': 'Remind me', 'إضافة': 'Add', 'ملفات / صور / برامج': 'Files / images / programs', 'مجلد': 'Folder', 'رابط': 'Link', 'ملاحظة': 'Note',
    'استيراد برامجي المثبتة': 'Import my installed programs', 'تحديث صور كل العناصر': 'Refresh all thumbnails', 'فحص الملفات الميتة والمكررة': 'Scan dead & duplicate files',
    'استيراد ألعاب Steam و Epic': 'Import Steam & Epic games', 'استيراد مفضلة Chrome / Edge': 'Import Chrome / Edge bookmarks', 'سلة المحذوفات': 'Trash',
    'الملفات الشخصية (خزنة لكل غرض)': 'Profiles (a vault per purpose)', 'اختيار مجلد مراقَب': 'Choose a watched folder', 'لوحة الأوامر (Ctrl+K)': 'Command palette (Ctrl+K)',
    'تحديث التطبيق (من GitHub)': 'Update app (from GitHub)', 'إحصائيات خزنتي': 'My vault stats', 'حاوية ذكية: فتحتها مؤخراً': 'Smart fence: recently opened', 'حاوية ذكية: الأكثر استخداماً': 'Smart fence: most used',
    'حاوية ذكية: أضفتها حديثاً': 'Smart fence: recently added', 'حاوية ذكية: المثبّتة': 'Smart fence: pinned', 'فتح مجلد النسخ التلقائية': 'Open auto-backup folder', 'تغيير مجلد النسخ التلقائية': 'Change auto-backup folder',
    'عبّي الأوصاف الناقصة': 'Fill missing descriptions', 'نسخة احتياطية': 'Backup', 'استعادة نسخة': 'Restore a backup', 'الذكاء الاصطناعي': 'AI', 'الأقسام': 'Sections', 'قسم جديد': 'New section',
    'اسحب أي عنصر وأفلته على قسم لنقله.': 'Drag any item and drop it on a section to move it.', 'تخصيص': 'Customize', 'اللون': 'Color', 'اللغة / Language': 'Language / اللغة', 'العربية': 'العربية', 'ثيم': 'Theme',
    'الأساسي': 'Default', 'ليلي': 'Night', 'زجاجي': 'Glass', 'ورقي': 'Paper', 'نيون': 'Neon', 'المظهر': 'Appearance', 'تلقائي': 'Auto', 'فاتح': 'Light', 'داكن': 'Dark',
    'إظهار الوصف': 'Show description', 'إظهار التصنيف والوسوم': 'Show category & tags', 'طبّق شكل العرض الحالي على كل الأقسام': 'Apply the current view to all sections',
    'مجموعات': 'Groups', 'تحديد': 'Select', 'الأحدث': 'Newest', 'الأكثر فتحاً': 'Most opened', 'الاسم': 'Name', 'محدد': 'selected', 'تحديد الكل': 'Select all', 'لون': 'Color', 'بدون لون': 'No color',
    'أحمر': 'Red', 'برتقالي': 'Orange', 'أصفر': 'Yellow', 'أخضر': 'Green', 'أزرق': 'Blue', 'بنفسجي': 'Purple', 'وردي': 'Pink', 'حذف': 'Delete', 'إلغاء': 'Cancel',
    'أفلت هنا (أو على قسم معيّن في القائمة)': 'Drop here (or on a section in the list)', 'تغيير المسار': 'Change path', 'وصف': 'Description', 'الرابط': 'URL', 'القسم': 'Section', 'الحالة': 'Status',
    'أستخدمه': 'In use', 'بعدين': 'Later', 'التصنيف': 'Category', 'كلمات مفتاحية': 'Keywords', 'تعرّف عليه بالذكاء الاصطناعي': 'Identify with AI', 'اقبل الباقي تلقائياً': 'Accept the rest automatically',
    'حفظ': 'Save', 'اسم القسم': 'Section name', 'داخل قسم': 'Inside section', 'قفل بكلمة سر': 'Lock with a password', 'إزالة القفل عن هذا القسم': 'Remove the lock from this section', 'رمز': 'Icon',
    'مجموعة': 'Group', 'اختر العناصر اللي تنفتح معها': 'Choose the items that open with it', 'شغّلها تلقائياً كل يوم الساعة': 'Run automatically every day at',
    'الأحد': 'Sun', 'الاثنين': 'Mon', 'الثلاثاء': 'Tue', 'الأربعاء': 'Wed', 'الخميس': 'Thu', 'الجمعة': 'Fri', 'السبت': 'Sat', 'وشغّلها أيضاً كل ما فتحت التطبيق': 'Also run whenever the app starts',
    'فحص الخزنة': 'Vault scan', 'إغلاق': 'Close', 'احذف المحدد من الخزنة': 'Delete selected from the vault', '(تبقى 30 يوم ثم تُمسح)': '(kept 30 days, then deleted)', 'تبقى 30 يوم ثم تُمسح': 'kept 30 days, then deleted',
    'إفراغ السلة': 'Empty trash', 'الملفات الشخصية': 'Profiles', 'كل ملف شخصي له خزنة منفصلة بالكامل (مثلاً: دراسة، عمل، ألعاب). التبديل يعيد تحميل التطبيق.': 'Each profile has a completely separate vault (e.g. study, work, games). Switching reloads the app.',
    'إنشاء وتبديل': 'Create & switch', 'ذكّرني بهذا العنصر': 'Remind me about this item', 'بعد ساعة': 'In 1 hour', 'الليلة 9 م': 'Tonight 9 PM', 'بكرة 9 ص': 'Tomorrow 9 AM', 'حفظ التذكير': 'Save reminder',
    'وقت الاستخدام يُحسب لبرامج .exe والاختصارات وهي شغّالة (كل 30 ثانية).': 'Usage time is counted for .exe programs and shortcuts while running (every 30 seconds).',
    'الذكاء الاصطناعي (اختياري)': 'AI (optional)', 'مفتاح Anthropic API': 'Anthropic API key', 'حذف المفتاح': 'Delete key',
    'اكتب أو اشرح شنو تبي: «أبي شي أحوّل فيه PDF» أو «صورة العقد»…': 'Type or describe what you need: “something to convert a PDF” or “the contract photo”…', 'بحث ذكي (Enter)': 'Smart search (Enter)', 'المزيد': 'More',
    'بطاقات كبيرة': 'Large cards', 'بطاقات صغيرة': 'Small cards', 'قائمة: سطر لكل عنصر': 'List: one row per item', 'تخصيص الواجهة': 'Customize the interface', 'مجموعات: افتح عدة عناصر بضغطة': 'Groups: open several items in one click',
    'تحديد عدة عناصر (أو اسحب بالماوس على مساحة فاضية)': 'Select several items (or drag the mouse on an empty area)', 'الترتيب': 'Sort', 'مثلاً: الملفات المهمة': 'e.g. Important files', 'اتركها فاضية إذا ما تبي قفل': 'Leave empty for no lock',
    'اسم المجموعة: مثلاً وضع الدراسة': 'Group name, e.g. Study mode', 'ابحث في العناصر…': 'Search items…', 'اسم ملف جديد': 'New profile name', 'اكتب أمر أو اسم عنصر أو قسم…': 'Type a command, item or section…',
    'برامج': 'Programs', 'صور': 'Images', 'فيديو': 'Video', 'صوت': 'Audio', 'مستندات': 'Documents', 'أرشيف': 'Archives', 'أكواد': 'Code', 'مجلدات': 'Folders', 'روابط': 'Links', 'ملاحظات': 'Notes', 'أخرى': 'Other', 'مضغوطات': 'Archives', 'ألعاب': 'Games',
    'تشغيل': 'Launch', 'فتح الرابط': 'Open link', 'عرض': 'View', 'فتح': 'Open', 'تراجع': 'Undo', 'مع محتوى الغرف': 'Include rooms’ content', 'ما لقيت شي مناسب في خزنتك.': 'Nothing suitable found in your vault.',
    'اقتراحات ما عندك': 'Suggestions you don’t have', 'بدون قسم': 'No section', 'نص الملاحظة': 'Note text', 'وصف (شنو هذا ولشنو تستخدمه؟)': 'Description (what is it and what do you use it for?)', 'إضافة رابط': 'Add link', 'انضاف': 'Added', 'ملاحظة جديدة': 'New note', 'انضافت': 'Added',
    'الملف مو موجود في مكانه. اضغط ✏️ ثم «تغيير المسار»': 'The file is not in its place. Click ✏️ then “Change path”', 'ما قدرت أفتحه': 'Could not open it', 'تعديل': 'Edit', 'انضاف لقائمة «بعدين»': 'Added to “Later”',
    'تثبّت في الأعلى': 'Pinned to the top', 'انلغى التثبيت': 'Unpinned', 'تعذّر الحفظ': 'Could not save', 'تم حفظ المفتاح': 'Key saved', 'انحذف المفتاح': 'Key deleted', 'تم حفظ النسخة الاحتياطية': 'Backup saved', 'الملف غير صالح': 'Invalid file',
    'طُبّق شكل العرض على كل الأقسام': 'View applied to all sections', 'هذا الرابط مضاف من قبل': 'This link is already added', 'المجموعة فاضية': 'The group is empty', 'تعديل المجموعة': 'Edit group', 'مجموعة جديدة': 'New group', 'انحفظت المجموعة': 'Group saved',
    'مجموعة جديدة+': 'New group', 'غرفة جديدة': 'New room', 'غير مرتبة': 'Unsorted', 'مفقود': 'Missing', 'أقفل الآن': 'Lock now', 'مسح البحث': 'Clear search', 'فتح كلمة السر': 'Unlock', 'كلمة السر': 'Password', 'اكتب كلمة السر لعرض محتواه': 'Enter the password to view its contents',
    'انقفل': 'Locked', 'انفتح': 'Unlocked', 'كلمة السر غلط': 'Wrong password', 'تعديل / نقل': 'Edit / move', 'حذف القسم': 'Delete section', 'حاوية على سطح المكتب': 'Desktop fence', 'إظهار في المجلد': 'Show in folder', 'ذكّرني بهذا': 'Remind me about this', 'تثبيت في الأعلى': 'Pin to top', 'إلغاء التثبيت': 'Unpin',
    'ما في عناصر هنا': 'No items here', 'اسحب ملفات جديدة هنا، أو اسحب عناصر من الخزنة وأفلتها على هذا القسم أو على إحدى غرفه.': 'Drag new files here, or drag items from the vault onto this section or one of its rooms.',
    'خزنتك جاهزة': 'Your vault is ready', 'اسحب أي ملف أو صورة أو برنامج أو مجلد وأفلته هنا،': 'Drag any file, image, program or folder and drop it here,', 'وخزنة تسألك عنه وتحفظه وتعرف تلاقيه بوصفه.': 'and Khazana will save it and help you find it by description.',
    'أضف ملفات': 'Add files', 'استورد برامجي المثبتة': 'Import my installed programs', 'أضف رابط': 'Add link', 'نقل إلى قسم…': 'Move to section…', 'نقل إلى قسم': 'Move to section', 'بدون قسم 📥': 'No section',
    'عنصر': 'items', 'مرة فتح': 'opens', 'وقت استخدام': 'usage time', 'ما فتحتها أبداً': 'never opened', 'مفقودة': 'missing', 'أكثر وقت استخدام': 'Most usage time', 'حسب النوع': 'By type', 'آخر 7 أيام (مرات الفتح)': 'Last 7 days (opens)',
    'لسا ما فتحت شي من خزنة.': 'You haven’t opened anything from Khazana yet.', 'ملفات مفقودة': 'Missing files', 'مكررات': 'Duplicates', 'يبقى': 'Keep', 'غيّر المسار': 'Change path', 'نفس المسار': 'Same path', 'نفس الرابط': 'Same URL', 'نفس الاسم والحجم': 'Same name and size',
    'كل ملفاتك موجودة في أماكنها.': 'All your files are in place.', 'ما في مكررات.': 'No duplicates.', 'أفحص ملفاتك…': 'Scanning your files…', 'السلة فاضية.': 'Trash is empty.', 'استرجاع': 'Restore', 'ما لقيت شي': 'Nothing found', 'ما لقيت شي.': 'Nothing found.',
    'ما عندك مجموعات. مثلاً «وضع الدراسة» تفتح متصفح + ملفاتك + ملاحظاتك بضغطة.': 'No groups yet. E.g. “Study mode” opens a browser + your files + notes in one click.',
    'مجموعة جديدة +': 'New group', 'فتح التطبيق': 'Open app', 'أبحث عن تحديث…': 'Checking for updates…', 'عندك آخر نسخة': 'You have the latest version', 'أنزّل التحديث…': 'Downloading the update…', 'تم! يعيد التشغيل…': 'Done! Restarting…',
    'فيه تحديث جديد لخزنة — من ⋯ اختر «تحديث التطبيق»': 'A new Khazana update is available — ⋯ → “Update app”', 'القسم فاضي.': 'This section is empty.', 'اسحب ملفات وأفلتها هنا لإضافتها.': 'Drag files and drop them here to add them.',
    'هذا القسم مقفل بكلمة سر.': 'This section is locked with a password.', 'افتحه من نافذة خزنة.': 'Open it from the Khazana window.', 'القسم انحذف': 'The section was deleted', 'هذا القسم انحذف من الخزنة.': 'This section was deleted from the vault.', 'اضغط ✕ لإغلاق الحاوية.': 'Click ✕ to close the fence.',
    'ما في عناصر بعد.': 'No items yet.', 'تتعبّى لحالها وأنت تستخدم خزنة.': 'It fills itself as you use Khazana.', 'فتحتها مؤخراً': 'Recently opened', 'الأكثر استخداماً': 'Most used', 'أضفتها حديثاً': 'Recently added', 'المثبّتة': 'Pinned',
    'ما عندك مجموعات.': 'No groups yet.', 'سوّها من خزنة ← ⚡ مجموعات.': 'Create them in Khazana → ⚡ Groups.', 'تفتح': 'opens', 'مجموعة: تفتح': 'Group: opens', 'ما لقيت بالكلمات. اضغط Shift+Enter للبحث الذكي بوصفك.': 'No keyword match. Press Shift+Enter for smart search by description.',
    'يفكر…': 'Thinking…', 'تعذّر البحث الذكي.': 'Smart search failed.', 'ما لقيت شي مناسب في خزنتك': 'Nothing suitable found in your vault', 'فتح · Enter': 'Open · Enter', 'بحث': 'Search', 'اكتب اسم أو وصف اللي تبيه…': 'Type a name or description…',
    'تنقّل': 'navigate', 'فتح': 'Open', 'بحث ذكي': 'smart search', 'إغلاق': 'Close', 'هذا الرابط مضاف من قبل.': 'This link is already added.', 'الحافظة ما فيها رابط أو ملف': 'The clipboard has no link or file',
    'مفضلة المتصفح': 'Browser bookmarks', 'حدّث resources أيضاً': 'Please update the resources folder too', 'اختر الوقت': 'Pick a time', 'ذكّرني': 'Remind me', 'حذف المجموعة': 'Delete group', 'احذف المحدد': 'Delete selected', 'إفراغ السلة نهائياً؟ ما يمديك ترجّعها بعدها.': 'Empty the trash permanently? You won’t be able to restore them.'
  };
  const P = [
    [/^تم تحديث (\d+) من (\d+)(?: · (\d+) ما لقيت لهم صورة)?$/, m => `Updated ${m[1]} of ${m[2]}${m[3] ? ` · ${m[3]} have no image` : ''}`],
    [/^🔄 فيه تحديث جديد للتطبيق \((\d+) ملف\)$/, m => `🔄 A new app update is available (${m[1]} files)`], [/^فشل التحديث: (.*)$/, m => `Update failed: ${m[1]}`],
    [/^⚠️ (\d+) عنصر مسارهم مفقود \(غالباً انتقلوا لمكان ثاني\)$/, m => `⚠️ ${m[1]} items have missing paths (probably moved elsewhere)`],
    [/^🔧 صلّحت مسار (\d+) عنصر(?: · باقي (\d+) ما لقيتهم)?$/, m => `🔧 Fixed ${m[1]} item path(s)${m[2] ? ` · ${m[2]} not found` : ''}`],
    [/^📝 ملاحظة: (.*)$/, m => `📝 Note: ${m[1]}`], [/^🔔 تذكير: (.*)$/, m => `🔔 Reminder: ${m[1]}`], [/^🎨 لوحة: (.*)$/, m => `🎨 Board: ${m[1]}`],
    [/^🗄️ (\d+) عنصر · 📝 (\d+) ملاحظة · 🎨 (\d+) بطاقة في اللوحة$/, m => `🗄️ ${m[1]} items · 📝 ${m[2]} notes · 🎨 ${m[3]} board cards`],
    [/^«(.*)» مقفل$/, m => `“${m[1]}” is locked`],
    [/^⏰ انضاف التذكير: (.*)$/, m => `⏰ Reminder added: ${m[1]}`], [/^📝 انسوّت ملاحظة جديدة: (.*)$/, m => `📝 Created note: ${m[1]}`], [/^تعذّر: (.*)$/, m => `Failed: ${m[1]}`],
    [/^(\d+) كلمة$/, m => `${m[1]} word(s)`], [/^(\d+) د$/, m => `${m[1]} min`], [/^(\d+) س$/, m => `${m[1]} h`], [/^(\d+) يوم$/, m => `${m[1]} d`], [/^📥 استيراد ملاحظات الخزنة \((\d+)\)$/, m => `📥 Import vault notes (${m[1]})`], [/^📥 انستوردت (\d+) ملاحظة$/, m => `📥 Imported ${m[1]} note(s)`],
    [/^(.+) \((\d+)\)$/, m => { const t = tr(m[1]); return t === m[1] ? null : `${t} (${m[2]})`; }],
    [/^الكل \((\d+)\)$/, m => `All (${m[1]})`], [/^بعدين \((\d+)\)$/, m => `Later (${m[1]})`], [/^نتائج البحث \((\d+)\)$/, m => `Search results (${m[1]})`],
    [/^انضاف (\d+) عنصر(?: من الحاوية)?$/, m => `Added ${m[1]} item(s)`], [/^انضاف (\d+) عنصر للخزنة$/, m => `Added ${m[1]} item(s) to the vault`], [/^انحذف (\d+) عنصر \(يبقى في السلة 30 يوم\)$/, m => `Deleted ${m[1]} item(s) (kept in trash for 30 days)`],
    [/^انتقل (\d+) عنصر إلى «(.*)»$/, m => `Moved ${m[1]} item(s) to “${m[2]}”`], [/^أُخرج (\d+) عنصر من القسم$/, m => `Removed ${m[1]} item(s) from the section`], [/^انضاف (\d+) برنامج$/, m => `Added ${m[1]} program(s)`],
    [/^انضافت (\d+) لعبة$/, m => `Added ${m[1]} game(s)`], [/^انضاف (\d+) رابط$/, m => `Added ${m[1]} link(s)`], [/^تم تلوين (\d+) عنصر$/, m => `Colored ${m[1]} item(s)`], [/^تم تحديث (\d+) من (\d+)$/, m => `Updated ${m[1]} of ${m[2]}`],
    [/^أحدّث الصور\.\.\. (\d+) من (\d+)$/, m => `Refreshing thumbnails… ${m[1]} of ${m[2]}`], [/^تمت كتابة (\d+) وصف$/, m => `Wrote ${m[1]} description(s)`], [/^\((\d+) محدد\)$/, m => `(${m[1]} selected)`],
    [/^ملفات مفقودة \((\d+)\)$/, m => `Missing files (${m[1]})`], [/^مكررات \((\d+) مجموعة\)$/, m => `Duplicates (${m[1]} groups)`], [/^احذف المحدد \((\d+)\) من الخزنة$/, m => `Delete selected (${m[1]}) from the vault`],
    [/^(.*) — العلامة على اللي يتحذف، واحد منهم يبقى$/, m => `${tr(m[1])} — checked items will be deleted, one is kept`], [/^حُذف (.*)$/, m => `Deleted ${m[1]}`], [/^انسترجع «(.*)»$/, m => `Restored “${m[1]}”`],
    [/^أشغّل «(.*)» \((\d+)\)$/, m => `Running “${m[1]}” (${m[2]})`], [/^انضاف الرابط: (.*)$/, m => `Link added: ${m[1]}`], [/^مجموعة: تفتح (\d+) عناصر$/, m => `Group: opens ${m[1]} items`],
    [/^حذف المجموعة «(.*)»؟ \(العناصر نفسها ما تتحذف\)$/, m => `Delete the group “${m[1]}”? (the items themselves are kept)`], [/^حذف القسم «(.*)»؟ ما يتحذف شي من محتواه: عناصره وغرفه تنتقل للقسم الأعلى\.$/, m => `Delete the section “${m[1]}”? Nothing is deleted: its items and rooms move up one level.`],
    [/^فيه تحديث جديد \((\d+) ملف\)\.\n?أحدّث الحين؟ التطبيق بيعيد تشغيل نفسه وبياناتك ما تتأثر\.$/, m => `An update is available (${m[1]} files).\nUpdate now? The app restarts itself and your data is not affected.`],
    [/^لقيت (\d+) برنامج جديد\. أضيفها كلها؟$/, m => `Found ${m[1]} new program(s). Add them all?`], [/^لقيت (\d+) لعبة جديدة .*$/s, m => `Found ${m[1]} new game(s). Add them to the “Games” section?`],
    [/^لقيت (\d+) رابط جديد في مفضلة المتصفح\..*$/s, m => `Found ${m[1]} new link(s) in your browser bookmarks. Add them under “Browser bookmarks” with a room per folder?`],
    [/^انضاف (\d+) رابط 🔖$/, m => `Added ${m[1]} link(s)`], [/^الأحدث$/, () => 'Newest'], [/^التحديد: (\d+)$/, m => `Selected: ${m[1]}`], [/^مضاف من قبل: (.*)$/, m => `Already added: ${m[1]}`],
    [/^تعذّر الذكاء الاصطناعي \((.*)\) — استخدمت البحث المحلي$/, m => `AI failed (${m[1]}) — used local search instead`], [/^فشل التحديث: (.*)$/, m => `Update failed: ${m[1]}`], [/^تعذّر الاتصال بـ GitHub: (.*)$/, m => `Could not reach GitHub: ${m[1]}`],
    [/^أراقب الآن: (.*) \(إشعار لكل ملف جديد\)$/, m => `Now watching: ${m[1]} (notification for each new file)`], [/^النسخ التلقائية صارت في: (.*)$/, m => `Auto-backups are now in: ${m[1]}`], [/^مكان بياناتك: (.*)$/, m => `Your data location: ${m[1]}`]
  ];
  let lang = 'ar', busy = false;
  const EL = /^[^\p{L}\p{N}«(]+/u, ER = /[^\p{L}\p{N}»)]+$/u;
  function tr(s) {
    if (lang !== 'en' || typeof s !== 'string' || !/[؀-ۿ]/.test(s)) return s;
    const lead = (EL.exec(s) || [''])[0]; let core = s.slice(lead.length); const tail = (ER.exec(core) || [''])[0]; core = core.slice(0, core.length - tail.length);
    if (!core) return s;
    if (D[core] !== undefined) return lead + D[core] + tail;
    const full = s.trim(); if (D[full] !== undefined) return D[full];
    for (const [re, f] of P) { const m = re.exec(core); if (m) { const r = f(m); if (r) return lead + r + tail; } const m2 = re.exec(full); if (m2) { const r = f(m2); if (r) return r; } }
    return s;
  }
  const SKIP = new Set(['SCRIPT', 'STYLE']);
  const ATTR = ['placeholder', 'title', 'aria-label'];
  function doText(n) {
    if (lang === 'en') {
      if (n.__ar !== undefined && n.data === n.__cur) return;
      if (!/[\u0600-\u06FF]/.test(n.data)) return;
      const t = tr(n.data);
      if (t !== n.data) { n.__ar = n.data; n.__cur = t; n.data = t; }
    } else if (n.__ar !== undefined) { n.data = n.__ar; n.__ar = undefined; }
  }
  function doEl(el) {
    if (!el.hasAttribute) return;
    for (const a of ATTR) {
      if (!el.hasAttribute(a)) continue;
      const k = '__ar_' + a, v = el.getAttribute(a);
      if (lang === 'en') {
        if (el[k] !== undefined && el[k + 'c'] === v) continue;
        if (!/[\u0600-\u06FF]/.test(v)) continue;
        const t = tr(v); if (t !== v) { el[k] = v; el[k + 'c'] = t; el.setAttribute(a, t); }
      } else if (el[k] !== undefined) { el.setAttribute(a, el[k]); el[k] = undefined; }
    }
  }
  function walk(root) {
    if (!root) return; busy = true;
    try {
      if (root.nodeType === 3) { doText(root); return; }
      if (root.nodeType !== 1 || SKIP.has(root.tagName)) return;
      doEl(root);
      const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: n => (n.nodeType === 1 && SKIP.has(n.tagName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
      let n; while ((n = tw.nextNode())) { if (n.nodeType === 3) { if (!n.parentNode || n.parentNode.tagName !== 'TEXTAREA') doText(n); } else doEl(n); }
    } finally { busy = false; }
  }
  let mo = null;
  function set(l) {
    lang = l === 'en' ? 'en' : 'ar';
    const h = document.documentElement; h.lang = lang; h.dir = lang === 'en' ? 'ltr' : 'rtl';
    walk(document.body); if (mo) mo.takeRecords();
    if (document.title) document.title = lang === 'en' ? tr(document.title) : (document.__arTitle || document.title);
    if (!mo) {
      mo = new MutationObserver(ms => {
        if (busy) return;
        for (const m of ms) {
          if (m.type === 'childList') m.addedNodes.forEach(n => walk(n));
          else if (m.type === 'characterData') { busy = true; try { doText(m.target); } finally { busy = false; } }
          else if (m.type === 'attributes') { busy = true; try { doEl(m.target); } finally { busy = false; } }
        }
        mo.takeRecords();
      });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
      mo.takeRecords();
    }
  }
  const oc = window.confirm.bind(window); window.confirm = s => oc(tr(String(s)));
  window.I18N = { set, tr, get: () => lang, auto: () => (navigator.language || 'ar').toLowerCase().startsWith('ar') ? 'ar' : 'en' };
})();
