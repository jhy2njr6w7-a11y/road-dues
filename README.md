# Road Dues: build and publish from Windows

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

## 2. Copy in the Road Dues files
From this zip, copy into the `RoadDuesApp` folder and replace when asked:
- `App.js`
- `app.json`
- `eas.json`
- the whole `src` folder
- the `assets` folder

## 3. Try it on your phone (Android, free)
```
npx expo start
```
Install **Expo Go** on an Android phone and scan the QR code. Screens, vehicles, fines and the SMS composer work here. Background location and notification buttons only work fully in a real build (step 4).

On iPhone, Expo Go is limited for background location. Use step 4 instead.

## 4. Real builds in Expo's cloud
```
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```
You get a link to an `.apk` file. Open it on an Android phone to install.

For iPhone:
```
eas build --platform ios --profile production
```
EAS asks for your Apple ID and creates the certificates for you. The build takes about 15–30 minutes.

## 5. Publish
1. Host `privacy.html` online. GitHub Pages or Netlify Drop (drag and drop, free) both work. Put your email in it first.
2. In `src/screens.js`, replace `https://YOUR-SITE/privacy.html` with your link, then build again.
3. Submit:
   ```
   eas submit --platform ios
   eas submit --platform android
   ```
4. In App Store Connect and Play Console, paste the text from `STORE-LISTING.md`, add screenshots, and send for review.

## Before you publish: check list
- **Drive-test it.** Correct the Salik gate positions with "I'm here" in Settings (as a passenger), then copy the corrected numbers into `GATES` in `src/data.js`.
- **Confirm the parking SMS formats** for each emirate with a real payment, especially Ras Al Khaimah, which is marked unverified.
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
