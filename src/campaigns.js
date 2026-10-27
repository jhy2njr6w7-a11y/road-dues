// Fine discount campaigns: download the public list, remember it, and keep reminders in sync.
// Nothing about the user is sent; it is a plain download of campaigns.json.
import { update, getState } from './store';
import { parseCampaigns, campaignStatus } from './data';
import { downloadCampaigns } from './campaign-source';
import { rescheduleCampaignReminders, notifyCampaignNow } from './notify';

const MIN_GAP = 3 * 3600e3; // don't download more often than every 3 hours unless asked

export const syncCampaignReminders = () => { const s = getState(); return rescheduleCampaignReminders(s.campaigns, s.settings.remFines); };

/** Returns true if a fresh list was downloaded. Never throws: offline just keeps the last list. */
export async function refreshCampaigns({ force = false } = {}) {
  const s = getState();
  if (!force && s.campaignsAt && Date.now() - new Date(s.campaignsAt).getTime() < MIN_GAP) return false;
  let list;
  try { list = parseCampaigns(await downloadCampaigns()); } catch (e) { return false; }
  const seen = s.seenCampaigns;
  // Running campaigns we haven't announced yet. Upcoming ones get their own "starts today" reminder.
  const fresh = seen ? list.filter((c) => !seen.includes(c.id) && campaignStatus(c) === 'active') : [];
  const next = await update((x) => {
    x.campaigns = list;
    x.campaignsAt = new Date().toISOString();
    x.seenCampaigns = [...new Set([...(x.seenCampaigns || []), ...list.map((c) => c.id)])].slice(-200);
  });
  try {
    if (next.settings.remFines) for (const c of fresh) await notifyCampaignNow(c);
    await syncCampaignReminders();
  } catch (e) { /* notifications unavailable: the list still shows in the app */ }
  return true;
}
