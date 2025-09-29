import { useAction } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";

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

interface CustomerListEntry {
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

interface CustomerListPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface CustomersAnalyticsActionResult {
  overview: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    activeCustomers: number;
    churnedCustomers: number;
    avgLifetimeValue: number;
    avgOrderValue: number;
    avgOrdersPerCustomer: number;
    customerAcquisitionCost: number;
    churnRate: number;
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
  } | null;
  cohorts: Array<{
    cohort: string;
    cohortSize: number;
    periods: Array<{
      period: number;
      retained: number;
      percentage: number;
      revenue: number;
    }>;
  }>;
  customerList: {
    data: CustomerListEntry[];
    pagination: CustomerListPagination;
    continueCursor: string;
  } | null;
  geographic: {
    countries: Array<{
      country: string;
      customers: number;
      revenue: number;
      orders: number;
      avgOrderValue: number;
      zipCodes: Array<{
        zipCode: string;
        city?: string;
        customers: number;
        revenue: number;
      }>;
    }>;
    cities: Array<{
      city: string;
      country: string;
      customers: number;
      revenue: number;
    }>;
    heatmapData: Array<{ lat: number; lng: number; value: number }>;
  } | null;
  journey: Array<{
    stage: string;
    customers: number;
    percentage: number;
    avgDays: number;
    conversionRate: number;
    icon: string;
    color: string;
  }>;
}

interface CustomersAnalyticsActionResponse {
  dateRange: { startDate: string; endDate: string };
  organizationId: string;
  result: CustomersAnalyticsActionResult;
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

  const [analytics, setAnalytics] = useState<
    CustomersAnalyticsActionResponse | null | undefined
  >(undefined);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [isCustomersLoading, setIsCustomersLoading] = useState(false);
  const [isCohortsLoading, setIsCohortsLoading] = useState(false);
  const [isGeographicLoading, setIsGeographicLoading] = useState(false);
  const [isJourneyLoading, setIsJourneyLoading] = useState(false);

  const requestIdRef = useRef(0);
  const previousArgsRef = useRef<{
    dateRange: { startDate: string; endDate: string };
    page: number;
    pageSize: number;
    searchTerm?: string;
    segment?: string;
  } | null>(null);

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
    const trimmedSearch = searchTerm.trim();

    return {
      dateRange: rangeStrings,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      searchTerm: trimmedSearch.length > 0 ? trimmedSearch : undefined,
      segment: selectedSegment,
    };
  }, [effectiveDateRange, timezone, page, searchTerm, selectedSegment]);

  const getAnalytics = useAction(api.web.customers.getAnalytics);

  useEffect(() => {
    const previousArgs = previousArgsRef.current;
    const onlyPageChanged =
      previousArgs !== null &&
      previousArgs.dateRange.startDate === actionArgs.dateRange.startDate &&
      previousArgs.dateRange.endDate === actionArgs.dateRange.endDate &&
      previousArgs.searchTerm === actionArgs.searchTerm &&
      previousArgs.segment === actionArgs.segment &&
      previousArgs.pageSize === actionArgs.pageSize &&
      previousArgs.page !== actionArgs.page;

    previousArgsRef.current = actionArgs;

    setIsOverviewLoading(!onlyPageChanged);
    setIsCohortsLoading(!onlyPageChanged);
    setIsGeographicLoading(!onlyPageChanged);
    setIsJourneyLoading(!onlyPageChanged);
    setIsCustomersLoading(true);

    if (!onlyPageChanged) {
      setAnalytics(undefined);
    }

    let cancelled = false;
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    getAnalytics(actionArgs)
      .then((response) => {
        if (cancelled || requestIdRef.current !== currentRequestId) return;
        setAnalytics(response ?? null);
      })
      .catch((error) => {
        if (cancelled || requestIdRef.current !== currentRequestId) return;
        console.error("Failed to load customer analytics", error);
        setAnalytics(null);
      })
      .finally(() => {
        if (cancelled || requestIdRef.current !== currentRequestId) return;
        setIsOverviewLoading(false);
        setIsCohortsLoading(false);
        setIsGeographicLoading(false);
        setIsJourneyLoading(false);
        setIsCustomersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [actionArgs, getAnalytics]);

  const result = analytics?.result as CustomersAnalyticsActionResult | undefined;

  const overview: CustomerOverviewMetrics | undefined = useMemo(() => {
    const overviewData = result?.overview;
    if (!overviewData) return undefined;

    const ltv = overviewData.avgLifetimeValue;
    const cac = overviewData.customerAcquisitionCost;

    return {
      totalCustomers: overviewData.totalCustomers,
      newCustomers: overviewData.newCustomers,
      returningCustomers: overviewData.returningCustomers,
      activeCustomers: overviewData.activeCustomers,
      churnedCustomers: overviewData.churnedCustomers,
      avgLTV: ltv,
      avgCAC: cac,
      ltvCacRatio: cac > 0 ? ltv / cac : 0,
      avgOrderValue: overviewData.avgOrderValue,
      avgOrdersPerCustomer: overviewData.avgOrdersPerCustomer,
      repeatPurchaseRate: overviewData.repeatPurchaseRate,
      periodCustomerCount: overviewData.periodCustomerCount,
      prepaidRate: overviewData.prepaidRate,
      periodRepeatRate: overviewData.periodRepeatRate,
      abandonedCartCustomers: overviewData.abandonedCartCustomers,
      changes: {
        totalCustomers: overviewData.changes.totalCustomers,
        newCustomers: overviewData.changes.newCustomers,
        avgLTV: overviewData.changes.lifetimeValue,
      },
    };
  }, [result?.overview]);

  const cohorts: CohortData[] | undefined = useMemo(() => {
    if (!result?.cohorts) return undefined;

    return result.cohorts.map((cohort) => ({
      cohort: cohort.cohort,
      size: cohort.cohortSize,
      months: cohort.periods.map((period) => ({
        month: period.period,
        retention: period.percentage,
        revenue: period.revenue,
      })),
    }));
  }, [result?.cohorts]);

  const customers: CustomersResult | undefined = useMemo(() => {
    if (!result?.customerList) return undefined;

    const pagination = result.customerList.pagination ?? {
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      total: result.customerList.data?.length ?? 0,
      totalPages: Math.max(
        1,
        Math.ceil((result.customerList.data?.length ?? 0) / DEFAULT_PAGE_SIZE),
      ),
    };

    return {
      data: result.customerList.data ?? [],
      pagination: {
        page: pagination.page,
        setPage,
        total: pagination.total,
        pageSize: pagination.pageSize,
        hasMore:
          !!result.customerList.continueCursor &&
          result.customerList.continueCursor !== END_CURSOR,
      },
    };
  }, [result?.customerList, page]);

  const geographicTotals = useMemo(() => {
    if (!result?.geographic) return 0;

    return result.geographic.countries.reduce(
      (sum, country) => sum + country.customers,
      0,
    );
  }, [result?.geographic]);

  const geographic: GeoData[] | undefined = useMemo(() => {
    if (!result?.geographic) return undefined;

    const total = geographicTotals || 1;

    return result.geographic.countries.map((country) => ({
      country: country.country,
      customers: country.customers,
      revenue: country.revenue,
      avgOrderValue: country.avgOrderValue,
      percentage: (country.customers / total) * 100,
      zipCodes: country.zipCodes?.map((zip) => ({
        zipCode: zip.zipCode,
        city: zip.city ?? undefined,
        customers: zip.customers,
        revenue: zip.revenue,
      })),
    }));
  }, [result?.geographic, geographicTotals]);

  const journey: JourneyStage[] | undefined = useMemo(() => {
    if (!result?.journey) return undefined;

    const colorMap: Record<string, { bg: string; text: string }> = {
      primary: { bg: "bg-primary/10", text: "text-primary" },
      secondary: { bg: "bg-secondary/10", text: "text-secondary" },
      success: { bg: "bg-success/10", text: "text-success" },
      warning: { bg: "bg-warning/10", text: "text-warning" },
      danger: { bg: "bg-danger/10", text: "text-danger" },
      default: { bg: "bg-default-100", text: "text-default-500" },
    };

    return result.journey.map((stage) => ({
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
  }, [result?.journey]);

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
    overview: isOverviewLoading,
    cohorts: isCohortsLoading,
    customers: isCustomersLoading,
    geographic: isGeographicLoading,
    journey: isJourneyLoading,
  };

  const isLoading = Object.values(loadingStates).some(Boolean);
  const isInitialLoading = analytics === undefined;

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
