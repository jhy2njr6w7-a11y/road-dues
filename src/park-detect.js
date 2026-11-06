// Did the car park? Pure decision logic for the background GPS task (src/location.js), kept apart so
// tests/logic.test.mjs can drive it with made-up trips.
//
// The task only runs when iOS hands it something: a GPS update (every 30 m of movement) or leaving the
// ~100 m circle ("anchor") around where the car was last seen moving. Nothing wakes it while the car
// stands still, so a fallback reminder is always scheduled ahead and pushed back while driving.
//   - driving or crawling in traffic        -> 'arm': push the fallback back, move the anchor here
//   - coarse readings (indoors, or after a stop when iOS turns GPS down) -> count only when they are clearly
//     further from the stop than their own error, so drift can't push the reminder back and real driving still does
//     (slow movement counts as walking only if the iPhone step counter agrees)
//   - walked away from the car              -> 'ask': ask "Did you pay?" now
//   - left the anchor without walking steps -> still driving after a stop (e.g. a red light): 'arm'
//   - sat in the parked car                 -> no event; the fallback fires after the in-car wait

export const DRIVE_SPEED = 6;     // m/s (~22 km/h): driving for sure
export const SLOW_SPEED = 2.5;    // m/s (~9 km/h): faster than walking, so crawling traffic still counts as driving
export const WALK_SPEED = 0.4;    // m/s: slower than this is standing still / GPS noise
export const CRAWL_SPEED = 1;     // m/s: a car crawling in traffic (0 steps) must at least move this fast; drift reads ~0-0.6
export const LEFT_CAR_M = 30;     // walked at least this far from where the car stopped
export const STEPS_WALKED = 20;   // steps in the last RECENT_STEPS_S seconds that mean the driver is walking
export const RECENT_STEPS_S = 120; // only recent steps count: an hour of walking around must not look like "just got out"
export const ANCHOR_RADIUS = 100; // metres; leaving this circle wakes the app even when iOS has paused it
export const BAD_ACCURACY = 50;   // metres; worse = a coarse Wi-Fi/cell position: counts only beyond its own error
export const FAR_UNKNOWN = 300;   // metres moved before an update with unknown speed (-1) counts as driving
export const EXIT_MOVED = 150;    // metres from the stop before leaving the circle counts as the car driving off
export const EXIT_COOLDOWN_MS = 20000; // build 5 log: dozens of 'left circle' a second (a circle drawn at a stale
                                       // position fires again at once); only the first exit in 20 s counts
export const IN_CAR_WAITS = [5, 10, 15]; // minutes, Settings ▸ "Ask if I stay in the car for"
export const DEFAULT_IN_CAR_WAIT = 10;

/**
 * drive: { lastMoving: ISO | null, lastLat, lastLng, asked: bool }
 * ev:    { type: 'loc', t: ms, lat, lng, speed, accuracy, steps }   a GPS update (speed m/s, null/-1 when unknown)
 *        { type: 'exit', t: ms, lat, lng, accuracy, steps }         left the anchor circle (position fetched then)
 *        steps: steps in the last RECENT_STEPS_S s (not before lastMoving), null when unknown (Android, no permission)
 * opts:  { wait } in-car wait in minutes. Once it has passed the fallback has asked, so the stop counts as asked:
 *        the next movement is the drive home, never "walked away" (build 5 asked ~9 of 10 times while driving off).
 * Returns { drive, action: 'arm' | 'ask' | 'none' }.
 */
export function onDriveEvent(drive, ev, distanceM, { wait = DEFAULT_IN_CAR_WAIT } = {}) {
  const d = drive || {};
  const acc = ev.accuracy != null ? ev.accuracy : 0;
  const coarse = acc > BAD_ACCURACY;                       // Wi-Fi/cell position: iOS often gives only these after a stop
  const known = !coarse && ev.speed != null && ev.speed >= 0;
  const here = { lat: ev.lat, lng: ev.lng };
  const moved = d.lastMoving && d.lastLat != null ? distanceM(here, { lat: d.lastLat, lng: d.lastLng }) : 0;
  const nowDriving = { lastMoving: new Date(ev.t).toISOString(), lastLat: ev.lat, lastLng: ev.lng, asked: false };
  const asked = d.asked || (d.lastMoving && ev.t - new Date(d.lastMoving).getTime() > wait * 60e3);
  const walking = ev.steps != null && ev.steps >= STEPS_WALKED;
  const ask = () => (asked ? { drive: { ...d, asked: true }, action: 'none' } : { drive: { ...d, asked: true }, action: 'ask' });
  const arm = { drive: nowDriving, action: 'arm' };
  const none = { drive: d, action: 'none' };

  if (ev.type === 'exit') {
    if (d.lastExit && ev.t - d.lastExit < EXIT_COOLDOWN_MS) return none;
    const r = onExit();
    return { ...r, drive: { ...r.drive, lastExit: ev.t } };
  }
  function onExit() {
    if (!d.lastMoving) return arm;
    if (walking && !coarse) return ask();
    if (moved > EXIT_MOVED + acc) return arm; // clearly away from the stop, beyond the reading's own error: drove off
    return none;
  }

  // A coarse reading counts only when it is further from the stop than its own error allows: drift indoors stays
  // inside that circle, a car that drove on for a few minutes doesn't (build 6 ignored them all and asked mid-drive).
  if (coarse) return d.lastMoving && moved > FAR_UNKNOWN + acc ? arm : none;
  // GPS update. Speed unknown (iOS sometimes reports -1): judge by distance from the last moving point.
  const driving = known ? ev.speed >= DRIVE_SPEED || (ev.speed >= SLOW_SPEED && !walking) : moved > FAR_UNKNOWN + acc;
  if (driving) return arm;
  if (!d.lastMoving || moved < LEFT_CAR_M + acc) return none;
  // Moved a little, slowly: walking, or the car crawling in traffic? The step counter knows.
  if (ev.steps != null) {
    if (walking) return ask();
    // crawling: no steps at all and a real speed; GPS drift (unknown or ~0 speed) and a few steps prove nothing yet
    if (ev.steps === 0 && known && ev.speed >= CRAWL_SPEED) return arm;
    return none;
  }
  if (known && ev.speed >= WALK_SPEED) return ask(); // no step counter (Android): slow movement = walking
  return none;
}

/** Several events in one go (iOS often delivers GPS updates in batches): the final state and what to do. */
export function runDriveEvents(drive, events, distanceM, opts) {
  let d = drive, ask = false, arm = false;
  for (const ev of events) {
    const r = onDriveEvent(d, ev, distanceM, opts);
    d = r.drive;
    if (r.action === 'ask') { ask = true; arm = false; }
    if (r.action === 'arm') { arm = true; ask = false; }
  }
  return { drive: d, action: ask ? 'ask' : arm ? 'arm' : 'none' };
}
