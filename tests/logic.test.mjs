// Run: node tests/logic.test.mjs   (copies src into a temp ESM folder so Node can import it)
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import assert from 'node:assert/strict';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rd-'));
fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
for (const f of ['data.js', 'i18n.js', 'i18n-extra.js', 'i18n-campaigns.js']) fs.writeFileSync(path.join(tmp, f), fs.readFileSync(new URL('../src/' + f, import.meta.url), 'utf8').replace(/from '\.\/(i18n-\w+)'/g, "from './$1.js'"));
const D = await import(path.join(tmp, 'data.js')); const I = await import(path.join(tmp, 'i18n.js'));
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
ok('Unknown emirate always asks', () => assert.equal(D.isPaidTime('FUJ', uae('2026-10-26T03:00:00')), true));

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
