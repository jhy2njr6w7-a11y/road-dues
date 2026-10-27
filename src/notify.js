// Local notifications: parking, Salik balance, fine discounts. Nothing is sent to a server.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { t, emName, fmtDate } from './i18n';
import { aed, discounted, fineOffer, campaignReminders } from './data';

export const CAT = { parking: 'parking', parkingZone: 'parking-zone', salik: 'salik', fine: 'fine', expiry: 'expiry', campaign: 'campaign' };
export const ACT = { open: 'open', zone: 'zone', paid: 'paid', free: 'free', topup: 'topup', payFine: 'payfine', extend: 'extend', payCampaign: 'paycampaign' };

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/** Categories hold the action buttons. Re-register after a language change so button labels are translated. */
export async function setupCategories() {
  const fg = { opensAppToForeground: true };
  await Notifications.setNotificationCategoryAsync(CAT.parking, [
    { identifier: ACT.open, buttonTitle: t('reviewSend'), options: fg },
    { identifier: ACT.paid, buttonTitle: t('alreadyPaid'), options: fg },
    { identifier: ACT.free, buttonTitle: t('freeHere'), options: fg },
  ]);
  await Notifications.setNotificationCategoryAsync(CAT.parkingZone, [
    { identifier: ACT.zone, buttonTitle: t('payBySms'), textInput: { submitButtonTitle: t('sendSms'), placeholder: t('zonePh') }, options: fg },
    { identifier: ACT.paid, buttonTitle: t('alreadyPaid'), options: fg },
    { identifier: ACT.free, buttonTitle: t('freeHere'), options: fg },
  ]);
  await Notifications.setNotificationCategoryAsync(CAT.salik, [{ identifier: ACT.topup, buttonTitle: t('topUpSalik'), options: fg }]);
  await Notifications.setNotificationCategoryAsync(CAT.fine, [{ identifier: ACT.payFine, buttonTitle: t('payNow'), options: fg }]);
  await Notifications.setNotificationCategoryAsync(CAT.campaign, [{ identifier: ACT.payCampaign, buttonTitle: t('payNow'), options: fg }]);
  await Notifications.setNotificationCategoryAsync(CAT.expiry, [{ identifier: ACT.extend, buttonTitle: t('extend'), options: fg }]);
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.HIGH });
  }
}

export async function notifStatus() {
  const cur = await Notifications.getPermissionsAsync();
  return { granted: cur.granted, canAsk: cur.canAskAgain !== false };
}
export async function requestNotifPermission() {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  // Android 13+ only shows the permission pop-up once the app has a notification channel.
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('reminders', { name: 'Reminders', importance: Notifications.AndroidImportance.HIGH });
  const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return r.granted;
}

function content(title, body, categoryIdentifier, data = {}) {
  return { title, body, categoryIdentifier, data, sound: true, interruptionLevel: 'timeSensitive' };
}
const at = (date) => ({ type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(date), channelId: 'reminders' });

// ---------- Parking
// Trick for reliable parking detection: while driving, every location update pushes this
// notification a few minutes into the future. When the car stops, updates stop, and it fires.
export const PARK_CHECK_ID = 'park-check';
export async function scheduleParkCheck({ em, smsText, num, minutes = 4, lat, lng }) {
  await Notifications.cancelScheduledNotificationAsync(PARK_CHECK_ID).catch(() => {});
  const ready = smsText && smsText.length > 0;
  const body = smsText === null ? t('pBodyNoSms', { em: emName(em) })
    : ready ? t('pkReady', { em: emName(em), num, text: smsText }) : t('pkZone', { em: emName(em) });
  await Notifications.scheduleNotificationAsync({
    identifier: PARK_CHECK_ID,
    content: content(t('didPayT'), body, ready || smsText === null ? CAT.parking : CAT.parkingZone, { kind: 'parking', em, lat, lng, scheduledFor: Date.now() + minutes * 60e3 }),
    trigger: at(Date.now() + minutes * 60e3),
  });
}
export const cancelParkCheck = () => Notifications.cancelScheduledNotificationAsync(PARK_CHECK_ID).catch(() => {});

export async function scheduleExpiry(until) {
  await Notifications.cancelScheduledNotificationAsync('park-expiry').catch(() => {});
  const when = new Date(until).getTime() - 10 * 60e3;
  if (when <= Date.now()) return;
  await Notifications.scheduleNotificationAsync({ identifier: 'park-expiry', content: content(t('expT'), t('expB'), CAT.expiry, { kind: 'expiry' }), trigger: at(when) });
}
export const cancelExpiry = () => Notifications.cancelScheduledNotificationAsync('park-expiry').catch(() => {});

// ---------- Salik
export async function notifySalik({ gate, charge, balance, low }) {
  if (balance == null) return;
  let title, body;
  const v = { gate, bal: aed(balance), charge: aed(charge) };
  if (balance < 0) { title = t('salikNegT'); body = t('salikNegB', v); }
  else if (balance < low) { title = t('salikLowT'); body = t('salikLowB', v); }
  else { title = t('salikGateT', v); body = t('salikGateB', v); }
  await Notifications.scheduleNotificationAsync({ identifier: 'salik-balance', content: content(title, body, balance < low ? CAT.salik : undefined, { kind: 'salik' }), trigger: { channelId: 'reminders' } });
}

// ---------- Fine discounts: 7 days and 1 day before the discount ends, at 09:00
export async function rescheduleFineReminders(fines, enabled) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith('fine-')).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  if (!enabled) return;
  for (const f of fines) {
    const o = fineOffer(f);
    if (!o) continue;
    for (const before of [7, 1]) {
      const d = new Date(o.end); d.setDate(d.getDate() - before); d.setHours(9, 0, 0, 0);
      if (d <= new Date()) continue;
      const title = before === 1 ? t('discT1', { p: o.pct }) : t('discTn', { p: o.pct, n: before });
      const body = t('discB', { issuer: t('iss_' + f.iss), pay: aed(discounted(f.amount, o.pct)), amt: aed(f.amount), date: fmtDate(o.end), save: aed(f.amount - discounted(f.amount, o.pct)) });
      await Notifications.scheduleNotificationAsync({ identifier: `fine-${f.id}-${before}`, content: content(title, body, CAT.fine, { kind: 'fine', fineId: f.id }), trigger: at(d) });
    }
  }
}

// ---------- Fine discount campaigns: on the start day, 3 days before the end and on the last day, at 09:00
function campaignContent(c, kind) {
  const v = { p: c.pct, issuer: t('iss_' + c.iss), date: fmtDate(c.end) };
  const [title, body] = kind === '3d' ? [t('campNotif3T', v), t('campNotif3B', v)]
    : kind === 'last' ? [t('campNotifLastT', v), t('campNotifLastB', v)] : [t('campTitle', v), t('campNotifB', v)];
  return content(title, body, CAT.campaign, { kind: 'campaign', campaignId: c.id });
}
export async function rescheduleCampaignReminders(campaigns, enabled) {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((n) => n.identifier.startsWith('camp-')).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  if (!enabled) return;
  for (const c of campaigns) for (const r of campaignReminders(c)) {
    await Notifications.scheduleNotificationAsync({ identifier: `camp-${c.id}-${r.kind}`, content: campaignContent(c, r.kind), trigger: at(r.at) });
  }
}
/** A campaign that is already running when the app first hears about it. */
export async function notifyCampaignNow(c) {
  await Notifications.scheduleNotificationAsync({ identifier: `camp-${c.id}-new`, content: campaignContent(c, 'start'), trigger: { channelId: 'reminders' } });
}

/** Calls handle for the tap that launched the app (once) and for every later tap. Returns an unsubscribe function. */
export function onNotificationResponse(handle) {
  // The launch response survives until cleared; clear it so a restart doesn't repeat the action.
  const last = Notifications.getLastNotificationResponse();
  if (last) { Notifications.clearLastNotificationResponse(); handle(last); }
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
