import type {
  AnalyticsSourceResponse,
  PlatformMetrics,
} from '@repo/types';

import type { AnyRecord } from './shared';
import {
  ensureDataset,
  safeNumber,
  sumBy,
} from './shared';

export function computePlatformMetrics(
  response: AnalyticsSourceResponse<any> | null | undefined,
): PlatformMetrics {
  if (!response) {
    return {
      shopifyConversionRate: 0,
      shopifyAbandonedCarts: 0,
      shopifyCheckoutRate: 0,
      metaSessions: 0,
      metaClicks: 0,
      metaConversion: 0,
      metaConversionRate: 0,
      metaImpressions: 0,
      metaCTR: 0,
      metaCPM: 0,
      metaReach: 0,
      metaFrequency: 0,
      metaUniqueClicks: 0,
      metaCPC: 0,
      metaCostPerConversion: 0,
      metaAddToCart: 0,
      metaInitiateCheckout: 0,
      metaPageViews: 0,
      metaViewContent: 0,
      metaLinkClicks: 0,
      metaOutboundClicks: 0,
      metaLandingPageViews: 0,
      metaVideoViews: 0,
      metaVideo3SecViews: 0,
      metaCostPerThruPlay: 0,
      blendedCPM: 0,
      blendedCPC: 0,
      blendedCTR: 0,
    } satisfies PlatformMetrics;
  }

  const data = ensureDataset(response);
  if (!data) {
    return {
      shopifyConversionRate: 0,
      shopifyAbandonedCarts: 0,
      shopifyCheckoutRate: 0,
      metaSessions: 0,
      metaClicks: 0,
      metaConversion: 0,
      metaConversionRate: 0,
      metaImpressions: 0,
      metaCTR: 0,
      metaCPM: 0,
      metaReach: 0,
      metaFrequency: 0,
      metaUniqueClicks: 0,
      metaCPC: 0,
      metaCostPerConversion: 0,
      metaAddToCart: 0,
      metaInitiateCheckout: 0,
      metaPageViews: 0,
      metaViewContent: 0,
      metaLinkClicks: 0,
      metaOutboundClicks: 0,
      metaLandingPageViews: 0,
      metaVideoViews: 0,
      metaVideo3SecViews: 0,
      metaCostPerThruPlay: 0,
      blendedCPM: 0,
      blendedCPC: 0,
      blendedCTR: 0,
    } satisfies PlatformMetrics;
  }

  const analytics = (data.analytics || []) as AnyRecord[];
  const metaInsights = (data.metaInsights || []) as AnyRecord[];

  const shopifySessions = sumBy(analytics, (entry) => safeNumber(entry.sessions ?? entry.visitors ?? entry.visits));
  const shopifyConversions = sumBy(analytics, (entry) => safeNumber(entry.conversions ?? entry.orders ?? entry.conversion));

  const metaClicks = sumBy(metaInsights, (entry) => safeNumber(entry.clicks));
  const metaUniqueClicks = sumBy(metaInsights, (entry) => safeNumber(entry.uniqueClicks));
  const metaImpressions = sumBy(metaInsights, (entry) => safeNumber(entry.impressions));
  const metaReach = sumBy(metaInsights, (entry) => safeNumber(entry.reach));
  const metaSpend = sumBy(metaInsights, (entry) => safeNumber(entry.spend));
  const metaConversions = sumBy(metaInsights, (entry) => safeNumber(entry.conversions));
  const metaAddToCart = sumBy(metaInsights, (entry) => safeNumber(entry.addToCart));
  const metaInitiateCheckout = sumBy(metaInsights, (entry) => safeNumber(entry.initiateCheckout));
  const metaPageViews = sumBy(metaInsights, (entry) => safeNumber(entry.pageViews));
  const metaViewContent = sumBy(metaInsights, (entry) => safeNumber(entry.viewContent));
  const metaLinkClicks = sumBy(metaInsights, (entry) => safeNumber(entry.linkClicks));
  const metaOutboundClicks = sumBy(metaInsights, (entry) => safeNumber(entry.outboundClicks));
  const metaLandingPageViews = sumBy(metaInsights, (entry) => safeNumber(entry.landingPageViews));
  const metaVideoViews = sumBy(metaInsights, (entry) => safeNumber(entry.videoViews));
  const metaVideo3SecViews = sumBy(metaInsights, (entry) => safeNumber(entry.video3SecViews));
  const metaCostPerThruPlay = sumBy(metaInsights, (entry) => safeNumber(entry.costPerThruPlay));

  const metaSessions = metaClicks || metaUniqueClicks;
  const metaConversionRate = metaClicks > 0 ? (metaConversions / metaClicks) * 100 : 0;
  const metaCTR = metaImpressions > 0 ? (metaClicks / metaImpressions) * 100 : 0;
  const metaCPM = metaImpressions > 0 ? (metaSpend / metaImpressions) * 1000 : 0;
  const metaCPC = metaClicks > 0 ? metaSpend / metaClicks : 0;
  const metaCostPerConversion = metaConversions > 0 ? metaSpend / metaConversions : 0;
  const metaFrequency = metaReach > 0 ? metaImpressions / metaReach : 0;

  const blendedCPM = metaCPM;
  const blendedCPC = metaCPC;
  const blendedCTR = metaCTR;

  return {
    shopifyConversionRate: shopifySessions > 0 ? (shopifyConversions / shopifySessions) * 100 : 0,
    shopifyAbandonedCarts: Math.max(shopifySessions - shopifyConversions, 0),
    shopifyCheckoutRate: shopifySessions > 0 ? (shopifyConversions / shopifySessions) * 100 : 0,
    metaSessions,
    metaClicks,
    metaConversion: metaConversions,
    metaConversionRate,
    metaImpressions,
    metaCTR,
    metaCPM,
    metaReach,
    metaFrequency,
    metaUniqueClicks,
    metaCPC,
    metaCostPerConversion,
    metaAddToCart,
    metaInitiateCheckout,
    metaPageViews,
    metaViewContent,
    metaLinkClicks,
    metaOutboundClicks,
    metaLandingPageViews,
    metaVideoViews,
    metaVideo3SecViews,
    metaCostPerThruPlay,
    blendedCPM,
    blendedCPC,
    blendedCTR,
  } satisfies PlatformMetrics;
}

