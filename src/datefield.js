// Date field with the phone's own picker: a calendar under the field on iPhone, the system dialog on Android.
// Values are 'YYYY-MM-DD' strings ('' = empty), the same format parseDate() checks.
import React, { useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useTheme, Icon } from './ui';
import { getLang, LOCALE } from './i18n';
import { parseDate } from './data';

const pad = (n) => String(n).padStart(2, '0');
export const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function DateField({ label, value, onChange, minDate, maxDate, placeholder, clearable }) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const date = value ? parseDate(value) : null;
  const shown = date ? date.toLocaleDateString(LOCALE[getLang()], { day: 'numeric', month: 'long', year: 'numeric' }) : placeholder || '';
  function press() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: date || maxDate || new Date(), mode: 'date', minimumDate: minDate, maximumDate: maxDate,
        onChange: (e, d) => { if (e.type === 'set' && d) onChange(toYmd(d)); } });
    } else setOpen(!open);
  }
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={{ color: c.muted, fontSize: 13, fontWeight: '600' }}>{label}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={press}
          style={{ flex: 1, minHeight: 50, borderRadius: 12, paddingHorizontal: 14, backgroundColor: c.field, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="calendar-outline" size={18} color={c.muted} />
          <Text style={{ fontSize: 17, color: date ? c.fg : c.muted, flex: 1 }}>{shown}</Text>
        </Pressable>
        {clearable && date ? <Pressable accessibilityRole="button" accessibilityLabel="Clear" hitSlop={8} onPress={() => { onChange(''); setOpen(false); }}>
          <Icon name="close-circle" size={22} color={c.muted} /></Pressable> : null}
      </View>
      {open ? <DateTimePicker value={date || maxDate || new Date()} mode="date" display="inline" minimumDate={minDate} maximumDate={maxDate}
        locale={LOCALE[getLang()]} themeVariant={c.dark ? 'dark' : 'light'} accentColor={c.fg}
        onChange={(e, d) => { if (d) { onChange(toYmd(d)); setOpen(false); } }} /> : null}
    </View>
  );
}
