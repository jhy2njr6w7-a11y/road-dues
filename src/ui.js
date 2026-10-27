// Shared look: UAE road-sign green, light and dark themes, components used by every screen.
import React from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, useColorScheme, Appearance } from 'react-native';
import { brandColor, brandMark } from './data';
import { useStore } from './store';

const LIGHT = { dark: false, bg: '#f4f7f6', card: '#ffffff', fg: '#13201e', muted: '#5d6d69', line: '#dbe3e0', sign: '#0b6b56', signText: '#0b6b56', signFg: '#ffffff', amber: '#8f5300', red: '#b3261e', ok: '#1d7a4b', chip: '#e6eeeb', bubble: '#1a66cc' };
const DARK = { dark: true, bg: '#101817', card: '#18221f', fg: '#e3ebe9', muted: '#93a39f', line: '#26332f', sign: '#0f6e5a', signText: '#3fb896', signFg: '#ffffff', amber: '#e6a33c', red: '#f07167', ok: '#4cc38a', chip: '#1f2b28', bubble: '#1a66cc' };

// Accent colours to try out (temporary: Settings ▸ App colour). sign = button fill (white text on it),
// signText = accent text on the page. Once one is chosen, put it in LIGHT/DARK and remove this list.
export const ACCENTS = [
  { key: 'green', name: 'Road-sign green', light: ['#0b6b56', '#0b6b56'], dark: ['#0f6e5a', '#3fb896'] },
  { key: 'teal', name: 'Gulf teal', light: ['#0e6f7d', '#0e6f7d'], dark: ['#127a89', '#5cc7d6'] },
  { key: 'blue', name: 'Blue', light: ['#1f5fbf', '#1f5fbf'], dark: ['#2a6fd6', '#7fb0ff'] },
  { key: 'navy', name: 'Navy', light: ['#1d3557', '#1d3557'], dark: ['#2c4f80', '#9db8e0'] },
  { key: 'purple', name: 'Purple', light: ['#5b3fb5', '#5b3fb5'], dark: ['#6a4fc8', '#b4a2ff'] },
  { key: 'maroon', name: 'Maroon', light: ['#8c1d2c', '#8c1d2c'], dark: ['#a32638', '#ff8a99'] },
  { key: 'orange', name: 'Burnt orange', light: ['#b04a12', '#b04a12'], dark: ['#c0561a', '#ff9e66'] },
  { key: 'gold', name: 'Desert gold', light: ['#8a5a00', '#8a5a00'], dark: ['#9a6a10', '#e6b34d'] },
  { key: 'graphite', name: 'Graphite', light: ['#2f3a40', '#2f3a40'], dark: ['#46545b', '#b9c6cc'] },
];

const cache = {};
function themeFor(dark, accentKey) {
  const id = (dark ? 'd-' : 'l-') + accentKey;
  if (!cache[id]) {
    const a = ACCENTS.find((x) => x.key === accentKey) || ACCENTS[0];
    const [sign, signText] = dark ? a.dark : a.light;
    cache[id] = { ...(dark ? DARK : LIGHT), sign, signText };
  }
  return cache[id];
}

/** Settings ▸ Appearance: 'auto' follows the phone, or force 'light' / 'dark'. */
export function useTheme() {
  const system = useColorScheme();
  const { appearance = 'auto', accent = 'green' } = useStore().settings;
  return themeFor((appearance === 'auto' ? system : appearance) === 'dark', accent);
}
/** Also switches native parts (alerts, keyboard, date pickers) to the chosen appearance. */
export function applyAppearance(mode) {
  if (typeof Appearance.setColorScheme === 'function') Appearance.setColorScheme(mode === 'light' || mode === 'dark' ? mode : 'unspecified');
}

export function Card({ children, style }) {
  const c = useTheme();
  return <View style={[{ backgroundColor: c.card, borderRadius: 14, padding: 14, gap: 10 }, style]}>{children}</View>;
}
export function Sec({ children }) {
  const c = useTheme();
  return <Text style={{ fontSize: 13, fontWeight: '600', color: c.muted, marginTop: 6, marginHorizontal: 4, textTransform: 'uppercase' }}>{children}</Text>;
}
export function Txt({ children, muted, color, bold, size = 15, style, ...rest }) {
  const c = useTheme();
  return <Text {...rest} style={[{ color: color || (muted ? c.muted : c.fg), fontSize: muted ? Math.min(size, 14) : size, fontWeight: bold ? '700' : '400' }, style]}>{children}</Text>;
}
export function Btn({ title, onPress, ghost, danger, disabled, style }) {
  const c = useTheme();
  const bg = danger ? c.red : ghost ? c.chip : c.sign;
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => [{ minHeight: 46, paddingHorizontal: 16, borderRadius: 12, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', opacity: disabled ? 0.45 : pressed ? 0.8 : 1 }, style]}>
      <Text style={{ color: ghost ? c.fg : '#fff', fontWeight: '700', fontSize: 15, textAlign: 'center' }}>{title}</Text>
    </Pressable>
  );
}
export function Chip({ title, on, onPress }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress}
      style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center', borderWidth: 1, borderColor: on ? c.sign : c.line, backgroundColor: on ? c.sign : c.card }}>
      <Text style={{ color: on ? '#fff' : c.fg, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}
export function Field({ label, error, ...props }) {
  const c = useTheme();
  return (
    <View style={{ gap: 4 }}>
      {label ? <Text style={{ color: c.muted, fontSize: 13, fontWeight: '500' }}>{label}</Text> : null}
      <TextInput placeholderTextColor={c.muted} {...props}
        style={[{ borderWidth: 1, borderColor: error ? c.red : c.line, borderRadius: 10, paddingHorizontal: 12, minHeight: 46, color: c.fg, backgroundColor: c.bg, fontSize: 16 }, props.style]} />
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
export function Warn({ children }) {
  const c = useTheme();
  return <View style={{ backgroundColor: c.amber + '22', borderRadius: 10, padding: 10 }}><Txt size={14}>{children}</Txt></View>;
}
export function Plate({ v }) {
  return (
    <View style={{ flexDirection: 'row', alignSelf: 'flex-start', borderWidth: 1.5, borderColor: '#111', borderRadius: 5, overflow: 'hidden', direction: 'ltr' }}>
      <Text style={{ backgroundColor: '#e3e7e6', color: '#111', paddingHorizontal: 6, fontWeight: '700', borderRightWidth: 1.5, borderColor: '#111' }}>{v.em}</Text>
      <Text style={{ backgroundColor: '#fff', color: '#111', paddingHorizontal: 6, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{v.code} {v.num}</Text>
    </View>
  );
}
export function BrandBadge({ brand, size = 44 }) {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: size, height: size, borderRadius: 12, backgroundColor: brandColor(brand), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{brandMark(brand)}</Text>
    </View>
  );
}
export function Bubble({ text }) {
  const c = useTheme();
  return (
    <View style={{ alignSelf: 'flex-end', backgroundColor: c.bubble, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, direction: 'ltr' }}>
      <Text selectable style={{ color: '#fff', fontFamily: 'Courier', fontSize: 15, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}
export const styles = StyleSheet.create({
  screen: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 30, fontWeight: '800' },
});
