// Simulated users: drives the web preview like 40 different people would (Saif's default) and reports anything broken.
// Run the web preview first (npx expo start --web), then:
//   node scripts/simulate-users.js [count=40] [http://localhost:8081]
// Needs Playwright with Chromium. Each user gets a random language, phone size, theme, location,
// cars (some with typos), parking zone, Salik balance and fine, and every screen is checked for:
// crashes/console errors, sideways overflow, "undefined"/"NaN"/"{placeholder}" text, and that the
// parking SMS shown equals buildSms() from src/data.js.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

const COUNT = Number(process.argv[2] || 40);
const BASE = process.argv[3] || 'http://localhost:8081';

// Load the app's own rules and strings (ES modules) so expectations match the app exactly.
async function loadApp() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-sim-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  for (const f of ['data.js', 'i18n.js', 'i18n-extra.js', 'i18n-campaigns.js']) {
    fs.writeFileSync(path.join(tmp, f), fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8').replace(/from '\.\/(i18n-\w+)'/g, "from './$1.js'"));
  }
  return { D: await import(path.join(tmp, 'data.js')), I: await import(path.join(tmp, 'i18n.js')) };
}

// Small seeded random so a failing user can be replayed
function rng(seed) { let s = (seed * 2654435761) >>> 0; const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); for (let i = 0; i < 5; i++) r(); return r; }

const SIZES = [[320, 640], [360, 780], [375, 812], [390, 844], [412, 915], [430, 932]];
const PLACES = { DXB: [25.2048, 55.2708], SHJ: [25.3463, 55.4209], AUH: [24.4539, 54.3773], AJM: [25.4052, 55.5136], RAK: [25.7895, 55.9432], FUJ: [25.1288, 56.3265], UAQ: [25.5647, 55.5552], none: null };
const CODES = { AUH: ['1', '5', '16', '50'], DXB: ['A', 'K', 'AA', 'BB'], SHJ: ['1', '2', '3', '4'], AJM: ['A', 'B', 'D', 'H'], RAK: ['A', 'C', 'K'], FUJ: ['A', 'B', 'M'], UAQ: ['A', 'D', 'X'] };

async function simulate(browser, id, D, I) {
  const r = rng(1000 + id); const pick = (a) => a[Math.floor(r() * a.length)];
  let lang = pick(['en', 'en', 'ar', 'ar', 'hi', 'zh', 'ru']);
  const t = (k, v = {}) => (I.T[lang][k] || I.T.en[k] || k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
  const [w, h] = pick(SIZES); const dark = r() < 0.4; const place = pick(Object.keys(PLACES));
  const user = { id, lang, size: `${w}x${h}`, dark, place, problems: [], steps: [] };
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: dark ? 'dark' : 'light',
    ...(PLACES[place] ? { geolocation: { latitude: PLACES[place][0], longitude: PLACES[place][1] }, permissions: ['geolocation'] } : {}) });
  const p = await ctx.newPage();
  const problem = (m) => user.problems.push(m);
  p.on('pageerror', (e) => problem('crash: ' + e.message.slice(0, 160)));
  p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource|net::ERR/.test(m.text())) problem('console: ' + m.text().slice(0, 160)); });
  p.on('dialog', (d) => d.accept().catch(() => {}));
  const click = async (text, opts = {}) => { await p.getByText(text, { exact: true }).last().click({ timeout: 4000, ...opts }); await p.waitForTimeout(250); };
  const tab = async (k) => { await p.getByRole('tab', { name: t('tab_' + k) }).click({ timeout: 4000 }); await p.waitForTimeout(400); };
  const check = async (where) => {
    const res = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, text: document.body.innerText }));
    if (res.over > 1) problem(`${where}: page ${res.over}px wider than the screen`);
    const bad = res.text.match(/\bundefined\b|\bNaN\b|\[object|\{[a-z]+\}/);
    if (bad) problem(`${where}: shows "${bad[0]}"`);
  };
  const step = async (name, fn) => { try { await fn(); user.steps.push(name); await check(name); } catch (e) { problem(`${name}: ${e.message.split('\n')[0].slice(0, 160)}`); } };

  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);

  await step('onboarding', async () => {
    const name = I.LANGS.find(([k]) => k === lang)[1];
    await click(name);
    await click(t('next'));
    await click(r() < 0.8 ? t('allow') : t('notNow'));
    await click(t('allow')); // location (granted on web, moves on)
    await click(t('agreeStart'));
    await p.getByRole('tab').first().waitFor({ timeout: 4000 });
  });

  const cars = [];
  for (let n = 0; n < 1 + Math.floor(r() * 2); n++) {
    await step('add car', async () => {
      await tab('vehicles');
      await click(t('addVehBtn'));
      const em = pick(D.EM_ORDER); const brand = pick(D.BRANDS);
      const typo = r() < 0.2;
      const code = typo ? pick(['', 'AB12', '#']) : pick(CODES[em]);
      const num = typo && r() < 0.5 ? pick(['', '123456', '12a']) : String(1 + Math.floor(r() * 99999));
      await click(brand);
      await click(t('em_' + em));
      await p.getByLabel(t('plateCode'), { exact: true }).fill(code);
      await p.getByLabel(t('plateNum'), { exact: true }).fill(num);
      await click(t('saveVeh'));
      // The boxes stop at 3 and 5 characters, like the real plate
      const v = D.validateVehicle({ em, code: code.slice(0, 3), num: num.slice(0, 5), brand, model: '', color: '' }, cars);
      if (v.error) {
        if (!(await p.getByText(t(v.error), { exact: true }).count())) problem(`add car: no "${v.error}" message for code "${code}" number "${num}"`);
        await click(t('cancel'));
      } else cars.push(v.vehicle);
    });
  }

  await step('parking', async () => {
    await tab('parking');
    const em = pick(D.PARKING_EMIRATES);
    await p.getByText(t('em_' + em), { exact: true }).last().click({ timeout: 4000 });
    await p.waitForTimeout(250);
    const zoneBox = p.getByPlaceholder('335A');
    const zone = pick(['335A', '214', '1', '9999B', '٣٣٥A', 'abc']);
    if (await zoneBox.count()) await zoneBox.fill(zone);
    await p.waitForTimeout(300);
    if (cars.length && D.EMIRATES[em].sms) {
      const expected = D.buildSms(em, cars[0], { zone, type: 'S', hours: 1 });
      if (expected && !(await p.getByText(expected, { exact: true }).count())) problem(`parking: SMS "${expected}" not shown (${em}, zone "${zone}")`);
      if (!expected && (await p.getByText(/^[A-Z]{1,3}\d* ?\d+ /).count()) > 0) problem(`parking: an SMS is shown for invalid zone "${zone}"`);
    }
  });

  await step('salik', async () => {
    await tab('salik');
    const val = pick(['50', '125.5', '٧٥', '0', '-5', 'abc', '6000']);
    const box = p.getByPlaceholder(/50\.00/).first();
    await box.fill(val);
    await click(t('save'));
    const n = Number(D.latinDigits(val));
    const ok = val !== '' && isFinite(n) && n >= 0 && n <= 5000;
    if (ok && !(await p.getByText(D.aed(Math.round(n * 100) / 100), { exact: true }).count())) problem(`salik: balance ${val} not shown as ${D.aed(n)}`);
    if (!ok && !(await p.getByText(t('balErr'), { exact: true }).count())) problem(`salik: no error for "${val}"`);
  });

  await step('fines', async () => {
    await tab('fines');
    if (r() < 0.5) {
      await click(t('addFine'));
      await p.getByLabel(t('amount')).or(p.locator('input').nth(0)).first().fill(String(100 + Math.floor(r() * 900)));
      await click(t('saveFine'));
    }
  });

  await step('settings', async () => {
    await tab('today');
    await p.getByRole('button', { name: t('settings') }).first().click({ timeout: 4000 });
    await p.waitForTimeout(300);
    await click(t(pick(['look_auto', 'look_light', 'look_dark'])));
    await p.getByRole('switch').nth(Math.floor(r() * 3)).click({ timeout: 4000 });
    const other = pick(I.LANGS); await click(other[1]); // switch language once more
    lang = other[0]; user.lang2 = lang;
  });

  await step('today', async () => { await tab('today'); });
  await ctx.close();
  return user;
}

(async () => {
  const { D, I } = await loadApp();
  const browser = await chromium.launch();
  const users = []; let next = 0;
  const worker = async () => { while (next < COUNT) { const id = next++; users[id] = await simulate(browser, id, D, I).catch((e) => ({ id, problems: ['runner: ' + e.message] })); process.stdout.write(users[id].problems.length ? 'x' : '.'); } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  await browser.close();
  const failed = users.filter((u) => u.problems.length);
  console.log(`\n${COUNT - failed.length}/${COUNT} users had no problems.`);
  const counts = {};
  for (const u of failed) for (const m of u.problems) { const key = m.replace(/"[^"]*"/g, '"…"').replace(/\d+px/, 'Npx'); (counts[key] = counts[key] || []).push(`#${u.id} ${u.lang} ${u.size}${u.dark ? ' dark' : ''}`); }
  for (const [m, who] of Object.entries(counts).sort((a, b) => b[1].length - a[1].length)) console.log(`- ${who.length}× ${m}\n    e.g. ${who.slice(0, 3).join(', ')}`);
  fs.writeFileSync(path.join(os.tmpdir(), 'simulate-users.json'), JSON.stringify(users, null, 2));
})();
