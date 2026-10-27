# App Store / Google Play listing text

## Name
Road Dues

## Subtitle (30 characters max)
Parking, Salik & fine reminders

## Description
Road Dues reminds UAE drivers before they get fined or miss a discount.

- Parking: notices when you park during paid hours and prepares the parking SMS for Dubai, Sharjah, Abu Dhabi, Ajman and Ras Al Khaimah. You review it and tap Send.
- Salik: detects gate crossings, keeps an estimate of your balance and warns you before it runs out.
- Fine discounts: tells you when police announce a fine discount campaign and reminds you before it ends. You can also track your own fines and their early-payment discounts.
- Vehicles: save all your cars and pick which one you are driving.
- Languages: English, Arabic, Hindi, Chinese and Russian.
- Private: everything stays on your phone. No account, no ads, no tracking.

DISCLAIMER: Road Dues is an unofficial app and is not affiliated with Salik, RTA, Parkin, any municipality or UAE police. Payments are made through official channels. Always check the confirmation SMS from the parking authority and the parking signs. Rates and rules can change.

## Links
- Privacy policy: https://jhy2njr6w7-a11y.github.io/road-dues/privacy.html
- Support: https://jhy2njr6w7-a11y.github.io/road-dues/

## Arabic listing
**Name:** رسوم الطريق
**Subtitle:** تذكير المواقف وسالك والمخالفات
**Description:**
رسوم الطريق يذكّر السائقين في الإمارات قبل أن تصلهم مخالفة أو يفوتهم خصم.
- المواقف: يلاحظ وقوفك خلال ساعات الدفع ويجهّز رسالة دفع الموقف لدبي والشارقة وأبوظبي وعجمان ورأس الخيمة. تراجعها ثم تضغط إرسال.
- سالك: يرصد العبور من البوابات ويقدّر رصيدك وينبهك قبل أن ينفد.
- تخفيضات المخالفات: ينبهك عند إعلان الشرطة حملة تخفيض ويذكّرك قبل انتهائها.
- خصوصية: كل بياناتك تبقى على هاتفك. بدون حساب أو إعلانات أو تتبع.
إخلاء مسؤولية: رسوم الطريق تطبيق غير رسمي ولا يتبع سالك أو هيئة الطرق والمواصلات أو باركن أو أي بلدية أو شرطة. تحقق دائمًا من رسالة التأكيد ومن لوحات المواقف.

## Keywords
parking,salik,uae,dubai,sharjah,abu dhabi,fines,toll,sms parking,rta

## App Review notes (paste into "Notes for review")
Road Dues uses background location for two features: detecting when the user parks (to remind them to pay for parking during paid hours) and detecting when they pass a Salik toll gate (to warn about low balance). Location is processed on the device only; the app has no server. The only network request is downloading a public list of fine discount campaigns (campaigns.json on GitHub), which sends no user data. To test without driving: open Parking, choose an emirate, add a vehicle in Vehicles, and tap Send SMS to see the pre-filled message. The app does not process payments; payment buttons open official government websites.

## Privacy "nutrition label" answers
- Data collected: None (all data stays on device).
- Tracking: No.

## Google Play: background location declaration
Play Console ▸ App content ▸ Location permissions. Google asks for a short video (30 s is enough: open the app, show the "Allow all the time" step, then the parking reminder) and this text:
> Road Dues uses location in the background to detect when the user parks during paid parking hours, so it can remind them to pay for parking, and to detect Salik toll gate crossings, so it can warn them before their Salik balance runs out. Both reminders are the app's core features and only work if the app can notice these events while it is closed. Location is processed on the device and never leaves the phone.

## Category
Navigation (secondary: Utilities)

## Age rating
4+
