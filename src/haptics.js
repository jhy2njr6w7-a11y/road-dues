// Light vibration on taps. 'tap' for buttons, 'select' for switches and choices, 'success' when something is done.
import * as Haptics from 'expo-haptics';

export function haptic(kind = 'tap') {
  const p = kind === 'select' ? Haptics.selectionAsync()
    : kind === 'success' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  p.catch(() => {});
}
