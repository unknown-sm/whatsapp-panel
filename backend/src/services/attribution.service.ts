import prisma from "../lib/prisma";

export async function trackAttribution(data: {
  contactId: string;
  adId?: string;
  campaignId?: string;
  adSetId?: string;
  creativeId?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  adSetName?: string;
  adName?: string;
  refParameter?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}) {
  // Check if already has attribution
  const existing = await prisma.adAttribution.findFirst({
    where: { contactId: data.contactId },
    orderBy: { createdAt: "desc" },
  });

  // Don't duplicate if same campaign within 24h
  if (existing && existing.campaignId === data.campaignId) {
    const hoursSince = (Date.now() - existing.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) return existing;
  }

  return prisma.adAttribution.create({
    data: {
      contactId: data.contactId,
      adId: data.adId,
      campaignId: data.campaignId,
      adSetId: data.adSetId,
      creativeId: data.creativeId,
      source: data.source || "whatsapp",
      medium: data.medium || "paid_social",
      campaign: data.campaign,
      adSetName: data.adSetName,
      adName: data.adName,
      refParameter: data.refParameter,
      utmSource: data.utmSource,
      utmCampaign: data.utmCampaign,
      utmContent: data.utmContent,
      utmTerm: data.utmTerm,
    },
  });
}

export async function parseRefAndTrack(contactId: string, ref?: string, metadata?: any) {
  if (!ref && !metadata) return null;

  // Parse Meta CTWA ref parameter
  // Format can be: "ad_123" or custom string set in the ad
  const attribution: any = {
    contactId,
    source: metadata?.source || "facebook",
    medium: "paid_social",
    refParameter: ref,
  };

  // If ref contains structured data (some setups pass JSON-like strings)
  if (ref) {
    attribution.adId = ref;
  }

  // Extract Meta webhook metadata if available
  if (metadata) {
    attribution.adId = metadata.ad_id || attribution.adId;
    attribution.campaignId = metadata.campaign_id;
    attribution.adSetId = metadata.adset_id;
    attribution.creativeId = metadata.creative_id;
    attribution.campaign = metadata.campaign_name;
    attribution.adSetName = metadata.adset_name;
    attribution.adName = metadata.ad_name;
  }

  return trackAttribution(attribution);
}

export async function getAttributionByContact(contactId: string) {
  return prisma.adAttribution.findMany({
    where: { contactId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAttributionStats(days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const attributions = await prisma.adAttribution.findMany({
    where: { createdAt: { gte: startDate } },
  });

  // Group by source
  const bySource: Record<string, { count: number; conversions: number; value: number }> = {};
  for (const attr of attributions) {
    const key = attr.source || "unknown";
    if (!bySource[key]) bySource[key] = { count: 0, conversions: 0, value: 0 };
    bySource[key].count++;
    if (attr.conversionAt) {
      bySource[key].conversions++;
      bySource[key].value += attr.conversionValue || 0;
    }
  }

  // Group by campaign
  const byCampaign: Record<string, { count: number; conversions: number; value: number }> = {};
  for (const attr of attributions) {
    const key = attr.campaign || "unknown";
    if (!byCampaign[key]) byCampaign[key] = { count: 0, conversions: 0, value: 0 };
    byCampaign[key].count++;
    if (attr.conversionAt) {
      byCampaign[key].conversions++;
      byCampaign[key].value += attr.conversionValue || 0;
    }
  }

  return {
    totalLeads: attributions.length,
    totalConversions: attributions.filter((a) => a.conversionAt).length,
    totalValue: attributions.reduce((sum, a) => sum + (a.conversionValue || 0), 0),
    bySource,
    byCampaign,
  };
}

export async function markConversion(contactId: string, value?: number) {
  const attribution = await prisma.adAttribution.findFirst({
    where: { contactId, conversionAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!attribution) return null;

  return prisma.adAttribution.update({
    where: { id: attribution.id },
    data: {
      conversionAt: new Date(),
      conversionValue: value,
    },
  });
}
