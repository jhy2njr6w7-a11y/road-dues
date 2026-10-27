import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, Modal, Switch, Linking, Alert, AppState } from 'react-native';
import { useStore, update, newId } from './store';
import { t, emName, hrsOf, fmtDate, fmtTime, LANGS, getLang } from './i18n';
import { EMIRATES, EM_ORDER, ISSUERS, GATES, BRANDS, aed, buildSms, cleanCode, ZONE_RE, fineOffer, discounted, daysLeft,
  validateVehicle, parseDate, emirateAt, distanceM, crossingCharge, latinDigits, visibleCampaigns, campaignStatus, campaignEnd, PAY_URLS } from './data';
import { Card, Sec, Txt, Btn, Chip, Field, Row, Wrap, Warn, Plate, BrandBadge, Bubble, useTheme, styles, ACCENTS, applyAppearance } from './ui';
import * as A from './actions';
import { currentPosition, requestLocation, locationStatus, startTracking } from './location';
import { requestNotifPermission, setupCategories } from './notify';
import { openDisclaimer } from './disclaimer';
import { refreshCampaigns, syncCampaignReminders } from './campaigns';

export const PRIVACY_URL = 'https://YOUR-SITE/privacy.html'; // replace after hosting privacy.html (see README)

// Every screen gets an ⓘ button that opens the disclaimer, plus the settings gear.
function Title({ k, onSettings }) {
  const c = useTheme();
  const round = { width: 46, height: 46, borderRadius: 23, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' };
  return (
    <Row>
      <Text accessibilityRole="header" style={[styles.title, { color: c.fg, flexShrink: 1 }]}>{t(k)}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('viewDisclaimer')} onPress={() => openDisclaimer()} style={round}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: c.fg }}>ⓘ</Text></Pressable>
        {onSettings ? <Pressable accessibilityRole="button" accessibilityLabel={t('settings')} onPress={onSettings} style={round}>
          <Text style={{ fontSize: 22, color: c.fg }}>⚙︎</Text></Pressable> : null}
      </View>
    </Row>
  );
}

// Always visible on the home screen
function DisclaimerCard() {
  const c = useTheme();
  return (
    <View accessibilityRole="summary" style={{ backgroundColor: c.card, borderRadius: 14, padding: 14, gap: 8, borderStartWidth: 4, borderStartColor: c.red }}>
      <Txt bold>{t('discTitle')}</Txt>
      <Txt size={14} color={c.red} bold>{t('disc3')}</Txt>
      <Txt size={14} muted>{t('disc4')}</Txt>
      <Wrap>
        <Btn ghost title={t('viewDisclaimer')} onPress={() => openDisclaimer()} />
        <Btn ghost title={t('hideDisc')} onPress={() => Alert.alert(t('hideDisc') + '?', t('discHiddenNote'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('hideDisc'), onPress: () => update((x) => { x.settings.discHome = false; }) },
        ])} />
      </Wrap>
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
  const c = useTheme();
  const [st, refresh] = useLocationStatus();
  // Nothing to fix if "Always" is on, or can't exist here (Expo Go) and "While Using" is on.
  if (!st || st.background || (st.foreground && st.noBackground)) return null;
  const off = !st.foreground;
  async function fix() {
    if (st.canAsk) { const r = await requestLocation(); if (r.background) startTracking(); refresh(); }
    else Linking.openSettings();
  }
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: c.amber + '22', borderRadius: 14, padding: 14, gap: 8, borderStartWidth: 4, borderStartColor: c.amber }}>
      <Txt bold>{t(off ? 'locOffT' : 'locLimitedT')}</Txt>
      <Txt size={14}>{t(off ? 'locOffB' : 'locLimitedB')}</Txt>
      {off && extra ? <Txt size={14}>{t(extra)}</Txt> : null}
      <Btn title={st.canAsk ? t('allow') : t('openSettings')} onPress={fix} />
    </View>
  );
}

// ---------- Disclaimer sheet (shown after every parking payment, and from Settings)
export function DisclaimerSheet({ visible, onClose, onRemoveTicket, afterPay }) {
  const c = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 24, gap: 18 }}>
        <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} />
        <Txt bold size={20}>{t('discTitle')}</Txt>
        <Txt size={17}>{t('disc1')}</Txt>
        <Txt size={17}>{t('disc2')}</Txt>
        <Txt size={17} color={c.red} bold>{t('disc3')}</Txt>
        <Txt size={17}>{t('disc4')}</Txt>
        {onRemoveTicket ? <Btn danger title={t('removeTicket')} onPress={onRemoveTicket} /> : null}
        <Btn title={afterPay ? t('continuePay') : t('gotIt')} onPress={onClose} />
        {afterPay ? <Btn ghost title={t('dontShowAgain')} onPress={async () => { await update((x) => { x.settings.discAfterPay = false; }); onClose(); }} /> : null}
        {afterPay ? <Txt muted style={{ textAlign: 'center' }}>{t('discHiddenNote')}</Txt> : null}
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
  const topCamp = visibleCampaigns(s.campaigns).find((x) => campaignStatus(x) === 'active');
  const balColor = bal == null ? c.muted : bal < 0 ? c.red : bal < s.settings.low ? c.amber : c.fg;
  return (
    <Screen>
      <Title k="appName" onSettings={() => go('settings')} />
      {s.settings.discHome ? <DisclaimerCard /> : null}
      <LocationNotice />
      {dv ? <Card><Row style={{ justifyContent: 'flex-start' }}><BrandBadge brand={dv.brand} /><View style={{ gap: 4, flex: 1 }}><Txt bold numberOfLines={1}>{dv.brand} {dv.model}</Txt><Plate v={dv} /></View></Row></Card>
        : <Card><Txt>{t('addVehFirst')}</Txt><Btn title={t('addVehBtn')} onPress={() => go('vehicles')} /></Card>}
      <Sec>{t('salik')}</Sec>
      <Card>
        <Row><View><Txt muted>{t('estBalance')}</Txt><Txt bold size={26} color={balColor}>{bal == null ? '—' : aed(bal)}</Txt></View><Btn title={t('topUp')} onPress={A.topUpSalik} /></Row>
        {bal != null && bal < 0 ? <Txt color={c.red}>{t('balNeg')}</Txt> : bal != null && bal < s.settings.low ? <Txt color={c.amber}>{t('balLow')}</Txt> : null}
      </Card>
      <Sec>{t('finesTitle')}</Sec>
      <Card>
        {unpaid.length ? <Row><Txt>{t('unpaid')}</Txt><Txt bold color={c.red}>{aed(total)}</Txt></Row> : null}
        {!unpaid.length && !topCamp ? <Txt muted>{t('campNone')}</Txt> : null}
        {topCamp ? <View style={{ gap: 6 }}>
          <Txt bold>{t('campTitle', { p: topCamp.pct, issuer: t('iss_' + topCamp.iss) })}</Txt>
          <Txt muted>{daysLeft(campaignEnd(topCamp)) === 0 ? t('campLastDay') : t('campUntil', { date: fmtDate(topCamp.end), n: daysLeft(campaignEnd(topCamp)) })}</Txt>
          <Wrap><Btn title={t('payNow')} onPress={() => A.payCampaign(topCamp)} /><Btn ghost title={t('campH')} onPress={() => go('fines')} /></Wrap></View> : null}
        {next ? <View style={{ gap: 6 }}>
          <Txt bold>{t('offTitle', { p: next[1].pct, issuer: t('iss_' + next[0].iss) })}</Txt>
          <Txt muted>{t('offBody', { pay: aed(discounted(next[0].amount, next[1].pct)), date: fmtDate(next[1].end), save: aed(next[0].amount - discounted(next[0].amount, next[1].pct)) })}</Txt>
          <Btn title={t('payDiscount')} onPress={() => A.payFine(next[0])} /></View> : null}
      </Card>
      <Sec>{t('parking')}</Sec>
      <Card><ParkingStatus go={go} /></Card>
    </Screen>
  );
}

function ParkingStatus({ go }) {
  const s = useStore(); const c = useTheme(); const p = s.parking;
  if (!p) return <Txt muted>{t('notParked')}</Txt>;
  return (
    <View style={{ gap: 8 }}>
      <Row><Txt bold>{t('parkedAt', { time: fmtTime(p.start), em: emName(p.em) })}</Txt>
        {p.status === 'paid' ? <Txt color={c.ok}>{t('paidUntil', { time: fmtTime(p.until) })}</Txt> : p.status === 'free' ? <Txt muted>{t('freeSpot')}</Txt> : <Txt color={c.red}>{t('notPaid')}</Txt>}</Row>
      {p.zone ? <Txt muted>{p.zone}</Txt> : null}
      <Wrap>
        {p.status === 'awaiting' ? <><Btn title={t('payNow')} onPress={() => go('parking')} /><Btn ghost title={t('freeHere')} onPress={A.markFreeHere} /></> : null}
        {p.status === 'paid' ? <Btn ghost title={t('extend')} onPress={() => go('parking')} /> : null}
        <Btn ghost title={t('removeTicket')} onPress={A.removeParkingTicket} />
      </Wrap>
    </View>
  );
}

// ---------- Parking
export function ParkingScreen({ go, prefill }) {
  const s = useStore(); const c = useTheme();
  const [pos, setPos] = useState(null);
  const [locating, setLocating] = useState(true);
  const [em, setEm] = useState(prefill?.em || s.parking?.em || 'DXB');
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
      if (e) setEm(e);
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
      {s.parking ? <Card><ParkingStatus go={go} /></Card> : null}
      <Card>
        <Txt muted>{locating ? t('detecting') : !pos ? t('noLocation') : detected ? '📍 ' + emName(em) + ' · ' + t('gps') : '📍 ' + emName(em)}</Txt>
        <Sec>{t('emirate')}</Sec>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {EM_ORDER.map((k) => <Chip key={k} title={emName(k)} on={k === em} onPress={() => { setEm(k); const hs = EMIRATES[k].hours; if (hs && !hs.includes(hours)) setHours(hs[0]); }} />)}
        </ScrollView>
        {s.vehicles.length ? <><Sec>{t('vehicle')}</Sec><Wrap>{s.vehicles.map((v) => <Chip key={v.id} title={`${v.brand} · ${v.em} ${v.code} ${v.num}`} on={v.id === vehicle?.id} onPress={() => setVehId(v.id)} />)}</Wrap></>
          : <Warn>{t('addVehFirst')}</Warn>}
        {!e.sms ? <Warn>{t('noSms', { em: emName(em), hours: hrsOf(em) })}</Warn> : <>
          {e.input === 'zone' ? <Field label={t('zoneSign')} value={zone} onChangeText={setZone} placeholder="335A" autoCapitalize="characters" autoCorrect={false} maxLength={6}
            error={zoneTyped && !ZONE_RE.test(zoneTyped) ? t('zoneErr') : null} style={{ textAlign: 'left', writingDirection: 'ltr' }} /> : null}
          {e.input === 'type' ? <><Sec>{t('parkType')}</Sec><Wrap><Chip title={t('standard')} on={type === 'S'} onPress={() => setType('S')} /><Chip title={t('premium')} on={type === 'P'} onPress={() => setType('P')} /></Wrap></> : null}
          {e.hours ? <><Sec>{t('duration')}</Sec><Wrap>{e.hours.map((h) => <Chip key={h} title={t('hoursUnit', { n: h })} on={h === hours} onPress={() => setHours(h)} />)}</Wrap>
            {e.hoursNote ? <Txt muted>{t(e.hoursNote)}</Txt> : null}</> : <Txt muted>{t('onePeriod')}</Txt>}
          <Txt muted>{t('toNum', { num: e.sms, hours: hrsOf(em) })}</Txt>
          {e.unverified ? <Warn>{t('unverified', { em: emName(em) })}</Warn> : null}
          {text ? <Bubble text={text} /> : e.input === 'zone' ? <Txt muted>{t('enterZone')}</Txt> : null}
          <Btn title={busy ? t('sending') : t('sendSms')} disabled={!text || busy} onPress={send} />
        </>}
      </Card>
      <DisclaimerSheet afterPay visible={sheet} onClose={() => { setSheet(false); go('today'); }}
        onRemoveTicket={async () => { await A.removeParkingTicket(); setSheet(false); go('today'); }} />
    </Screen>
  );
}

// ---------- Fines
// ---------- Fine discounts: campaigns first, then the standing rules, official sites and optional tracking
function CampaignCard({ c }) {
  const col = useTheme();
  const active = campaignStatus(c) === 'active';
  const n = daysLeft(campaignEnd(c));
  const note = c.note[getLang()] || c.note.en;
  return (
    <Card style={active ? { borderStartWidth: 4, borderStartColor: col.sign } : null}>
      <Txt bold size={17}>{t('campTitle', { p: c.pct, issuer: t('iss_' + c.iss) })}</Txt>
      <Txt bold color={active ? (n === 0 ? col.red : col.signText) : col.muted}>
        {!active ? t('campStarts', { date: fmtDate(c.start) }) : n === 0 ? t('campLastDay') : t('campUntil', { date: fmtDate(c.end), n })}</Txt>
      {note ? <Txt muted>{note}</Txt> : null}
      <Wrap>
        {active ? <Btn title={t('payNow')} onPress={() => A.payCampaign(c)} /> : null}
        <Btn ghost title={t('campSource')} onPress={() => Linking.openURL(c.url)} />
      </Wrap>
    </Card>
  );
}

const CHECK_SITES = ['dxb', 'adp', 'shj', 'moi', 'rta', 'parkin'];

export function FinesScreen({ go }) {
  const s = useStore(); const c = useTheme();
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const camps = visibleCampaigns(s.campaigns);
  const list = s.fines.slice().sort((a, b) => a.paid - b.paid || new Date(b.date) - new Date(a.date));
  const checkNow = async () => { setBusy(true); await refreshCampaigns({ force: true }); setBusy(false); };
  return (
    <Screen>
      <Title k="finesTitle" onSettings={() => go('settings')} />
      <Sec>{t('campH')}</Sec>
      {camps.length === 0 ? <Card><Txt>{t('campNone')}</Txt></Card> : camps.map((x) => <CampaignCard key={x.id} c={x} />)}
      {camps.length ? <Txt muted size={13}>{t('campCheckNote')}</Txt> : null}
      <Row>
        <Txt muted size={13}>{s.campaignsAt ? t('campChecked', { time: fmtDate(s.campaignsAt) + ' ' + fmtTime(s.campaignsAt) }) : t('campNever')}</Txt>
        <Btn ghost title={t('campRefresh')} disabled={busy} onPress={checkNow} />
      </Row>

      <Sec>{t('rulesH')}</Sec>
      <Card><Txt>{t('rulesB')}</Txt></Card>

      <Sec>{t('checkFinesH')}</Sec>
      <Card>
        <Txt muted>{t('checkFinesB')}</Txt>
        <Wrap>{CHECK_SITES.map((k) => <Chip key={k} title={t('iss_' + k)} onPress={() => Linking.openURL(PAY_URLS[k])} />)}</Wrap>
      </Card>

      <Sec>{t('trackH')}</Sec>
      {list.map((f) => { const o = fineOffer(f);
        return (
          <Card key={f.id}>
            <Row><Txt bold>{t('iss_' + f.iss)}</Txt>
              <View style={{ alignItems: 'flex-end' }}>
                <Txt bold>{aed(f.paid ? (f.paidAmount ?? f.amount) : o ? discounted(f.amount, o.pct) : f.amount)}</Txt>
                {(o && !f.paid) || (f.paid && f.paidAmount < f.amount) ? <Txt muted style={{ textDecorationLine: 'line-through' }}>{aed(f.amount)}</Txt> : null}
              </View></Row>
            {f.note ? <Txt>{f.note}</Txt> : null}
            <Txt muted>{fmtDate(f.date)}{f.paid ? ' · ' + t('paidTag') : ''}</Txt>
            {o ? <Txt bold color={c.signText}>{t('offDays', { p: o.pct, n: daysLeft(o.end) })}</Txt> : null}
            <Wrap>
              {!f.paid ? <><Btn title={t('pay')} onPress={() => A.payFine(f)} /><Btn ghost title={t('markPaid')} onPress={() => A.markFinePaid(f.id)} /></> : null}
              <Btn ghost title={t('delete')} onPress={() => Alert.alert(t('delete') + '?', '', [{ text: t('cancel'), style: 'cancel' }, { text: t('delete'), style: 'destructive', onPress: () => A.deleteFine(f.id) }])} />
            </Wrap>
          </Card>);
      })}
      {edit ? <FineForm initial={edit} onClose={() => setEdit(null)} />
        : <Btn ghost title={t('addFine')} onPress={() => setEdit({ iss: 'dxb', amount: '', date: new Date().toISOString().slice(0, 10), note: '', severe: false, manualPct: '', manualUntil: '' })} />}
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
      <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, gap: 12 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
        <Txt bold size={22}>{t('addFine')}</Txt>
        <Sec>{t('issuer')}</Sec>
        <Wrap>{ISSUERS.map((k) => <Chip key={k} title={t('iss_' + k)} on={f.iss === k} onPress={() => set('iss')(k)} />)}</Wrap>
        <Field label={t('amount')} value={String(f.amount)} onChangeText={set('amount')} keyboardType="decimal-pad" />
        <Field label={t('violDate')} value={f.date} onChangeText={set('date')} placeholder="2026-10-27" />
        <Field label={t('note')} value={f.note} onChangeText={set('note')} maxLength={80} />
        <Row><Txt style={{ flex: 1 }}>{t('severe')}</Txt><Switch trackColor={{ true: c.sign }} value={f.severe} onValueChange={set('severe')} /></Row>
        <Field label={t('manualPct')} value={String(f.manualPct ?? '')} onChangeText={set('manualPct')} keyboardType="number-pad" />
        <Field label={t('manualUntil')} value={f.manualUntil ?? ''} onChangeText={set('manualUntil')} placeholder="2026-12-31" />
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
  const [val, setVal] = useState(''); const [err, setErr] = useState(false); const [adding, setAdding] = useState(false);
  const bal = s.balance;
  const list = s.crossings.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 100);
  async function saveBal() {
    const v = Number(latinDigits(val.trim()));
    if (val.trim() === '' || !isFinite(v) || v < 0 || v > 5000) return setErr(true);
    setErr(false); setVal(''); await update((x) => { x.balance = Math.round(v * 100) / 100; });
  }
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
      <Card>
        <Row><View><Txt muted>{t('estBalance')}</Txt><Txt bold size={26} color={bal == null ? c.muted : bal < 0 ? c.red : bal < s.settings.low ? c.amber : c.fg}>{bal == null ? '—' : aed(bal)}</Txt></View><Btn title={t('topUp')} onPress={A.topUpSalik} /></Row>
        <Field label={t('correctBal')} value={val} onChangeText={setVal} keyboardType="decimal-pad" placeholder="50.00" error={err ? t('balErr') : null} />
        <Btn ghost title={t('save')} onPress={saveBal} />
      </Card>
      <Row><Sec>{t('crossings')}</Sec><Btn ghost title={t('addCrossing')} onPress={() => setAdding(!adding)} /></Row>
      {adding ? <Card><Wrap>{GATES.map((g) => <Chip key={g.id} title={g.name} onPress={() => addCrossing(g)} />)}</Wrap></Card> : null}
      <Card>
        {list.length === 0 ? <Txt muted>{t('noCrossings')}</Txt> : list.map((x) => (
          <Row key={x.id}><View style={{ flex: 1 }}><Txt>{GATES.find((g) => g.id === x.gate)?.name || x.gate}</Txt><Txt muted>{fmtDate(x.date)} · {fmtTime(x.date)}</Txt></View><Txt bold>{x.charge ? aed(x.charge) : t('free')}</Txt></Row>))}
      </Card>
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
          <Row style={{ justifyContent: 'flex-start' }}><BrandBadge brand={v.brand} />
            <View style={{ flex: 1, gap: 4 }}><Txt bold numberOfLines={1}>{v.brand} {v.model}</Txt>{v.color ? <Txt muted>{v.color}</Txt> : null}<Plate v={v} />
              {v.id === s.defaultVeh ? <Txt bold size={13} color={c.signText}>{t('defaultPark')}</Txt> : null}</View></Row>
          <Wrap>
            {v.id !== s.defaultVeh ? <Btn ghost title={t('makeDefault')} onPress={() => update((x) => { x.defaultVeh = v.id; })} /> : null}
            <Btn ghost title={t('remove')} onPress={() => update((x) => { x.vehicles = x.vehicles.filter((y) => y.id !== v.id); if (x.defaultVeh === v.id) x.defaultVeh = x.vehicles[0]?.id || null; })} />
          </Wrap>
        </Card>))}
      {form ? (
        <Card>
          <Txt bold>{t('addVehicle')}</Txt>
          <Row style={{ justifyContent: 'flex-start' }}><BrandBadge brand={form.brand} /><Txt>{form.brand} {form.model}</Txt></Row>
          <Sec>{t('brand')}</Sec>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{BRANDS.map((b) => <Chip key={b} title={b} on={form.brand === b} onPress={() => setForm({ ...form, brand: b })} />)}</ScrollView>
          <Field label={t('model')} value={form.model} onChangeText={(v) => setForm({ ...form, model: v })} maxLength={24} />
          <Sec>{t('plateEm')}</Sec>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>{EM_ORDER.map((k) => <Chip key={k} title={emName(k)} on={form.em === k} onPress={() => setForm({ ...form, em: k })} />)}</ScrollView>
          <Field label={t('plateCode')} value={form.code} onChangeText={(v) => setForm({ ...form, code: v })} autoCapitalize="characters" maxLength={3} placeholder="A / 3" />
          <Field label={t('plateNum')} value={form.num} onChangeText={(v) => setForm({ ...form, num: v })} keyboardType="number-pad" maxLength={5} placeholder="12345" />
          <Field label={t('colour')} value={form.color} onChangeText={(v) => setForm({ ...form, color: v })} maxLength={16} />
          {err ? <Txt color={c.red}>{t(err)}</Txt> : null}
          <Wrap><Btn title={t('saveVeh')} onPress={save} /><Btn ghost title={t('cancel')} onPress={() => { setForm(null); setErr(null); }} /></Wrap>
        </Card>
      ) : <Btn title={t('addVehBtn')} onPress={() => setForm({ brand: 'Toyota', model: '', em: 'SHJ', code: '', num: '', color: '' })} />}
    </Screen>
  );
}

// ---------- Settings
export function SettingsScreen({ go, onLang }) {
  const s = useStore(); const c = useTheme();
  const [saved, setSaved] = useState(null);
  const setSetting = (k) => async (v) => { await update((x) => { x.settings[k] = v; }); if (k === 'remFines') { A.syncFineReminders(); syncCampaignReminders(); } };
  return (
    <Screen>
      <Title k="settings" />
      <Btn ghost title="←" onPress={() => go('today')} style={{ alignSelf: 'flex-start' }} />
      <Sec>{t('language')}</Sec>
      <Wrap>{LANGS.map(([k, n]) => <Chip key={k} title={n} on={(s.settings.lang || 'en') === k} onPress={() => onLang(k)} />)}</Wrap>
      <Sec>{t('appearanceH')}</Sec>
      <Wrap>{['auto', 'light', 'dark'].map((k) => <Chip key={k} title={t('look_' + k)} on={s.settings.appearance === k}
        onPress={() => { applyAppearance(k); setSetting('appearance')(k); }} />)}</Wrap>
      <Sec>{t('accentH')}</Sec>
      <Card>
        <Txt muted>{t('accentNote')}</Txt>
        <Wrap>{ACCENTS.map((a) => { const on = s.settings.accent === a.key; const [fill] = c.dark ? a.dark : a.light;
          return (
            <Pressable key={a.key} accessibilityRole="button" accessibilityLabel={a.name} accessibilityState={{ selected: on }} onPress={() => setSetting('accent')(a.key)}
              style={{ width: 92, alignItems: 'center', gap: 6, paddingVertical: 8, borderRadius: 12, borderWidth: 2, borderColor: on ? fill : 'transparent' }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: fill, alignItems: 'center', justifyContent: 'center' }}>
                {on ? <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>✓</Text> : null}</View>
              <Txt size={12} style={{ textAlign: 'center' }}>{a.name}</Txt>
            </Pressable>); })}</Wrap>
      </Card>
      <LocationNotice />
      <Sec>{t('remindersH')}</Sec>
      <Card>
        <Row><Txt style={{ flex: 1 }}>{t('remParking')}</Txt><Switch trackColor={{ true: c.sign }} value={s.settings.remParking} onValueChange={setSetting('remParking')} /></Row>
        <Row><Txt style={{ flex: 1 }}>{t('remSalik')}</Txt><Switch trackColor={{ true: c.sign }} value={s.settings.remSalik} onValueChange={setSetting('remSalik')} /></Row>
        <Row><Txt style={{ flex: 1 }}>{t('remFines')}</Txt><Switch trackColor={{ true: c.sign }} value={s.settings.remFines} onValueChange={setSetting('remFines')} /></Row>
        <Row><Txt style={{ flex: 1 }}>{t('lowWarn', { n: s.settings.low })}</Txt>
          <Wrap><Chip title="−" onPress={() => setSetting('low')(Math.max(0, s.settings.low - 5))} /><Chip title="+" onPress={() => setSetting('low')(Math.min(200, s.settings.low + 5))} /></Wrap></Row>
      </Card>
      <Sec>{t('freeSpots')}</Sec>
      <Card>
        {s.freeSpots.map((f) => <Row key={f.id}><Txt>{f.name}</Txt><Btn ghost title={t('remove')} onPress={() => update((x) => { x.freeSpots = x.freeSpots.filter((y) => y.id !== f.id); })} /></Row>)}
        <Btn ghost title={t('addFreeHere')} onPress={async () => { const p = await currentPosition(); if (p) update((x) => { x.freeSpots.push({ id: newId(), name: t('freeSpotName', { n: x.freeSpots.length + 1 }), ...p }); }); }} />
      </Card>
      <Sec>{t('gatesH')}</Sec>
      <Card>
        <Txt muted>{t('gatesNote')}</Txt>
        {GATES.map((g) => (
          <Row key={g.id}><View style={{ flex: 1 }}><Txt>{g.name}</Txt><Txt muted>{s.settings.gateOverrides[g.id] ? t('corrected') : t('approx')}</Txt></View>
            <Btn ghost title={saved === g.id ? '✓' : t('imHere')} onPress={async () => { const p = await currentPosition(); if (p) { await update((x) => { x.settings.gateOverrides[g.id] = p; }); setSaved(g.id); } }} /></Row>))}
      </Card>
      <Sec>{t('discH')}</Sec>
      <Card>
        <Row><Txt style={{ flex: 1 }}>{t('setDiscHome')}</Txt><Switch trackColor={{ true: c.sign }} value={s.settings.discHome} onValueChange={setSetting('discHome')} /></Row>
        <Row><Txt style={{ flex: 1 }}>{t('setDiscAfterPay')}</Txt><Switch trackColor={{ true: c.sign }} value={s.settings.discAfterPay} onValueChange={setSetting('discAfterPay')} /></Row>
        <Txt muted>{t('discHiddenNote')}</Txt>
      </Card>
      <Sec>{t('aboutH')}</Sec>
      <Card>
        <Txt>{t('privacyShort')}</Txt>
        <Btn ghost title={t('privacyLink')} onPress={() => Linking.openURL(PRIVACY_URL)} />
        <Btn ghost title={t('viewDisclaimer')} onPress={() => openDisclaimer()} />
      </Card>
    </Screen>
  );
}

// ---------- First launch
export function Onboarding({ onDone, onLang }) {
  const s = useStore(); const c = useTheme();
  const [notif, setNotif] = useState(false); const [loc, setLoc] = useState({ foreground: false, background: false }); const [asked, setAsked] = useState(false);
  const locDone = loc.background || (loc.foreground && loc.noBackground);
  return (
    <Screen>
      <Wrap>{LANGS.map(([k, n]) => <Chip key={k} title={n} on={(s.settings.lang || 'en') === k} onPress={() => onLang(k)} />)}</Wrap>
      <Txt bold size={28}>{t('welcomeT')}</Txt>
      <Txt size={17}>{t('welcomeB')}</Txt>
      <Card><Txt bold>{t('permNotifT')}</Txt><Txt muted>{t('permNotifB')}</Txt>
        <Btn title={notif ? t('allowed') + ' ✓' : t('allow')} disabled={notif} onPress={async () => { setNotif(await requestNotifPermission()); await setupCategories(); }} /></Card>
      <Card><Txt bold>{t('permLocT')}</Txt><Txt muted>{t('permLocB')}</Txt>
        <Btn title={locDone ? t('allowed') + ' ✓' : t('allow')} disabled={locDone} onPress={async () => { const r = await requestLocation(); setLoc(r); setAsked(true); if (r.background) startTracking(); }} />
        {asked && !loc.foreground ? <Warn>{t('locOffB')}</Warn> : loc.foreground && !locDone ? <Warn>{t('locLimitedB')}</Warn> : null}</Card>
      <Card>
        <Txt bold>{t('discTitle')}</Txt>
        <Txt>{t('disc1')}</Txt><Txt>{t('disc2')}</Txt><Txt bold color={c.red}>{t('disc3')}</Txt><Txt>{t('disc4')}</Txt>
      </Card>
      <Btn title={t('agreeStart')} onPress={onDone} />
    </Screen>
  );
}
