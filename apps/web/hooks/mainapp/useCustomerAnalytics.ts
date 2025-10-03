import { useAction } from "convex/react";
import { useEffect, useMemo, useState } from "react";

import { api } from "@/libs/convexApi";
import { toUtcRangeStrings } from "@/libs/dateRange";
import { useOrganizationTimeZone, useUser } from "./useUser";
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
}

interface CustomersResult {
  data: Customer[];
  pagination: {
    page: number;
    setPage: (page: number) => void;
    total: number;
    pageSize: number;
    hasMore: boolean;
  };
}

const END_CURSOR = "__END__";
const DEFAULT_PAGE_SIZE = 50;

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

export function useCustomerAnalytics(dateRange?: {
  startDate: string;
  endDate: string;
}) {
  const { primaryCurrency } = useUser();
  const { timezone } = useOrganizationTimeZone();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<string | undefined>();

  const effectiveDateRange = useMemo(() => {
    if (dateRange) return dateRange;
    return defaultRange();
  }, [dateRange?.startDate, dateRange?.endDate]);

  useEffect(() => {
    setPage(1);
  }, [
    effectiveDateRange.startDate,
    effectiveDateRange.endDate,
    selectedSegment,
    searchTerm,
  ]);

  const actionArgs = useMemo(() => {
    const rangeStrings = toUtcRangeStrings(effectiveDateRange, timezone);
    const normalizedRange = {
      startDate: effectiveDateRange.startDate,
      endDate: effectiveDateRange.endDate,
      startDateTimeUtc: rangeStrings.startDateTimeUtc,
      endDateTimeUtc: rangeStrings.endDateTimeUtc,
      endDateTimeUtcExclusive: rangeStrings.endDateTimeUtcExclusive,
      dayCount: rangeStrings.dayCount,
    } as const;
    const trimmedSearch = searchTerm.trim();

    return {
      dateRange: normalizedRange,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      searchTerm: trimmedSearch.length > 0 ? trimmedSearch : undefined,
      segment: selectedSegment,
    };
  }, [effectiveDateRange, timezone, page, searchTerm, selectedSegment]);

  // Use consolidated action for better performance - batches all queries with Promise.all
  const [analyticsData, setAnalyticsData] =
    useState<CustomerAnalyticsResponse | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const fetchAnalytics = useAction(api.web.customers.getAnalytics);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingAnalytics(true);

    fetchAnalytics({
      dateRange: actionArgs.dateRange,
      page: actionArgs.page,
      pageSize: actionArgs.pageSize,
      searchTerm: actionArgs.searchTerm,
      segment: actionArgs.segment,
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
    actionArgs.dateRange.startDate,
    actionArgs.dateRange.endDate,
    actionArgs.page,
    actionArgs.pageSize,
    actionArgs.searchTerm,
    actionArgs.segment,
  ]);

  const overviewQuery = analyticsData?.result?.overview;
  const cohortsQuery = analyticsData?.result?.cohorts;
  const customerListQuery = analyticsData?.result?.customerList;
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

  const customers: CustomersResult | undefined = useMemo(() => {
    if (!customerListQuery) return undefined;

    const entries =
      customerListQuery.data ?? customerListQuery.page ?? ([] as Customer[]);

    const paginationSource = customerListQuery.pagination ?? {
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      total: entries.length,
      totalPages: Math.max(
        1,
        Math.ceil(Math.max(entries.length, 1) / DEFAULT_PAGE_SIZE),
      ),
    };

    return {
      data: entries,
      pagination: {
        page: paginationSource.page,
        setPage,
        total: paginationSource.total,
        pageSize: paginationSource.pageSize,
        hasMore:
          !!customerListQuery.continueCursor &&
          customerListQuery.continueCursor !== END_CURSOR,
      },
    };
  }, [customerListQuery, page, setPage]);

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
          "Avg Order Value": formatCurrency(c.avgOrderValue, primaryCurrency),
          "Last Order": c.lastOrderDate,
          "First Order": c.firstOrderDate,
          Segment: c.segment,
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
    customers: isLoadingAnalytics || customerListQuery === undefined,
    geographic: isLoadingAnalytics || geographicQuery === undefined,
    journey: isLoadingAnalytics || journeyQuery === undefined,
  };

  const isLoading = isLoadingAnalytics || Object.values(loadingStates).some(Boolean);
  const isInitialLoading = isLoadingAnalytics;

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
    setSearchTerm,
    setSelectedSegment,
  };
}
