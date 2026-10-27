import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, Modal, Linking, Alert, AppState } from 'react-native';
import { useStore, update, newId } from './store';
import { t, emName, hrsOf, fmtDate, fmtTime, LANGS, getLang } from './i18n';
import { EMIRATES, EM_ORDER, ISSUERS, GATES, BRANDS, aed, buildSms, cleanCode, ZONE_RE, fineOffer, discounted, daysLeft,
  validateVehicle, parseDate, emirateAt, distanceM, crossingCharge, latinDigits, visibleCampaigns, campaignStatus, campaignEnd, PAY_URLS } from './data';
import { Card, Sec, Txt, Figure, Btn, Chip, Segmented, Toggle, Pill, List, ListRow, Field, Wrap, Notice, Warn, Plate, BrandBadge, Bubble, Progress, Icon,
  useTheme, styles, applyAppearance } from './ui';
import * as A from './actions';
import { currentPosition, requestLocation, locationStatus, startTracking } from './location';
import { requestNotifPermission, setupCategories } from './notify';
import { openDisclaimer } from './disclaimer';
import { refreshCampaigns, syncCampaignReminders } from './campaigns';

export const PRIVACY_URL = 'https://YOUR-SITE/privacy.html'; // replace after hosting privacy.html (see README)

// Screen header: big title, ⓘ (disclaimer) on every screen, settings gear or a back button.
function RoundBtn({ icon, label, onPress }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6}
      style={({ pressed }) => ({ width: 42, height: 42, borderRadius: 21, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <Icon name={icon} size={22} />
    </Pressable>
  );
}
function Title({ k, onSettings, onBack }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
      {onBack ? <RoundBtn icon="chevron-back" label="Back" onPress={onBack} /> : null}
      <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: c.fg, flex: 1 }]}>{t(k)}</Text>
      <RoundBtn icon="information-circle-outline" label={t('viewDisclaimer')} onPress={() => openDisclaimer()} />
      {onSettings ? <RoundBtn icon="settings-outline" label={t('settings')} onPress={onSettings} /> : null}
    </View>
  );
}

// Pinned on the home screen until hidden (Settings brings it back)
function DisclaimerCard() {
  const c = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Icon name="shield-checkmark-outline" size={20} color={c.red} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <Txt bold>{t('discTitle')}</Txt>
          <Txt size={14} color={c.red} bold>{t('disc3')}</Txt>
          <Txt size={14} muted>{t('disc4')}</Txt>
        </View>
      </View>
      <Wrap>
        <Btn ghost small title={t('viewDisclaimer')} onPress={() => openDisclaimer()} />
        <Btn plain small title={t('hideDisc')} onPress={() => Alert.alert(t('hideDisc') + '?', t('discHiddenNote'), [
          { text: t('cancel'), style: 'cancel' },
          { text: t('hideDisc'), onPress: () => update((x) => { x.settings.discHome = false; }) },
        ])} />
      </Wrap>
    </Card>
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

      <Card tone={s.parking?.status === 'awaiting' ? 'danger' : undefined}><ParkingStatus go={go} /></Card>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card onPress={() => go('salik')} style={{ flex: 1, minWidth: 0 }} tone={balTone}>
          <Txt muted size={13}>{t('estBalance')}</Txt>
          <Figure size={24} color={balTone === 'danger' ? c.red : balTone === 'warn' ? c.amber : c.fg}>{bal == null ? '—' : aed(bal)}</Figure>
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

function ParkingStatus({ go }) {
  const s = useStore(); const p = s.parking;
  if (!p) {
    return (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <ParkingMark />
          <View style={{ flex: 1, minWidth: 0 }}><Txt bold>{t('parking')}</Txt><Txt muted>{t('notParked')}</Txt></View>
        </View>
        <Btn icon="chatbubble-ellipses-outline" title={t('payBySms')} onPress={() => go('parking')} />
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ParkingMark />
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Txt bold>{t('parkedAt', { time: fmtTime(p.start), em: emName(p.em) })}</Txt>
          {p.status === 'paid' ? <Pill tone="ok" text={t('paidUntil', { time: fmtTime(p.until) })} /> : p.status === 'free' ? <Pill text={t('freeSpot')} /> : <Pill tone="danger" text={t('notPaid')} />}
        </View>
      </View>
      {p.zone ? <Txt muted>{p.zone}</Txt> : null}
      <Wrap>
        {p.status === 'awaiting' ? <><Btn small title={t('payNow')} onPress={() => go('parking')} /><Btn ghost small title={t('freeHere')} onPress={A.markFreeHere} /></> : null}
        {p.status === 'paid' ? <Btn ghost small title={t('extend')} onPress={() => go('parking')} /> : null}
        <Btn plain small title={t('removeTicket')} onPress={A.removeParkingTicket} />
      </Wrap>
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
      {s.parking ? <Card tone={s.parking.status === 'awaiting' ? 'danger' : undefined}><ParkingStatus go={go} /></Card> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
        <Icon name={detected ? 'navigate' : 'location-outline'} size={16} color={c.muted} />
        <Txt muted>{locating ? t('detecting') : !pos ? t('noLocation') : detected ? emName(em) + ' · ' + t('gps') : emName(em)}</Txt>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {EM_ORDER.map((k) => <Chip key={k} title={emName(k)} on={k === em} onPress={() => { setEm(k); const hs = EMIRATES[k].hours; if (hs && !hs.includes(hours)) setHours(hs[0]); }} />)}
      </ScrollView>

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
      {onMore ? <Btn plain small title={t('finesTitle')} icon="chevron-forward" onPress={onMore} />
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
        <Field label={t('violDate')} value={f.date} onChangeText={set('date')} placeholder="2026-10-27" />
        <Field label={t('note')} value={f.note} onChangeText={set('note')} maxLength={80} />
        <List><ListRow title={t('severe')} right={<Toggle label={t('severe')} value={f.severe} onValueChange={set('severe')} />} /></List>
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
  const balTone = bal == null ? null : bal < 0 ? 'danger' : bal < s.settings.low ? 'warn' : null;
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
      <Card tone={balTone}>
        <Txt muted size={13}>{t('estBalance')}</Txt>
        <Figure size={42} color={balTone === 'danger' ? c.red : balTone === 'warn' ? c.amber : c.fg}>{bal == null ? '—' : aed(bal)}</Figure>
        {balTone ? <Txt color={balTone === 'danger' ? c.red : c.amber}>{t(balTone === 'danger' ? 'balNeg' : 'balLow')}</Txt> : null}
        <Btn icon="card-outline" title={t('topUp')} onPress={A.topUpSalik} />
      </Card>
      <Card>
        <Field label={t('correctBal')} value={val} onChangeText={setVal} keyboardType="decimal-pad" placeholder="50.00" error={err ? t('balErr') : null} />
        <Btn ghost title={t('save')} onPress={saveBal} />
      </Card>
      <Sec action={<Btn plain small icon={adding ? 'close' : 'add'} title={t('addCrossing')} onPress={() => setAdding(!adding)} />}>{t('crossings')}</Sec>
      {adding ? <Card><Wrap>{GATES.map((g) => <Chip key={g.id} title={g.name} onPress={() => addCrossing(g)} />)}</Wrap></Card> : null}
      {list.length === 0 ? <Card><Txt muted>{t('noCrossings')}</Txt></Card> : (
        <List>{list.map((x) => (
          <ListRow key={x.id} icon="swap-horizontal" title={GATES.find((g) => g.id === x.gate)?.name || x.gate} sub={fmtDate(x.date) + ' · ' + fmtTime(x.date)}
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
              <Plate v={v} big />
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
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Field label={t('plateCode')} value={form.code} onChangeText={(v) => setForm({ ...form, code: v })} autoCapitalize="characters" maxLength={3} placeholder="A / 3" /></View>
            <View style={{ flex: 2 }}><Field label={t('plateNum')} value={form.num} onChangeText={(v) => setForm({ ...form, num: v })} keyboardType="number-pad" maxLength={5} placeholder="12345" /></View>
          </View>
          <Field label={t('colour')} value={form.color} onChangeText={(v) => setForm({ ...form, color: v })} maxLength={16} />
          {err ? <Txt color={c.red}>{t(err)}</Txt> : null}
          <Btn title={t('saveVeh')} onPress={save} />
          <Btn ghost title={t('cancel')} onPress={() => { setForm(null); setErr(null); }} />
        </Card>
      ) : <Btn icon="add" title={t('addVehBtn')} onPress={() => setForm({ brand: 'Toyota', model: '', em: 'SHJ', code: '', num: '', color: '' })} />}
    </Screen>
  );
}

// ---------- Settings
export function SettingsScreen({ go, onLang }) {
  const s = useStore();
  const [saved, setSaved] = useState(null);
  const setSetting = (k) => async (v) => { await update((x) => { x.settings[k] = v; }); if (k === 'remFines') { A.syncFineReminders(); syncCampaignReminders(); } };
  const toggleRow = (k, label) => <ListRow title={label} right={<Toggle label={label} value={s.settings[k]} onValueChange={setSetting(k)} />} />;
  return (
    <Screen>
      <Title k="settings" onBack={() => go('today')} />
      <Sec>{t('language')}</Sec>
      <Wrap>{LANGS.map(([k, n]) => <Chip key={k} title={n} on={(s.settings.lang || 'en') === k} onPress={() => onLang(k)} />)}</Wrap>
      <Sec>{t('appearanceH')}</Sec>
      <Segmented value={s.settings.appearance} onChange={(k) => { applyAppearance(k); setSetting('appearance')(k); }}
        options={['auto', 'light', 'dark'].map((k) => [k, t('look_' + k)])} />
      <LocationNotice />
      <Sec>{t('remindersH')}</Sec>
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
      <Sec>{t('freeSpots')}</Sec>
      <List>
        {s.freeSpots.map((f) => <ListRow key={f.id} icon="location-outline" title={f.name}
          right={<Btn plain small title={t('remove')} onPress={() => update((x) => { x.freeSpots = x.freeSpots.filter((y) => y.id !== f.id); })} />} />)}
        <ListRow icon="add" title={t('addFreeHere')} onPress={async () => { const p = await currentPosition(); if (p) update((x) => { x.freeSpots.push({ id: newId(), name: t('freeSpotName', { n: x.freeSpots.length + 1 }), ...p }); }); }} />
      </List>
      <Sec>{t('gatesH')}</Sec>
      <Txt muted size={13} style={{ paddingHorizontal: 4 }}>{t('gatesNote')}</Txt>
      <List>
        {GATES.map((g) => (
          <ListRow key={g.id} title={g.name} sub={s.settings.gateOverrides[g.id] ? t('corrected') : t('approx')}
            right={<Btn ghost small title={saved === g.id ? '✓' : t('imHere')} onPress={async () => { const p = await currentPosition(); if (p) { await update((x) => { x.settings.gateOverrides[g.id] = p; }); setSaved(g.id); } }} />} />))}
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

// ---------- First run
export function Onboarding({ onDone, onLang }) {
  const s = useStore(); const c = useTheme();
  const [notif, setNotif] = useState(false); const [loc, setLoc] = useState({ foreground: false, background: false }); const [asked, setAsked] = useState(false);
  const locDone = loc.background || (loc.foreground && loc.noBackground);
  return (
    <Screen>
      <Wrap>{LANGS.map(([k, n]) => <Chip key={k} title={n} on={(s.settings.lang || 'en') === k} onPress={() => onLang(k)} />)}</Wrap>
      <View style={{ gap: 10, marginVertical: 12 }}>
        <ParkingMark size={56} />
        <Txt bold size={30} style={{ letterSpacing: -0.5 }}>{t('welcomeT')}</Txt>
        <Txt size={17} muted>{t('welcomeB')}</Txt>
      </View>
      <List>
        <ListRow icon="notifications-outline" iconTone="info" title={t('permNotifT')} sub={t('permNotifB')}
          right={<Btn small ghost={notif} title={notif ? '✓' : t('allow')} disabled={notif} onPress={async () => { setNotif(await requestNotifPermission()); await setupCategories(); }} />} />
        <ListRow icon="location-outline" iconTone="info" title={t('permLocT')} sub={t('permLocB')}
          right={<Btn small ghost={locDone} title={locDone ? '✓' : t('allow')} disabled={locDone} onPress={async () => { const r = await requestLocation(); setLoc(r); setAsked(true); if (r.background) startTracking(); }} />} />
      </List>
      {asked && !loc.foreground ? <Warn>{t('locOffB')}</Warn> : loc.foreground && !locDone ? <Warn>{t('locLimitedB')}</Warn> : null}
      <Card>
        <Txt bold>{t('discTitle')}</Txt>
        <Txt size={14}>{t('disc1')}</Txt><Txt size={14}>{t('disc2')}</Txt><Txt size={14} bold color={c.red}>{t('disc3')}</Txt><Txt size={14}>{t('disc4')}</Txt>
      </Card>
      <Btn title={t('agreeStart')} onPress={onDone} />
    </Screen>
  );
}
