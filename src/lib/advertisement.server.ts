/** Five independently configurable direct-sold image/video billboard slots. */
function safeCreative(value: string | undefined) {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try { const u = new URL(value); return u.protocol === "https:" ? u.href : null; } catch { return null; }
}
function safeDestination(value: string | undefined) {
  try { const u = new URL(value ?? ""); return u.protocol === "https:" ? u.href : null; } catch { return null; }
}
export function billboardCampaign(slot = 1) {
  if (![1, 2, 3, 4, 5].includes(slot)) return null;
  const read = (key: string) => process.env[`BILLBOARD_${slot}_${key}`] ?? (slot === 1 ? process.env[`BILLBOARD_${key}`] : undefined);
  const image = safeCreative(read("IMAGE_URL"));
  const video = safeCreative(read("VIDEO_URL"));
  const destination = safeDestination(read("CLICK_URL"));
  if ((!image && !video) || !destination) return null;
  return {
    slot, image, video, destination,
    title: (read("TITLE") || "Sponsored message").slice(0, 80),
    campaign: (read("CAMPAIGN_ID") || `direct-campaign-${slot}`).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || `direct-campaign-${slot}`,
  };
}
export function billboardCampaigns() { return [1, 2, 3, 4, 5].map((slot) => ({ slot, campaign: billboardCampaign(slot) })); }
