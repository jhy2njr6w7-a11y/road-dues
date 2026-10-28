# Parking+: build and publish from Windows

You don't need a Mac. Expo's cloud builds the iPhone and Android apps for you.

## What you need
- A Windows PC
- **Node.js LTS**: download from nodejs.org and install with the default options
- **A free Expo account**: expo.dev/signup
- **Apple Developer account** ($99/year) to put it on iPhones and the App Store: developer.apple.com/programs
- **Google Play Console account** ($25 once) for Android (optional)

## 1. Create the project (once)
Open **Command Prompt** and run these one by one:

```
npx create-expo-app@latest RoadDuesApp --template blank
cd RoadDuesApp
npx expo install expo-location expo-task-manager expo-notifications expo-sms expo-localization @react-native-async-storage/async-storage react-native-safe-area-context
```

`npx expo install` picks the versions that match your Expo SDK, so don't use plain `npm install` for these.

## 2. Copy in the Parking+ files
From this zip, copy into the `RoadDuesApp` folder and replace when asked:
- `App.js`
- `app.json`
- `eas.json`
- the whole `src` folder
- the `assets` folder

## 2b. Add the Arabic font (once)
Arabic text uses **Janna LT Bold**, a licensed font. It is not in GitHub (the repo is public), so copy your `Janna_LT_Bold.ttf` into the project as:
```
assets\fonts\JannaLT-Bold.ttf
```
Without it the app won't start. `eas build` includes it automatically (see `.easignore`). Make sure your Janna licence covers mobile apps.

## 3. Try it on your phone (Android, free)
```
npx expo start
```
Install **Expo Go** on an Android phone and scan the QR code. Screens, vehicles, fines and the SMS composer work here. Background location and notification buttons only work fully in a real build (step 4).

On iPhone, Expo Go is limited for background location. Use step 4 instead.

## 3b. Click through it in a browser (web preview)
```
npm install
npx expo start --web
```
Opens the app at http://localhost:8081. Screens, vehicles, fines, Salik balance, languages and the disclaimer all work. The phone-only parts are switched off on web: no notifications, no background GPS, and "Send SMS" just says the device can't send SMS (the message text is still shown). Location permission shows as allowed; the Parking screen uses the browser's location if you allow it.

To get static files you can host anywhere (Netlify Drop, GitHub Pages): `npm run build:web`, then upload the `dist` folder.

## 4. Real builds in Expo's cloud
```
npm install -g eas-cli
eas login
eas init
eas build --platform android --profile preview
```
`eas init` links the folder to your Expo account (it adds `extra.eas.projectId` to `app.json`; commit that). `eas.json` is already set up, so you don't need `eas build:configure`. The first Android build asks to create a signing keystore: answer Yes and let Expo keep it.

You get a link to an `.apk` file. Open it on an Android phone to install. After installing, allow notifications, and for location choose "Allow all the time" (Android shows it on a separate settings page).

For iPhone:
```
eas build --platform ios --profile production
```
EAS asks for your Apple ID and creates the certificates for you. The build takes about 15–30 minutes.

## 5. Publish
1. **Turn on the website (once):** on github.com open the repo ▸ **Settings** ▸ **Pages**. Under "Build and deployment" choose **Deploy from a branch**, branch **main**, folder **/docs**, then **Save**. After a minute the pages are live:
   - Privacy policy: https://jhy2njr6w7-a11y.github.io/road-dues/privacy.html (already linked in the app)
   - Support page: https://jhy2njr6w7-a11y.github.io/road-dues/
2. Put your contact email in `docs/privacy.html` and `docs/index.html` (replace `darbak9900@gmail.com`).
3. Submit:
   ```
   eas submit --platform ios
   eas submit --platform android
   ```
4. In App Store Connect and Play Console, paste the text from `STORE-LISTING.md` and upload the screenshots from `store/screenshots/`.

## Announcing a fine discount campaign
When police announce a discount (for example "50% off Sharjah fines until 31 December"), add it to `campaigns.json` in the GitHub repo. You can do this from your phone: open the file on github.com, tap the pencil, edit, then **Commit changes**. Phones pick it up within a few hours (or straight away with **Check now** on the Fines tab) and remind people on the start day, 3 days before the end and on the last day.

```json
{
  "campaigns": [
    {
      "id": "shj-2026-12",
      "iss": "shj",
      "pct": 50,
      "start": "2026-12-01",
      "end": "2026-12-31",
      "url": "https://link-to-the-official-announcement",
      "note": { "en": "Not for serious violations.", "ar": "لا يشمل المخالفات الجسيمة." }
    }
  ]
}
```
- `id`: any short unique name (letters, numbers, `-`). Never reuse one.
- `iss`: `dxb` Dubai Police, `adp` Abu Dhabi Police, `shj` Sharjah Police, `ajm` Ajman, `rak` RAK, `fuj` Fujairah, `uaq` UAQ, `moi` Ministry of Interior, `rta`, `parkin`.
- `pct`: whole number 1–100. Dates are `YYYY-MM-DD`; both days are included.
- `url` must start with `https://`. Optional `payUrl` if paying happens on a different page. `note` is optional, in any of `en`, `ar`, `hi`, `zh`, `ru`.
- A mistake (missing comma, bad date) makes that campaign, or the whole file, be ignored, so check it after saving: `npm test` validates `campaigns.json`.
- Remove campaigns after they end to keep the file short (ended ones are hidden anyway).

## Before you publish: check list
- **Drive-test it.** Correct the Salik gate positions with "I'm here" in Settings (as a passenger), then copy the corrected numbers into `GATES` in `src/data.js`.
- **Confirm the parking SMS formats** for each emirate with a real payment.
- **Get the translations checked.** Have native speakers review the Hindi, Chinese and Russian text in `src/i18n.js` and `src/i18n-extra.js`.
- **Run the logic tests** after any change to rules: `node tests/logic.test.mjs`.

## Where things are
| File | What it does |
|---|---|
| `src/data.js` | SMS formats, paid hours, Salik tariff and gates, fine discount rules, validation |
| `src/location.js` | Background GPS: Salik crossings and parking detection |
| `src/notify.js` | All notifications and their buttons |
| `src/actions.js` | Paying, SMS sending, marking paid |
| `src/screens.js` | All screens, the disclaimer sheet and onboarding |
| `src/i18n.js`, `src/i18n-extra.js` | Translations (5 languages) |

## How parking detection works
While you drive, each GPS update pushes a "Did you pay for parking?" notification 4 minutes into the future. When the car stops, the updates stop, so the notification fires. It only does this during the emirate's paid hours, and never within 150 m of a saved free spot. A long traffic jam can trigger it by mistake; tap "Free here" or ignore it.
