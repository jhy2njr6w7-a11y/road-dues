// Web preview: the browser's own date input stands in for the phone pickers.
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from './ui';

export function DateField({ label, value, onChange, minDate, maxDate }) {
  const c = useTheme();
  const ymd = (d) => (d ? d.toISOString().slice(0, 10) : undefined);
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600' }}>{label}</Text> : null}
      <input type="date" value={value || ''} min={ymd(minDate)} max={ymd(maxDate)} onChange={(e) => onChange(e.target.value)} aria-label={label}
        style={{ minHeight: 50, borderRadius: 12, border: 'none', padding: '0 14px', fontSize: 17, background: c.field, color: c.fg, colorScheme: c.dark ? 'dark' : 'light', fontFamily: 'inherit' }} />
    </View>
  );
}
