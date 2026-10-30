// User actions that change state and keep notifications in sync.
import { Linking, Alert, Platform } from 'react-native';
import * as SMS from './sms';
import { update, getState, newId } from './store';
import { t } from './i18n';
import { EMIRATES, cleanCode, discounted, fineOffer, PAY_URLS } from './data';
import { rescheduleFineReminders, scheduleExpiry, cancelExpiry, cancelParkCheck } from './notify';
import { openDisclaimer } from './disclaimer';
import { haptic } from './haptics';

// Before any payment, show the disclaimer (unless the user chose "Don't show this again").
function withDisclaimer(fn) {
  if (!getState().settings.discAfterPay) return fn();
  openDisclaimer({ afterPay: true, onContinue: fn });
}

export const syncFineReminders = () => { const s = getState(); return rescheduleFineReminders(s.fines, s.settings.remFines); };

export async function saveFine(f) {
  await update((x) => { const i = x.fines.findIndex((y) => y.id === f.id); if (i >= 0) x.fines[i] = f; else x.fines.push({ ...f, id: newId() }); });
  await syncFineReminders();
}
export async function deleteFine(id) { await update((x) => { x.fines = x.fines.filter((f) => f.id !== id); }); await syncFineReminders(); }

/** Opens the official payment site, then asks whether to mark the fine paid (and at what amount). */
export function payFine(f) { withDisclaimer(() => openFinePayment(f)); }
async function openFinePayment(f) {
  await Linking.openURL(PAY_URLS[f.iss] || PAY_URLS.other);
  const o = fineOffer(f);
  const amount = o ? discounted(f.amount, o.pct) : f.amount;
  setTimeout(() => Alert.alert(t('finePaidT') + '?', t('paidOnly', { paid: 'AED ' + amount.toFixed(2) }), [
    { text: t('no'), style: 'cancel' },
    { text: t('markPaid'), onPress: () => markFinePaid(f.id, amount) },
  ]), 600);
}
export async function markFinePaid(id, amount) {
  haptic('success');
  await update((x) => { const f = x.fines.find((y) => y.id === id); if (f && !f.paid) { f.paid = true; f.paidAmount = amount ?? f.amount; f.paidAt = new Date().toISOString(); } });
  await syncFineReminders();
}

/** Opens the official page for a discount campaign (after the disclaimer). */
export function payCampaign(c) { withDisclaimer(() => Linking.openURL(c.payUrl || PAY_URLS[c.iss] || c.url)); }

export function topUpSalik() { withDisclaimer(() => Linking.openURL(PAY_URLS.salik)); }

/** Opens the SMS composer pre-filled. The user taps Send. Returns true if it should count as paid. */
export async function sendParkingSms({ em, text, hours, zone, lat, lng, vehicle }) {
  const e = EMIRATES[em];
  if (!e?.sms || !text) return false;
  if (!(await SMS.isAvailableAsync())) { Alert.alert('SMS', 'This device cannot send SMS.'); return false; }
  const { result } = await SMS.sendSMSAsync([e.sms], text);
  let sent = result === 'sent';
  if (result === 'unknown') { // Android can't tell us: ask the user
    sent = await new Promise((resolve) => Alert.alert(t('confirmSentT'), t('confirmSentB'), [
      { text: t('no'), style: 'cancel', onPress: () => resolve(false) },
      { text: t('yes'), onPress: () => resolve(true) },
    ]));
  }
  if (!sent) return false;
  haptic('success');
  const h = e.hours ? hours : 1;
  const until = new Date(Date.now() + h * 3600e3).toISOString();
  await update((x) => {
    x.parking = { ...(x.parking || { id: newId(), start: new Date().toISOString(), lat, lng }), em, status: 'paid', zone: e.input === 'zone' ? cleanCode(zone) : null, until, paidAt: new Date().toISOString(), hours: h };
    // Settings ▸ Transaction history (on this phone only)
    const car = vehicle ? { em: vehicle.em, code: vehicle.code, num: vehicle.num } : null;
    x.history = [...(x.history || []), { id: newId(), date: new Date().toISOString(), em, hours: h, zone: x.parking.zone, text, car }].slice(-300);
    if (e.input === 'zone' && lat != null) {
      x.zones = x.zones.filter((z) => Math.abs(z.lat - lat) > 0.0015 || Math.abs(z.lng - lng) > 0.0015);
      x.zones.push({ lat, lng, zone: cleanCode(zone) });
    }
  });
  await cancelParkCheck();
  await scheduleExpiry(until);
  return true;
}

export async function markParkingPaid(hours = 1) {
  const until = new Date(Date.now() + hours * 3600e3).toISOString();
  await update((x) => { if (x.parking) { x.parking.status = 'paid'; x.parking.until = until; x.parking.paidAt = new Date().toISOString(); x.parking.hours = hours; } });
  await cancelParkCheck();
  await scheduleExpiry(until);
}
export async function markFreeHere() {
  await update((x) => {
    if (!x.parking) return;
    x.parking.status = 'free';
    if (x.parking.lat != null && !x.freeSpots.some((f) => Math.abs(f.lat - x.parking.lat) < 0.0015 && Math.abs(f.lng - x.parking.lng) < 0.0015)) {
      const id = newId();
      x.freeSpots.push({ id, name: t('freeSpotName', { n: x.freeSpots.length + 1 }), lat: x.parking.lat, lng: x.parking.lng });
      x.namePending = id; // Today asks for a name (Home, Work…)
    }
  });
  await cancelParkCheck();
}
export async function removeParkingTicket() { await update((x) => { x.parking = null; }); await cancelExpiry(); }

export async function startParkingSession({ lat, lng, em }) {
  await update((x) => { if (!x.parking) x.parking = { id: newId(), start: new Date().toISOString(), lat, lng, em, status: 'awaiting' }; });
}
export const isIOS = Platform.OS === 'ios';

export async function renameFreeSpot(id, name) {
  const n = (name || '').trim().slice(0, 40);
  await update((x) => { const f = x.freeSpots.find((y) => y.id === id); if (f && n) f.name = n; if (x.namePending === id) x.namePending = null; });
}
