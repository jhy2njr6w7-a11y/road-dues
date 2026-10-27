// App state, persisted on the device with AsyncStorage. Shared by the UI and the background location task.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const KEY = 'road-dues-state-v1';
export const DEFAULT_STATE = {
  settings: { lang: null, onboarded: false, low: 25, remParking: true, remSalik: true, remFines: true, gateOverrides: {}, discHome: true, discAfterPay: true },
  balance: null,            // Salik balance in AED (user-entered, then reduced by detected crossings)
  vehicles: [],             // {id, brand, model, color, em, code, num}
  defaultVeh: null,
  fines: [],                // {id, iss, amount, date, note, severe, manualPct, manualUntil, paid, paidAmount}
  crossings: [],            // {id, gate, date, charge, auto}
  parking: null,            // {id, start, lat, lng, em, status: 'awaiting'|'paid'|'free', zone, until}
  freeSpots: [],            // {id, name, lat, lng}
  zones: [],                // remembered zone codes {lat, lng, zone}
  drive: { lastMoving: null, lastLat: null, lastLng: null }, // used by the background task
  campaigns: [],            // fine discount campaigns from campaigns.json (see src/campaigns.js)
  campaignsAt: null,        // when the list was last downloaded
  seenCampaigns: null,      // campaign ids already announced (null until the first download)
};

let state = DEFAULT_STATE;
let loaded = false;
const listeners = new Set();

export async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      state = { ...DEFAULT_STATE, ...s, settings: { ...DEFAULT_STATE.settings, ...s.settings }, drive: { ...DEFAULT_STATE.drive, ...s.drive } };
    }
  } catch (e) { /* corrupted storage: start fresh */ }
  loaded = true;
  listeners.forEach((l) => l());
  return state;
}

export const getState = () => state;
export const isLoaded = () => loaded;

/** Apply a change: fn receives a deep copy and returns the new state (or mutates and returns nothing). */
export async function update(fn) {
  const copy = JSON.parse(JSON.stringify(state));
  const next = fn(copy) || copy;
  state = next;
  listeners.forEach((l) => l());
  try { await AsyncStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage full: keep in memory */ }
  return state;
}

export function useStore() {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => state);
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
