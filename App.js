import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, AppState, StatusBar } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { getLocales } from 'expo-localization';
import './src/location'; // registers the background task at startup (must load before anything else runs)
import { loadState, update, getState, useStore, isLoaded } from './src/store';
import { t, setLangCode, T } from './src/i18n';
import { setupCategories, ACT } from './src/notify';
import { startTracking } from './src/location';
import * as A from './src/actions';
import { useTheme } from './src/ui';
import { emirateAt } from './src/data';
import { TodayScreen, FinesScreen, SalikScreen, ParkingScreen, VehiclesScreen, SettingsScreen, Onboarding, DisclaimerSheet } from './src/screens';
import { setDisclaimerOpener } from './src/disclaimer';

const TABS = [['today', '◔'], ['fines', '⚠︎'], ['salik', '⇅'], ['parking', 'Ⓟ'], ['vehicles', '🚗']];

export default function App() {
  const s = useStore();
  const c = useTheme();
  const [ready, setReady] = useState(isLoaded());
  const [tab, setTab] = useState('today');
  const [prefill, setPrefill] = useState(null);
  const [, force] = useState(0);
  const [disc, setDisc] = useState(null); // null = closed, otherwise { afterPay, onContinue }
  useEffect(() => { setDisclaimerOpener((opts) => setDisc(opts || {})); }, []);

  const go = useCallback((k, pre = null) => { setPrefill(pre); setTab(k); }, []);

  const setLang = useCallback(async (k) => {
    setLangCode(k);
    await update((x) => { x.settings.lang = k; });
    await setupCategories();            // notification buttons in the new language
    A.syncFineReminders();
    force((n) => n + 1);
  }, []);

  // First load: state, language, background tracking
  useEffect(() => { (async () => {
    const st = await loadState();
    const device = getLocales()?.[0]?.languageCode;
    const lang = st.settings.lang || (T[device] ? device : 'en');
    setLangCode(lang);
    if (!st.settings.lang) await update((x) => { x.settings.lang = lang; });
    await setupCategories();
    if (st.settings.onboarded) startTracking();
    setReady(true);
  })(); }, []);

  // When the app comes back to the foreground: pick up changes made by the background task,
  // and if the car stopped a while ago with no parking session, open one so the user can pay.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (st) => {
      if (st !== 'active') return;
      const x = await loadState();
      const d = x.drive;
      if (!x.parking && d.lastMoving && Date.now() - new Date(d.lastMoving).getTime() > 4 * 60e3 && Date.now() - new Date(d.lastMoving).getTime() < 3 * 3600e3 && d.handled !== d.lastMoving) {
        const em = emirateAt({ lat: d.lastLat, lng: d.lastLng });
        if (em) await A.startParkingSession({ lat: d.lastLat, lng: d.lastLng, em });
        await update((y) => { y.drive.handled = d.lastMoving; });
      }
    });
    return () => sub.remove();
  }, []);

  // Notification buttons
  useEffect(() => {
    const handle = async (r) => {
      if (!r) return;
      const data = r.notification.request.content.data || {};
      const action = r.actionIdentifier;
      await loadState();
      if (data.kind === 'parking') {
        await A.startParkingSession({ lat: data.lat, lng: data.lng, em: data.em });
        if (action === ACT.paid) { await A.markParkingPaid(1); go('today'); }
        else if (action === ACT.free) { await A.markFreeHere(); go('today'); }
        else if (action === ACT.zone) go('parking', { em: data.em, lat: data.lat, lng: data.lng, zone: (r.userText || '').trim(), autoSend: true });
        else go('parking', { em: data.em, lat: data.lat, lng: data.lng, autoSend: action === ACT.open });
      } else if (data.kind === 'expiry') go('parking', { em: getState().parking?.em });
      else if (data.kind === 'salik') { if (action === ACT.topup) A.topUpSalik(); go('salik'); }
      else if (data.kind === 'fine') {
        const f = getState().fines.find((y) => y.id === data.fineId);
        if (f && !f.paid && action === ACT.payFine) A.payFine(f);
        go('fines');
      }
    };
    Notifications.getLastNotificationResponseAsync().then(handle);
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [go]);

  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  const rtl = s.settings.lang === 'ar';
  const screenProps = { go, onLang: setLang };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={c.bg === '#101817' ? 'light-content' : 'dark-content'} />
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg, direction: rtl ? 'rtl' : 'ltr' }}>
        {!s.settings.onboarded ? (
          <Onboarding onLang={setLang} onDone={async () => { await update((x) => { x.settings.onboarded = true; }); startTracking(); }} />
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ flex: 1 }}>
              {tab === 'today' && <TodayScreen {...screenProps} />}
              {tab === 'fines' && <FinesScreen {...screenProps} />}
              {tab === 'salik' && <SalikScreen {...screenProps} />}
              {tab === 'parking' && <ParkingScreen key={JSON.stringify(prefill)} prefill={prefill} {...screenProps} />}
              {tab === 'vehicles' && <VehiclesScreen {...screenProps} />}
              {tab === 'settings' && <SettingsScreen {...screenProps} />}
            </View>
            <SafeAreaView edges={['bottom']} style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: c.line, backgroundColor: c.card }} accessibilityRole="tablist">
              {TABS.map(([k, icon]) => (
                <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => go(k)}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 8, minHeight: 52 }}>
                  <Text style={{ fontSize: 18, color: tab === k ? c.signText : c.muted }}>{icon}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '600', color: tab === k ? c.signText : c.muted }}>{t('tab_' + k)}</Text>
                </Pressable>
              ))}
            </SafeAreaView>
            <DisclaimerSheet visible={!!disc} afterPay={!!disc?.afterPay} onClose={() => { const next = disc?.onContinue; setDisc(null); if (next) setTimeout(next, 350); }} />
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
