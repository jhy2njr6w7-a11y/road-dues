// Web preview only: browsers can't schedule these local notifications, so every call is a no-op.
// Same exports as notify.js; Metro picks this file when bundling for web.
export const CAT = { parking: 'parking', parkingZone: 'parking-zone', salik: 'salik', fine: 'fine', expiry: 'expiry', campaign: 'campaign' };
export const ACT = { open: 'open', zone: 'zone', paid: 'paid', free: 'free', topup: 'topup', payFine: 'payfine', extend: 'extend', payCampaign: 'paycampaign' };
export const PARK_CHECK_ID = 'park-check';
const noop = async () => {};
export const setupCategories = noop;
export const requestNotifPermission = async () => true;
export const notifStatus = async () => ({ granted: true, canAsk: true });
export const scheduleParkCheck = noop;
export const cancelParkCheck = noop;
export const scheduleExpiry = noop;
export const cancelExpiry = noop;
export const notifySalik = noop;
export const rescheduleFineReminders = noop;
export const rescheduleCampaignReminders = noop;
export const notifyCampaignNow = noop;
export const onNotificationResponse = () => () => {};
