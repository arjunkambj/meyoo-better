import { useQuery } from "convex-helpers/react/cache/hooks";
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
    const trimmedSearch = searchTerm.trim();

    return {
      dateRange: rangeStrings,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
      searchTerm: trimmedSearch.length > 0 ? trimmedSearch : undefined,
      segment: selectedSegment,
    };
  }, [effectiveDateRange, timezone, page, searchTerm, selectedSegment]);

  const geographicQueryArgs = useMemo(
    () => ({
      dateRange: {
        startDate: actionArgs.dateRange.startDate,
        endDate: actionArgs.dateRange.endDate,
      },
    }),
    [actionArgs.dateRange.endDate, actionArgs.dateRange.startDate],
  );

  const geographicQuery = useQuery(
    api.web.customers.getGeographicDistribution,
    geographicQueryArgs,
  );

  const sharedDateRange = useMemo(
    () => ({
      startDate: actionArgs.dateRange.startDate,
      endDate: actionArgs.dateRange.endDate,
    }),
    [actionArgs.dateRange.endDate, actionArgs.dateRange.startDate],
  );

  const overviewQueryArgs = useMemo(
    () => ({
      dateRange: sharedDateRange,
    }),
    [sharedDateRange],
  );

  const cohortsQueryArgs = useMemo(
    () => ({
      dateRange: sharedDateRange,
      cohortType: "monthly" as const,
    }),
    [sharedDateRange],
  );

  const customerListQueryArgs = useMemo(
    () => ({
      dateRange: sharedDateRange,
      page: actionArgs.page,
      pageSize: actionArgs.pageSize,
      searchTerm: actionArgs.searchTerm,
      segment: actionArgs.segment,
    }),
    [
      sharedDateRange,
      actionArgs.page,
      actionArgs.pageSize,
      actionArgs.searchTerm,
      actionArgs.segment,
    ],
  );

  const journeyQueryArgs = useMemo(
    () => ({
      dateRange: sharedDateRange,
    }),
    [sharedDateRange],
  );

  const overviewQuery = useQuery(
    api.web.customers.getCustomerOverview,
    overviewQueryArgs,
  );

  const cohortsQuery = useQuery(
    api.web.customers.getCohortAnalysis,
    cohortsQueryArgs,
  );

  const customerListQuery = useQuery(
    api.web.customers.getCustomerList,
    customerListQueryArgs,
  );

  const journeyQuery = useQuery(
    api.web.customers.getCustomerJourney,
    journeyQueryArgs,
  );

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

    return cohortsQuery.map((cohort) => ({
      cohort: cohort.cohort,
      size: cohort.cohortSize,
      months: cohort.periods.map((period) => ({
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
      (sum, country) => sum + country.customers,
      0,
    );
  }, [geographicSource]);

  const geographic: GeoData[] | undefined = useMemo(() => {
    if (!geographicSource) return undefined;

    const total = geographicTotals || 1;

    return geographicSource.countries.map((country) => ({
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

    return journeyQuery.map((stage) => ({
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

  const geographicLoading = geographicQuery === undefined;

  const loadingStates = {
    overview: overviewQuery === undefined,
    cohorts: cohortsQuery === undefined,
    customers: customerListQuery === undefined,
    geographic: geographicLoading,
    journey: journeyQuery === undefined,
  };

  const isLoading = Object.values(loadingStates).some(Boolean);
  const isInitialLoading = isLoading;

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
