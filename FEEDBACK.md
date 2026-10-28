# Saif's test feedback

Things Saif wants changed after testing on his iPhone (TestFlight). Saved here as he reports them;
**not built until he says to** ("improve it" / "put it in the app"). Newest at the bottom.
When an item is built, move it to "Done" with the PR link.

## Waiting

1. **Show the parking price** (Parking tab, 28 Oct 2026). Saif's reference: another parking app shows "السعر درهمان + رسوم الرسائل النصية" (price AED 2 + SMS fees) for Abu Dhabi, standard (فرعي, S), 1 hour, under the duration picker, with the zone's paid hours and max stay (24 h) below it. Wanted: show the price for the chosen emirate / zone type / hours before sending the SMS, plus "+ SMS fee". Needs each emirate's current tariff checked from official sources (AUH standard/premium per hour, DXB zone A–D/codes, SHJ per hour, AJM).
2. **Use 12-hour times, not 24-hour** (everywhere times are shown: paid hours, ticket/countdown, reminders, Salik peak times, notifications). E.g. "8:00 AM – 10:00 PM", not "08:00–22:00". In Arabic use the **full words** صباحاً / مساءً (e.g. "8:00 صباحاً – 10:00 مساءً"), not ص/م.
3. **Disclaimer as a page in Settings** (Saif sent another parking app's "إخلاء مسؤولية" screen as reference). Add a Settings row that opens a full disclaimer page: separate points in one card (app doesn't charge you, the SMS goes to the official service which deducts parking + SMS fees from your phone balance; prices shown come from official sites but may be out of date; not responsible for decisions/actions based on the app; not responsible for errors in services, fees or fines incl. parking violations; no liability for damages; content may change without notice; info provided in good faith, no guarantee), plus a red note at the end: for parking problems contact the official authority directly. **Use our own wording** (CLAUDE.md: disclaimer must not copy another app), in all 5 languages.

## Done
