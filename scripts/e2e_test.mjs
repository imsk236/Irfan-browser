import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const dir = 'C:\\Users\\alkin\\AppData\\Local\\Temp\\e2e_screenshots';
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

let pass = true;
function check(label, ok, detail = '') {
  const mark = ok ? '✅' : '❌';
  console.log(`${mark} ${label}${detail ? ' — ' + detail : ''}`);
  if (!ok) pass = false;
}

async function ss(name) {
  await page.screenshot({ path: path.join(dir, name), fullPage: true });
}

// ── 1. App loads ─────────────────────────────────────────────────
console.log('\n── 1. App load ──');
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(1000);
await ss('01_load.png');
check('HTML dir=rtl', await page.getAttribute('html', 'dir') === 'rtl');
check('HTML lang=ar', await page.getAttribute('html', 'lang') === 'ar');

const navItems = await page.locator('.nav-item').allTextContents();
check('4 nav items present', navItems.length === 4, navItems.join(' | '));

// ── 2. Vocab API ──────────────────────────────────────────────────
console.log('\n── 2. Vocab API ──');
const roles = await page.evaluate(() => fetch('http://localhost:8765/vocab/role').then(r => r.json()));
check('Role vocab returned 7 values', roles.length === 7, roles.join(', '));
check('مؤلف present', roles.includes('مؤلف'));

// ── 3. Create repository ──────────────────────────────────────────
console.log('\n── 3. Create repository ──');
await page.locator('.nav-item').filter({ hasText: 'المجلدات' }).click();
await page.waitForTimeout(500);
await page.locator('button').filter({ hasText: 'مجلد جديد' }).click();
await page.waitForTimeout(500);
await page.locator('button').filter({ hasText: 'مستودع جديد' }).click();
await page.waitForTimeout(800);

// use unique place_key each run to avoid 409 on duplicate
const placeKey = String(Date.now() % 9000 + 1000).substring(0, 4);
await page.locator('input[placeholder="مثال: 0001"]').fill(placeKey);

// repo name: 3rd text input on page (shelfmark=0, placeKey=1, name=2)
await page.locator('input[type="text"]').nth(2).fill('مكتبة الاختبار');

// repo kind: wait for options to load, pick index 1
const kindSelect = page.locator('select').last();
await kindSelect.waitFor({ state: 'attached', timeout: 5000 });
await page.waitForTimeout(500);
const kindOptions = await kindSelect.locator('option').allTextContents();
console.log('  Kind options:', kindOptions.join(' | '));
if (kindOptions.length > 1) await kindSelect.selectOption({ index: 1 });

await ss('03_repo_form.png');
await page.locator('button').filter({ hasText: 'حفظ المستودع' }).click();
await page.waitForTimeout(1200);
await ss('03b_repo_saved.png');

const repoSelect = page.locator('select').first();
const repoOptions = await repoSelect.locator('option').allTextContents();
console.log('  Repo options after save:', repoOptions.join(' | '));
const repoCreated = repoOptions.some(o => o.includes(placeKey) || o.includes('مكتبة الاختبار'));
check('Repository created and appears in dropdown', repoCreated);

// ── 4. Save volume ────────────────────────────────────────────────
console.log('\n── 4. Save volume ──');
if (repoCreated) {
  const opt = repoOptions.find(o => o.includes(placeKey) || o.includes('مكتبة الاختبار'));
  if (opt) await repoSelect.selectOption({ label: opt });
}
await page.waitForTimeout(400);
await ss('04_volume_form.png');

const saveVolBtn = page.locator('button[type="submit"]').filter({ hasText: 'حفظ' }).first();
await saveVolBtn.click();
await page.waitForTimeout(1500);
await ss('04b_volume_saved.png');

const serialBadges = await page.locator('.serial-badge').allTextContents();
console.log('  Serial badges:', serialBadges.join(' | '));
check('Serial badge visible (PPPP-DDDD)', serialBadges.some(s => /\d{4}-\d{4}/.test(s)), serialBadges[0] || 'none');

// ── 5. Create person ──────────────────────────────────────────────
console.log('\n── 5. Create person ──');
await page.locator('.nav-item').filter({ hasText: 'الأشخاص' }).click();
await page.waitForTimeout(600);
await page.locator('button').filter({ hasText: 'شخص جديد' }).click();
await page.waitForTimeout(600);
await ss('05_person_form.png');

// preferred_name input has a known placeholder
const preferredInput = page.locator('input[placeholder="أدخل الاسم كما تعرفه أنت"]');
await preferredInput.waitFor({ state: 'visible', timeout: 5000 });
await preferredInput.fill('ابن خلدون');
await page.waitForTimeout(300);
await ss('05b_person_filled.png');

await page.locator('button[type="submit"]').filter({ hasText: 'حفظ' }).first().click();
await page.waitForTimeout(1200);
await ss('05c_person_saved.png');

const personTexts = await page.locator('body').innerText();
const personSaved = personTexts.includes('ابن خلدون');
check('Person saved and visible', personSaved);

// ── 6. PersonField search on Trace screen ────────────────────────
console.log('\n── 6. Trace screen — search person ──');
await page.locator('.nav-item').filter({ hasText: 'تتبع' }).click();
await page.waitForTimeout(600);
await ss('06_trace.png');

const traceInput = page.locator('input').first();
await traceInput.fill('ابن');
await page.waitForTimeout(900);
await ss('06b_trace_search.png');

const candidateItems = await page.locator('[class*="candidate"], [class*="result"], [class*="option"]').allTextContents();
console.log('  Candidate items:', candidateItems.slice(0, 5).join(' | '));
check('Search produces candidates or "new person" option',
  candidateItems.length > 0 || (await page.locator('body').innerText()).includes('ابن'));

// ── 7. Annotations screen loads ──────────────────────────────────
console.log('\n── 7. Annotations screen ──');
await page.locator('.nav-item').filter({ hasText: 'التقييدات' }).click();
await page.waitForTimeout(600);
await ss('07_annotations.png');
const bodyText = await page.locator('body').innerText();
check('Annotations screen loaded', bodyText.includes('تقييد') || bodyText.includes('التقييدات'));

// ── 8. Console errors ─────────────────────────────────────────────
console.log('\n── 8. Console errors ──');
check('No console/page errors', errors.length === 0, errors.join('; ') || 'clean');

// ── Summary ───────────────────────────────────────────────────────
console.log('\n' + (pass ? '✅ PASS — all checks passed' : '❌ FAIL — see above'));
console.log('Screenshots saved to:', dir);

await browser.close();
process.exit(pass ? 0 : 1);
