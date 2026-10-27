// Background location: detects driving, Salik gate crossings and parking.
// Location data is processed on the phone only and never uploaded.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { loadState, update, newId } from './store';
import { setLangCode } from './i18n';
import { GATES, gatePos, distanceM, crossingCharge, emirateAt, isPaidTime, buildSms, EMIRATES } from './data';
import { scheduleParkCheck, cancelParkCheck, notifySalik, cancelExpiry } from './notify';

export const TASK = 'road-dues-location';
const DRIVING_SPEED = 6;    // m/s (~22 km/h): below this we never count a gate crossing
const GATE_RADIUS = 170;    // metres
const FREE_RADIUS = 150;    // metres around a saved free spot

/** Called for every batch of background locations. Exported for testing. */
export async function handleLocations(locations) {
  const s = await loadState();
  if (s.settings.lang) setLangCode(s.settings.lang);
  for (const loc of locations) {
    const { latitude: lat, longitude: lng, speed, accuracy } = loc.coords;
    const when = new Date(loc.timestamp);
    const moving = speed != null && speed >= DRIVING_SPEED;
    if (!moving) continue;

    // 1) Car is moving: it is not parked any more.
    const st = await update((x) => {
      if (x.parking && x.parking.status !== 'free') x.parking = null;
      x.drive = { lastMoving: when.toISOString(), lastLat: lat, lastLng: lng };
    });
    await cancelExpiry();

    // 2) Salik gates
    if (st.settings.remSalik && accuracy != null && accuracy < 60) {
      for (const g of GATES) {
        if (distanceM({ lat, lng }, gatePos(g, st.settings.gateOverrides)) > GATE_RADIUS) continue;
        const charge = crossingCharge(g.id, when, st.crossings);
        if (charge == null) continue;
        const after = await update((x) => {
          x.crossings.push({ id: newId(), gate: g.id, date: when.toISOString(), charge, auto: true });
          if (x.crossings.length > 500) x.crossings = x.crossings.slice(-500);
          if (x.balance != null) x.balance = Math.round((x.balance - charge) * 100) / 100;
        });
        if (charge > 0) await notifySalik({ gate: g.name, charge, balance: after.balance, low: after.settings.low });
      }
    }

    // 3) Re-arm the parking check a few minutes ahead (fires only once the car stops moving).
    const cur = (await loadState());
    if (!cur.settings.remParking) { await cancelParkCheck(); continue; }
    const em = emirateAt({ lat, lng });
    const nearFree = cur.freeSpots.some((f) => distanceM({ lat, lng }, f) < FREE_RADIUS);
    const checkAt = new Date(Date.now() + 4 * 60e3);
    if (!em || nearFree || !isPaidTime(em, checkAt)) { await cancelParkCheck(); continue; }
    const vehicle = cur.vehicles.find((v) => v.id === cur.defaultVeh) || cur.vehicles[0];
    const zone = cur.zones.find((z) => distanceM({ lat, lng }, z) < FREE_RADIUS)?.zone || '';
    const smsText = buildSms(em, vehicle, { zone, hours: 1, type: 'S' });
    await scheduleParkCheck({ em, smsText, num: EMIRATES[em].sms, lat, lng });
  }
}

TaskManager.defineTask(TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  try { await handleLocations(data.locations); } catch (e) { /* never crash the background task */ }
});

export async function locationStatus() {
  const fg = await Location.getForegroundPermissionsAsync();
  const bg = await Location.getBackgroundPermissionsAsync();
  return { foreground: fg.granted, background: bg.granted, canAsk: fg.canAskAgain !== false && bg.canAskAgain !== false };
}

export async function requestLocation() {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (!fg.granted) return { foreground: false, background: false };
  const bg = await Location.requestBackgroundPermissionsAsync();
  return { foreground: true, background: bg.granted };
}

export async function startTracking() {
  const { background } = await locationStatus();
  if (!background) return false;
  const running = await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false);
  if (running) return true;
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.High,
    activityType: Location.ActivityType.AutomotiveNavigation,
    distanceInterval: 30,
    pausesUpdatesAutomatically: true,     // iOS pauses GPS when the phone is still: saves battery
    showsBackgroundLocationIndicator: false,
    foregroundService: {                  // Android requires a visible notification while tracking
      notificationTitle: 'Road Dues',
      notificationBody: 'Watching for parking and Salik gates',
    },
  });
  return true;
}

export async function currentPosition() {
  try {
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: p.coords.latitude, lng: p.coords.longitude };
  } catch (e) { return null; }
}
