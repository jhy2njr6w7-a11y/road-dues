# Road Dues: project notes for Claude Code

Owner: Saif (UAE, Kalba). Works on a **Windows PC, no Mac**. Prefers concise, direct answers.
This project was designed in a claude.ai chat. The chat could not install packages or build, so **nothing here has been run in a real Expo project yet**. That is the first job.

## What the app is
A free iPhone + Android app (Expo / React Native, JavaScript) for UAE drivers:
- **Parking:** detects when the car stops during paid hours and asks "Did you pay for parking?". It builds the official parking SMS for the emirate the car is in and opens the Messages composer pre-filled. The user taps Send.
- **Salik:** detects toll-gate crossings by GPS, charges the 2026 tariff, keeps an estimated balance the user entered, warns when low or negative.
- **Fines:** user enters fines; reminders 7 days and 1 day before an early-payment discount ends.
- **Vehicles:** several cars, one default; brand shown as a coloured initials badge (no real brand logos: trademark).
- **Languages:** English, Arabic (RTL), Hindi, Chinese (Simplified), Russian.
- **Privacy:** all data on the device (AsyncStorage). No server, no accounts, no analytics.
- **Payments:** the app never takes payments. Buttons open official sites; parking goes by SMS. In-app payment would need a licensed partner and a UAE trade license (out of scope).

## Decisions already made (keep them)
| Topic | Decision |
|---|---|
| Parking SMS | Dubai 7275 `A12345 335A 2` (Dubai plate) / `SHJ3 12345 335A 1` (other plates); Sharjah 5566 `SHJ 12345 2` (1,2,3,5 h); Abu Dhabi 3009 `AUH 1 12345 S 2` (S/P); Ajman 5155 `AJM B 12345`; RAK 7275 marked **unverified**; Fujairah and UAQ: no SMS, point to meter/app |
| Paid hours | DXB Mon–Sat 08–22; SHJ Sat–Thu 08–22; AUH 08–24 (free Sun); AJM Sat–Thu 08–13 & 17–22; others unknown → always ask |
| Salik | AED 6.30 peak (Mon–Sat 06–10, 16–20), 4.20 off-peak and Sunday, free 01–06; 1-hour pair rule for Safa N/S and Mamzar N/S; ignore same gate within 10 min. Ramadan schedule not implemented |
| Fine discounts | Abu Dhabi and Sharjah: 35% within 60 days, 25% within a year, not for serious violations. Dubai: no built-in rule; user enters the discount shown in the official app |
| Parking detection | While moving (speed ≥ 6 m/s) every GPS update reschedules a notification 4 min ahead; when the car stops the updates stop and it fires. Skipped near saved free spots (150 m) and outside paid hours |
| Disclaimer | Own wording (not copied from another app). Pinned card on home (hideable), ⓘ button on every screen, shown before fine/Salik payments and after parking SMS, with "Don't show this again"; Settings toggles bring it back. Red line = disc3 |
| Location off | Notice on Today/Parking/Salik/Settings listing what won't work; "While Using" gets a softer notice asking for "Always" |
| Validation | Plate code 1–3 A–Z/0–9 required; plate number 1–5 digits; Arabic-Indic digits converted; zone code `^\d{2,4}[A-Z]?$`; balance 0–5000 |

## Files
| File | Purpose |
|---|---|
| `App.js` | Startup, language, tab bar, notification button handling, global disclaimer sheet |
| `src/data.js` | All rules (pure functions): SMS formats, paid hours, emirate from GPS, Salik tariff/gates, discounts, validation |
| `src/location.js` | Background GPS task: gate crossings + parking check |
| `src/notify.js` | Notification categories/buttons and scheduling |
| `src/actions.js` | Pay fine, top up, send SMS, mark paid, free spot (wraps payments in the disclaimer) |
| `src/screens.js` | All screens, disclaimer sheet/card, location notice, onboarding |
| `src/i18n.js`, `src/i18n-extra.js` | Translations; every key must exist in all 5 languages with the same `{placeholders}` |
| `src/store.js` | AsyncStorage state shared by UI and background task |
| `tests/logic.test.mjs` | `node tests/logic.test.mjs`: 900+ checks of rules and translations. Run after any rule or string change |
| `privacy.html`, `STORE-LISTING.md`, `README.md` | Privacy policy, store text + App Review notes, Windows build guide |

## First tasks (what the chat could not do)
1. Create the Expo project per `README.md` steps 1–2 (`npx create-expo-app@latest`, then `npx expo install expo-location expo-task-manager expo-notifications expo-sms expo-localization @react-native-async-storage/async-storage react-native-safe-area-context`) and move these files in. Or convert this folder into that project directly.
2. Run `npx expo start` / `npx expo export` and **fix every error**. APIs most likely to need adjusting for the installed SDK: `Notifications.setNotificationHandler` fields, `SchedulableTriggerInputTypes`, `textInput` on category actions, `Location.startLocationUpdatesAsync` options.
3. Run `node tests/logic.test.mjs`; keep it passing.
4. Add a web preview if useful (`npx expo start --web`) so Saif can click through it in a browser.
5. Set up EAS (`eas build:configure`) and get an Android preview `.apk` building. iOS build needs Saif's Apple Developer account ($99/yr).
6. Review for real-device issues: background location on Android 14+ (foreground service type), iOS "Always" upgrade flow, notification permission on Android 13+.

## Open items for Saif (before publishing)
- Drive-test and correct Salik gate coordinates (Settings ▸ "I'm here"), then copy into `GATES` in `src/data.js`.
- Confirm SMS formats with real payments, especially RAK.
- Native-speaker review of Hindi, Chinese, Russian.
- Host `privacy.html`, add his email, put the URL in `PRIVACY_URL` in `src/screens.js`.
- Not legal advice: free app needs no government permission; earning money (ads/subscriptions) usually needs a UAE freelance/trade license; never use Salik/RTA/police logos.

## Related
A clickable web demo of the same app exists as a claude.ai artifact ("Road Dues Demo"). It mirrors these features and was used for testing with 100 simulated users and 5 persona testers.
