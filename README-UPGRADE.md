# دنيا الدورات — النسخة Course-First

هذه النسخة تعيد تعريف المشروع من **دليل منصات** إلى **دليل ذكي لدورات ومسارات تعليمية محددة**، مع بقاء المشروع 100% Static ويعمل مباشرة على GitHub Pages دون Backend.

## هوية المشروع

- الاسم: **دنيا الدورات**
- المطورون: **اتحاد شباب الأمة**
- الفكرة الأساسية: المستخدم لا يبحث عن منصة؛ بل يبحث عن المهارة أو الهدف، ثم يرى دورات محددة تساعده على اتخاذ قرار واضح.

## ماذا تغير؟

- استبدال `PLATFORMS_DATA` بـ `COURSES_DATA`.
- 14 دورة محددة في النسخة الأولية، و7 مسارات تعليمية.
- كل دورة تحتوي على:
  - الاسم والجهة المقدمة والمنصة.
  - المجال والمهارات.
  - المستوى والمدة.
  - مجاني/مدفوع.
  - الشهادة ونوعها.
  - لمن تناسب.
  - ماذا ستتعلم.
  - المتطلبات السابقة.
  - سبب الترشيح التحريري.
  - تقييم تحريري تفصيلي.
  - المصدر الرسمي.
  - تاريخ آخر تحقق من المعلومات.
  - الدورات المقترحة بعدها.

## الميزات التي لا تحتاج Backend

- بحث متعدد اللغات داخل الاسم والوصف والمهارات والجهة والمنصة.
- فلاتر: المجال، المستوى، المنصة، اللغة، المدة، المجاني، الشهادة.
- ترتيب حسب الترشيح، المدة، التقييم، الاسم، والمشاهدات المحلية.
- المفضلة باستخدام `localStorage`.
- سجل آخر الدورات التي تمت مشاهدتها.
- عداد مشاهدات محلي على جهاز المستخدم.
- مقارنة حتى 3 دورات.
- اختبار ترشيح سريع.
- مسارات تعليمية ثابتة مرتبطة بدورات حقيقية داخل الكتالوج.
- Dark Mode.
- مشاركة الدورة أو نسخ رابطها.
- PWA + Service Worker.
- العربية والإنجليزية والتركية.

## الملفات المهمة

- `index.html`: الصفحة التعريفية + محرك اكتشاف الدورات.
- `course.html`: صفحة تفاصيل الدورة.
- `js/data.js`: قاعدة بيانات الدورات والمسارات.
- `js/catalog-core.js`: منطق البحث والفلاتر والترتيب والترشيح.
- `js/app.js`: واجهة الصفحة الرئيسية.
- `js/detail.js`: واجهة صفحة الدورة.
- `js/i18n.js`: اللغات.
- `css/style.css`: التصميم.
- `sw.js`: PWA cache.

## إضافة دورة جديدة

أضف Object جديدًا إلى `COURSES_DATA` في `js/data.js` بنفس البنية الموجودة. أهم الحقول:

```js
{
  id: 'unique-course-id',
  title: 'Course title',
  title_ar: 'اسم الدورة بالعربية',
  title_tr: 'Türkçe başlık',
  summary: 'Short summary',
  summary_ar: 'ملخص عربي',
  summary_tr: 'Türkçe özet',
  platform: 'Platform',
  provider: 'Provider',
  category: 'programming',
  skills: ['Skill 1', 'Skill 2'],
  level: 'beginner',
  durationHours: 10,
  durationLabel: { ar: '10 ساعات', en: '10 hours', tr: '10 saat' },
  language: ['en'],
  free: true,
  certificate: true,
  sourceUrl: 'https://official-source.example/course',
  lastVerified: '2026-08-19'
}
```

## التصنيفات الحالية

- `programming`
- `data`
- `ai`
- `cybersecurity`
- `marketing`
- `project-management`
- `languages`

## الاختبارات

```bash
node --test tests/catalog-core.test.js tests/ui-structure.test.js
node --check js/app.js
node --check js/catalog-core.js
node --check js/data.js
node --check js/detail.js
node --check js/i18n.js
node --check sw.js
```

## ملاحظة البيانات

المعلومات التعليمية تتغير بمرور الوقت، خصوصًا الأسعار والشهادات ومدد البرامج. لذلك تعرض كل دورة رابط المصدر الرسمي وتاريخ آخر تحقق، ويجب تحديث `lastVerified` عند مراجعة أي سجل.
