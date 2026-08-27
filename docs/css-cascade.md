# CSS cascade — مصدر واحد لكل قاعدة

## ترتيب الاستيراد (`src/main.jsx`)

1. `index.css` — أساس الألوان، الطباعة، مكوّنات عامة قديمة
2. ملفات الميزة (`trello`, `workspaces`, `archive`, …)
3. `design-system.css` — tokens + shell + أزرار/نماذج (بدون تخطيط مصفوفة)
4. `layout-shell.css` — تباعد الصفحة + العوامات فقط (كان layout-1400)
5. `sidebar-rail.css` — السكة الحالية
6. `matrix-stack.css` — **المصدر الوحيد** لتخطيط المصفوفة/TaskRow
7. `settings-tabs` / `kpi-motion` / `shortcuts-help` / `ux-motion`

## قواعد ملغاة من التعارض

| قاعدة | كانت في | المصدر المعتمد الآن |
|--------|---------|---------------------|
| `.matrix-grid` | index, design-system, layout-1400, visual-polish | **مهجور** — الواجهة تستخدم `.matrix-stack` |
| `.drop-zone` min-height | design-system, layout | **مهجور** مع الأقسام المسطّحة |
| `.sidebar` عرض/طي | design-system, visual-polish, sidebar-collapse | **`.sidebar-rail` فقط** |
| `.task-item` شريط أولوية | visual-polish | **`.task-row` في matrix-stack** |

## ملفات stub

- `layout-1400.css` → يُعاد توجيهه عبر `layout-shell.css` (نفس الاستيراد القديم مسموح)
- `visual-polish.css` → فارغ تقريباً (تعليق فقط) حتى لا يطغى
- `sidebar-collapse.css` → فارغ (السكة لا تستخدمه)
