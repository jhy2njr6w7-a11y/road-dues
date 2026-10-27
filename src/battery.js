// Android only: phones like Samsung and Xiaomi stop background apps to save battery, which stops
// parking and Salik detection. This opens the system page where the user can exempt Darbak.
// (Asking directly needs REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, which Google Play restricts.)
import { Linking } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

export async function openBatterySettings() {
  try { await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS); }
  catch (e) { Linking.openSettings(); }
}
