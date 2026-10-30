import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, Modal, Linking, Alert, AppState, Platform, Image } from 'react-native';
import { useStore, update, newId } from './store';
import { t, T, emName, hrsOf, fmtDate, fmtTime, LANGS, getLang, gateName } from './i18n';
import { IN_CAR_WAITS, DEFAULT_IN_CAR_WAIT } from './park-detect';
import { EMIRATES, EM_ORDER, ISSUERS, GATES, gatePos, BRANDS, aed, buildSms, cleanCode, ZONE_RE, fineOffer, discounted, daysLeft,
  validateVehicle, parseDate, emirateAt, distanceM, crossingCharge, latinDigits, visibleCampaigns, campaignStatus, campaignEnd, PAY_URLS, PARKING_EMIRATES } from './data';
import { Card, Row, Sec, Txt, Figure, Btn, Chip, Segmented, Toggle, Pill, List, ListRow, Field, Wrap, Notice, Warn, BrandBadge, Bubble, Progress, Icon,
  useTheme, useArabicFont, styles, applyAppearance, Glass, Press } from './ui';
import * as A from './actions';
import { currentPosition, requestLocation, locationStatus, startTracking } from './location';
import { requestNotifPermission, setupCategories, notifStatus } from './notify';
import { openBatterySettings } from './battery';
import { DateField } from './datefield';
import { Plate, PlateInput } from './plates';
import { SafeAreaView } from 'react-native-safe-area-context';
import { openDisclaimer } from './disclaimer';
import { refreshCampaigns, syncCampaignReminders } from './campaigns';

export const PRIVACY_URL = 'https://jhy2njr6w7-a11y.github.io/road-dues/privacy.html'; // docs/privacy.html, served by GitHub Pages

// Screen header: big title, ⓘ (disclaimer) on every screen, settings gear or a back button.
function RoundBtn({ icon, label, onPress }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={{ borderRadius: 21 }}>
      <Glass interactive style={{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={22} />
      </Glass>
    </Press>
  );
}
function Title({ k, onSettings, onBack }) {
  const c = useTheme(); const af = useArabicFont();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      {onBack ? <RoundBtn icon="chevron-back" label={t('back')} onPress={onBack} /> : null}
      <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3} style={[styles.title, { color: c.fg, flex: 1 }, af]}>{t(k)}</Text>
      <RoundBtn icon="information-circle-outline" label={t('viewDisclaimer')} onPress={() => openDisclaimer()} />
      {onSettings ? <RoundBtn icon="settings-outline" label={t('settings')} onPress={onSettings} /> : null}
    </View>
  );
}

// Pinned on the home screen until hidden (Settings brings it back). Slim: the red line, tap for the full text.
function DisclaimerCard() {
  const c = useTheme();
  const hide = () => Alert.alert(t('hideDisc') + '?', t('discHiddenNote'), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('hideDisc'), onPress: () => update((x) => { x.settings.discHome = false; }) },
  ]);
  return (
    <View style={{ backgroundColor: c.redBg, borderRadius: 16, flexDirection: 'row', alignItems: 'center' }}>
      <Press accessibilityRole="button" accessibilityLabel={t('viewDisclaimer')} onPress={() => openDisclaimer()}
        style={{ flex: 1, paddingVertical: 10, paddingStart: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16 }}>
        <Icon name="shield-checkmark-outline" size={20} color={c.red} />
        <Txt size={13} bold color={c.red} numberOfLines={3} style={{ flex: 1 }}>{t('disc3')}</Txt>
      </Press>
      <Pressable accessibilityRole="button" accessibilityLabel={t('hideDisc')} onPress={hide} hitSlop={8} style={{ padding: 12 }}>
        <Icon name="close" size={18} color={c.red} />
      </Pressable>
    </View>
  );
}
const Screen = ({ children }) => { const c = useTheme(); return <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">{children}</ScrollView>; };


// ---------- Location permission notice (shown when location is off or only "While Using")
export function useLocationStatus() {
  const [st, setSt] = useState(null);
  useEffect(() => {
    let alive = true;
    const check = () => locationStatus().then((x) => alive && setSt(x)).catch(() => {});
    check();
    const sub = AppState.addEventListener('change', (a) => { if (a === 'active') check(); });
    return () => { alive = false; sub.remove(); };
  }, []);
  return [st, () => locationStatus().then(setSt)];
}
export function LocationNotice({ extra }) {
  const [st, refresh] = useLocationStatus();
  // Nothing to fix if "Always" is on, or can't exist here (Expo Go) and "While Using" is on.
  if (!st || st.background || (st.foreground && st.noBackground)) return null;
  const off = !st.foreground;
  async function fix() {
    if (st.canAsk) { const r = await requestLocation(); if (r.background) startTracking(); refresh(); }
    else Linking.openSettings();
  }
  return (
    <Notice icon="location-outline" title={t(off ? 'locOffT' : 'locLimitedT')}>
      <Txt size={14}>{t(off ? 'locOffB' : 'locLimitedB')}</Txt>
      {off && extra ? <Txt size={14}>{t(extra)}</Txt> : null}
      <Btn small title={st.canAsk ? t('allow') : t('openSettings')} onPress={fix} style={{ alignSelf: 'flex-start' }} />
    </Notice>
  );
}

// ---------- Notifications off: every reminder depends on them, so say so where reminders are set
function NotifNotice() {
  const [st, setSt] = useState(null);
  useEffect(() => {
    let alive = true;
    const check = () => notifStatus().then((x) => alive && setSt(x)).catch(() => {});
    check();
    const sub = AppState.addEventListener('change', (a) => { if (a === 'active') check(); });
    return () => { alive = false; sub.remove(); };
  }, []);
  if (!st || st.granted) return null;
  async function fix() {
    if (st.canAsk) { await requestNotifPermission(); await setupCategories(); setSt(await notifStatus()); }
    else Linking.openSettings();
  }
  return (
    <Notice icon="notifications-off-outline" title={t('notifOffT')}>
      <Txt size={14}>{t('notifOffB')}</Txt>
      <Btn small title={st.canAsk ? t('allow') : t('openSettings')} onPress={fix} style={{ alignSelf: 'flex-start' }} />
    </Notice>
  );
}

// ---------- Disclaimer sheet (shown after every parking payment, and from Settings)
export function DisclaimerSheet({ visible, onClose, onRemoveTicket, afterPay }) {
  const c = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 24, gap: 16 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} />
        <Icon name="shield-checkmark" size={36} color={c.red} />
        <Txt bold size={24}>{t('discTitle')}</Txt>
        <Txt size={17}>{t('disc1')}</Txt>
        <Txt size={17}>{t('disc2')}</Txt>
        <Card tone="danger"><Txt size={17} color={c.red} bold>{t('disc3')}</Txt></Card>
        <Txt size={17}>{t('disc4')}</Txt>
        <View style={{ gap: 10, marginTop: 8 }}>
          {onRemoveTicket ? <Btn danger title={t('removeTicket')} onPress={onRemoveTicket} /> : null}
          <Btn title={afterPay ? t('continuePay') : t('gotIt')} onPress={onClose} />
          {afterPay ? <Btn ghost title={t('dontShowAgain')} onPress={async () => { await update((x) => { x.settings.discAfterPay = false; }); onClose(); }} /> : null}
          {afterPay ? <Txt muted style={{ textAlign: 'center' }}>{t('discHiddenNote')}</Txt> : null}
        </View>
      </ScrollView>
    </Modal>
  );
}

// ---------- Today
export function TodayScreen({ go }) {
  const s = useStore(); const c = useTheme();
  const unpaid = s.fines.filter((f) => !f.paid);
  const total = unpaid.reduce((a, f) => a + f.amount, 0);
  const next = unpaid.map((f) => [f, fineOffer(f)]).filter((x) => x[1]).sort((a, b) => a[1].end - b[1].end)[0];
  const dv = s.vehicles.find((v) => v.id === s.defaultVeh) || s.vehicles[0];
  const bal = s.balance;
  const balTone = bal == null ? null : bal < 0 ? 'danger' : bal < s.settings.low ? 'warn' : null;
  const topCamp = visibleCampaigns(s.campaigns).find((x) => campaignStatus(x) === 'active');
  return (
    <Screen>
      <Title k="appName" onSettings={() => go('settings')} />
      {s.settings.discHome ? <DisclaimerCard /> : null}
      <NamePendingCard />
      <LocationNotice />

      {dv ? (
        <Card onPress={() => go('vehicles')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <BrandBadge brand={dv.brand} />
            <View style={{ gap: 6, flex: 1, minWidth: 0 }}><Txt bold numberOfLines={1}>{dv.brand} {dv.model}</Txt><Plate v={dv} /></View>
            <Icon name="chevron-forward" size={18} color={c.muted} />
          </View>
        </Card>
      ) : (
        <Card>
          <Txt>{t('addVehFirst')}</Txt>
          <Btn icon="add" title={t('addVehBtn')} onPress={() => go('vehicles')} />
        </Card>
      )}

      <ParkingStatus go={go} />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card onPress={() => go('salik')} style={{ flex: 1, minWidth: 0 }} tone={balTone}>
          <Txt muted size={13}>{t('estBalance')}</Txt>
          {bal == null ? <Txt bold size={17}>{t('addBalance')} ›</Txt>
            : <Figure size={24} color={balTone === 'danger' ? c.red : balTone === 'warn' ? c.amber : c.fg}>{aed(bal)}</Figure>}
          <Txt muted size={13}>{t('salik')}</Txt>
        </Card>
        <Card onPress={() => go('fines')} style={{ flex: 1, minWidth: 0 }}>
          <Txt muted size={13}>{t('finesTitle')}</Txt>
          <Figure size={24} color={topCamp ? c.ok : c.fg}>{topCamp ? '−' + topCamp.pct + '%' : unpaid.length ? aed(total) : '—'}</Figure>
          <Txt muted size={13} numberOfLines={1}>{topCamp ? t('iss_' + topCamp.iss) : unpaid.length ? t('unpaid') : t('campH')}</Txt>
        </Card>
      </View>
      {balTone ? <Notice tone={balTone} icon="wallet-outline">{t(balTone === 'danger' ? 'balNeg' : 'balLow')}</Notice> : null}

      {topCamp ? <CampaignHero c={topCamp} onMore={() => go('fines')} /> : null}
      {next ? (
        <Card tone="ok">
          <Txt bold>{t('offTitle', { p: next[1].pct, issuer: t('iss_' + next[0].iss) })}</Txt>
          <Txt size={14}>{t('offBody', { pay: aed(discounted(next[0].amount, next[1].pct)), date: fmtDate(next[1].end), save: aed(next[0].amount - discounted(next[0].amount, next[1].pct)) })}</Txt>
          <Btn title={t('payDiscount')} onPress={() => A.payFine(next[0])} />
        </Card>
      ) : null}
    </Screen>
  );
}

// Each emirate's colour, used for its parking ticket icon and tile
export const EM_COLORS = { AUH: '#3aa6c2', DXB: '#2f5fd0', SHJ: '#e0a72e', AJM: '#8a6d45', RAK: '#c4473c', FUJ: '#2f9467', UAQ: '#7357c9' };

// A parking ticket in the emirate's colour, with the P of parking signs
function TicketIcon({ em, size = 34 }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-14deg' }] }}>
      <Icon name="ticket" size={size} color={EM_COLORS[em] || '#1a56b8'} />
      <Text style={{ position: 'absolute', color: '#fff', fontWeight: '900', fontSize: size * 0.36 }}>P</Text>
    </View>
  );
}

// Re-renders every second while mounted (live countdown)
function useNow(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!active) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [active]);
  return now;
}
const countdown = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
  const p2 = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p2(m)}:${p2(sec)}` : `${p2(m)}:${p2(sec)}`;
};

// The parking ticket: emirate, when, how long, which car, a live countdown, and what to do next
function ParkingStatus({ go }) {
  const s = useStore(); const c = useTheme(); const p = s.parking;
  const paid = p?.status === 'paid'; const left = paid && p.until ? new Date(p.until).getTime() - Date.now() : 0;
  useNow(paid && left > 0);
  if (!p) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ParkingMark />
          <View style={{ flex: 1, minWidth: 0 }}><Txt bold>{t('parking')}</Txt><Txt muted>{t('notParked')}</Txt></View>
        </View>
        <Btn icon="chatbubble-ellipses-outline" title={t('payBySms')} onPress={() => go('parking')} />
      </Card>
    );
  }
  const v = s.vehicles.find((x) => x.id === s.defaultVeh) || s.vehicles[0];
  const since = p.paidAt || p.start;
  const Line = ({ icon, children }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Icon name={icon} size={18} color={c.muted} />{children}</View>
  );
  return (
    <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: c.line }}>
        <TicketIcon em={p.em} size={30} />
        <Txt bold style={{ flex: 1 }} numberOfLines={1}>{t('parking')} · {emName(p.em)}</Txt>
        {paid ? <Pill tone={left > 0 ? 'ok' : 'danger'} text={left > 0 ? t('activeTicket') : t('ticketEnded')} />
          : p.status === 'free' ? <Pill text={t('freeSpot')} /> : <Pill tone="danger" text={t('notPaid')} />}
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        <Line icon="calendar-outline"><Txt>{fmtDate(since)} · {fmtTime(since)}</Txt></Line>
        {paid && p.hours ? <Line icon="time-outline"><Txt>{t('forHours', { n: p.hours })}</Txt></Line> : null}
        {p.zone ? <Line icon="location-outline"><Txt>{p.zone}</Txt></Line> : null}
        {v ? <Line icon="car-outline"><Plate v={v} width={150} /></Line> : null}
        {paid && left > 0 ? (
          <View style={{ marginTop: 4 }}>
            <Txt muted>{t('ticketEndsIn')}</Txt>
            <Figure size={44} color={left < 10 * 60e3 ? c.red : c.fg}>{countdown(left)}</Figure>
          </View>
        ) : null}
        {paid ? <Notice icon="chatbubble-ellipses-outline">{t('checkSms')}</Notice> : null}
        <Wrap>
          {p.status === 'awaiting' ? <><Btn small title={t('payNow')} onPress={() => go('parking')} /><Btn ghost small title={t('freeHere')} onPress={A.markFreeHere} /></> : null}
          {paid ? <Btn ghost small icon="add" title={t('extend')} onPress={() => go('parking')} /> : null}
          <Btn plain small title={t('removeTicket')} onPress={A.removeParkingTicket} />
        </Wrap>
      </View>
    </Card>
  );
}

// Emirate picker: a coloured tile per emirate, name in the app's language and the other of Arabic/English
function EmirateTiles({ value, onChange }) {
  const c = useTheme();
  const second = (k) => (getLang() === 'ar' ? T.en['em_' + k] : T.ar['em_' + k]);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {PARKING_EMIRATES.map((k) => { const on = k === value;
        return (
          <Press key={k} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => onChange(k)}
            style={{ flexBasis: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18,
              backgroundColor: on ? EM_COLORS[k] + '22' : c.card, borderWidth: 2, borderColor: on ? EM_COLORS[k] : 'transparent' }}>
            <TicketIcon em={k} size={30} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt bold numberOfLines={1}>{emName(k)}</Txt>
              <Txt muted size={12} numberOfLines={1}>{second(k)}</Txt>
            </View>
          </Press>); })}
    </View>
  );
}

// The blue "P" of UAE parking signs
function ParkingMark({ size = 40 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26, backgroundColor: '#1a56b8', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.58 }}>P</Text>
    </View>
  );
}

// ---------- Parking
export function ParkingScreen({ go, prefill }) {
  const s = useStore(); const c = useTheme();
  const [pos, setPos] = useState(null);
  const [locating, setLocating] = useState(true);
  const startEm = prefill?.em || s.parking?.em;
  const [em, setEm] = useState(PARKING_EMIRATES.includes(startEm) ? startEm : 'DXB');
  const [freeEm, setFreeEm] = useState(null); // GPS says we're in an emirate without paid street parking
  const [vehId, setVehId] = useState(s.defaultVeh || s.vehicles[0]?.id);
  const [zone, setZone] = useState(prefill?.zone || '');
  const [type, setType] = useState('S');
  const [hours, setHours] = useState(1);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);

  useEffect(() => { (async () => {
    const p = prefill?.lat != null ? { lat: prefill.lat, lng: prefill.lng } : await currentPosition();
    setPos(p); setLocating(false);
    if (p) {
      const e = prefill?.em || emirateAt(p);
      if (PARKING_EMIRATES.includes(e)) setEm(e); else if (e) setFreeEm(e);
      const z = s.zones.find((z) => distanceM(p, z) < 150);
      if (z && !prefill?.zone) setZone(z.zone);
    }
  })(); }, []);

  const e = EMIRATES[em];
  const vehicle = s.vehicles.find((v) => v.id === vehId) || s.vehicles[0];
  const text = buildSms(em, vehicle, { zone, type, hours });
  const zoneTyped = cleanCode(zone);
  const detected = pos && emirateAt(pos) === em;

  const autoSent = React.useRef(false);
  useEffect(() => {
    // Came from a notification button: open the SMS composer straight away (the user still taps Send).
    if (!locating && prefill?.autoSend && text && !autoSent.current) { autoSent.current = true; send(); }
  }, [locating, text]);

  async function send() {
    if (busy) return; setBusy(true);
    try {
      if (!s.parking && pos) await A.startParkingSession({ lat: pos.lat, lng: pos.lng, em });
      const ok = await A.sendParkingSms({ em, text, hours, zone, lat: pos?.lat, lng: pos?.lng });
      if (ok) { if (s.settings.discAfterPay) setSheet(true); else go('today'); }
    } finally { setTimeout(() => setBusy(false), 2500); }
  }

  return (
    <Screen>
      <Title k="parking" onSettings={() => go('settings')} />
      <LocationNotice extra="locParkNote" />
      {s.parking ? <ParkingStatus go={go} /> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
        <Icon name={detected ? 'navigate' : 'location-outline'} size={16} color={c.muted} />
        <Txt muted>{locating ? t('detecting') : !pos ? t('noLocation') : freeEm ? emName(freeEm) + ' · ' + t('gps') : detected ? emName(em) + ' · ' + t('gps') : emName(em)}</Txt>
      </View>
      {freeEm ? <Notice tone="info" icon="information-circle-outline">{t('freeEmirate', { em: emName(freeEm) })}</Notice> : null}
      <Sec>{t('chooseEmirate')}</Sec>
      <EmirateTiles value={em} onChange={(k) => { setEm(k); const hs = EMIRATES[k].hours; if (hs && !hs.includes(hours)) setHours(hs[0]); }} />

      <Card>
        {s.vehicles.length ? <><Txt muted size={13}>{t('vehicle')}</Txt>
          <Wrap>{s.vehicles.map((v) => <Chip key={v.id} title={`${v.brand} · ${v.em} ${v.code} ${v.num}`} on={v.id === vehicle?.id} onPress={() => setVehId(v.id)} />)}</Wrap></>
          : <><Warn>{t('addVehFirst')}</Warn><Btn ghost icon="add" title={t('addVehBtn')} onPress={() => go('vehicles')} /></>}
        {!e.sms ? <Notice tone="info" icon="information-circle-outline">{t('noSms', { em: emName(em), hours: hrsOf(em) })}</Notice> : <>
          {e.input === 'zone' ? <Field label={t('zoneSign')} value={zone} onChangeText={setZone} placeholder="335A" autoCapitalize="characters" autoCorrect={false} maxLength={6}
            error={zoneTyped && !ZONE_RE.test(zoneTyped) ? t('zoneErr') : null} style={{ textAlign: 'left', writingDirection: 'ltr', fontSize: 22, fontWeight: '700', letterSpacing: 2 }} /> : null}
          {e.input === 'type' ? <><Txt muted size={13}>{t('parkType')}</Txt><Segmented value={type} onChange={setType} options={[['S', t('standard')], ['P', t('premium')]]} /></> : null}
          {e.hours ? <><Txt muted size={13}>{t('duration')}</Txt><Segmented value={hours} onChange={setHours} options={e.hours.map((h) => [h, t('hoursUnit', { n: h })])} />
            {e.hoursNote ? <Txt muted>{t(e.hoursNote)}</Txt> : null}</> : <Txt muted>{t('onePeriod')}</Txt>}
          {e.unverified ? <Warn>{t('unverified', { em: emName(em) })}</Warn> : null}
        </>}
      </Card>

      {e.sms ? (
        <Card>
          <Txt muted size={13}>{t('toNum', { num: e.sms, hours: hrsOf(em) })}</Txt>
          {text ? <Bubble text={text} /> : e.input === 'zone' ? <Txt muted>{t('enterZone')}</Txt> : null}
          <Btn icon="send" title={busy ? t('sending') : t('sendSms')} disabled={!text || busy} onPress={send} />
        </Card>
      ) : null}
      <DisclaimerSheet afterPay visible={sheet} onClose={() => { setSheet(false); go('today'); }}
        onRemoveTicket={async () => { await A.removeParkingTicket(); setSheet(false); go('today'); }} />
    </Screen>
  );
}

// ---------- Fine discounts: running campaigns first, then official sites, the standing rule and optional tracking
const campaignProgress = (camp) => {
  const start = parseDate(camp.start); start.setHours(0, 0, 0, 0);
  const end = campaignEnd(camp);
  return (Date.now() - start) / (end - start);
};
const campaignNote = (camp) => camp.note[getLang()] || camp.note.en;

// A running campaign, shown big. onMore (Today screen) swaps the announcement link for "see all".
function CampaignHero({ c: camp, onMore }) {
  const c = useTheme();
  const n = daysLeft(campaignEnd(camp));
  const urgent = n <= 3;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Txt muted size={13}>{t('campH')}</Txt>
          <Txt bold size={20}>{t('iss_' + camp.iss)}</Txt>
          <Pill tone={urgent ? 'danger' : 'ok'} text={n === 0 ? t('campLastDay') : t('campUntil', { date: fmtDate(camp.end), n })} />
        </View>
        <View style={{ backgroundColor: c.okBg, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Figure size={32} color={c.ok}>−{camp.pct}%</Figure>
        </View>
      </View>
      <Progress value={campaignProgress(camp)} color={urgent ? c.red : c.ok} />
      {!onMore && campaignNote(camp) ? <Txt muted>{campaignNote(camp)}</Txt> : null}
      <Btn icon="card-outline" title={t('payNow')} onPress={() => A.payCampaign(camp)} />
      {onMore ? <Btn plain small title={t('finesTitle')} iconEnd="chevron-forward" onPress={onMore} />
        : <Btn plain small icon="open-outline" title={t('campSource')} onPress={() => Linking.openURL(camp.url)} />}
    </Card>
  );
}

const CHECK_SITES = ['dxb', 'adp', 'shj', 'moi', 'rta', 'parkin'];

export function FinesScreen({ go }) {
  const s = useStore(); const c = useTheme();
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const camps = visibleCampaigns(s.campaigns);
  const [hero, ...more] = camps[0] && campaignStatus(camps[0]) === 'active' ? camps : [null, ...camps];
  const list = s.fines.slice().sort((a, b) => a.paid - b.paid || new Date(b.date) - new Date(a.date));
  const checkNow = async () => { setBusy(true); await refreshCampaigns({ force: true }); setBusy(false); };
  return (
    <Screen>
      <Title k="finesTitle" onSettings={() => go('settings')} />

      {hero ? <CampaignHero c={hero} /> : (
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.chip, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="pricetags-outline" size={26} color={c.muted} /></View>
          <Txt style={{ textAlign: 'center' }}>{t('campNone')}</Txt>
        </Card>
      )}
      {more.length ? (
        <List>{more.map((x) => { const active = campaignStatus(x) === 'active'; const n = daysLeft(campaignEnd(x));
          return <ListRow key={x.id} icon="pricetag-outline" iconTone={active ? 'ok' : undefined}
            title={t('campTitle', { p: x.pct, issuer: t('iss_' + x.iss) })}
            sub={!active ? t('campStarts', { date: fmtDate(x.start) }) : n === 0 ? t('campLastDay') : t('campUntil', { date: fmtDate(x.end), n })}
            right={active ? <Btn small title={t('payNow')} onPress={() => A.payCampaign(x)} /> : null}
            chevron={!active} onPress={active ? undefined : () => Linking.openURL(x.url)} />; })}
        </List>) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 4 }}>
        <Txt muted size={13} style={{ flex: 1 }}>{s.campaignsAt ? t('campChecked', { time: fmtDate(s.campaignsAt) + ' ' + fmtTime(s.campaignsAt) }) : t('campNever')}</Txt>
        <Btn plain small icon="refresh" title={t('campRefresh')} disabled={busy} onPress={checkNow} />
      </View>
      {camps.length ? <Txt muted size={13} style={{ paddingHorizontal: 4 }}>{t('campCheckNote')}</Txt> : null}

      <Sec>{t('checkFinesH')}</Sec>
      <List>{CHECK_SITES.map((k) => <ListRow key={k} icon="shield-outline" title={t('iss_' + k)} chevron onPress={() => Linking.openURL(PAY_URLS[k])} />)}</List>

      <Notice tone="info" icon="time-outline" title={t('rulesH')}>{t('rulesB')}</Notice>

      <Sec action={<Btn plain small icon="add" title={t('addFine')} onPress={() => setEdit({ iss: 'dxb', amount: '', date: new Date().toISOString().slice(0, 10), note: '', severe: false, manualPct: '', manualUntil: '' })} />}>{t('trackH')}</Sec>
      {list.map((f) => { const o = fineOffer(f);
        return (
          <Card key={f.id}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Txt bold>{t('iss_' + f.iss)}</Txt>
                {f.note ? <Txt>{f.note}</Txt> : null}
                <Txt muted>{fmtDate(f.date)}</Txt>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Figure size={20}>{aed(f.paid ? (f.paidAmount ?? f.amount) : o ? discounted(f.amount, o.pct) : f.amount)}</Figure>
                {(o && !f.paid) || (f.paid && f.paidAmount < f.amount) ? <Txt muted style={{ textDecorationLine: 'line-through' }}>{aed(f.amount)}</Txt> : null}
              </View>
            </View>
            {f.paid ? <Pill tone="ok" text={t('paidTag')} /> : o ? <Pill tone="ok" text={t('offDays', { p: o.pct, n: daysLeft(o.end) })} /> : null}
            <Wrap>
              {!f.paid ? <><Btn small title={t('pay')} onPress={() => A.payFine(f)} /><Btn ghost small title={t('markPaid')} onPress={() => A.markFinePaid(f.id)} /></> : null}
              <Btn plain small title={t('delete')} onPress={() => Alert.alert(t('delete') + '?', '', [{ text: t('cancel'), style: 'cancel' }, { text: t('delete'), style: 'destructive', onPress: () => A.deleteFine(f.id) }])} />
            </Wrap>
          </Card>);
      })}
      {edit ? <FineForm initial={edit} onClose={() => setEdit(null)} /> : null}
    </Screen>
  );
}
function FineForm({ initial, onClose }) {
  const c = useTheme();
  const [f, setF] = useState(initial);
  const [err, setErr] = useState(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    const amount = Number(latinDigits(f.amount));
    const date = parseDate(f.date);
    if (!(amount > 0) || amount > 100000) return setErr('errAmount');
    if (!date || date > new Date()) return setErr('errDate');
    const pct = f.manualPct === '' ? null : Number(latinDigits(f.manualPct));
    const until = f.manualUntil === '' ? null : parseDate(f.manualUntil);
    if ((pct == null) !== (until == null) || (pct != null && !(pct > 0 && pct < 100))) return setErr('errManual');
    await A.saveFine({ id: initial.id, iss: f.iss, amount, date: date.toISOString(), note: f.note.trim().slice(0, 80), severe: f.severe, manualPct: pct, manualUntil: until?.toISOString() || null, paid: false });
    onClose();
  }
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
        <Txt bold size={24}>{t('addFine')}</Txt>
        <Txt muted size={13}>{t('issuer')}</Txt>
        <Wrap>{ISSUERS.map((k) => <Chip key={k} title={t('iss_' + k)} on={f.iss === k} onPress={() => set('iss')(k)} />)}</Wrap>
        <Field label={t('amount')} value={String(f.amount)} onChangeText={set('amount')} keyboardType="decimal-pad" />
        <DateField label={t('violDate')} value={f.date} onChange={set('date')} maxDate={new Date()} />
        <Field label={t('note')} value={f.note} onChangeText={set('note')} maxLength={80} />
        <List><ListRow title={t('severe')} right={<Toggle label={t('severe')} value={f.severe} onValueChange={set('severe')} />} /></List>
        <Field label={t('manualPct')} value={String(f.manualPct ?? '')} onChangeText={set('manualPct')} keyboardType="number-pad" />
        <DateField label={t('manualUntil')} value={f.manualUntil ?? ''} onChange={set('manualUntil')} minDate={new Date()} placeholder="—" clearable />
        {err ? <Txt color={c.red}>{t(err)}</Txt> : null}
        <Btn title={t('saveFine')} onPress={save} />
        <Btn ghost title={t('cancel')} onPress={onClose} />
      </ScrollView>
    </Modal>
  );
}

// ---------- Salik
export function SalikScreen({ go }) {
  const s = useStore(); const c = useTheme();
  const [val, setVal] = useState(''); const [err, setErr] = useState(false); const [adding, setAdding] = useState(false); const [fixing, setFixing] = useState(false);
  const bal = s.balance;
  const list = s.crossings.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 100);
  const balTone = bal == null ? null : bal < 0 ? 'danger' : bal < s.settings.low ? 'warn' : null;
  async function saveBal() {
    const v = Number(latinDigits(val.trim()));
    if (val.trim() === '' || !isFinite(v) || v < 0 || v > 5000) return setErr(true);
    setErr(false); setVal(''); setFixing(false); await update((x) => { x.balance = Math.round(v * 100) / 100; });
  }
  // What is being typed, shown right away in the big figure (saved on Done, leaving the box or Save)
  const typed = (() => { const v = Number(latinDigits(val.trim())); return val.trim() !== '' && isFinite(v) && v >= 0 && v <= 5000 ? Math.round(v * 100) / 100 : null; })();
  const saveIfTyped = () => { if (val.trim() !== '') saveBal(); };
  async function addCrossing(g) {
    setAdding(false);
    const now = new Date(); const charge = crossingCharge(g.id, now, s.crossings);
    if (charge == null) return;
    await update((x) => { x.crossings.push({ id: newId(), gate: g.id, date: now.toISOString(), charge, auto: false }); if (x.balance != null) x.balance = Math.round((x.balance - charge) * 100) / 100; });
  }
  return (
    <Screen>
      <Title k="tab_salik" onSettings={() => go('settings')} />
      <LocationNotice extra="locSalikNote" />
      {bal == null ? (
        <Card>
          <Icon name="wallet-outline" size={28} />
          <Txt bold size={20}>{t('salikAskT')}</Txt>
          <Txt muted>{t('salikAskB')}</Txt>
          {typed != null ? <Figure size={34}>{aed(typed)}</Figure> : null}
          <Field value={val} onChangeText={(v) => { setVal(v); setErr(false); }} keyboardType="decimal-pad" placeholder="AED 50.00" error={err ? t('balErr') : null} onSubmitEditing={saveBal} onBlur={saveIfTyped} />
          <Btn title={t('save')} onPress={saveBal} />
        </Card>
      ) : (
        <Card tone={balTone}>
          <Txt muted size={13}>{t('estBalance')}</Txt>
          <Figure size={42} color={fixing && typed != null ? c.fg : balTone === 'danger' ? c.red : balTone === 'warn' ? c.amber : c.fg}>{aed(fixing && typed != null ? typed : bal)}</Figure>
          {balTone ? <Txt color={balTone === 'danger' ? c.red : c.amber}>{t(balTone === 'danger' ? 'balNeg' : 'balLow')}</Txt> : null}
          <Btn icon="card-outline" title={t('topUp')} onPress={A.topUpSalik} />
          {fixing ? <>
            <Field label={t('correctBal')} value={val} onChangeText={(v) => { setVal(v); setErr(false); }} keyboardType="decimal-pad" placeholder="50.00" error={err ? t('balErr') : null} autoFocus onSubmitEditing={saveBal} onBlur={saveIfTyped} />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn ghost title={t('cancel')} onPress={() => { setFixing(false); setErr(false); }} style={{ flex: 1 }} />
              <Btn title={t('save')} onPress={saveBal} style={{ flex: 1 }} />
            </View>
          </> : <Btn plain small icon="create-outline" title={t('fixBal')} onPress={() => setFixing(true)} />}
        </Card>
      )}
      <Sec action={<Btn plain small icon={adding ? 'close' : 'add'} title={t('addCrossing')} onPress={() => setAdding(!adding)} />}>{t('crossings')}</Sec>
      {adding ? <Card><Wrap>{GATES.map((g) => <Chip key={g.id} title={gateName(g.id)} onPress={() => addCrossing(g)} />)}</Wrap></Card> : null}
      {list.length === 0 ? <Card><Txt muted>{t('noCrossings')}</Txt></Card> : (
        <List>{list.map((x) => (
          <ListRow key={x.id} icon="swap-horizontal" title={gateName(x.gate)} sub={fmtDate(x.date) + ' · ' + fmtTime(x.date)}
            right={<Txt bold style={{ fontVariant: ['tabular-nums'] }}>{x.charge ? aed(x.charge) : t('free')}</Txt>} />))}
        </List>)}
    </Screen>
  );
}

// ---------- Vehicles
export function VehiclesScreen({ go }) {
  const s = useStore(); const c = useTheme();
  const [form, setForm] = useState(null); const [err, setErr] = useState(null);
  async function save() {
    const r = validateVehicle(form, s.vehicles);
    if (r.error) return setErr(r.error);
    const v = { ...r.vehicle, id: newId() };
    await update((x) => { x.vehicles.push(v); if (!x.defaultVeh) x.defaultVeh = v.id; });
    setForm(null); setErr(null);
  }
  return (
    <Screen>
      <Title k="tab_vehicles" onSettings={() => go('settings')} />
      {s.vehicles.map((v) => (
        <Card key={v.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <BrandBadge brand={v.brand} size={52} />
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Txt bold size={17} numberOfLines={1}>{v.brand} {v.model}</Txt>
              <Plate v={v} width={240} />
              {v.color ? <Txt muted>{v.color}</Txt> : null}
            </View>
          </View>
          {v.id === s.defaultVeh ? <Pill tone="info" text={t('defaultPark')} /> : null}
          <Wrap>
            {v.id !== s.defaultVeh ? <Btn ghost small title={t('makeDefault')} onPress={() => update((x) => { x.defaultVeh = v.id; })} /> : null}
            <Btn plain small title={t('remove')} onPress={() => update((x) => { x.vehicles = x.vehicles.filter((y) => y.id !== v.id); if (x.defaultVeh === v.id) x.defaultVeh = x.vehicles[0]?.id || null; })} />
          </Wrap>
        </Card>))}
      {form ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><BrandBadge brand={form.brand} /><Txt bold size={17} style={{ flex: 1 }}>{t('addVehicle')}</Txt></View>
          <Txt muted size={13}>{t('brand')}</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{BRANDS.map((b) => <Chip key={b} title={b} on={form.brand === b} onPress={() => setForm({ ...form, brand: b })} />)}</ScrollView>
          <Field label={t('model')} value={form.model} onChangeText={(v) => setForm({ ...form, model: v })} maxLength={24} />
          <Txt muted size={13}>{t('plateEm')}</Txt>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{EM_ORDER.map((k) => <Chip key={k} title={emName(k)} on={form.em === k} onPress={() => setForm({ ...form, em: k })} />)}</ScrollView>
          <Txt muted size={13}>{t('plateCode')} · {t('plateNum')}</Txt>
          <PlateInput em={form.em} code={form.code} num={form.num} codeLabel={t('plateCode')} numLabel={t('plateNum')}
            onCode={(v) => setForm({ ...form, code: v })} onNum={(v) => setForm({ ...form, num: v })}
            error={err === 'errCode' || err === 'errNum' ? t(err) : null} errorColor={c.red} />
          <Field label={t('colour')} value={form.color} onChangeText={(v) => setForm({ ...form, color: v })} maxLength={16} />
          {err && err !== 'errCode' && err !== 'errNum' ? <Txt color={c.red}>{t(err)}</Txt> : null}
          <Btn title={t('saveVeh')} onPress={save} />
          <Btn ghost title={t('cancel')} onPress={() => { setForm(null); setErr(null); }} />
        </Card>
      ) : <Btn icon="add" title={t('addVehBtn')} onPress={() => setForm({ brand: 'Toyota', model: '', em: 'SHJ', code: '', num: '', color: '' })} />}
    </Screen>
  );
}

// ---------- Settings
export function SettingsScreen({ go, onLang }) {
  const [page, setPage] = useState(null); // a sub-page of Settings: 'gates', ...
  if (page === 'gates') return <GatesPage onBack={() => setPage(null)} />;
  return <SettingsMain go={go} onLang={onLang} setPage={setPage} />;
}

// Settings ▸ Salik gate positions: every gate, open it in Maps, "I'm here" to correct it, reset a mistaken one.
function GatesPage({ onBack }) {
  const s = useStore(); const [saved, setSaved] = useState(null);
  const openMap = (g) => { const p = gatePos(g, s.settings.gateOverrides); const q = encodeURIComponent(gateName(g.id));
    Linking.openURL(Platform.OS === 'ios' ? `http://maps.apple.com/?ll=${p.lat},${p.lng}&q=${q}` : `geo:${p.lat},${p.lng}?q=${p.lat},${p.lng}(${q})`); };
  const imHere = async (g) => { const p = await currentPosition(); if (p) { await update((x) => { x.settings.gateOverrides[g.id] = p; }); setSaved(g.id); } };
  const reset = (g) => Alert.alert(t('resetGate'), t('resetGateQ', { gate: gateName(g.id) }), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('resetGate'), style: 'destructive', onPress: () => { update((x) => { delete x.settings.gateOverrides[g.id]; }); setSaved(null); } },
  ]);
  return (
    <Screen>
      <Title k="gatesH" onBack={onBack} />
      <Txt muted size={13} style={{ paddingHorizontal: 4 }}>{t('gatesNote')}</Txt>
      {GATES.map((g) => { const fixed = !!s.settings.gateOverrides[g.id];
        return (
          <Card key={g.id} style={{ gap: 10 }}>
            <Row>
              <View style={{ flex: 1, minWidth: 0 }}><Txt bold>{gateName(g.id)}</Txt><Txt muted size={13}>{fixed ? t('corrected') : t('approx')}</Txt></View>
              <Btn plain small icon="map-outline" title={t('gateMap')} onPress={() => openMap(g)} />
            </Row>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Btn ghost small icon="locate-outline" title={saved === g.id ? '✓ ' + t('corrected') : t('imHere')} onPress={() => imHere(g)} style={{ flex: 1 }} />
              {fixed ? <Btn ghost small icon="arrow-undo-outline" title={t('resetGate')} onPress={() => reset(g)} style={{ flex: 1 }} /> : null}
            </View>
          </Card>); })}
    </Screen>
  );
}

function SettingsMain({ go, onLang, setPage }) {
  const s = useStore();
  const [naming, setNaming] = useState(null); // { id, name } to rename, or { pos } for a new free spot
  const [taps, setTaps] = useState(0); // 5 taps on "Reminders" shows the trip log (for testing on the road)
  const setSetting = (k) => async (v) => { await update((x) => { x.settings[k] = v; }); if (k === 'remFines') { A.syncFineReminders(); syncCampaignReminders(); } };
  const toggleRow = (k, label) => <ListRow title={label} right={<Toggle label={label} value={s.settings[k]} onValueChange={setSetting(k)} />} />;
  return (
    <Screen>
      <Title k="settings" onBack={() => go('today')} />
      <Sec>{t('language')}</Sec>
      <Wrap>{LANGS.map(([k, n]) => <Chip key={k} lang={k} title={n} on={(s.settings.lang || 'en') === k} onPress={() => onLang(k)} />)}</Wrap>
      <Sec>{t('appearanceH')}</Sec>
      <Segmented value={s.settings.appearance} onChange={(k) => { applyAppearance(k); setSetting('appearance')(k); }}
        options={['auto', 'light', 'dark'].map((k) => [k, t('look_' + k)])} />
      <Sec>{t('startTabH')}</Sec>
      <Wrap>{['today', 'parking', 'salik', 'fines', 'vehicles'].map((k) => <Chip key={k} title={t('tab_' + k)} on={(s.settings.startTab || 'today') === k} onPress={() => setSetting('startTab')(k)} />)}</Wrap>
      <LocationNotice />
      <Press onPress={() => { const n = taps + 1; setTaps(n); if (n >= 5) setSetting('tripLog')(!s.settings.tripLog); }} accessible={false}>
        <Sec>{t('remindersH')}</Sec>
      </Press>
      <NotifNotice />
      <List>
        {toggleRow('remParking', t('remParking'))}
        {toggleRow('remSalik', t('remSalik'))}
        {toggleRow('remFines', t('remFines'))}
        <ListRow title={t('lowWarn', { n: s.settings.low })} right={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Btn ghost small title="−" onPress={() => setSetting('low')(Math.max(0, s.settings.low - 5))} />
            <Btn ghost small title="+" onPress={() => setSetting('low')(Math.min(200, s.settings.low + 5))} />
          </View>} />
      </List>
      <Txt muted size={13} style={{ paddingHorizontal: 4 }}>{t('inCarWait')}</Txt>
      <Segmented value={s.settings.inCarWait || DEFAULT_IN_CAR_WAIT} onChange={setSetting('inCarWait')} options={IN_CAR_WAITS.map((n) => [n, t('nMin', { n })])} />
      {s.settings.tripLog ? <TripLog /> : null}
      {Platform.OS === 'android' ? <>
        <List><ListRow icon="battery-half-outline" iconTone="warn" title={t('battT')} sub={t('battB')} chevron onPress={openBatterySettings} /></List>
      </> : null}
      <Sec>{t('freeSpots')}</Sec>
      <List>
        {s.freeSpots.map((f) => <ListRow key={f.id} icon="location-outline" title={f.name} onPress={() => setNaming({ id: f.id, name: f.name })}
          right={<Btn plain small title={t('remove')} onPress={() => update((x) => { x.freeSpots = x.freeSpots.filter((y) => y.id !== f.id); })} />} />)}
        <ListRow icon="add" title={t('addFreeHere')} onPress={async () => { const p = await currentPosition(); if (p) setNaming({ pos: p, name: '' }); }} />
      </List>
      {naming ? <NamePrompt title={naming.id ? t('rename') : t('spotNameT')} initial={naming.name} onClose={() => setNaming(null)}
        onSave={async (v) => {
          if (naming.id) await A.renameFreeSpot(naming.id, v);
          else await update((x) => { x.freeSpots.push({ id: newId(), name: (v || '').trim().slice(0, 40) || t('freeSpotName', { n: x.freeSpots.length + 1 }), ...naming.pos }); });
          setNaming(null);
        }} /> : null}
      <List>
        <ListRow icon="swap-horizontal" iconTone="info" title={t('gatesH')} sub={t('gatesCount', { n: GATES.length })} chevron onPress={() => setPage('gates')} />
      </List>
      <Sec>{t('discH')}</Sec>
      <List>
        {toggleRow('discHome', t('setDiscHome'))}
        {toggleRow('discAfterPay', t('setDiscAfterPay'))}
      </List>
      <Txt muted size={13} style={{ paddingHorizontal: 4 }}>{t('discHiddenNote')}</Txt>
      <Sec>{t('aboutH')}</Sec>
      <Card><Txt size={14}>{t('privacyShort')}</Txt></Card>
      <List>
        <ListRow icon="lock-closed-outline" title={t('privacyLink')} chevron onPress={() => Linking.openURL(PRIVACY_URL)} />
        <ListRow icon="shield-checkmark-outline" title={t('viewDisclaimer')} chevron onPress={() => openDisclaimer()} />
      </List>
    </Screen>
  );
}

/** Small sheet asking for a name (free spots). */
function NamePrompt({ title, initial = '', onSave, onClose }) {
  const c = useTheme(); const [v, setV] = useState(initial);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: c.card, borderRadius: 20, padding: 18, gap: 12 }}>
          <Txt bold size={18}>{title}</Txt>
          <Field value={v} onChangeText={setV} placeholder={t('spotNamePh')} autoFocus maxLength={40} onSubmitEditing={() => onSave(v)} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn ghost title={t('cancel')} onPress={onClose} style={{ flex: 1 }} />
            <Btn title={t('save')} onPress={() => onSave(v)} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// After "Free here" on the parking notification: ask for a name right on Today.
function NamePendingCard() {
  const s = useStore(); const [v, setV] = useState('');
  const spot = s.freeSpots.find((f) => f.id === s.namePending);
  if (!spot) return null;
  return (
    <Card>
      <Txt bold>{t('spotNameT')}</Txt>
      <Field value={v} onChangeText={setV} placeholder={t('spotNamePh')} maxLength={40} onSubmitEditing={() => A.renameFreeSpot(spot.id, v)} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn ghost title={t('skip')} onPress={() => update((x) => { x.namePending = null; })} style={{ flex: 1 }} />
        <Btn title={t('save')} onPress={() => A.renameFreeSpot(spot.id, v)} style={{ flex: 1 }} />
      </View>
    </Card>
  );
}

// Hidden testing aid: what the background task saw on the last drives and what it decided (src/location.js).
function TripLog() {
  const s = useStore(); const c = useTheme();
  const lines = (s.tripLog || []).slice(-120).reverse();
  return (
    <Card>
      <Row><Txt bold>{t('tripLog')}</Txt><Btn plain small title={t('clearLog')} onPress={() => update((x) => { x.tripLog = []; })} /></Row>
      {lines.length ? <Text selectable style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, color: c.muted, writingDirection: 'ltr', textAlign: 'left' }}>{lines.join('\n')}</Text>
        : <Txt muted size={13}>{t('tripLogEmpty')}</Txt>}
    </Card>
  );
}

// ---------- First run: one thing per step (language, notifications, location, battery on Android, disclaimer)
export function Onboarding({ onDone, onLang }) {
  const s = useStore(); const c = useTheme();
  const steps = ['lang', 'notif', 'loc', ...(Platform.OS === 'android' ? ['batt'] : []), 'disc'];
  const [i, setI] = useState(0);
  const [loc, setLoc] = useState(null);
  const step = steps[i];
  const next = () => setI((n) => Math.min(n + 1, steps.length - 1));
  const locDone = loc && (loc.background || (loc.foreground && loc.noBackground));
  async function allowNotif() { await requestNotifPermission(); await setupCategories(); next(); }
  async function allowLoc() {
    const r = await requestLocation(); setLoc(r);
    if (r.background) startTracking();
    if (r.background || (r.foreground && r.noBackground)) next();
  }
  const Hero = ({ icon, tone, title, body }) => (
    <View style={{ gap: 14, marginTop: 24 }}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: tone ? c[tone + 'Bg'] : c.chip, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={32} color={tone ? c[tone] : c.fg} /></View>
      <Txt bold size={28} style={{ letterSpacing: -0.5 }}>{title}</Txt>
      <Txt size={17} muted>{body}</Txt>
    </View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 8 }}>
        {i > 0 ? <Btn plain small icon="chevron-back" title={t('back')} onPress={() => setI(i - 1)} /> : null}
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }} accessibilityLabel={t('stepOf', { n: i + 1, total: steps.length })}>
          {steps.map((k, n) => <View key={k} style={{ width: n === i ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: n <= i ? c.fg : c.line }} />)}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, flexGrow: 1 }}>
        {step === 'lang' ? <>
          <View style={{ gap: 14, marginTop: 24 }}>
            <Image source={require('../assets/icon.png')} accessibilityIgnoresInvertColors style={{ width: 72, height: 72, borderRadius: 16 }} />
            <Txt bold size={30} style={{ letterSpacing: -0.5 }}>{t('welcomeT')}</Txt>
            <Txt size={17} muted>{t('welcomeB')}</Txt>
          </View>
          <Txt muted size={13}>{t('language')}</Txt>
          <Wrap>{LANGS.map(([k, n]) => <Chip key={k} lang={k} title={n} on={(s.settings.lang || 'en') === k} onPress={() => onLang(k)} />)}</Wrap>
        </> : null}
        {step === 'notif' ? <Hero icon="notifications-outline" tone="info" title={t('permNotifT')} body={t('permNotifB')} /> : null}
        {step === 'loc' ? <>
          <Hero icon="location-outline" tone="info" title={t('permLocT')} body={t('permLocB')} />
          {loc && !loc.foreground ? <Warn>{t('locOffB')}</Warn> : loc && !locDone ? <Warn>{t('locLimitedB')}</Warn> : null}
        </> : null}
        {step === 'batt' ? <Hero icon="battery-half-outline" tone="amber" title={t('battT')} body={t('battB')} /> : null}
        {step === 'disc' ? <>
          <Hero icon="shield-checkmark-outline" tone="red" title={t('discTitle')} body={t('disc1')} />
          <Txt size={16}>{t('disc2')}</Txt>
          <Card tone="danger"><Txt bold color={c.red}>{t('disc3')}</Txt></Card>
          <Txt size={16}>{t('disc4')}</Txt>
        </> : null}
      </ScrollView>
      <SafeAreaView edges={['bottom']} style={{ padding: 16, gap: 8 }}>
        {step === 'lang' ? <Btn title={t('next')} onPress={next} /> : null}
        {step === 'notif' ? <><Btn title={t('allow')} onPress={allowNotif} /><Btn plain title={t('notNow')} onPress={next} /></> : null}
        {step === 'loc' ? <><Btn title={loc ? t('next') : t('allow')} onPress={loc ? next : allowLoc} />{loc ? null : <Btn plain title={t('notNow')} onPress={next} />}</> : null}
        {step === 'batt' ? <><Btn title={t('openSettings')} onPress={async () => { await openBatterySettings(); next(); }} /><Btn plain title={t('notNow')} onPress={next} /></> : null}
        {step === 'disc' ? <Btn title={t('agreeStart')} onPress={onDone} /> : null}
      </SafeAreaView>
    </View>
  );
}
