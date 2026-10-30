// Run: node tests/logic.test.mjs   (copies src into a temp ESM folder so Node can import it)
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import assert from 'node:assert/strict';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-'));
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
for (const f of ['data.js', 'park-detect.js', 'i18n.js', 'i18n-extra.js', 'i18n-campaigns.js', 'i18n-build5.js']) fs.writeFileSync(path.join(tmp, f), fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8').replace(/from '\.\/(i18n-\w+)'/g, "from './$1.js'"));
const D = await import(path.join(tmp, 'data.js')); const P = await import(path.join(tmp, 'park-detect.js')); const I = await import(path.join(tmp, 'i18n.js'));
let n = 0; const ok = (name, fn) => { fn(); n++; };

const shj = { em: 'SHJ', code: '3', num: '12345' }, dxb = { em: 'DXB', code: 'A', num: '54321' }, auh = { em: 'AUH', code: '1', num: '777' };
ok('Dubai SMS, Dubai plate', () => assert.equal(D.buildSms('DXB', dxb, { zone: '335a', hours: 2 }), 'A54321 335A 2'));
ok('Dubai SMS, Sharjah plate', () => assert.equal(D.buildSms('DXB', shj, { zone: '335A', hours: 1 }), 'SHJ3 12345 335A 1'));
ok('Dubai SMS needs zone', () => assert.equal(D.buildSms('DXB', dxb, { zone: '', hours: 1 }), ''));
ok('Dubai bad zone', () => assert.equal(D.buildSms('DXB', dxb, { zone: '33 5A x', hours: 1 }), ''));
ok('Arabic digits in zone', () => assert.equal(D.buildSms('DXB', dxb, { zone: '٣٣٥A', hours: 1 }), 'A54321 335A 1'));
ok('Sharjah SMS', () => assert.equal(D.buildSms('SHJ', shj, { hours: 5 }), 'SHJ 12345 5'));
ok('Sharjah invalid hours → first allowed', () => assert.equal(D.buildSms('SHJ', shj, { hours: 4 }), 'SHJ 12345 1'));
ok('Abu Dhabi SMS', () => assert.equal(D.buildSms('AUH', auh, { type: 'P', hours: 2 }), 'AUH 1 777 P 2'));
ok('Ajman SMS', () => assert.equal(D.buildSms('AJM', shj, {}), 'SHJ 3 12345'));
ok('Fujairah has no SMS', () => assert.equal(D.buildSms('FUJ', shj, {}), null));
ok('No vehicle', () => assert.equal(D.buildSms('SHJ', undefined, {}), null));

const uae = (iso) => new Date(iso + '+04:00');
ok('Salik peak Mon 08:00', () => assert.equal(D.salikCharge(uae('2026-10-26T08:00:00')), 6.3));
ok('Salik off-peak Mon 12:00', () => assert.equal(D.salikCharge(uae('2026-10-26T12:00:00')), 4.2));
ok('Salik free 03:00', () => assert.equal(D.salikCharge(uae('2026-10-26T03:00:00')), 0));
ok('Salik Sunday peak hour = 4.20', () => assert.equal(D.salikCharge(uae('2026-10-25T08:00:00')), 4.2));
ok('Salik 00:30 off-peak', () => assert.equal(D.salikCharge(uae('2026-10-26T00:30:00')), 4.2));
const t0 = uae('2026-10-26T08:00:00');
ok('Pair rule: Safa N then S within 1h free', () => assert.equal(D.crossingCharge('safa-s', new Date(t0.getTime() + 20 * 60e3), [{ gate: 'safa-n', date: t0.toISOString(), charge: 6.3 }]), 0));
ok('Duplicate within 10 min ignored', () => assert.equal(D.crossingCharge('barsha', new Date(t0.getTime() + 5 * 60e3), [{ gate: 'barsha', date: t0.toISOString(), charge: 6.3 }]), null));
ok('Same gate after 9h charged (17:00 peak)', () => assert.equal(D.crossingCharge('barsha', new Date(t0.getTime() + 9 * 3600e3), [{ gate: 'barsha', date: t0.toISOString(), charge: 6.3 }]), 6.3));

ok('Paid parking Dubai Sun = free', () => assert.equal(D.isPaidTime('DXB', uae('2026-10-25T12:00:00')), false));
ok('Paid parking Dubai Mon noon', () => assert.equal(D.isPaidTime('DXB', uae('2026-10-26T12:00:00')), true));
ok('Sharjah Fri free', () => assert.equal(D.isPaidTime('SHJ', uae('2026-10-30T12:00:00')), false));
ok('Ajman afternoon break', () => assert.equal(D.isPaidTime('AJM', uae('2026-10-26T14:00:00')), false));
ok('No reminders in Fujairah', () => assert.equal(D.isPaidTime('FUJ', uae('2026-10-26T10:00:00')), false));
ok('No reminders in RAK', () => assert.equal(D.isPaidTime('RAK', uae('2026-10-26T10:00:00')), false));
ok('RAK has no SMS', () => assert.equal(D.buildSms('RAK', shj, { zone: '335A', hours: 1 }), null));
ok('Parking emirates', () => assert.deepEqual(D.PARKING_EMIRATES, ['DXB', 'SHJ', 'AUH', 'AJM']));

ok('Emirate: Kalba', () => assert.equal(D.emirateAt({ lat: 25.05, lng: 56.355 }), 'SHJ'));
ok('Emirate: Dubai Marina', () => assert.equal(D.emirateAt({ lat: 25.08, lng: 55.14 }), 'DXB'));
ok('Emirate: Abu Dhabi', () => assert.equal(D.emirateAt({ lat: 24.47, lng: 54.37 }), 'AUH'));
ok('Emirate: Ajman', () => assert.equal(D.emirateAt({ lat: 25.40, lng: 55.50 }), 'AJM'));
ok('Emirate: Fujairah city', () => assert.equal(D.emirateAt({ lat: 25.13, lng: 56.33 }), 'FUJ'));
ok('Emirate: outside UAE', () => assert.equal(D.emirateAt({ lat: 30, lng: 40 }), null));

const now = new Date('2026-10-27T10:00:00+04:00');
ok('Abu Dhabi 35% within 60 days', () => assert.equal(D.fineOffer({ iss: 'adp', date: '2026-10-01', amount: 400 }, now).pct, 35));
ok('Abu Dhabi 25% after 60 days', () => assert.equal(D.fineOffer({ iss: 'adp', date: '2026-06-01', amount: 400 }, now).pct, 25));
ok('Severe: no discount', () => assert.equal(D.fineOffer({ iss: 'shj', date: '2026-10-01', amount: 400, severe: true }, now), null));
ok('Dubai: none unless entered', () => assert.equal(D.fineOffer({ iss: 'dxb', date: '2026-10-01', amount: 400 }, now), null));
ok('Manual discount', () => assert.equal(D.fineOffer({ iss: 'dxb', date: '2026-10-01', amount: 400, manualPct: 25, manualUntil: '2026-11-30' }, now).pct, 25));
ok('Paid: none', () => assert.equal(D.fineOffer({ iss: 'adp', date: '2026-10-01', amount: 400, paid: true }, now), null));
ok('Discount math', () => assert.equal(D.discounted(600, 35), 390));

ok('Vehicle ok', () => assert.deepEqual(D.validateVehicle({ em: 'DXB', code: 'a', num: '١٢٣' }).vehicle.code + D.validateVehicle({ em: 'DXB', code: 'a', num: '١٢٣' }).vehicle.num, 'A123'));
ok('Vehicle no code', () => assert.equal(D.validateVehicle({ em: 'DXB', code: '', num: '123' }).error, 'errCode'));
ok('Vehicle bad num', () => assert.equal(D.validateVehicle({ em: 'DXB', code: 'A', num: '12a' }).error, 'errNum'));
ok('Vehicle injection', () => assert.equal(D.validateVehicle({ em: 'DXB', code: '<b>', num: '1' }).vehicle.code, 'B'));
ok('Vehicle duplicate', () => assert.equal(D.validateVehicle({ em: 'DXB', code: 'A', num: '1' }, [{ em: 'DXB', code: 'A', num: '1' }]).error, 'errDup'));
ok('Date parse', () => assert.equal(D.parseDate('2026-02-30'), null));
ok('Date parse ok', () => assert.ok(D.parseDate('2026-10-27')));

// Fine discount campaigns
const camp = { id: 'shj-50', iss: 'shj', pct: 50, start: '2026-11-01', end: '2026-11-30', url: 'https://www.shjpolice.gov.ae/x' };
ok('Campaign parse ok', () => assert.equal(D.parseCampaigns({ campaigns: [camp] }).length, 1));
ok('Campaign parse junk', () => assert.deepEqual(D.parseCampaigns(null), []));
ok('Campaign bad issuer', () => assert.equal(D.parseCampaigns({ campaigns: [{ ...camp, iss: 'xx' }] }).length, 0));
ok('Campaign bad pct', () => assert.equal(D.parseCampaigns({ campaigns: [{ ...camp, pct: 150 }] }).length, 0));
ok('Campaign http url', () => assert.equal(D.parseCampaigns({ campaigns: [{ ...camp, url: 'http://x.ae' }] }).length, 0));
ok('Campaign js url', () => assert.equal(D.parseCampaigns({ campaigns: [{ ...camp, payUrl: 'javascript:alert(1)' }] }).length, 0));
ok('Campaign end before start', () => assert.equal(D.parseCampaigns({ campaigns: [{ ...camp, end: '2026-10-01' }] }).length, 0));
ok('Campaign bad date', () => assert.equal(D.parseCampaigns({ campaigns: [{ ...camp, start: '1 Nov' }] }).length, 0));
ok('Campaign note kept', () => assert.equal(D.parseCampaigns({ campaigns: [{ ...camp, note: { en: 'Not for serious violations', ar: 1 } }] })[0].note.ar, undefined));
ok('Campaign upcoming', () => assert.equal(D.campaignStatus(camp, new Date(2026, 9, 31, 23)), 'upcoming'));
ok('Campaign active first day', () => assert.equal(D.campaignStatus(camp, new Date(2026, 10, 1, 0, 1)), 'active'));
ok('Campaign active last evening', () => assert.equal(D.campaignStatus(camp, new Date(2026, 10, 30, 23, 30)), 'active'));
ok('Campaign ended', () => assert.equal(D.campaignStatus(camp, new Date(2026, 11, 1, 0, 1)), 'ended'));
ok('Campaign reminders', () => assert.deepEqual(D.campaignReminders(camp, new Date(2026, 9, 1)).map((r) => r.kind + r.at.getDate()), ['start1', '3d27', 'last30']));
ok('Campaign reminders mid-way', () => assert.deepEqual(D.campaignReminders(camp, new Date(2026, 10, 28)).map((r) => r.kind), ['last']));
ok('Campaign one day', () => assert.deepEqual(D.campaignReminders({ ...camp, end: '2026-11-01' }, new Date(2026, 9, 1)).map((r) => r.kind), ['start']));
ok('Campaign order', () => assert.deepEqual(D.visibleCampaigns([camp, { ...camp, id: 'b', end: '2026-11-10' }, { ...camp, id: 'old', end: '2026-10-02', start: '2026-10-01' }, { ...camp, id: 'up', start: '2026-12-01', end: '2026-12-05' }], new Date(2026, 10, 5)).map((c) => c.id), ['b', 'shj-50', 'up']));
const shipped = JSON.parse(fs.readFileSync(new URL('../campaigns.json', import.meta.url), 'utf8'));
ok('campaigns.json is valid', () => assert.equal(D.parseCampaigns(shipped).length, shipped.campaigns.length));

ok('Every Salik gate has a name', () => D.GATES.forEach((g) => assert.ok(I.T.en['gate_' + g.id], g.id)));

// Parking detection on simulated trips (src/park-detect.js). Second by second: GPS updates every 30 m
// (or none when iOS holds them back), the ~100 m circle that wakes the app, the step counter, and the
// fallback reminder. Each trip returns when "Did you pay?" would appear.
function trip(steps, { gpsAfterStop = true, stepCounter = true, wait = 10 } = {}) {
  const start = Date.UTC(2026, 9, 29, 6, 0, 0); // 10:00 UAE, a Thursday
  let t = start, x = 0, speed = 0;             // metres east of a Kalba street
  const pos = () => ({ lat: 25.0742, lng: 56.3553 + x / 100800 });
  let drive = {}, anchor = null, fireAt = null, lastGps = null, stepCount = 0, stepsAtMove = 0, stoppedOnce = false;
  const fired = [];
  const apply = (r) => {
    drive = r.drive;
    if (r.action === 'arm') { fireAt = t + wait * 60e3; stepsAtMove = stepCount; const p = pos(); if (!anchor || D.distanceM(p, anchor) >= 50) anchor = p; }
    if (r.action === 'ask') { fired.push({ at: (t - start) / 1000, speed, how: 'now' }); fireAt = null; }
  };
  for (const [kind, secs, kmh = 0] of steps) {
    for (let i = 0; i < secs; i++) {
      t += 1000; speed = kind === 'walk' ? 1.4 : kmh / 3.6;
      x += speed; if (kind === 'walk') stepCount += 1.8;
      if (kind === 'stop' || kind === 'walk') stoppedOnce = true;
      const p = pos(); const steps = stepCounter ? Math.round(stepCount - stepsAtMove) : null;
      const gpsOn = gpsAfterStop || !stoppedOnce;
      if (gpsOn && (!lastGps || D.distanceM(p, lastGps) >= 30)) { lastGps = p; apply(P.runDriveEvents(drive, [{ type: 'loc', t, ...p, speed: kind === 'walk' ? 1.4 : speed, steps }], D.distanceM)); }
      if (anchor && D.distanceM(p, anchor) > P.ANCHOR_RADIUS) { anchor = null; apply(P.runDriveEvents(drive, [{ type: 'exit', t, ...p, steps }], D.distanceM)); }
      if (fireAt && t >= fireAt) { fired.push({ at: (t - start) / 1000, speed, how: 'fallback' }); fireAt = null; }
    }
  }
  return fired;
}
const drivingWhen = (f) => f.filter((e) => e.speed > 2);
ok('Trip: red light 1 min then drive on, GPS normal → no question', () => assert.deepEqual(trip([['drive', 300, 60], ['stop', 60], ['drive', 600, 60]]), []));
ok('Trip: red light then drive on, iOS holds GPS back → circle wakes it, no question', () => assert.deepEqual(trip([['drive', 300, 60], ['stop', 60], ['drive', 600, 60]], { gpsAfterStop: false }), []));
ok('Trip: 117 km/h after a short stop never gets asked', () => assert.deepEqual(drivingWhen(trip([['drive', 120, 117], ['stop', 40], ['drive', 900, 117]], { gpsAfterStop: false })), []));
ok('Trip: crawling traffic 7 km/h for 12 min → no question', () => assert.deepEqual(trip([['drive', 200, 50], ['drive', 720, 7], ['drive', 200, 50]]), []));
ok('Trip: several lights in a row → no question', () => assert.deepEqual(trip([['drive', 120, 50], ['stop', 90], ['drive', 60, 40], ['stop', 120], ['drive', 60, 40], ['stop', 45], ['drive', 300, 60]], { gpsAfterStop: false }), []));
ok('Trip: park and walk away → asked within 30 s', () => { const f = trip([['drive', 300, 50], ['stop', 20], ['walk', 120]]); assert.equal(f.length, 1); assert.equal(f[0].how, 'now'); assert.ok(f[0].at - 320 <= 30, `asked after ${f[0].at - 320} s`); });
ok('Trip: park and walk away, GPS held back → circle + steps ask', () => { const f = trip([['drive', 300, 50], ['stop', 20], ['walk', 180]], { gpsAfterStop: false }); assert.equal(f.length, 1); assert.equal(f[0].how, 'now'); });
ok('Trip: park and stay in the car → asked after the in-car wait', () => { const f = trip([['drive', 300, 50], ['stop', 15 * 60]]); assert.equal(f.length, 1); assert.equal(f[0].how, 'fallback'); assert.ok(Math.abs(f[0].at - 300 - 600) < 30); });
ok('Trip: in-car wait 5 min setting', () => { const f = trip([['drive', 300, 50], ['stop', 15 * 60]], { wait: 5 }); assert.ok(Math.abs(f[0].at - 300 - 300) < 30); });
ok('Trip: asked only once per stop', () => assert.equal(trip([['drive', 300, 50], ['stop', 20], ['walk', 600]]).length, 1));
ok('Trip: no step counter (Android) walk away → asked by walking speed', () => { const f = trip([['drive', 300, 50], ['stop', 20], ['walk', 120]], { stepCounter: false }); assert.equal(f[0].how, 'now'); });
ok('Trip: unknown speed (-1) while driving still counts as driving', () => { let d = {}; for (let i = 0; i < 20; i++) d = P.onDriveEvent(d, { type: 'loc', t: i * 3000, lat: 25, lng: 56 + i * 0.0012, speed: i ? -1 : 15 }, D.distanceM).drive; assert.equal(new Date(d.lastMoving).getTime(), 19 * 3000); });

// 12-hour times (Saif): Arabic with full words
ok('12h English', () => { I.setLangCode('en'); assert.equal(I.hrsOf('DXB'), 'Mon–Sat 8:00 AM–10:00 PM'); assert.equal(I.clock(0, 5), '12:05 AM'); assert.equal(I.clock(12), '12:00 PM'); });
ok('12h Arabic full words', () => { I.setLangCode('ar'); assert.equal(I.clock(8), '8:00 صباحاً'); assert.equal(I.clock(22), '10:00 مساءً'); assert.equal(I.clock(12), '12:00 ظهراً'); assert.ok(!/ص$|م$/.test(I.clock(17))); });
ok('12h AUH ends at midnight', () => { I.setLangCode('en'); assert.match(I.hrsOf('AUH'), /8:00 AM–12:00 AM/); });
ok('No 24-hour times left in paid hours', () => { for (const L of ['en', 'ar', 'hi', 'zh', 'ru']) { I.setLangCode(L); for (const e of ['DXB', 'SHJ', 'AUH', 'AJM']) assert.ok(!/\b(1[3-9]|2\d|0\d):\d{2}\b/.test(I.hrsOf(e)), L + e + ' ' + I.hrsOf(e)); } I.setLangCode('en'); });

// Translations: every language has every key, with the same {placeholders}
const keys = Object.keys(I.T.en);
for (const L of ['ar', 'hi', 'zh', 'ru']) for (const k of keys) {
  ok(`${L}.${k}`, () => {
    assert.ok(I.T[L][k], `missing ${L}.${k}`);
    const ph = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
    assert.equal(ph(I.T[L][k]), ph(I.T.en[k]), `placeholders differ in ${L}.${k}`);
  });
}
console.log(`All ${n} checks passed (${keys.length} strings × 5 languages).`);
