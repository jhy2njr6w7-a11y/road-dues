// UAE private number plates, long format (520 × 110 mm), one layout per emirate, drawn from photos of
// real plates. Emirate names are set in type (Arabic calligraphy / kufi fonts), not copied emblems.
// Plate is read-only; PlateInput puts text boxes where the code and number go.
import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';

// Loaded in App.js with expo-font; until then the system font is used.
export const PLATE_FONTS = {
  PlateDigits: require('@expo-google-fonts/barlow-condensed/600SemiBold/BarlowCondensed_600SemiBold.ttf'),
  PlateKufi: require('@expo-google-fonts/reem-kufi/600SemiBold/ReemKufi_600SemiBold.ttf'),
  PlateRuqaa: require('@expo-google-fonts/aref-ruqaa/700Bold/ArefRuqaa_700Bold.ttf'),
};

const INK = '#111111';
const BASE_W = 300; // design width at scale 1; height follows the real 520:110 ratio
const BASE_H = Math.round(BASE_W * 110 / 520);

const T = ({ k, size, font, color = INK, style, children, ...rest }) => (
  <Text maxFontSizeMultiplier={1} allowFontScaling={false} {...rest}
    style={[{ color, fontSize: size * k, fontFamily: font, includeFontPadding: false }, style]}>{children}</Text>
);
const Col = ({ children, style }) => <View style={[{ alignItems: 'center', justifyContent: 'center' }, style]}>{children}</View>;

// The UAE flag, as on Ajman plates
function Flag({ k }) {
  const h = 15 * k, w = 26 * k;
  return (
    <View style={{ flexDirection: 'row', width: w, height: h, borderRadius: 1.5 * k, overflow: 'hidden' }}>
      <View style={{ width: w * 0.26, backgroundColor: '#ce1126' }} />
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: '#00732f' }} />
        <View style={{ flex: 1, backgroundColor: '#ffffff', borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: '#d0d0d0' }} />
        <View style={{ flex: 1, backgroundColor: '#000000' }} />
      </View>
    </View>
  );
}

// slots: { code, num } are elements (text or inputs) sized by the caller
function layout(em, k, code, num) {
  const name = (ar, en, arFont, arSize, enSize, extra) => (
    <Col style={{ paddingHorizontal: 2 * k }}>
      <T k={k} size={arSize} font={arFont} style={{ lineHeight: arSize * 1.25 * k }}>{ar}</T>
      {en ? <T k={k} size={enSize} style={{ fontWeight: '800', letterSpacing: 0.6 * k }}>{en}</T> : null}
      {extra}
    </Col>
  );
  switch (em) {
    case 'AUH': // red block with the code, "الإمارات / أبوظبي / U.A.E A.D", number
      return (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'stretch' }}>
          <Col style={{ backgroundColor: '#d71920', width: 52 * k, marginStart: -2 * k, marginVertical: -2 * k, borderTopLeftRadius: 5 * k, borderBottomLeftRadius: 5 * k }}>{code('#ffffff')}</Col>
          <Col style={{ paddingHorizontal: 5 * k, alignItems: 'flex-start' }}>
            <T k={k} size={12} style={{ fontWeight: '800', lineHeight: 14 * k }}>الإمارات</T>
            <T k={k} size={12} style={{ fontWeight: '800', lineHeight: 14 * k }}>أبوظبي</T>
            <T k={k} size={8.5} style={{ fontWeight: '800', letterSpacing: 0.3 * k }}>U.A.E A.D</T>
          </Col>
          <Col style={{ flex: 1 }}>{num()}</Col>
        </View>
      );
    case 'DXB': // code, "دبي / DUBAI", number
      return <Row k={k}>{code()}{name('دبي', 'DUBAI', 'PlateKufi', 21, 12)}<Col style={{ flex: 1 }}>{num()}</Col></Row>;
    case 'SHJ': // vertical "UAE", code, "الشارقة / Sharjah", number
      return (
        <Row k={k}>
          <Col>{['U', 'A', 'E'].map((l) => <T key={l} k={k} size={8} style={{ fontWeight: '800', lineHeight: 9.5 * k }}>{l}</T>)}</Col>
          {code()}
          {name('الشارقة', 'Sharjah', 'PlateKufi', 18, 11.5)}
          <Col style={{ flex: 1 }}>{num()}</Col>
        </Row>
      );
    case 'AJM': // code, number, flag over "AJMAN"
      return (
        <Row k={k}>
          {code()}
          <Col style={{ flex: 1 }}>{num()}</Col>
          <Col style={{ gap: 3 * k }}><Flag k={k} /><T k={k} size={13} style={{ fontWeight: '900', letterSpacing: 0.8 * k }}>AJMAN</T></Col>
        </Row>
      );
    case 'UAQ': // code, "أم القيوين" in calligraphy, number
      return <Row k={k}>{code()}{name('أم القيوين', 'UMM AL QUWAIN', 'PlateRuqaa', 17, 5.5)}<Col style={{ flex: 1 }}>{num()}</Col></Row>;
    case 'RAK': // "رأس الخيمة" in calligraphy, code, number
      return <Row k={k}>{name('رأس الخيمة', null, 'PlateRuqaa', 21)}{code()}<Col style={{ flex: 1 }}>{num()}</Col></Row>;
    case 'FUJ': // code, "الفجيرة / FUJAIRAH / U.A.E", number
      return (
        <Row k={k}>
          {code()}
          {name('الفجيرة', 'FUJAIRAH', 'PlateRuqaa', 22, 6, <T k={k} size={8.5} style={{ fontWeight: '800', letterSpacing: 1 * k }}>U.A.E</T>)}
          <Col style={{ flex: 1 }}>{num()}</Col>
        </Row>
      );
    default:
      return <Row k={k}>{code()}<Col style={{ flex: 1 }}>{num()}</Col></Row>;
  }
}
const Row = ({ k, children }) => <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 * k, paddingHorizontal: 8 * k }}>{children}</View>;

function Frame({ k, children, label }) {
  return (
    <View accessible={!!label} accessibilityLabel={label}
      style={{ direction: 'ltr', width: BASE_W * k, height: BASE_H * k, backgroundColor: '#f8f8f6', borderWidth: Math.max(1.5, 2.2 * k), borderColor: INK,
        borderRadius: 7 * k, overflow: 'hidden', alignSelf: 'flex-start' }}>
      {children}
    </View>
  );
}

const codeStyle = (k, color = INK) => ({ color, fontSize: 46 * k, fontFamily: 'PlateDigits', includeFontPadding: false, textAlign: 'center' });
const numStyle = (k) => ({ color: INK, fontSize: 54 * k, fontFamily: 'PlateDigits', includeFontPadding: false, letterSpacing: 1.5 * k, textAlign: 'center' });

/** Read-only plate. width in points (default 200). */
export function Plate({ v, width = 200 }) {
  const k = width / BASE_W;
  return (
    <Frame k={k} label={`${v.em} ${v.code} ${v.num}`}>
      {layout(v.em, k,
        (color) => <Text allowFontScaling={false} style={codeStyle(k, color)}>{v.code}</Text>,
        () => <Text allowFontScaling={false} numberOfLines={1} adjustsFontSizeToFit style={numStyle(k)}>{v.num}</Text>)}
    </Frame>
  );
}

/** A plate to type into; fills the available width (up to 360). */
export function PlateInput({ em, code, num, onCode, onNum, codeLabel, numLabel, error, errorColor }) {
  const [w, setW] = useState(0);
  const k = Math.min(w, 360) / BASE_W;
  const line = { borderBottomWidth: 1.5, borderColor: '#b8bdc4', paddingVertical: 0, paddingHorizontal: 0, outlineWidth: 0, outlineStyle: 'none' };
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ gap: 6, alignItems: 'center' }}>
      {w ? (
        <Frame k={k}>
          {layout(em, k,
            (color) => <TextInput accessibilityLabel={codeLabel} value={code} onChangeText={onCode} placeholder={em === 'AUH' || em === 'SHJ' ? '1' : 'A'}
              placeholderTextColor={color ? 'rgba(255,255,255,0.55)' : '#b8bdc4'} autoCapitalize="characters" autoCorrect={false} maxLength={3} allowFontScaling={false}
              style={[codeStyle(k, color), line, { width: 42 * k, borderColor: color ? 'rgba(255,255,255,0.6)' : '#b8bdc4' }]} />,
            () => <TextInput accessibilityLabel={numLabel} value={num} onChangeText={onNum} placeholder="12345" placeholderTextColor="#b8bdc4"
              keyboardType="number-pad" maxLength={5} allowFontScaling={false} style={[numStyle(k), line, { width: '92%' }]} />)}
        </Frame>
      ) : <View style={{ height: BASE_H }} />}
      {error ? <Text style={{ color: errorColor, fontSize: 13 }}>{error}</Text> : null}
    </View>
  );
}
