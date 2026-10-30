// Did the car park? Pure decision logic for the background GPS task (src/location.js), kept apart so
// tests/logic.test.mjs can drive it with made-up trips.
//
// The task only runs when iOS hands it something: a GPS update (every 30 m of movement) or leaving the
// ~100 m circle ("anchor") around where the car was last seen moving. Nothing wakes it while the car
// stands still, so a fallback reminder is always scheduled ahead and pushed back while driving.
//   - driving or crawling in traffic        -> 'arm': push the fallback back, move the anchor here
//     (slow movement counts as walking only if the iPhone step counter agrees)
//   - walked away from the car              -> 'ask': ask "Did you pay?" now
//   - left the anchor without walking steps -> still driving after a stop (e.g. a red light): 'arm'
//   - sat in the parked car                 -> no event; the fallback fires after the in-car wait

export const DRIVE_SPEED = 6;     // m/s (~22 km/h): driving for sure
export const SLOW_SPEED = 2.5;    // m/s (~9 km/h): faster than walking, so crawling traffic still counts as driving
export const WALK_SPEED = 0.4;    // m/s: slower than this is standing still / GPS noise
export const LEFT_CAR_M = 30;     // walked at least this far from where the car stopped
export const STEPS_WALKED = 20;   // steps since the car stopped that mean the driver got out
export const ANCHOR_RADIUS = 100; // metres; leaving this circle wakes the app even when iOS has paused it
export const IN_CAR_WAITS = [5, 10, 15]; // minutes, Settings ▸ "Ask if I stay in the car for"
export const DEFAULT_IN_CAR_WAIT = 10;

/**
 * drive: { lastMoving: ISO | null, lastLat, lastLng, asked: bool }
 * ev:    { type: 'loc', t: ms, lat, lng, speed }            a GPS update (speed in m/s, null/-1 when unknown)
 *        { type: 'exit', t: ms, lat, lng, steps }           left the anchor circle
 *        steps (both): steps since lastMoving from the iPhone step counter, null when unknown (Android, no permission)
 * Returns { drive, action: 'arm' | 'ask' | 'none' }.
 */
export function onDriveEvent(drive, ev, distanceM) {
  const d = drive || {};
  const known = ev.speed != null && ev.speed >= 0;
  const here = { lat: ev.lat, lng: ev.lng };
  const moved = d.lastMoving && d.lastLat != null ? distanceM(here, { lat: d.lastLat, lng: d.lastLng }) : 0;
  const nowDriving = { lastMoving: new Date(ev.t).toISOString(), lastLat: ev.lat, lastLng: ev.lng, asked: false };

  if (ev.type === 'exit') {
    if (!d.lastMoving) return { drive: nowDriving, action: 'arm' };
    const walked = ev.steps != null && ev.steps >= STEPS_WALKED;
    if (walked) return d.asked ? { drive: d, action: 'none' } : { drive: { ...d, asked: true }, action: 'ask' };
    return { drive: nowDriving, action: 'arm' }; // no steps: the car drove off after a stop
  }

  // GPS update. Speed unknown (iOS sometimes reports -1): judge by distance from the last moving point.
  const driving = known ? ev.speed >= SLOW_SPEED : moved > ANCHOR_RADIUS;
  if (driving) return { drive: nowDriving, action: 'arm' };
  if (!d.lastMoving || moved < LEFT_CAR_M) return { drive: d, action: 'none' };
  // Moved a little, slowly: walking, or the car crawling in traffic? The step counter knows.
  if (ev.steps != null && ev.steps < STEPS_WALKED) return { drive: nowDriving, action: 'arm' };
  const walking = ev.steps != null || !known || ev.speed >= WALK_SPEED;
  if (walking && !d.asked) return { drive: { ...d, asked: true }, action: 'ask' };
  return { drive: d, action: 'none' };
}

/** Several events in one go (iOS often delivers GPS updates in batches): the final state and what to do. */
export function runDriveEvents(drive, events, distanceM) {
  let d = drive, ask = false, arm = false;
  for (const ev of events) {
    const r = onDriveEvent(d, ev, distanceM);
    d = r.drive;
    if (r.action === 'ask') { ask = true; arm = false; }
    if (r.action === 'arm') { arm = true; ask = false; }
  }
  return { drive: d, action: ask ? 'ask' : arm ? 'arm' : 'none' };
}
