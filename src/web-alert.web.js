// Web preview only: react-native-web's Alert.alert does nothing, so map it to browser dialogs.
// One button -> alert(); otherwise confirm(): OK runs the last non-cancel button, Cancel the cancel button.
import { Alert } from 'react-native';

Alert.alert = (title, message, buttons = [{ text: 'OK' }]) => {
  const text = [title, message].filter(Boolean).join('\n\n');
  if (buttons.length <= 1) { window.alert(text); buttons[0]?.onPress?.(); return; }
  const cancel = buttons.find((b) => b.style === 'cancel');
  const ok = [...buttons].reverse().find((b) => b !== cancel);
  (window.confirm(text) ? ok : cancel)?.onPress?.();
};
