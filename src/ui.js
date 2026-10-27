// Shared look. Neutral ink-and-paper surfaces; colour is kept for meaning (paid, due, overdue, info),
// so whatever needs attention stands out. Light and dark themes; RTL-aware building blocks.
import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, useColorScheme, Appearance } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { brandColor, brandMark } from './data';
import { useStore } from './store';
import { haptic } from './haptics';

const LIGHT = {
  dark: false, bg: '#f2f3f5', card: '#ffffff', field: '#e8eaee', fg: '#0e1116', muted: '#646b76', line: '#e3e6ea',
  primary: '#0e1116', onPrimary: '#ffffff', chip: '#e9ebee',
  ok: '#15803d', okBg: '#e6f4ea', amber: '#a15c07', amberBg: '#fcf1de', red: '#c62828', redBg: '#fdeaea', info: '#1d4ed8', infoBg: '#e8eefc',
  bubble: '#1a66cc',
};
const DARK = {
  dark: true, bg: '#0b0d10', card: '#16191d', field: '#1f2328', fg: '#f2f4f7', muted: '#9aa1ab', line: '#272c32',
  primary: '#f2f4f7', onPrimary: '#0b0d10', chip: '#22262c',
  ok: '#4ade80', okBg: '#11261a', amber: '#fbbf24', amberBg: '#2a2110', red: '#f87171', redBg: '#2c1616', info: '#93b4ff', infoBg: '#152038',
  bubble: '#1a66cc',
};
// Older screens refer to the accent as sign/signText; keep those names pointing at the ink colour.
LIGHT.sign = LIGHT.primary; LIGHT.signText = LIGHT.fg; DARK.sign = DARK.primary; DARK.signText = DARK.fg;

/** Settings ▸ Appearance: 'auto' follows the phone, or force 'light' / 'dark'. */
export function useTheme() {
  const system = useColorScheme();
  const { appearance = 'auto' } = useStore().settings;
  return (appearance === 'auto' ? system : appearance) === 'dark' ? DARK : LIGHT;
}
/** Also switches native parts (alerts, keyboard) to the chosen appearance. */
export function applyAppearance(mode) {
  if (typeof Appearance.setColorScheme === 'function') Appearance.setColorScheme(mode === 'light' || mode === 'dark' ? mode : 'unspecified');
}
export const useRtl = () => useStore().settings.lang === 'ar';

const TONES = { ok: ['ok', 'okBg'], warn: ['amber', 'amberBg'], danger: ['red', 'redBg'], info: ['info', 'infoBg'] };
const tone = (c, k) => (TONES[k] ? { fg: c[TONES[k][0]], bg: c[TONES[k][1]] } : { fg: c.fg, bg: c.chip });

/** Ionicons; arrows and chevrons mirror in Arabic. */
export function Icon({ name, size = 20, color, style }) {
  const c = useTheme(); const rtl = useRtl();
  const flip = rtl && /chevron|arrow|open-outline/.test(name);
  return <Ionicons name={name} size={size} color={color || c.fg} style={[flip ? { transform: [{ scaleX: -1 }] } : null, style]} />;
}

export function Card({ children, style, tone: tn, onPress }) {
  const c = useTheme();
  const box = [{ backgroundColor: tn ? tone(c, tn).bg : c.card, borderRadius: 20, padding: 16, gap: 12 }, style];
  if (!onPress) return <View style={box}>{children}</View>;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [box, pressed && { opacity: 0.85 }]}>{children}</Pressable>;
}
/** Section heading between cards. `action` is an optional plain button on the other side. */
export function Sec({ children, action }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingHorizontal: 4 }}>
      <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '700', color: c.fg, flexShrink: 1 }}>{children}</Text>
      {action || null}
    </View>
  );
}
export function Txt({ children, muted, color, bold, size = 15, style, ...rest }) {
  const c = useTheme();
  return <Text {...rest} style={[{ color: color || (muted ? c.muted : c.fg), fontSize: muted ? Math.min(size, 14) : size, fontWeight: bold ? '700' : '400', lineHeight: Math.round(size * 1.4) }, style]}>{children}</Text>;
}
/** Big figures (balance, percent). Digits line up. */
export function Figure({ children, size = 34, color, style }) {
  const c = useTheme();
  return <Text maxFontSizeMultiplier={1.3} style={[{ color: color || c.fg, fontSize: size, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'] }, style]}>{children}</Text>;
}

/** primary (filled), ghost (soft grey), plain (text only), danger. */
export function Btn({ title, onPress, ghost, plain, danger, disabled, icon, iconEnd, small, style }) {
  const c = useTheme();
  const bg = danger ? c.red : plain ? 'transparent' : ghost ? c.chip : c.primary;
  const fg = danger ? '#ffffff' : plain || ghost ? c.fg : c.onPrimary;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={(e) => { haptic(); onPress?.(e); }} hitSlop={plain ? 8 : 0}
      style={({ pressed }) => [{ minHeight: small ? 40 : 50, paddingHorizontal: plain ? 4 : small ? 14 : 18, borderRadius: 14, backgroundColor: bg,
        flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }] }, style]}>
      {icon ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text maxFontSizeMultiplier={1.6} style={{ color: fg, fontWeight: '700', fontSize: small ? 14 : 16, textAlign: 'center', flexShrink: 1 }}>{title}</Text>
      {iconEnd ? <Icon name={iconEnd} size={small ? 16 : 18} color={fg} /> : null}
    </Pressable>
  );
}
export function Chip({ title, on, onPress }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={() => { haptic('select'); onPress?.(); }}
      style={({ pressed }) => ({ minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', backgroundColor: on ? c.primary : c.chip, opacity: pressed ? 0.75 : 1 })}>
      <Text maxFontSizeMultiplier={1.6} style={{ color: on ? c.onPrimary : c.fg, fontWeight: '600', fontSize: 14 }}>{title}</Text>
    </Pressable>
  );
}
/** One choice out of a few, side by side (appearance, duration, parking type). */
export function Segmented({ options, value, onChange }) {
  const c = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: c.chip, borderRadius: 14, padding: 3 }}>
      {options.map(([k, label]) => { const on = k === value;
        return (
          <Pressable key={k} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { if (!on) haptic('select'); onChange(k); }}
            style={{ flex: 1, minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: on ? c.card : 'transparent' }}>
            <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={{ color: on ? c.fg : c.muted, fontWeight: on ? '700' : '600', fontSize: 14 }}>{label}</Text>
          </Pressable>); })}
    </View>
  );
}
/** On/off switch drawn by the app, so it lines up the same way in English and Arabic on every platform. */
export function Toggle({ value, onValueChange, label }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: !!value }} onPress={() => { haptic('select'); onValueChange(!value); }} hitSlop={8}
      style={{ width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: value ? c.ok : c.line, alignItems: value ? 'flex-end' : 'flex-start', justifyContent: 'center' }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 }} />
    </Pressable>
  );
}
/** A small coloured label: Paid, Not paid, 2 days left. */
export function Pill({ text, tone: tn }) {
  const c = useTheme(); const { fg, bg } = tone(c, tn);
  return <View style={{ alignSelf: 'flex-start', backgroundColor: bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}><Text maxFontSizeMultiplier={1.5} style={{ color: fg, fontWeight: '700', fontSize: 12 }}>{text}</Text></View>;
}
/** Rows inside one card, separated by hairlines (settings, lists). */
export function List({ children }) {
  const c = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={{ backgroundColor: c.card, borderRadius: 20, overflow: 'hidden' }}>
      {rows.map((r, i) => <React.Fragment key={i}>{i ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginStart: 16 }} /> : null}{r}</React.Fragment>)}
    </View>
  );
}
export function ListRow({ icon, iconTone, title, sub, right, onPress, chevron }) {
  const c = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, paddingStart: icon ? 12 : 0, paddingEnd: 16 }}>
      {icon ? <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: tone(c, iconTone).bg, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={19} color={tone(c, iconTone).fg} /></View> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt>{title}</Txt>
        {sub ? <Txt muted size={13}>{sub}</Txt> : null}
      </View>
      {right || null}
      {chevron ? <Icon name="chevron-forward" size={18} color={c.muted} /> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ backgroundColor: pressed ? c.chip : 'transparent' })}>{body}</Pressable>;
}
export function Field({ label, error, ...props }) {
  const c = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600' }}>{label}</Text> : null}
      <TextInput placeholderTextColor={c.muted} {...props}
        style={[{ borderWidth: 1.5, borderColor: error ? c.red : 'transparent', borderRadius: 12, paddingHorizontal: 14, minHeight: 50, color: c.fg, backgroundColor: c.field, fontSize: 17 }, props.style]} />
      {error ? <Text style={{ color: c.red, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}
export function Row({ children, style }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, style]}>{children}</View>;
}
export function Wrap({ children, style }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}>{children}</View>;
}
/** Coloured notice with an icon. Plain text children, or anything. */
export function Notice({ tone: tn = 'warn', icon = 'alert-circle', title, children }) {
  const c = useTheme(); const { fg, bg } = tone(c, tn);
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: bg, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10 }}>
      <Icon name={icon} size={20} color={fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        {title ? <Txt bold>{title}</Txt> : null}
        {typeof children === 'string' ? <Txt size={14}>{children}</Txt> : children}
      </View>
    </View>
  );
}
export const Warn = ({ children }) => <Notice>{children}</Notice>;

export function BrandBadge({ brand, size = 44 }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: brandColor(brand), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.36 }}>{brandMark(brand)}</Text>
    </View>
  );
}
export function Bubble({ text }) {
  const c = useTheme();
  return (
    <View style={{ alignSelf: 'flex-end', backgroundColor: c.bubble, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10, direction: 'ltr' }}>
      <Text selectable style={{ color: '#fff', fontFamily: 'Courier', fontSize: 16, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}
/** Thin bar for time passed in a campaign. */
export function Progress({ value, color }) {
  const c = useTheme();
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: c.line, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, height: 6, borderRadius: 3, backgroundColor: color || c.fg }} />
    </View>
  );
}
export const styles = StyleSheet.create({
  screen: { paddingHorizontal: 16, paddingTop: 8, gap: 12, paddingBottom: 40 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
});
