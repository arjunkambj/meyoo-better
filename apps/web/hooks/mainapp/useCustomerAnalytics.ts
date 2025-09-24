import { useQuery } from "convex-helpers/react/cache/hooks";
import { useMemo, useState } from "react";
import type { JourneyStage } from "@/components/dashboard/(analytics)/customer-insights/components/CustomerJourney";
import { api } from "@/libs/convexApi";
import { formatCurrency } from "@/libs/utils/format";
import { toUtcRangeStrings } from "@/libs/dateRange";
import { useOrganizationTimeZone } from "./useUser";

// Define types locally
interface CustomerOverviewMetrics {
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  activeCustomers: number;
  churnedCustomers: number;
  avgLTV: number; // Changed from avgLifetimeValue
  avgCAC: number; // Changed from customerAcquisitionCost
  ltvCacRatio: number; // Added
  avgOrderValue: number;
  avgOrdersPerCustomer: number;
  repeatPurchaseRate: number;
  changes: {
    totalCustomers: number;
    newCustomers: number;
    avgLTV: number; // Changed from lifetimeValue
  };
}

import type { CohortData } from "@/components/dashboard/(analytics)/orders-insights/components/CohortAnalysis";
import type { GeoData } from "@/components/dashboard/(analytics)/orders-insights/components/GeographicDistribution";

import { useUser } from "./useUser";

export function useCustomerAnalytics(dateRange?: {
  startDate: string;
  endDate: string;
}) {
  const { primaryCurrency } = useUser();
  const { timezone } = useOrganizationTimeZone();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<string | undefined>();

  // Default date range: last 30 days
  const defaultDateRange = useMemo<{
    startDate: string;
    endDate: string;
  }>(() => {
    const endDate = new Date();
    const startDate = new Date();

    startDate.setDate(startDate.getDate() - 30);

    return {
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    };
  }, []);

  const effectiveDateRange: { startDate: string; endDate: string } = {
    startDate: dateRange?.startDate ?? defaultDateRange.startDate,
    endDate: dateRange?.endDate ?? defaultDateRange.endDate,
  };

  // Fetch customer overview metrics
  const overviewData = useQuery(api.web.customers.getCustomerOverview, {
    dateRange: toUtcRangeStrings(effectiveDateRange, timezone),
  });

  // Fetch cohort analysis
  const cohortsData = useQuery(api.web.customers.getCohortAnalysis, {
    dateRange: toUtcRangeStrings(effectiveDateRange, timezone),
    cohortType: "monthly",
  });

  // Fetch customer list
  const customersData = useQuery(api.web.customers.getCustomerList, {
    page,
    pageSize: 50,
    searchTerm: searchTerm || undefined,
    segment: selectedSegment,
    sortBy: "lifetimeValue",
    sortOrder: "desc",
  });

  // Fetch geographic distribution
  const geographicData = useQuery(api.web.customers.getGeographicDistribution, {
    dateRange: toUtcRangeStrings(effectiveDateRange, timezone),
  });

  // Fetch customer journey
  const journeyData = useQuery(api.web.customers.getCustomerJourney, {
    dateRange: toUtcRangeStrings(effectiveDateRange, timezone),
  });

  // Process overview metrics
  const overview: CustomerOverviewMetrics | undefined = useMemo(() => {
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
      changes: {
        totalCustomers: overviewData.changes.totalCustomers,
        newCustomers: overviewData.changes.newCustomers,
        avgLTV: overviewData.changes.lifetimeValue,
      },
    };
  }, [overviewData]);

  // Process cohort data
  const cohorts: CohortData[] | undefined = useMemo(() => {
    if (!cohortsData) return undefined;

    return cohortsData.map((cohort) => ({
      cohort: cohort.cohort,
      size: cohort.cohortSize,
      months: cohort.periods.map((period) => ({
        month: period.period,
        retention: period.percentage,
        revenue: period.revenue,
      })),
    }));
  }, [cohortsData]);

  // Process customer list
  const customers = useMemo(() => {
    if (!customersData) return undefined;

    return {
      data: customersData.data.map((customer) => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        avatar: customer.avatar,
        status: customer.status,
        lifetimeValue: customer.lifetimeValue,
        orders: customer.orders,
        avgOrderValue: customer.avgOrderValue,
        lastOrderDate: customer.lastOrderDate,
        firstOrderDate: customer.firstOrderDate,
        segment: customer.segment,
        city: customer.city,
        country: customer.country,
      })),
      pagination: {
        page: customersData.pagination.page,
        setPage,
        total: customersData.pagination.total,
      },
    };
  }, [customersData]);

  // Process geographic data
  const totalCustomersAcrossCountries = useMemo(() => {
    if (!geographicData) return 0;

    return geographicData.countries.reduce((sum, country) => sum + country.customers, 0);
  }, [geographicData]);

  const geographic: GeoData[] | undefined = useMemo(() => {
    if (!geographicData) return undefined;

    const total = totalCustomersAcrossCountries || 1;

    // Convert to GeoData array format expected by GeographicDistribution component
    return geographicData.countries.map((country) => ({
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
  }, [geographicData, totalCustomersAcrossCountries]);

  // Process journey data
  const journey: JourneyStage[] | undefined = useMemo(() => {
    if (!journeyData) return undefined;

    const colorMap: Record<string, { bg: string; text: string }> = {
      primary: { bg: "bg-primary/10", text: "text-primary" },
      secondary: { bg: "bg-secondary/10", text: "text-secondary" },
      success: { bg: "bg-success/10", text: "text-success" },
      warning: { bg: "bg-warning/10", text: "text-warning" },
      danger: { bg: "bg-danger/10", text: "text-danger" },
      default: { bg: "bg-default-100", text: "text-default-500" },
    };

    return journeyData.map((stage) => {
      return {
        stage: stage.stage,
        customers: stage.customers,
        percentage: stage.percentage,
        avgDays: stage.avgDays,
        conversionRate: stage.conversionRate,
        icon: stage.icon,
        color: stage.color,
        bgColor: (colorMap[stage.color] ?? colorMap.default)!.bg,
        textColor: (colorMap[stage.color] ?? colorMap.default)!.text,
      };
    });
  }, [journeyData]);

  // Export data function
  const exportData = async () => {
    const exportableData = [];

    // Add overview metrics
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
            primaryCurrency
          ),
          "Avg Order Value": formatCurrency(
            overview.avgOrderValue,
            primaryCurrency
          ),
          "Avg Orders per Customer": overview.avgOrdersPerCustomer.toFixed(2),
          "Customer Acquisition Cost": formatCurrency(
            overview.avgCAC,
            primaryCurrency
          ),
          "LTV:CAC Ratio": `${overview.ltvCacRatio.toFixed(1)}x`,
          "Repeat Purchase Rate": `${overview.repeatPurchaseRate.toFixed(1)}%`,
        },
      });
    }

    // Add cohort analysis
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
              idx: number
            ) => {
              acc[`Month ${idx}`] = `${m.retention.toFixed(1)}%`;

              return acc;
            },
            {} as Record<string, string>
          ),
        })),
      });
    }

    // Add customer list
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
          Location: c.city && c.country ? `${c.city}, ${c.country}` : "Unknown",
        })),
      });
    }

    // Add geographic distribution
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

    // Add customer journey
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

  // Granular loading states for each data type
  const loadingStates = {
    overview: overviewData === undefined,
    cohorts: cohortsData === undefined,
    customers: customersData === undefined,
    geographic: geographicData === undefined,
    journey: journeyData === undefined,
  };

  // Check if any data is loading (for backward compatibility)
  const isLoading = Object.values(loadingStates).some((loading) => loading);

  // Check if initial critical data is loading (overview and segments)
  const isInitialLoading = loadingStates.overview;

  return {
    overview,
    cohorts,
    customers,
    geographic,
    journey,
    isLoading,
    isInitialLoading,
    loadingStates,
    exportData,
    // Search and filter functions for customer table
    setSearchTerm,
    setSelectedSegment,
  };
}
