// Web preview only: no background GPS in a browser. Permissions report as granted so the
// screens look like a phone with "Always" allowed; "I'm here" uses the browser's location.
export const TASK = 'road-dues-location';
export const handleLocations = async () => {};
export const locationStatus = async () => ({ foreground: true, background: true, noBackground: false, canAsk: true });
export const requestLocation = async () => ({ foreground: true, background: true, noBackground: false });
export const startTracking = async () => false;
export function currentPosition() {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => navigator.geolocation.getCurrentPosition(
    (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), () => resolve(null), { timeout: 10000 }));
}
