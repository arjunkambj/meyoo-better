import { useQuery } from "convex-helpers/react/cache/hooks";
import { useAction } from "convex/react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/libs/convexApi";
import { dateRangeToUtcWithShopPreference } from "@/libs/dateRange";
import { useOrganizationTimeZone, useUser } from "./useUser";
import { useShopifyTime } from "./useShopifyTime";
import type { JourneyStage } from "@/components/dashboard/(analytics)/customer-insights/components/CustomerJourney";
import type { CohortData } from "@/components/dashboard/(analytics)/orders-insights/components/CohortAnalysis";
import type { GeoData } from "@/components/dashboard/(analytics)/orders-insights/components/GeographicDistribution";
import { formatCurrency } from "@/libs/utils/format";

interface CustomerOverviewMetrics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  activeCustomers: number;
  churnedCustomers: number;
  avgLTV: number;
  avgCAC: number;
  ltvCacRatio: number;
  avgOrderValue: number;
  avgOrdersPerCustomer: number;
  repeatPurchaseRate: number;
  periodCustomerCount: number;
  prepaidRate: number;
  periodRepeatRate: number;
  abandonedCartCustomers: number;
  changes: {
    totalCustomers: number;
    newCustomers: number;
    avgLTV: number;
  };
}

interface Customer {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: string;
  lifetimeValue: number;
  orders: number;
  avgOrderValue: number;
  lastOrderDate: string;
  firstOrderDate: string;
  segment: string;
  city?: string;
  country?: string;
  periodOrders: number;
  periodRevenue: number;
  isReturning: boolean;
}

interface CustomersResult {
  data: Customer[];
  pagination: {
    page: number;
    total: number;
    pageSize: number;
    hasMore: boolean;
  };
}

const END_CURSOR = "__END__";
const DEFAULT_PAGE_SIZE = 50;

interface CustomersPageSnapshot {
  page: Customer[];
  continueCursor: string;
  isDone: boolean;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  info?: {
    pageSize: number;
    returned: number;
    hasMore: boolean;
  };
}

function buildCustomerCursorKey(args: {
  dateRange: {
    startDate: string;
    endDate: string;
    startDateTimeUtc: string;
    endDateTimeUtcExclusive: string;
    endDateTimeUtc: string;
    dayCount: number;
  };
  status?: string;
  segment?: string;
  searchTerm?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  pageSize: number;
}): string {
  const { dateRange, status, segment, searchTerm, sortBy, sortOrder, pageSize } = args;
  return JSON.stringify({
    dateRange,
    status: status ?? null,
    segment: segment ?? null,
    search: searchTerm ?? null,
    sortBy: sortBy ?? null,
    sortOrder: sortOrder ?? null,
    pageSize,
  });
}

function encodeCustomerCursor(state: { offset: number; key: string }): string {
  return JSON.stringify(state);
}

export interface UseCustomerAnalyticsParams {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  status?: "all" | "converted" | "abandoned_cart";
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  segment?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

type BackendOverview = {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  activeCustomers: number;
  churnedCustomers: number;
  avgLifetimeValue: number;
  avgOrderValue: number;
  avgOrdersPerCustomer: number;
  customerAcquisitionCost: number;
  repeatPurchaseRate: number;
  periodCustomerCount: number;
  prepaidRate: number;
  periodRepeatRate: number;
  abandonedCartCustomers: number;
  changes: {
    totalCustomers: number;
    newCustomers: number;
    lifetimeValue: number;
  };
};

type BackendCohort = {
  cohort: string;
  cohortSize: number;
  periods: Array<{
    period: number;
    percentage: number;
    revenue?: number;
    retained?: number;
  }>;
};

type BackendCustomerList = {
  data?: Customer[];
  page?: Customer[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  continueCursor?: string | null;
};

type BackendGeoZip = {
  zipCode: string;
  city?: string;
  customers: number;
  revenue: number;
};

type BackendGeoCountry = {
  country: string;
  customers: number;
  revenue: number;
  avgOrderValue: number;
  orders?: number;
  zipCodes?: BackendGeoZip[];
};

type BackendGeographic = {
  countries: BackendGeoCountry[];
  cities: Array<{
    city: string;
    country: string;
    customers: number;
    revenue: number;
  }>;
  heatmapData: Array<{ lat: number; lng: number; value: number }>;
};

type BackendJourneyStage = {
  stage: string;
  customers: number;
  percentage: number;
  avgDays: number;
  conversionRate: number;
  icon: string;
  color: string;
};

type CustomerAnalyticsResponse = {
  dateRange: { startDate: string; endDate: string };
  organizationId: string;
  result: {
    overview: BackendOverview | null;
    cohorts: BackendCohort[];
    customerList: BackendCustomerList | null;
    geographic: BackendGeographic | null;
    journey: BackendJourneyStage[];
  };
};

const defaultRange = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

export function useCustomerAnalytics(params: UseCustomerAnalyticsParams = {}) {
  const { primaryCurrency } = useUser();
  const { timezone } = useOrganizationTimeZone();
  const { offsetMinutes } = useShopifyTime();

  const {
    dateRange,
    status = "all",
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
    searchTerm,
    segment,
    sortBy,
    sortOrder = "desc",
  } = params;

  const requestedPage = Math.max(1, page);

  const normalizedSearch = useMemo(() => {
    if (!searchTerm) return undefined;
    const trimmed = searchTerm.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, [searchTerm]);

  const normalizedSegment = useMemo(() => {
    if (!segment) return undefined;
    const trimmed = segment.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, [segment]);

  const effectiveDateRange = useMemo(() => {
    if (dateRange) return dateRange;
    return defaultRange();
  }, [dateRange?.startDate, dateRange?.endDate]);

  const rangeStrings = useMemo(() => {
    if (!effectiveDateRange) return null;
    return dateRangeToUtcWithShopPreference(
      effectiveDateRange,
      typeof offsetMinutes === "number" ? offsetMinutes : undefined,
      timezone,
    );
  }, [effectiveDateRange, offsetMinutes, timezone]);

  const normalizedRange = useMemo(() => {
    if (!rangeStrings) return null;

    return {
      startDate: effectiveDateRange.startDate,
      endDate: effectiveDateRange.endDate,
      startDateTimeUtc:
        rangeStrings.startDateTimeUtc ?? `${effectiveDateRange.startDate}T00:00:00.000Z`,
      endDateTimeUtc:
        rangeStrings.endDateTimeUtc ?? `${effectiveDateRange.endDate}T23:59:59.999Z`,
      endDateTimeUtcExclusive:
        rangeStrings.endDateTimeUtcExclusive ?? `${effectiveDateRange.endDate}T23:59:59.999Z`,
      dayCount: rangeStrings.dayCount ?? 0,
    } as const;
  }, [effectiveDateRange.endDate, effectiveDateRange.startDate, rangeStrings]);

  // Use consolidated action for overview-related metrics
  const [analyticsData, setAnalyticsData] =
    useState<CustomerAnalyticsResponse | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const fetchAnalytics = useAction(api.web.customers.getAnalytics);

  useEffect(() => {
    if (!normalizedRange) {
      setIsLoadingAnalytics(false);
      return;
    }

    let cancelled = false;
    setIsLoadingAnalytics(true);

    fetchAnalytics({
      dateRange: normalizedRange,
    })
      .then((result: CustomerAnalyticsResponse | null) => {
        if (!cancelled) {
          setAnalyticsData(result);
          setIsLoadingAnalytics(false);
        }
      })
      .catch((error) => {
        console.error("Failed to load customer analytics:", error);
        if (!cancelled) {
          setIsLoadingAnalytics(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    fetchAnalytics,
    normalizedRange?.startDate,
    normalizedRange?.endDate,
    normalizedRange?.startDateTimeUtc,
    normalizedRange?.endDateTimeUtcExclusive,
  ]);

  const overviewQuery = analyticsData?.result?.overview;
  const cohortsQuery = analyticsData?.result?.cohorts;
  const geographicQuery = analyticsData?.result?.geographic;
  const journeyQuery = analyticsData?.result?.journey;

  const overview: CustomerOverviewMetrics | undefined = useMemo(() => {
    if (!overviewQuery) return undefined;

    const ltv = overviewQuery.avgLifetimeValue;
    const cac = overviewQuery.customerAcquisitionCost;

    return {
      totalCustomers: overviewQuery.totalCustomers,
      newCustomers: overviewQuery.newCustomers,
      returningCustomers: overviewQuery.returningCustomers,
      activeCustomers: overviewQuery.activeCustomers,
      churnedCustomers: overviewQuery.churnedCustomers,
      avgLTV: ltv,
      avgCAC: cac,
      ltvCacRatio: cac > 0 ? ltv / cac : 0,
      avgOrderValue: overviewQuery.avgOrderValue,
      avgOrdersPerCustomer: overviewQuery.avgOrdersPerCustomer,
      repeatPurchaseRate: overviewQuery.repeatPurchaseRate,
      periodCustomerCount: overviewQuery.periodCustomerCount,
      prepaidRate: overviewQuery.prepaidRate,
      periodRepeatRate: overviewQuery.periodRepeatRate,
      abandonedCartCustomers: overviewQuery.abandonedCartCustomers,
      changes: {
        totalCustomers: overviewQuery.changes.totalCustomers,
        newCustomers: overviewQuery.changes.newCustomers,
        avgLTV: overviewQuery.changes.lifetimeValue,
      },
    };
  }, [overviewQuery]);

  const cohorts: CohortData[] | undefined = useMemo(() => {
    if (!cohortsQuery) return undefined;

    return cohortsQuery.map((cohort: BackendCohort) => ({
      cohort: cohort.cohort,
      size: cohort.cohortSize,
      months: cohort.periods.map((period: BackendCohort["periods"][number]) => ({
        month: period.period,
        retention: period.percentage,
        revenue: period.revenue,
      })),
    }));
  }, [cohortsQuery]);

  const cursorKey = useMemo(() => {
    if (!normalizedRange) return null;
    return buildCustomerCursorKey({
      dateRange: normalizedRange,
      status: status === "all" ? undefined : status,
      segment: normalizedSegment,
      searchTerm: normalizedSearch,
      sortBy,
      sortOrder,
      pageSize,
    });
  }, [
    normalizedRange?.startDate,
    normalizedRange?.endDate,
    normalizedRange?.startDateTimeUtc,
    normalizedRange?.endDateTimeUtcExclusive,
    normalizedRange?.endDateTimeUtc,
    normalizedRange?.dayCount,
    status,
    normalizedSegment,
    normalizedSearch,
    sortBy,
    sortOrder,
    pageSize,
  ]);

  const cursorForPage = useMemo(() => {
    if (!cursorKey || requestedPage <= 1) {
      return null;
    }
    const offset = (requestedPage - 1) * pageSize;
    return encodeCustomerCursor({ offset, key: cursorKey });
  }, [cursorKey, requestedPage, pageSize]);

  const customersQueryArgs = useMemo(() => {
    if (!normalizedRange) return "skip" as const;
    return {
      dateRange: normalizedRange,
      status: status === "all" ? undefined : status,
      searchTerm: normalizedSearch,
      segment: normalizedSegment,
      sortBy,
      sortOrder,
      page: requestedPage,
      pageSize,
      paginationOpts: {
        cursor: cursorForPage,
        numItems: pageSize,
      },
    };
  }, [
    normalizedRange?.startDate,
    normalizedRange?.endDate,
    normalizedRange?.startDateTimeUtc,
    normalizedRange?.endDateTimeUtcExclusive,
    normalizedRange?.endDateTimeUtc,
    normalizedRange?.dayCount,
    status,
    normalizedSearch,
    normalizedSegment,
    sortBy,
    sortOrder,
    requestedPage,
    pageSize,
    cursorForPage,
  ]);

  const customersPageSnapshot = useQuery(
    (api.web.customers as Record<string, any>).getCustomerList,
    customersQueryArgs,
  ) as CustomersPageSnapshot | undefined;

  const customersLoading =
    customersQueryArgs !== "skip" && customersPageSnapshot === undefined;

  const customers: CustomersResult | undefined = useMemo(() => {
    if (!customersPageSnapshot) return undefined;

    const paginationSource = customersPageSnapshot.pagination ?? {
      page: requestedPage,
      pageSize,
      total: customersPageSnapshot.page.length,
      totalPages: Math.max(
        1,
        Math.ceil(
          Math.max(customersPageSnapshot.page.length, 1) / Math.max(pageSize, 1),
        ),
      ),
    };

    const hasMore = customersPageSnapshot.info?.hasMore ??
      (customersPageSnapshot.continueCursor !== END_CURSOR && !customersPageSnapshot.isDone);

    return {
      data: customersPageSnapshot.page,
      pagination: {
        page: paginationSource.page,
        total: paginationSource.total,
        pageSize: paginationSource.pageSize,
        hasMore,
      },
    };
  }, [customersPageSnapshot, pageSize, requestedPage]);

  const geographicSource = geographicQuery ?? null;

  const geographicTotals = useMemo(() => {
    if (!geographicSource) return 0;

    return geographicSource.countries.reduce(
      (sum: number, country: BackendGeoCountry) => sum + country.customers,
      0,
    );
  }, [geographicSource]);

  const geographic: GeoData[] | undefined = useMemo(() => {
    if (!geographicSource) return undefined;

    const total = geographicTotals || 1;

    return geographicSource.countries.map((country: BackendGeoCountry) => ({
      country: country.country,
      customers: country.customers,
      revenue: country.revenue,
      avgOrderValue: country.avgOrderValue,
      percentage: (country.customers / total) * 100,
      zipCodes: country.zipCodes?.map((zip: BackendGeoZip) => ({
        zipCode: zip.zipCode,
        city: zip.city ?? undefined,
        customers: zip.customers,
        revenue: zip.revenue,
      })),
    }));
  }, [geographicSource, geographicTotals]);

  const journey: JourneyStage[] | undefined = useMemo(() => {
    if (!journeyQuery) return undefined;

    const colorMap: Record<string, { bg: string; text: string }> = {
      primary: { bg: "bg-primary/10", text: "text-primary" },
      secondary: { bg: "bg-secondary/10", text: "text-secondary" },
      success: { bg: "bg-success/10", text: "text-success" },
      warning: { bg: "bg-warning/10", text: "text-warning" },
      danger: { bg: "bg-danger/10", text: "text-danger" },
      default: { bg: "bg-default-100", text: "text-default-500" },
    };

    return journeyQuery.map((stage: BackendJourneyStage) => ({
      stage: stage.stage,
      customers: stage.customers,
      percentage: stage.percentage,
      avgDays: stage.avgDays,
      conversionRate: stage.conversionRate,
      icon: stage.icon,
      color: stage.color,
      bgColor: (colorMap[stage.color] ?? colorMap.default)!.bg,
      textColor: (colorMap[stage.color] ?? colorMap.default)!.text,
    }));
  }, [journeyQuery]);

  const exportData = async () => {
    const exportableData = [] as Array<Record<string, unknown>>;

    if (overview) {
      exportableData.push({
        section: "Overview",
        metrics: {
          "Total Customers": overview.totalCustomers,
          "New Customers": overview.newCustomers,
          "Returning Customers": overview.returningCustomers,
          "Active Customers": overview.activeCustomers,
          "Churned Customers": overview.churnedCustomers,
          "Avg Lifetime Value": formatCurrency(
            overview.avgLTV,
            primaryCurrency,
          ),
          "Avg Order Value": formatCurrency(
            overview.avgOrderValue,
            primaryCurrency,
          ),
          "Avg Orders per Customer": overview.avgOrdersPerCustomer.toFixed(2),
          "Customer Acquisition Cost": formatCurrency(
            overview.avgCAC,
            primaryCurrency,
          ),
          "LTV:CAC Ratio": `${overview.ltvCacRatio.toFixed(1)}x`,
          "Repeat Purchase Rate": `${overview.repeatPurchaseRate.toFixed(1)}%`,
        },
      });
    }

    if (cohorts) {
      exportableData.push({
        section: "Cohort Analysis",
        data: cohorts.map((c) => ({
          Cohort: c.cohort,
          "Cohort Size": c.size,
          ...c.months.reduce(
            (
              acc: Record<string, string>,
              m: { month: number; retention: number; revenue?: number },
              idx: number,
            ) => {
              acc[`Month ${idx}`] = `${m.retention.toFixed(1)}%`;

              return acc;
            },
            {} as Record<string, string>,
          ),
        })),
      });
    }

    if (customers) {
      exportableData.push({
        section: "Customers",
        data: customers.data.map((c) => ({
          Name: c.name,
          Email: c.email,
          Status: c.status,
          "Lifetime Value": formatCurrency(c.lifetimeValue, primaryCurrency),
          Orders: c.orders,
          "Orders (Range)": c.periodOrders,
          "Avg Order Value": formatCurrency(c.avgOrderValue, primaryCurrency),
          "Revenue (Range)": formatCurrency(c.periodRevenue, primaryCurrency),
          "Last Order": c.lastOrderDate,
          "First Order": c.firstOrderDate,
          Segment: c.segment,
          Returning: c.isReturning ? "Yes" : "No",
          Location:
            c.city && c.country ? `${c.city}, ${c.country}` : "Unknown",
        })),
      });
    }

    if (geographic) {
      exportableData.push({
        section: "Geographic Distribution",
        data: geographic.map((g) => ({
          Country: g.country,
          Customers: g.customers,
          Revenue: formatCurrency(g.revenue, primaryCurrency),
          "Avg Order Value": formatCurrency(g.avgOrderValue, primaryCurrency),
          Percentage: `${g.percentage.toFixed(1)}%`,
        })),
      });
    }

    if (journey) {
      exportableData.push({
        section: "Customer Journey",
        data: journey.map((j) => ({
          Stage: j.stage,
          Customers: j.customers,
          Percentage: `${j.percentage}%`,
          "Avg Days": j.avgDays,
          "Conversion Rate": `${j.conversionRate}%`,
        })),
      });
    }

    return exportableData;
  };

  const loadingStates = {
    overview: isLoadingAnalytics || overviewQuery === undefined,
    cohorts: isLoadingAnalytics || cohortsQuery === undefined,
    customers: customersLoading,
    geographic: isLoadingAnalytics || geographicQuery === undefined,
    journey: isLoadingAnalytics || journeyQuery === undefined,
  };

  const isLoading = isLoadingAnalytics || customersLoading;
  const isInitialLoading =
    (isLoadingAnalytics && !analyticsData) ||
    (customersLoading && requestedPage === 1);

  return {
    overview,
    cohorts,
    customers,
    geographic,
    journey,
    exportData,
    isLoading,
    isInitialLoading,
    loadingStates,
  };
}
