// End-to-end smoke test: drives the real site in Chromium.
// Usage: BASE_URL=http://localhost:4173/ node e2e/smoke.mjs [--hands=12] [--shots=dir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const HANDS = Number(arg('hands', 12));
const SHOTS = arg('shots', 'screenshots');
const EXEC = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
mkdirSync(SHOTS, { recursive: true });

const problems = [];
const log = (...a) => console.log('•', ...a);

async function newPage(browser, viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'he-IL', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  return { ctx, page };
}

/** Visible text with playing cards removed must contain no Latin letters. */
async function assertHebrewOnly(page, where) {
  const latin = await page.evaluate(() => {
    const clone = document.body.cloneNode(true);
    clone.querySelectorAll('.pcard, script, style, noscript').forEach((n) => n.remove());
    const text = clone.innerText ?? clone.textContent;
    const attrs = [...document.querySelectorAll('[aria-label],[title]')]
      .filter((el) => !el.closest('.pcard'))
      .map((el) => `${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''}`)
      .join(' ');
    return (text + ' ' + attrs).match(/[A-Za-z]{1,}/g);
  });
  if (latin) problems.push(`English text on ${where}: ${[...new Set(latin)].join(', ')}`);
}

async function noHorizontalScroll(page, where) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 1) problems.push(`horizontal overflow ${over}px on ${where}`);
}

async function playHands(page, n, tag, shotEvery = 99) {
  let played = 0;
  const seen = new Set();
  const deadline = Date.now() + n * 25000;
  while (Date.now() < deadline && played < n) {
    const state = await page.evaluate(() => {
      const has = (s) => !!document.querySelector(s);
      if (has('.betting-panel')) return 'bet';
      if (document.body.textContent.includes('נגמרו לך הצ׳יפים')) return 'broke';
      if (has('.summary-panel')) return 'summary';
      if (has('.insurance-panel')) return 'insurance';
      if (has('.feedback .btn-row button.btn-gold') && document.querySelector('.feedback')?.textContent.includes('נסה שוב')) return 'pending';
      if (has('.coach')) return 'coach';
      if (has('.action-panel')) return 'act';
      return 'wait';
    });
    if (state === 'broke') {
      seen.add('out-of-chips');
      await page.getByRole('button', { name: /קבל 1,000 צ׳יפים/ }).click();
    } else if (state === 'bet') {
      const bet = Number((await page.locator('.bet-amount').innerText()).replace(/[^0-9.]/g, ''));
      const chip = page.locator('.chip-btn:not([disabled])').first();
      if (!bet && (await chip.count())) await chip.click();
      await page.getByRole('button', { name: 'אשר הימור' }).click();
    } else if (state === 'insurance') {
      seen.add('insurance');
      await page.getByRole('button', { name: 'ללא ביטוח' }).click();
    } else if (state === 'coach') {
      seen.add('coach');
      if (!seen.has('coachShot')) {
        seen.add('coachShot');
        await page.screenshot({ path: `${SHOTS}/${tag}-coach.png`, fullPage: true });
      }
      await page.getByRole('button', { name: 'הבנתי' }).click();
    } else if (state === 'pending') {
      seen.add('practice-feedback');
      if (!seen.has('pendShot')) {
        seen.add('pendShot');
        await page.screenshot({ path: `${SHOTS}/${tag}-practice-feedback.png`, fullPage: true });
      }
      await page.getByRole('button', { name: /^המשך \(/ }).click();
    } else if (state === 'act') {
      // Mix correct and random choices so every branch gets exercised.
      const buttons = page.locator('.action-panel .btn-action');
      const count = await buttons.count();
      const rec = page.locator('.action-panel .btn-action.is-recommended');
      const labels = await buttons.allInnerTexts();
      labels.forEach((l) => seen.add(l.split('\n')[0]));
      const pick = (await rec.count()) && Math.random() < 0.7 ? rec.first() : buttons.nth(Math.floor(Math.random() * count));
      await pick.click();
    } else if (state === 'summary') {
      played++;
      if (played % shotEvery === 1) await page.screenshot({ path: `${SHOTS}/${tag}-summary-${played}.png`, fullPage: true });
      await assertHebrewOnly(page, `${tag} summary`);
      await page.getByRole('button', { name: 'יד חדשה' }).click();
    } else {
      await page.waitForTimeout(120);
    }
  }
  if (played < n) problems.push(`${tag}: only ${played}/${n} hands completed`);
  log(`${tag}: played ${played} hands; saw: ${[...seen].join(', ')}`);
  return seen;
}

/** Open the play screen for a mode; if a game is running, choose to start a new one. */
async function openMode(page, mode) {
  await page.goto(`${BASE}#/play?mode=${mode}`);
  const conflict = page.getByRole('button', { name: 'התחל משחק חדש' });
  const setup = page.getByRole('button', { name: 'המשך לבחירת מקום' });
  await conflict.or(setup).first().waitFor({ timeout: 10000 });
  if (await conflict.isVisible()) await conflict.click();
  await setup.waitFor();
}

const browser = await chromium.launch({ executablePath: EXEC });
try {
  // ---------- desktop ----------
  const { page } = await newPage(browser, { width: 1440, height: 900 });
  await page.goto(BASE);
  await page.getByRole('dialog').waitFor();
  await page.screenshot({ path: `${SHOTS}/desktop-onboarding.png` });
  await assertHebrewOnly(page, 'home');
  await page.getByRole('button', { name: /שיחקתי כמה פעמים/ }).click();
  await page.waitForURL(/#\/play\?mode=learn/);

  // speed up for the long run
  await page.goto(`${BASE}#/settings`);
  await page.getByRole('radio', { name: 'מהירה מאוד' }).click();
  await assertHebrewOnly(page, 'settings');
  await page.goto(`${BASE}#/`);
  await page.screenshot({ path: `${SHOTS}/desktop-home.png`, fullPage: true });

  // learn mode with 4 players
  await page.goto(`${BASE}#/play?mode=learn`);
  await page.getByRole('radio', { name: 'אני ועוד שלושה שחקנים' }).click();
  await page.getByRole('button', { name: 'המשך לבחירת מקום' }).click();
  await page.screenshot({ path: `${SHOTS}/desktop-seat-pick.png`, fullPage: true });
  await page.getByRole('button', { name: /מקום 4: מקום פנוי/ }).click();
  await page.getByText('זה המקום שלך').first().waitFor();
  await page.screenshot({ path: `${SHOTS}/desktop-seated.png`, fullPage: true });
  await page.getByRole('button', { name: 'התחל לשחק' }).click();
  await page.screenshot({ path: `${SHOTS}/desktop-betting.png`, fullPage: true });
  await playHands(page, HANDS, 'desktop-learn', 5);
  await assertHebrewOnly(page, 'table');
  await page.getByRole('button', { name: 'היסטוריית הסיבוב' }).first().click();
  await page.screenshot({ path: `${SHOTS}/desktop-history.png` });
  await page.getByRole('button', { name: 'סגור' }).click();
  await page.getByRole('button', { name: 'סיים משחק' }).click();
  await page.screenshot({ path: `${SHOTS}/desktop-game-summary.png` });
  await assertHebrewOnly(page, 'game summary');

  // practice mode, alone at the table
  await openMode(page, 'practice');
  await page.getByRole('radio', { name: 'רק אני' }).click();
  await page.getByRole('button', { name: 'המשך לבחירת מקום' }).click();
  await page.getByRole('button', { name: /מקום 1: מקום פנוי/ }).click();
  await page.getByRole('button', { name: 'התחל לשחק' }).click();
  await playHands(page, Math.ceil(HANDS / 2), 'desktop-practice', 99);

  // Visiting the decision chart mid-game must not reset the table.
  const handsBefore = await page.locator('.mini-stats dd').first().innerText();
  await page.getByRole('link', { name: 'טבלת החלטות' }).first().click();
  await page.waitForURL(/#\/chart/);
  await page.getByRole('tab', { name: 'יד עם אס' }).click();
  await page.getByRole('link', { name: 'חזרה למשחק' }).click();
  await page.waitForURL(/#\/play$/);
  await page.locator('.seat-user').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  const handsAfter = await page.locator('.mini-stats dd').first().innerText();
  if (handsBefore !== handsAfter || !(await page.locator('.seat-user').isVisible())) problems.push(`game reset after visiting chart: ${handsBefore} -> ${handsAfter}`);
  else log(`returned to the same game after visiting the chart (hands: ${handsAfter})`);
  await playHands(page, 1, 'desktop-practice-resumed', 99);
  // Asking for another mode mid-game offers to resume instead of resetting.
  await page.goto(`${BASE}#/play?mode=learn`);
  await page.getByRole('button', { name: 'חזרה למשחק' }).click();
  await page.locator('.seat-user').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (!(await page.locator('.seat-user').isVisible())) problems.push('resume from mode prompt failed');

  // free mode with 7 players
  await openMode(page, 'free');
  await page.getByRole('radio', { name: 'אני ועוד שישה שחקנים' }).click();
  await page.getByRole('button', { name: 'המשך לבחירת מקום' }).click();
  await page.getByRole('button', { name: /מקום 7: מקום פנוי/ }).click();
  await page.getByRole('button', { name: 'התחל לשחק' }).click();
  await playHands(page, Math.ceil(HANDS / 2), 'desktop-free', 3);
  await page.getByRole('button', { name: 'סיים משחק' }).click();
  await page.screenshot({ path: `${SHOTS}/desktop-free-summary.png` });

  // quick practice
  await page.goto(`${BASE}#/quick`);
  for (let i = 0; i < 6; i++) {
    await page.locator('.quick-actions .btn-action:not([disabled])').first().click();
    if (i === 0) await page.screenshot({ path: `${SHOTS}/desktop-quick.png`, fullPage: true });
    await page.getByRole('button', { name: /^(המשך|סיום)$/ }).click();
  }
  await assertHebrewOnly(page, 'quick');

  // chart
  await page.goto(`${BASE}#/chart`);
  await page.getByRole('tab', { name: 'זוגות' }).click();
  await page.getByRole('button', { name: /8־8 מול 10/ }).click();
  await page.screenshot({ path: `${SHOTS}/desktop-chart.png` });
  await assertHebrewOnly(page, 'chart');
  await page.getByRole('button', { name: 'סגור' }).click();

  // progress, persisted after reload
  await page.goto(`${BASE}#/progress`);
  const before = await page.locator('.tile').first().innerText();
  await page.reload();
  const after = await page.locator('.tile').first().innerText();
  const hands = Number((await page.locator('.tile').nth(1).innerText()).split('\n')[0]);
  if (before !== after || hands < HANDS) problems.push(`stats not persisted: ${before} / ${after}, hands=${hands}`);
  log(`progress after reload: games=${after.split('\n')[0]} hands=${hands}`);
  await page.screenshot({ path: `${SHOTS}/desktop-progress.png`, fullPage: true });
  await assertHebrewOnly(page, 'progress');

  const mistakesLink = page.getByRole('link', { name: 'תרגל את הטעויות שלי' });
  if ((await mistakesLink.getAttribute('aria-disabled')) === 'false') {
    await mistakesLink.click();
    await page.locator('.quick-actions').waitFor();
    await page.screenshot({ path: `${SHOTS}/desktop-mistakes.png`, fullPage: true });
  }

  await page.goto(`${BASE}#/lesson`);
  await page.getByRole('button', { name: 'הבא ←' }).click();
  await page.screenshot({ path: `${SHOTS}/desktop-lesson.png`, fullPage: true });
  await assertHebrewOnly(page, 'lesson');

  // ---------- mobile ----------
  const m = await newPage(browser, { width: 390, height: 844 });
  await m.page.goto(BASE);
  await m.page.getByRole('button', { name: /אני מכיר את החוקים/ }).click();
  await m.page.goto(`${BASE}#/`);
  await m.page.screenshot({ path: `${SHOTS}/mobile-home.png`, fullPage: true });
  await noHorizontalScroll(m.page, 'mobile home');
  await m.page.goto(`${BASE}#/play?mode=learn`);
  await m.page.getByRole('radio', { name: 'אני ועוד ארבעה שחקנים' }).click();
  await m.page.getByRole('button', { name: 'המשך לבחירת מקום' }).click();
  await m.page.screenshot({ path: `${SHOTS}/mobile-seat-pick.png`, fullPage: true });
  await m.page.getByRole('button', { name: /מקום 3: מקום פנוי/ }).click();
  await m.page.getByRole('button', { name: 'התחל לשחק' }).click();
  await noHorizontalScroll(m.page, 'mobile table');
  await m.page.screenshot({ path: `${SHOTS}/mobile-betting.png`, fullPage: true });
  await playHands(m.page, 4, 'mobile-learn', 2);
  await noHorizontalScroll(m.page, 'mobile table after hands');
  for (const r of ['quick', 'chart', 'progress', 'settings', 'lesson']) {
    await m.page.goto(`${BASE}#/${r}`);
    await m.page.waitForTimeout(150);
    await m.page.screenshot({ path: `${SHOTS}/mobile-${r}.png`, fullPage: true });
    await noHorizontalScroll(m.page, `mobile ${r}`);
  }
} catch (e) {
  problems.push(`exception: ${e.message.split('\n')[0]}`);
  for (const ctx of browser.contexts()) for (const pg of ctx.pages()) await pg.screenshot({ path: `${SHOTS}/failure-${Date.now()}.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

if (problems.length) {
  console.log('\nPROBLEMS:');
  for (const p of [...new Set(problems)]) console.log('  ✗', p);
  process.exit(1);
}
console.log('\nAll smoke checks passed.');
