import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const targetUrl = process.env.UI_AUDIT_URL;
if (!targetUrl) throw new Error('UI_AUDIT_URL is required.');

const axePath = path.join(projectRoot, 'node_modules', 'axe-core', 'axe.min.js');
const axeSource = fs.readFileSync(axePath, 'utf8');
const auditDir = path.join(projectRoot, 'audit');
fs.mkdirSync(auditDir, { recursive: true });

const NAVIGATION = [
  { id: 'work', label: 'مساحة العمل', selector: 'button[title="مساحة العمل"]' },
  { id: 'projects', label: 'المشاريع', selector: 'button[title="المشاريع"]' },
  { id: 'reports', label: 'التقدم', selector: 'button[title="التقدم"]' },
  { id: 'notes', label: 'المفكرة', selector: 'button[title="المفكرة"]' },
  { id: 'settings', label: 'الإعدادات', selector: 'button[title="الإعدادات"]' },
];

function compact(text = '') {
  return text.replace(/\s+/g, ' ').trim();
}

async function waitForApp(page) {
  await page.waitForFunction(() => {
    const root = document.querySelector('#root');
    return root && root.textContent && !root.textContent.includes('جاري تحميل المهام');
  }, { timeout: 20_000 });
  await page.waitForTimeout(650);
}

async function inspectPage(page, pageInfo) {
  await page.addScriptTag({ content: axeSource });
  const snapshot = await page.evaluate((pageMeta) => {
    const compact = (text = '') => text.replace(/\\s+/g, ' ').trim();
    const styleSignature = (node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return {
        classes: node.className || '',
        width: Math.round(box.width),
        height: Math.round(box.height),
        radius: style.borderRadius,
        background: style.background,
        color: style.color,
        border: style.borderColor,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
      };
    };
    const accessibleName = (button) => compact(button.getAttribute('aria-label') || button.getAttribute('title') || button.innerText || button.value || '');
    const visible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const buttons = [...document.querySelectorAll('button')].filter(visible);
    const buttonIssues = buttons.map((button, index) => {
      const icons = [...button.querySelectorAll('i')];
      const iconStates = icons.map((icon) => ({
        classes: icon.className,
        before: getComputedStyle(icon, '::before').content,
        width: Math.round(icon.getBoundingClientRect().width),
        height: Math.round(icon.getBoundingClientRect().height),
      }));
      const name = accessibleName(button);
      const text = compact(button.innerText);
      const hasGlyphFailure = iconStates.some((icon) => icon.classes.includes('ph') && (icon.before === 'none' || icon.before === '""' || icon.before === ''));
      const iconOnly = icons.length > 0 && !text;
      const issue = [];
      if (!name) issue.push('زر بلا تسمية قابلة للوصول');
      if (iconOnly && !button.getAttribute('aria-label') && !button.getAttribute('title')) issue.push('زر أيقونة بلا وصف');
      if (hasGlyphFailure) issue.push('أيقونة Phosphor بلا رمز مرئي');
      return issue.length ? { index, name, text, issue, signature: styleSignature(button), iconStates } : null;
    }).filter(Boolean);

    const iconFailures = [...document.querySelectorAll('i.ph')].filter(visible).map((icon) => ({
      classes: icon.className,
      before: getComputedStyle(icon, '::before').content,
      width: Math.round(icon.getBoundingClientRect().width),
      height: Math.round(icon.getBoundingClientRect().height),
      text: compact(icon.parentElement?.innerText || ''),
    })).filter((icon) => icon.before === 'none' || icon.before === '""' || icon.before === '');

    const controlGroups = [...document.querySelectorAll('.work-toolbar, .project-filter-control, .settings-tabs, .knowledge-tabs, .knowledge-filter-list, .work-layout-switcher')].filter(visible).map((group) => {
      const label = compact(group.getAttribute('aria-label') || group.querySelector('h1,h2,h3,label,.project-filter-label')?.textContent || '');
      const controls = [...group.querySelectorAll('button')].filter(visible).map((button) => ({ text: compact(button.innerText), name: accessibleName(button), active: button.classList.contains('is-active') || button.classList.contains('active') }));
      return { classes: group.className, label, controls, hasVisiblePurpose: Boolean(label) || controls.every((control) => control.name) };
    });

    const primarySelectors = ['.btn-primary', '.work-add-button', '.project-new-button', '.projects-add-button', '.page-header .btn-primary'];
    const primaryActions = [...document.querySelectorAll(primarySelectors.join(','))].filter(visible).map((button) => ({ name: accessibleName(button), text: compact(button.innerText), signature: styleSignature(button) }));
    const primarySignatures = [...new Set(primaryActions.map((action) => JSON.stringify({ width: action.signature.width, height: action.signature.height, radius: action.signature.radius, background: action.signature.background, color: action.signature.color, fontSize: action.signature.fontSize, fontWeight: action.signature.fontWeight })))];

    const criticalCopy = [...document.querySelectorAll('button, [role="tab"], label')].filter(visible).map((node) => compact(node.innerText)).filter(Boolean);
    const knownQuestionableCopy = criticalCopy.filter((copy) => /تصفية المهام|كل المشاريع|طلب الإذن|تجربة/.test(copy));
    const todayGroupLabels = [...document.querySelectorAll('.work-task-group-head h2')].filter(visible).map((node) => compact(node.textContent));
    const visibleBodyText = compact(document.body.innerText);
    const todayTab = [...document.querySelectorAll('.work-mode-tabs button')].find((button) => compact(button.innerText).startsWith('اليوم'));
    const behavioral = {
      todayGroups: todayGroupLabels,
      hasTodayDecisionGroups: visibleBodyText.includes('ابدأ الآن') && (visibleBodyText.includes('لاحقًا اليوم') || visibleBodyText.includes('متأخرة تحتاج قرارًا') || visibleBodyText.includes('لا توجد مهام مقررة لهذا اليوم')),
      todayTabLabel: todayTab ? compact(todayTab.innerText) : null,
      hasUnscheduledGroup: todayGroupLabels.some((label) => label.includes('غير مجدولة')),
      hasProjectEmptyStateExplanation: Boolean([...document.querySelectorAll('body *')].find((node) => visible(node) && compact(node.textContent) === 'مهام غير مصنفة')),
    };

    return {
      page: pageMeta,
      title: document.title,
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      buttonCount: buttons.length,
      buttonIssues,
      iconFailures,
      controlGroups,
      primaryActions,
      primarySignatureCount: primarySignatures.length,
      knownQuestionableCopy,
      behavioral,
    };
  }, pageInfo);
  const axe = await page.evaluate(async () => {
    const results = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } });
    return results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.slice(0, 4).map((node) => ({ target: node.target, failureSummary: node.failureSummary })),
    }));
  });
  return { ...snapshot, axe };
}

function summarize(results) {
  const issues = [];
  for (const result of results) {
    for (const issue of result.buttonIssues) issues.push({ severity: issue.issue.some((item) => item.includes('بلا تسمية')) ? 'high' : 'medium', page: result.page.label, category: 'button', finding: issue.issue.join('؛ '), evidence: issue });
    for (const icon of result.iconFailures) issues.push({ severity: 'medium', page: result.page.label, category: 'icon', finding: 'رمز مرئي مفقود من أيقونة Phosphor', evidence: icon });
    for (const group of result.controlGroups.filter((group) => !group.hasVisiblePurpose)) issues.push({ severity: 'medium', page: result.page.label, category: 'filter', finding: 'مجموعة تحكم بلا تسمية أو غرض مرئي', evidence: group });
    for (const violation of result.axe) issues.push({ severity: violation.impact || 'low', page: result.page.label, category: 'axe', finding: violation.help, evidence: violation });
    if (result.primarySignatureCount > 2) issues.push({ severity: 'low', page: result.page.label, category: 'consistency', finding: `توجد ${result.primarySignatureCount} بصمات بصرية مختلفة للإجراءات الأساسية في الصفحة`, evidence: result.primaryActions });
    if (result.page.id === 'work' && result.behavioral && !result.behavioral.hasTodayDecisionGroups) issues.push({ severity: 'high', page: result.page.label, category: 'behavior', finding: 'لا تظهر مجموعات قرار واضحة لليوم (ابدأ الآن/لاحقًا اليوم)', evidence: result.behavioral });
    if (result.page.id === 'projects' && result.behavioral && result.behavioral.hasProjectEmptyStateExplanation === false) issues.push({ severity: 'medium', page: result.page.label, category: 'behavior', finding: 'لا يظهر تفسير صريح للمهام غير المصنفة عند غياب المشاريع', evidence: result.behavioral });
  }
  const rank = { critical: 0, serious: 1, high: 2, moderate: 3, medium: 4, low: 5, minor: 6, null: 7 };
  issues.sort((a, b) => (rank[a.severity] ?? 8) - (rank[b.severity] ?? 8));
  return issues;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 920 }, locale: 'ar-SA' });
const page = await context.newPage();
const runtimeErrors = [];
page.on('pageerror', (error) => runtimeErrors.push({ type: 'pageerror', message: error.message }));
page.on('console', (message) => { if (message.type() === 'error') runtimeErrors.push({ type: 'console', message: message.text() }); });

await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
await waitForApp(page);
const pages = [];
for (const nav of NAVIGATION) {
  const trigger = page.locator(nav.selector);
  if (await trigger.count()) {
    await trigger.first().click();
    await page.waitForTimeout(700);
    pages.push(await inspectPage(page, { id: nav.id, label: nav.label }));
  } else {
    pages.push({ page: { id: nav.id, label: nav.label }, auditError: `لم يُعثر على عنصر الانتقال: ${nav.selector}` });
  }
}

const issues = summarize(pages.filter((result) => !result.auditError));
const report = { generatedAt: new Date().toISOString(), targetUrl, runtimeErrors, pages, issues };
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const jsonPath = path.join(auditDir, `ui-audit-${stamp}.json`);
const mdPath = path.join(auditDir, `ui-audit-${stamp}.md`);
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
const md = [
  '# تقرير تدقيق واجهة مَهَد',
  '',
  `- وقت الفحص: ${report.generatedAt}`,
  `- الصفحات المفحوصة: ${pages.length}`,
  `- أخطاء وقت التشغيل: ${runtimeErrors.length}`,
  `- النتائج المرصودة: ${issues.length}`,
  '',
  '## النتائج مرتبة بحسب الأولوية',
  '',
  '| الأولوية | الصفحة | الفئة | النتيجة |',
  '|---|---|---|---|',
  ...(issues.length ? issues.map((issue) => `| ${issue.severity} | ${issue.page} | ${issue.category} | ${issue.finding} |`) : ['| — | — | — | لم يرصد الفحص قاعدة مخالفة |']),
  '',
  '## ملخص الصفحات',
  '',
  '| الصفحة | الأزرار | مشكلات الأزرار | الأيقونات المفقودة | مخالفات الوصولية | بصمات الإجراءات الأساسية |',
  '|---|---:|---:|---:|---:|',
  ...pages.map((result) => result.auditError ? `| ${result.page.label} | — | — | — | — |` : `| ${result.page.label} | ${result.buttonCount} | ${result.buttonIssues.length} | ${result.iconFailures.length} | ${result.axe.length} | ${result.primarySignatureCount} |`),
  '',
  'هذا التقرير آلي واستقصائي؛ لا يطبّق إصلاحات على الواجهة.',
].join('\n');
fs.writeFileSync(mdPath, `${md}\n`);
await browser.close();
console.log(JSON.stringify({ jsonPath, mdPath, pages: pages.length, issues: issues.length, runtimeErrors: runtimeErrors.length }, null, 2));
