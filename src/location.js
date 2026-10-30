// Background location: detects driving, Salik gate crossings and parking.
// Location data is processed on the phone only and never uploaded.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Pedometer } from 'expo-sensors';
import { Alert, Platform } from 'react-native';
import { loadState, update, newId, getState } from './store';
import { setLangCode, t, gateName } from './i18n';
import { GATES, gatePos, distanceM, crossingCharge, emirateAt, isPaidTime, buildSms, EMIRATES } from './data';
import { runDriveEvents, DRIVE_SPEED, SLOW_SPEED, ANCHOR_RADIUS, DEFAULT_IN_CAR_WAIT } from './park-detect';
import { scheduleParkCheck, cancelParkCheck, notifySalik, cancelExpiry } from './notify';
import { refreshCampaigns } from './campaigns';

export const TASK = 'road-dues-location';
const GEO_TASK = 'road-dues-car-anchor';
const GATE_RADIUS = 170;    // metres
const FREE_RADIUS = 150;    // metres around a saved free spot
const LOG_MAX = 300;        // trip log lines kept (Settings ▸ tap "Reminders" 5 times)

const hms = (ms) => new Date(ms).toTimeString().slice(0, 8);
const logLine = (x, line) => { x.tripLog = [...(x.tripLog || []), line].slice(-LOG_MAX); };

export async function handleLocations(locations) {
  const s = await loadState();
  if (s.settings.lang) setLangCode(s.settings.lang);
  const events = locations.map((l) => ({ type: 'loc', t: l.timestamp, lat: l.coords.latitude, lng: l.coords.longitude, speed: l.coords.speed, accuracy: l.coords.accuracy }));
  // Slow updates: walking or crawling? Ask the step counter once for the batch.
  if (events.some((e) => e.speed == null || e.speed < SLOW_SPEED)) {
    const steps = await stepsSince(s.drive.lastMoving);
    for (const e of events) e.steps = steps;
  }
  // Parking first: it is what must not miss its few seconds of background time.
  await decide(events, 'gps');
  await checkGates(events);
  await refreshCampaigns(); // last: can be slow on the road (at most every 3 h)
}

// 1) Parked, driving or walking? (rules in src/park-detect.js)
async function decide(events, src) {
  const before = getState().drive;
  const { drive, action } = runDriveEvents(before, events, distanceM);
  const last = events[events.length - 1];
  await update((x) => {
    x.drive = { ...x.drive, ...drive };
    if (action === 'arm' && x.parking && x.parking.status !== 'free') x.parking = null; // driving again: not parked
    for (const e of events) logLine(x, `${hms(e.t)} ${src} ${e.speed != null && e.speed >= 0 ? (e.speed * 3.6).toFixed(0) + ' km/h' : e.steps != null ? e.steps + ' steps' : '?'}`);
    logLine(x, `${hms(Date.now())}   → ${action}`);
  });
  if (action === 'arm') { await cancelExpiry(); await armParking(); await moveAnchor(last); }
  if (action === 'ask') await askNow();
}

// Where the car stopped, if a reminder makes sense there now (or at `when`).
function parkingSpot(when) {
  const cur = getState();
  const d = cur.drive;
  if (!cur.settings.remParking || d.lastLat == null) return { skip: 'off' };
  const spot = { lat: d.lastLat, lng: d.lastLng };
  const em = emirateAt(spot);
  if (!em) return { skip: 'no emirate' };
  if (cur.freeSpots.some((f) => distanceM(spot, f) < FREE_RADIUS)) return { skip: 'free spot' };
  if (!isPaidTime(em, when)) return { skip: 'free hours' };
  const vehicle = cur.vehicles.find((v) => v.id === cur.defaultVeh) || cur.vehicles[0];
  const zone = cur.zones.find((z) => distanceM(spot, z) < FREE_RADIUS)?.zone || '';
  return { em, spot, smsText: buildSms(em, vehicle, { zone, hours: 1, type: 'S' }) };
}

// Fallback for "parked and stayed in the car": ask after the in-car wait unless driving pushes it back.
async function armParking() {
  const wait = getState().settings.inCarWait || DEFAULT_IN_CAR_WAIT;
  const p = parkingSpot(new Date(Date.now() + wait * 60e3));
  if (p.skip) { await cancelParkCheck(); return; }
  await scheduleParkCheck({ em: p.em, smsText: p.smsText, num: EMIRATES[p.em].sms, minutes: wait, ...p.spot });
}

async function askNow() {
  const p = parkingSpot(new Date());
  await update((x) => logLine(x, `${hms(Date.now())}   ask now${p.skip ? ' skipped: ' + p.skip : ''}`));
  if (p.skip) { await cancelParkCheck(); return; }
  await scheduleParkCheck({ em: p.em, smsText: p.smsText, num: EMIRATES[p.em].sms, minutes: 0, ...p.spot });
}

// Circle around the last moving point. Leaving it wakes the app even when iOS has stopped sending GPS
// updates after a stop, so a red light can't turn into a false "Did you pay?" a few minutes later.
async function moveAnchor(at) {
  const a = getState().drive;
  if (a.anchorLat != null && distanceM(at, { lat: a.anchorLat, lng: a.anchorLng }) < 50) return;
  try {
    await Location.startGeofencingAsync(GEO_TASK, [{ identifier: 'car', latitude: at.lat, longitude: at.lng, radius: ANCHOR_RADIUS, notifyOnEnter: false, notifyOnExit: true }]);
    await update((x) => { x.drive.anchorLat = at.lat; x.drive.anchorLng = at.lng; });
  } catch (e) { /* no background permission: GPS updates alone */ }
}

// Steps since the car last moved (iPhone motion chip keeps them even while the app sleeps); null if unknown.
async function stepsSince(iso) {
  if (Platform.OS !== 'ios' || !iso) return null;
  try {
    if (!(await Pedometer.isAvailableAsync()) || !(await Pedometer.getPermissionsAsync()).granted) return null;
    return (await Pedometer.getStepCountAsync(new Date(iso), new Date())).steps;
  } catch (e) { return null; }
}

async function handleAnchorExit() {
  const s = await loadState();
  if (s.settings.lang) setLangCode(s.settings.lang);
  const p = await Location.getLastKnownPositionAsync({ maxAge: 60e3 }).catch(() => null)
    || await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
  if (!p) return;
  const steps = await stepsSince(s.drive.lastMoving);
  await update((x) => { x.drive.anchorLat = null; }); // we are outside it now; the next 'arm' draws a new one here
  await decide([{ type: 'exit', t: Date.now(), lat: p.coords.latitude, lng: p.coords.longitude, steps }], 'left circle');
}

// 2) Salik gates
async function checkGates(events) {
  for (const e of events) {
    if (e.speed == null || e.speed < DRIVE_SPEED) continue; // never count a gate when not clearly driving
    const st = getState();
    if (!st.settings.remSalik || e.accuracy == null || e.accuracy >= 60) continue;
    const when = new Date(e.t);
    for (const g of GATES) {
      if (distanceM(e, gatePos(g, st.settings.gateOverrides)) > GATE_RADIUS) continue;
      const charge = crossingCharge(g.id, when, getState().crossings);
      if (charge == null) continue;
      const after = await update((x) => {
        x.crossings.push({ id: newId(), gate: g.id, date: when.toISOString(), charge, auto: true });
        if (x.crossings.length > 500) x.crossings = x.crossings.slice(-500);
        if (x.balance != null) x.balance = Math.round((x.balance - charge) * 100) / 100;
      });
      if (charge > 0) await notifySalik({ gate: gateName(g.id), charge, balance: after.balance, low: after.settings.low });
    }
  }
}

TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  try { await handleLocations(data.locations); } catch (e) { /* never crash the background task */ }
});
TaskManager.defineTask(GEO_TASK, async ({ data, error }) => {
  if (error || data?.eventType !== Location.GeofencingEventType.Exit) return;
  try { await handleAnchorExit(); } catch (e) { /* never crash the background task */ }
});

// Background ("Always") permission throws where it isn't available, e.g. Expo Go on iPhone.
// Treat that as "not granted" so the app keeps working with foreground location only.
const NO_BACKGROUND = { granted: false, canAskAgain: true, unavailable: true };

export async function locationStatus() {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync().catch(() => NO_BACKGROUND);
  return { foreground: fg.granted, background: bg.granted, noBackground: !!bg.unavailable, canAsk: fg.canAskAgain !== false && bg.canAskAgain !== false };
}

// Android 11+ never shows "Allow all the time" in the pop-up: the request opens the app's location
// settings page instead. Say what to tap first, or people press Back and stay on "While using".
const explainAndroidBackground = () => new Promise((resolve) => Alert.alert(t('bgAndroidT'), t('bgAndroidB'), [{ text: t('continuePay'), onPress: resolve }], { cancelable: false }));

export async function requestLocation() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { foreground: false, background: false };
  if (Platform.OS === 'android' && Platform.Version >= 30) {
    const cur = await Location.getBackgroundPermissionsAsync().catch(() => NO_BACKGROUND);
    if (!cur.granted && cur.canAskAgain !== false) await explainAndroidBackground();
  }
  const bg = await Location.requestBackgroundPermissionsAsync().catch(() => NO_BACKGROUND);
  return { foreground: true, background: bg.granted, noBackground: !!bg.unavailable };
}

// Bump when the options below change, so phones already tracking restart with the new ones.
const TRACKING_VERSION = 3;

export async function startTracking() {
  try {
    const { background } = await locationStatus();
    if (!background) return false;
    const running = await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false);
    if (running && getState().trackingVersion === TRACKING_VERSION) return true;
    if (running) await Location.stopLocationUpdatesAsync(TASK);
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: Location.Accuracy.High,
      activityType: Location.ActivityType.AutomotiveNavigation,
      distanceInterval: 30,
      // Must stay off: once iOS pauses updates it doesn't resume them in the background, so after the
      // first stop the app would never see the next drive (no Salik gates, no parking reminders).
      // While parked, distanceInterval keeps the task quiet.
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: false,
      foregroundService: {                  // Android requires a visible notification while tracking
        notificationTitle: t('appName'),
        notificationBody: t('trackBody'),
      },
    });
    await update((x) => { x.trackingVersion = TRACKING_VERSION; });
  } catch (e) { return false; }
  await askMotion(); // e.g. Expo Go, or Android refusing to start the foreground service
  return true;
}

// iPhone "Motion & Fitness": lets the app tell "got out and walked" from "waiting at a red light".
async function askMotion() {
  if (Platform.OS !== 'ios') return;
  try {
    const p = await Pedometer.getPermissionsAsync();
    if (!p.granted && p.canAskAgain) await Pedometer.requestPermissionsAsync();
  } catch (e) { /* not available: GPS speed alone */ }
}

export async function currentPosition() {
  try {
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch (e) { return null; }
}
