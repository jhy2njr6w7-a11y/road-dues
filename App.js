import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, AppState, StatusBar, PanResponder } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { getLocales } from 'expo-localization';
import './src/web-alert'; // web preview only: Alert.alert -> browser dialogs (no-op on phones)
import './src/location'; // registers the background task at startup (must load before anything else runs)
import { loadState, update, getState, useStore, isLoaded } from './src/store';
import { t, setLangCode, T } from './src/i18n';
import { setupCategories, ACT, onNotificationResponse } from './src/notify';
import { startTracking } from './src/location';
import * as A from './src/actions';
import { useTheme, useArabicFont, applyAppearance, Icon, Glass, HAS_GLASS, Press } from './src/ui';
import { haptic } from './src/haptics';
import { useFonts } from 'expo-font';
import { PLATE_FONTS } from './src/plates';
import { emirateAt } from './src/data';
import { refreshCampaigns, syncCampaignReminders } from './src/campaigns';
import { TodayScreen, FinesScreen, SalikScreen, ParkingScreen, VehiclesScreen, SettingsScreen, Onboarding, DisclaimerSheet } from './src/screens';
import { setDisclaimerOpener } from './src/disclaimer';

export const TAB_KEYS = ['today', 'parking', 'salik', 'fines', 'vehicles'];
const TABS = [['today', 'home'], ['parking', 'car'], ['salik', 'swap-horizontal'], ['fines', 'pricetags'], ['vehicles', 'car-sport']];

export default function App() {
  const s = useStore();
  const c = useTheme();
  const af = useArabicFont();
  // Number-plate fonts and the Arabic UI font (licensed, not in git: see README). Nothing is drawn until
  // they load: text measured with the fallback font and then drawn in Janna (much taller) gets clipped on iOS.
  const [fontsLoaded, fontError] = useFonts({ ...PLATE_FONTS, JannaLT: require('./assets/fonts/JannaLT-Bold.ttf') });
  const [ready, setReady] = useState(isLoaded());
  const [tab, setTab] = useState('today');
  const [prefill, setPrefill] = useState(null);
  const [, force] = useState(0);
  const [disc, setDisc] = useState(null); // null = closed, otherwise { afterPay, onContinue }
  useEffect(() => { setDisclaimerOpener((opts) => setDisc(opts || {})); }, []);

  const go = useCallback((k, pre = null) => { setPrefill(pre); setTab(k); }, []);

  // Slide a finger along the tab bar to pick a tab (like iOS 26): the pill follows the finger, lift to open.
  const [dragTab, setDragTab] = useState(null);
  const bar = useRef({ left: 12, width: 1, rtl: false, last: null });
  bar.current.rtl = s.settings.lang === 'ar';
  const tabAt = (pageX) => {
    const { left, width, rtl } = bar.current;
    const i = Math.max(0, Math.min(TABS.length - 1, Math.floor(((pageX - left) / width) * TABS.length)));
    return TABS[rtl ? TABS.length - 1 - i : i][0];
  };
  const swipe = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderMove: (e, g) => { const k = tabAt(g.moveX); if (k !== bar.current.last) { bar.current.last = k; haptic('select'); setDragTab(k); } },
    onPanResponderRelease: () => { const k = bar.current.last; bar.current.last = null; setDragTab(null); if (k) go(k); },
    onPanResponderTerminate: () => { bar.current.last = null; setDragTab(null); },
  }), [go]);

  const setLang = useCallback(async (k) => {
    setLangCode(k);
    await update((x) => { x.settings.lang = k; });
    await setupCategories();            // notification buttons in the new language
    A.syncFineReminders();
    syncCampaignReminders();
    force((n) => n + 1);
  }, []);

  // First load: state, language, background tracking
  useEffect(() => { (async () => {
    const st = await loadState();
    applyAppearance(st.settings.appearance);
    const device = getLocales()?.[0]?.languageCode;
    const lang = st.settings.lang || (T[device] ? device : 'en');
    setLangCode(lang);
    if (!st.settings.lang) await update((x) => { x.settings.lang = lang; });
    await setupCategories();
    if (st.settings.onboarded) startTracking();
    // Settings ▸ Open the app on. A notification tap that already chose a screen wins.
    const start = TAB_KEYS.includes(st.settings.startTab) ? st.settings.startTab : 'today';
    setTab((cur) => (cur === 'today' ? start : cur));
    setReady(true);
    refreshCampaigns();
  })(); }, []);

  // When the app comes back to the foreground: pick up changes made by the background task,
  // and if the car stopped a while ago with no parking session, open one so the user can pay.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (st) => {
      if (st !== 'active') return;
      const x = await loadState();
      refreshCampaigns();
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
      else if (data.kind === 'campaign') {
        const camp = getState().campaigns.find((y) => y.id === data.campaignId);
        if (camp && action === ACT.payCampaign) A.payCampaign(camp);
        go('fines');
      }
      else if (data.kind === 'fine') {
        const f = getState().fines.find((y) => y.id === data.fineId);
        if (f && !f.paid && action === ACT.payFine) A.payFine(f);
        go('fines');
      }
    };
    return onNotificationResponse(handle);
  }, [go]);

  if (!ready || (!fontsLoaded && !fontError)) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  const rtl = s.settings.lang === 'ar';
  const screenProps = { go, onLang: setLang };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={c.dark ? 'light-content' : 'dark-content'} />
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
            {/* Floating tab bar over the content (Liquid Glass on iOS 26); the selected tab sits on a pill */}
            <SafeAreaView edges={['bottom']} pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 12 }}>
              <Glass accessibilityRole="tablist" interactive {...swipe.panHandlers}
                onLayout={(e) => { bar.current.left = e.nativeEvent.layout.x; /* parent spans the screen from x = 0 */ bar.current.width = e.nativeEvent.layout.width || 1; }} style={{ flexDirection: 'row', borderRadius: 30, padding: 5, marginBottom: 6,
                borderWidth: HAS_GLASS || !c.dark ? 0 : 1, borderColor: c.line, shadowColor: '#000', shadowOpacity: HAS_GLASS || c.dark ? 0 : 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: HAS_GLASS ? 0 : 6 }}>
                {TABS.map(([k, icon]) => { const on = (dragTab || tab) === k;
                  return (
                    <Press key={k} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { if (!on) haptic('select'); go(k); }}
                      style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 7, borderRadius: 25, backgroundColor: on ? (HAS_GLASS ? 'rgba(127,127,127,0.18)' : c.chip) : 'transparent' }}>
                      <Icon name={on ? icon : icon + '-outline'} size={22} color={on ? c.fg : c.muted} />
                      <Text numberOfLines={1} maxFontSizeMultiplier={1.3} style={[{ fontSize: 11, fontWeight: on ? '700' : '500', color: on ? c.fg : c.muted }, af]}>{t('tab_' + k)}</Text>
                    </Press>); })}
              </Glass>
            </SafeAreaView>
            <DisclaimerSheet visible={!!disc} afterPay={!!disc?.afterPay} onClose={() => { const next = disc?.onContinue; setDisc(null); if (next) setTimeout(next, 350); }} />
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
