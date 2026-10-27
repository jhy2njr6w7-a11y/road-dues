// Web preview only: sample campaigns (dates relative to today) so the Fines tab can be clicked through.
// These are made up and never reach the phone apps, which download campaigns.json instead.
export const CAMPAIGNS_URL = 'demo';
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export async function downloadCampaigns() {
  return { campaigns: [
    { id: 'demo-shj', iss: 'shj', pct: 50, start: day(-20), end: day(12), url: 'https://www.shjpolice.gov.ae', note: { en: 'Demo: not a real campaign.' } },
    { id: 'demo-ajm', iss: 'ajm', pct: 50, start: day(-5), end: day(2), url: 'https://www.ajmanpolice.gov.ae', note: { en: 'Demo: not a real campaign.' } },
    { id: 'demo-rak', iss: 'rak', pct: 40, start: day(9), end: day(40), url: 'https://www.rakpolice.gov.ae', note: { en: 'Demo: not a real campaign.' } },
  ] };
}
