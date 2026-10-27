// Where the campaign list lives. Edit campaigns.json in the GitHub repo to announce a campaign;
// phones pick it up the next time they check (see src/campaigns.js).
export const CAMPAIGNS_URL = 'https://raw.githubusercontent.com/jhy2njr6w7-a11y/road-dues/main/campaigns.json';

export async function downloadCampaigns() {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(CAMPAIGNS_URL, { signal: ctl.signal, headers: { 'Cache-Control': 'no-cache' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}
