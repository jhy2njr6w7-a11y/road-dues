// Store screenshots from the web preview, with sample data.
// Run the web preview first (npx expo start --web), then:
//   node scripts/store-screenshots.js [http://localhost:8081]
// Needs Playwright with Chromium (npm i -D playwright && npx playwright install chromium).
// Writes store/screenshots/{ios,android}/NN-name.png:
//   iOS 6.9" display 1320×2868, Android phone 1080×2160 (Play allows at most 2:1).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:8081';
const OUT = path.join(__dirname, '..', 'store', 'screenshots');
const DEVICES = {
  ios: { viewport: { width: 440, height: 956 }, deviceScaleFactor: 3 },
  android: { viewport: { width: 360, height: 720 }, deviceScaleFactor: 3 },
};
const DUBAI = { latitude: 25.2048, longitude: 55.2708 };

const now = Date.now();
const iso = (minutes) => new Date(now + minutes * 60e3).toISOString();
const day = (n) => new Date(now + n * 864e5).toISOString().slice(0, 10);

// Sample data shown in every shot. Campaigns are examples, not real announcements.
function state({ lang = 'en', parking = 'paid', appearance = 'light' } = {}) {
  return {
    settings: { lang, onboarded: true, low: 25, remParking: true, remSalik: true, remFines: true, gateOverrides: {}, discHome: true, discAfterPay: true, appearance },
    balance: 86.4,
    vehicles: [
      { id: 'v1', brand: 'Toyota', model: 'Land Cruiser', color: 'White', em: 'DXB', code: 'A', num: '54321' },
      { id: 'v2', brand: 'Nissan', model: 'Patrol', color: 'Black', em: 'SHJ', code: '3', num: '12345' },
    ],
    defaultVeh: 'v1',
    fines: [],
    crossings: [
      { id: 'c1', gate: 'garhoud', date: iso(-40), charge: 6.3, auto: true },
      { id: 'c2', gate: 'maktoum', date: iso(-60 * 26), charge: 4.2, auto: true },
      { id: 'c3', gate: 'airport', date: iso(-60 * 30), charge: 6.3, auto: true },
      { id: 'c4', gate: 'businessbay', date: iso(-60 * 50), charge: 4.2, auto: true },
    ],
    parking: parking === 'paid' ? { id: 'p1', start: iso(-25), lat: DUBAI.latitude, lng: DUBAI.longitude, em: 'DXB', status: 'paid', zone: '335A', until: iso(95) } : null,
    freeSpots: [], zones: [],
    drive: { lastMoving: null, lastLat: null, lastLng: null },
    campaigns: [
      { id: 'ex-shj', iss: 'shj', pct: 50, start: day(-20), end: day(12), url: 'https://www.shjpolice.gov.ae', payUrl: null, note: {} },
      { id: 'ex-ajm', iss: 'ajm', pct: 50, start: day(-3), end: day(25), url: 'https://www.ajmanpolice.gov.ae', payUrl: null, note: {} },
      { id: 'ex-rak', iss: 'rak', pct: 40, start: day(9), end: day(40), url: 'https://www.rakpolice.gov.ae', payUrl: null, note: {} },
    ],
    campaignsAt: new Date(now).toISOString(), // recent, so the preview doesn't swap in its demo list
    seenCampaigns: ['ex-shj', 'ex-ajm', 'ex-rak'],
    trackingVersion: null,
  };
}

const SHOTS = [
  { name: '01-today', data: state() },
  { name: '02-parking', data: state({ parking: null }), tab: 'Parking', zone: '335A' },
  { name: '03-fine-discounts', data: state(), tab: 'Fines' },
  { name: '04-salik', data: state(), tab: 'Salik' },
  { name: '05-arabic', data: state({ lang: 'ar' }) },
  { name: '06-dark', data: state({ appearance: 'dark' }), dark: true },
];

(async () => {
  const browser = await chromium.launch();
  for (const [platform, device] of Object.entries(DEVICES)) {
    fs.mkdirSync(path.join(OUT, platform), { recursive: true });
    for (const shot of SHOTS) {
      const ctx = await browser.newContext({ ...device, colorScheme: shot.dark ? 'dark' : 'light', geolocation: DUBAI, permissions: ['geolocation'] });
      await ctx.addInitScript((s) => localStorage.setItem('road-dues-state-v1', s), JSON.stringify(shot.data));
      const page = await ctx.newPage();
      await page.goto(BASE, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      if (shot.tab) { await page.getByRole('tab', { name: new RegExp(shot.tab) }).click(); await page.waitForTimeout(1200); }
      if (shot.zone) { await page.getByPlaceholder('335A').fill(shot.zone); await page.waitForTimeout(400); }
      const file = path.join(OUT, platform, shot.name + '.png');
      await page.screenshot({ path: file });
      console.log(path.relative(process.cwd(), file));
      await ctx.close();
    }
  }
  await browser.close();
})();
