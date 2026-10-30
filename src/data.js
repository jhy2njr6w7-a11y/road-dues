// Rules and reference data. Pure functions only (unit-tested in tests/logic.test.mjs).

// ---------- Emirates: parking SMS formats and paid hours
// v = vehicle {em, code, num}; x = zone code (DXB/RAK) or parking type S/P (AUH); h = hours
export const EMIRATES = {
  DXB: { sms: '7275', input: 'zone', hours: [1, 2, 3, 4],
    fmt: (v, x, h) => (v.em === 'DXB' ? `${v.code}${v.num}` : `${v.em}${v.code} ${v.num}`) + ` ${x} ${h}` },
  SHJ: { sms: '5566', input: null, hours: [1, 2, 3, 5], hoursNote: 'shjHours',
    fmt: (v, x, h) => `${v.em} ${v.num} ${h}` },
  AUH: { sms: '3009', input: 'type', hours: [1, 2, 3, 4],
    fmt: (v, x, h) => `${v.em} ${v.code} ${v.num} ${x} ${h}` },
  AJM: { sms: '5155', input: null, hours: null,
    fmt: (v) => `${v.em} ${v.code} ${v.num}` },
  // No public paid street parking found (Oct 2026): mostly free; paid spots (airport, beaches) use machines.
  RAK: { sms: null, freeParking: true },
  FUJ: { sms: null, freeParking: true },
  UAQ: { sms: null, freeParking: true },
};
export const EM_ORDER = ['DXB', 'SHJ', 'AUH', 'AJM', 'RAK', 'FUJ', 'UAQ']; // plates: cars from every emirate
export const PARKING_EMIRATES = EM_ORDER.filter((k) => !EMIRATES[k].freeParking); // where you can pay by SMS

// Paid parking windows in UAE local time. day: 0 = Sunday … 6 = Saturday. null = unknown (always ask).
const PAID = {
  DXB: { days: [1, 2, 3, 4, 5, 6], spans: [[8, 22]] },
  SHJ: { days: [6, 0, 1, 2, 3, 4], spans: [[8, 24]] }, // until midnight since 1 Jul 2026, incl. Kalba, Khorfakkan, Al Dhaid (Sharjah Municipality)
  AUH: { days: [1, 2, 3, 4, 5, 6], spans: [[8, 24]] },
  AJM: { days: [6, 0, 1, 2, 3, 4], spans: [[8, 13], [17, 22]] },
};
export function uaeParts(date) {
  // UAE is UTC+4 all year (no daylight saving)
  const d = new Date(date.getTime() + 4 * 3600e3);
  return { day: d.getUTCDay(), hour: d.getUTCHours() + d.getUTCMinutes() / 60 };
}
// Approximate parking prices in AED (Oct 2026 guides; the sign at the spot always wins). Shown with "+ SMS fee".
// Dubai depends on the zone letter and peak hours, so only a range per hour.
export const PRICES = {
  SHJ: { byHours: { 1: 2, 2: 5, 3: 8, 5: 12 } },
  AUH: { perHour: { S: 2, P: 3 } },
  AJM: { byHours: { 1: 2 } },
  DXB: { perHourRange: [2, 6] },
};
export function parkingPrice(em, { hours = 1, type = 'S' } = {}) {
  const p = PRICES[em];
  if (!p) return null;
  if (p.byHours) return p.byHours[hours] != null ? { aed: p.byHours[hours] } : null;
  if (p.perHour) return p.perHour[type] != null ? { aed: p.perHour[type] * hours } : null;
  return { from: p.perHourRange[0] * hours, to: p.perHourRange[1] * hours };
}

export function isPaidTime(em, date = new Date()) {
  if (EMIRATES[em]?.freeParking) return false; // no parking reminders there
  const p = PAID[em];
  if (!p) return true; // unknown rules: remind anyway, the user checks the sign
  const { day, hour } = uaeParts(date);
  return p.days.includes(day) && p.spans.some(([a, b]) => hour >= a && hour < b);
}

// ---------- Emirate from coordinates (offline). Nearest reference point; the user can switch it.
const REF = [
  ['DXB', 25.2048, 55.2708], ['DXB', 25.0800, 55.1400], ['DXB', 24.9850, 55.0900], ['DXB', 25.2700, 55.3300], ['DXB', 25.1200, 55.4000], ['DXB', 24.7900, 55.6300], ['DXB', 25.0900, 56.1700],
  ['SHJ', 25.3463, 55.4209], ['SHJ', 25.3000, 55.4800], ['SHJ', 25.2700, 55.6400], ['SHJ', 25.1100, 55.8700], ['SHJ', 25.0480, 56.3550], ['SHJ', 25.0750, 56.3600], ['SHJ', 25.3400, 56.3500], ['SHJ', 25.6200, 56.2700],
  ['AJM', 25.4052, 55.5136], ['AJM', 25.3850, 55.4600],
  ['UAQ', 25.5647, 55.5552], ['UAQ', 25.5300, 55.6500],
  ['RAK', 25.7895, 55.9432], ['RAK', 25.6700, 55.7800], ['RAK', 25.9200, 56.0500],
  ['FUJ', 25.1288, 56.3265], ['FUJ', 25.1650, 56.3400], ['FUJ', 25.4000, 56.2500], ['FUJ', 25.5900, 56.2500],
  ['AUH', 24.4539, 54.3773], ['AUH', 24.4700, 54.6000], ['AUH', 24.2075, 55.7447], ['AUH', 24.1000, 52.7300], ['AUH', 24.8000, 54.9000],
];
export function distanceM(a, b) {
  const R = 6371000, toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export function emirateAt(p) {
  let best = null, bestD = Infinity;
  for (const [em, lat, lng] of REF) { const d = distanceM(p, { lat, lng }); if (d < bestD) { bestD = d; best = em; } }
  return bestD < 80000 ? best : null;
}

// ---------- Salik
// 2026 tariff incl. 5% VAT (from 1 June 2026). Ramadan schedules are not applied.
export function salikCharge(date) {
  const { day, hour } = uaeParts(date);
  if (hour >= 1 && hour < 6) return 0;
  if (day === 0) return 4.2;
  if ((hour >= 6 && hour < 10) || (hour >= 16 && hour < 20)) return 6.3;
  return 4.2;
}
// Approximate positions. Users correct them in Settings ▸ Salik gates ▸ "I'm here".
export const GATES = [
  { id: 'garhoud', name: 'Al Garhoud Bridge', lat: 25.2338, lng: 55.3420 },
  { id: 'maktoum', name: 'Al Maktoum Bridge', lat: 25.2445, lng: 55.3228 },
  { id: 'airport', name: 'Airport Tunnel', lat: 25.2560, lng: 55.3530 },
  { id: 'mamzar-s', name: 'Al Mamzar South', lat: 25.2880, lng: 55.3570, pair: 'mamzar-n' },
  { id: 'mamzar-n', name: 'Al Mamzar North', lat: 25.2960, lng: 55.3640, pair: 'mamzar-s' },
  { id: 'safa-n', name: 'Al Safa North', lat: 25.1790, lng: 55.2330, pair: 'safa-s' },
  { id: 'safa-s', name: 'Al Safa South', lat: 25.1640, lng: 55.2170, pair: 'safa-n' },
  { id: 'barsha', name: 'Al Barsha', lat: 25.1180, lng: 55.1980 },
  { id: 'jebelali', name: 'Jebel Ali', lat: 25.0260, lng: 55.1010 },
  { id: 'businessbay', name: 'Business Bay Crossing', lat: 25.1890, lng: 55.2930 },
];
export const gatePos = (g, overrides = {}) => overrides[g.id] || { lat: g.lat, lng: g.lng };

// Charge for a crossing, applying the 1-hour pair rule. Returns null for a duplicate (same gate within 10 min).
export function crossingCharge(gateId, date, crossings) {
  const t = date.getTime();
  if (crossings.some((c) => c.gate === gateId && Math.abs(new Date(c.date).getTime() - t) < 600e3)) return null;
  const pair = GATES.find((g) => g.id === gateId)?.pair;
  if (pair && crossings.some((c) => c.gate === pair && c.charge > 0 && t - new Date(c.date).getTime() >= 0 && t - new Date(c.date).getTime() < 3600e3)) return 0;
  return salikCharge(date);
}

// ---------- Fines
export const ISSUERS = ['dxb', 'rta', 'parkin', 'adp', 'shj', 'other'];
const RULES = { adp: [[35, 60], [25, 365]], shj: [[35, 60], [25, 365]] };
export function fineOffer(f, now = new Date()) {
  if (f.paid) return null;
  if (f.manualPct && f.manualUntil && new Date(f.manualUntil) > now) return { pct: f.manualPct, end: new Date(f.manualUntil) };
  if (f.severe) return null;
  for (const [pct, days] of RULES[f.iss] || []) {
    const end = new Date(f.date); end.setDate(end.getDate() + days);
    if (end > now) return { pct, end };
  }
  return null;
}
export const discounted = (amount, pct) => Math.round(amount * (1 - pct / 100) * 100) / 100;
export function daysLeft(end, now = new Date()) {
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(end); b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b - a) / 864e5));
}

// ---------- Fine discount campaigns (e.g. "50% off Sharjah fines until 31 Dec").
// Published by hand in campaigns.json; the app downloads that list and reminds users.
export const CAMPAIGN_ISSUERS = ['dxb', 'adp', 'shj', 'ajm', 'rak', 'fuj', 'uaq', 'moi', 'rta', 'parkin'];
const httpsUrl = (u) => typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u) && u.length <= 300;
const dayStart = (s) => { const d = parseDate(s); d.setHours(0, 0, 0, 0); return d; };
const dayEnd = (s) => { const d = parseDate(s); d.setHours(23, 59, 59, 999); return d; };
const at9 = (d) => { const x = new Date(d); x.setHours(9, 0, 0, 0); return x; };

/** Keeps only well-formed campaigns from the downloaded JSON; anything odd is dropped, never shown. */
// "1.2.0" newer than "1.1.9"? For the update notice (campaigns.json ▸ latestVersion).
export function isNewerVersion(latest, current) {
  const ok = (v) => typeof v === 'string' && /^\d+(\.\d+){0,3}$/.test(v);
  if (!ok(latest) || !ok(current)) return false;
  const a = latest.split('.').map(Number), b = current.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) { const d = (a[i] || 0) - (b[i] || 0); if (d) return d > 0; }
  return false;
}

export function parseCampaigns(json) {
  const list = Array.isArray(json?.campaigns) ? json.campaigns : [];
  const out = [];
  for (const c of list.slice(0, 50)) {
    if (!c || typeof c.id !== 'string' || !/^[\w-]{1,40}$/.test(c.id)) continue;
    if (!CAMPAIGN_ISSUERS.includes(c.iss)) continue;
    if (!Number.isInteger(c.pct) || c.pct < 1 || c.pct > 100) continue;
    if (!parseDate(c.start) || !parseDate(c.end) || dayEnd(c.end) < dayStart(c.start)) continue;
    if (!httpsUrl(c.url) || (c.payUrl != null && !httpsUrl(c.payUrl))) continue;
    const note = {};
    if (c.note && typeof c.note === 'object') for (const [k, v] of Object.entries(c.note)) if (/^[a-z]{2}$/.test(k) && typeof v === 'string') note[k] = v.slice(0, 200);
    out.push({ id: c.id, iss: c.iss, pct: c.pct, start: c.start, end: c.end, url: c.url, payUrl: c.payUrl || null, note });
  }
  return out;
}
export function campaignStatus(c, now = new Date()) {
  if (now < dayStart(c.start)) return 'upcoming';
  return now <= dayEnd(c.end) ? 'active' : 'ended';
}
export const campaignEnd = (c) => dayEnd(c.end);
/** Active first (ending soonest first), then upcoming; ended ones are dropped. */
export function visibleCampaigns(list, now = new Date()) {
  const rank = { active: 0, upcoming: 1 };
  return list.filter((c) => campaignStatus(c, now) !== 'ended')
    .sort((a, b) => rank[campaignStatus(a, now)] - rank[campaignStatus(b, now)] || dayEnd(a.end) - dayEnd(b.end));
}
/** Reminder times at 09:00: the start day, 3 days before the end, and the last day. Only future ones. */
export function campaignReminders(c, now = new Date()) {
  const start = at9(dayStart(c.start)), last = at9(dayStart(c.end));
  const three = new Date(last); three.setDate(three.getDate() - 3);
  const out = [{ kind: 'start', at: start }];
  if (three > start) out.push({ kind: '3d', at: three });
  if (last > start) out.push({ kind: 'last', at: last });
  return out.filter((r) => r.at > now);
}

// ---------- Input cleaning and validation
export const latinDigits = (s) => String(s)
  .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
  .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
export const cleanCode = (s) => latinDigits(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
export const ZONE_RE = /^\d{2,4}[A-Z]?$/;
export function validateVehicle(v, existing = []) {
  const code = cleanCode(v.code), num = latinDigits(v.num).replace(/\s/g, '');
  if (!/^[A-Z0-9]{1,3}$/.test(code)) return { error: 'errCode' };
  if (!/^\d{1,5}$/.test(num)) return { error: 'errNum' };
  if (existing.some((x) => x.em === v.em && x.code === code && x.num === num)) return { error: 'errDup' };
  return { vehicle: { ...v, code, num, model: (v.model || '').trim().slice(0, 24), color: (v.color || '').trim().slice(0, 16) } };
}
export function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(latinDigits(String(s).trim()));
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], 12);
  return d.getMonth() === +m[2] - 1 ? d : null;
}

/** Build the parking SMS. Returns null if the emirate has no SMS service, '' if input is missing/invalid. */
export function buildSms(em, vehicle, { zone = '', type = 'S', hours = 1 } = {}) {
  const e = EMIRATES[em];
  if (!e?.sms || !vehicle) return null;
  if (e.input === 'zone' && !ZONE_RE.test(cleanCode(zone))) return '';
  const x = e.input === 'zone' ? cleanCode(zone) : e.input === 'type' ? type : '';
  const h = e.hours ? (e.hours.includes(hours) ? hours : e.hours[0]) : 1;
  return e.fmt(vehicle, x, h);
}

export const BRANDS = ['Toyota', 'Nissan', 'Lexus', 'Mitsubishi', 'Hyundai', 'Kia', 'Honda', 'Mazda', 'Ford', 'Chevrolet', 'GMC', 'Jeep', 'Dodge', 'Mercedes-Benz', 'BMW', 'Audi', 'Volkswagen', 'Porsche', 'Land Rover', 'Range Rover', 'Tesla', 'MG', 'Geely', 'Changan', 'Other'];
export const brandMark = (b) => (b === 'Other' ? '•' : b.split(/[\s-]/).map((w) => w[0]).join('').slice(0, 2).toUpperCase());

// Official channels (the app never handles card details)
export const PAY_URLS = {
  dxb: 'https://www.dubaipolice.gov.ae', rta: 'https://www.rta.ae', parkin: 'https://www.parkin.ae',
  adp: 'https://www.tamm.abudhabi', shj: 'https://www.shjpolice.gov.ae', moi: 'https://www.moi.gov.ae', other: 'https://u.ae', salik: 'https://www.salik.ae',
};
export const aed = (n) => 'AED ' + (Math.round(n * 100) / 100).toFixed(2);
