// Web preview only: browsers can't schedule these local notifications, so every call is a no-op.
// Same exports as notify.js; Metro picks this file when bundling for web.
export const CAT = { parking: 'parking', parkingZone: 'parking-zone', salik: 'salik', fine: 'fine', expiry: 'expiry' };
export const ACT = { open: 'open', zone: 'zone', paid: 'paid', free: 'free', topup: 'topup', payFine: 'payfine', extend: 'extend' };
export const PARK_CHECK_ID = 'park-check';
const noop = async () => {};
export const setupCategories = noop;
export const requestNotifPermission = async () => true;
export const scheduleParkCheck = noop;
export const cancelParkCheck = noop;
export const scheduleExpiry = noop;
export const cancelExpiry = noop;
export const notifySalik = noop;
export const rescheduleFineReminders = noop;
export const onNotificationResponse = () => () => {};
