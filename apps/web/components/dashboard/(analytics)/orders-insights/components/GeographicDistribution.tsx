"use client";

import { Card, Tooltip } from "@heroui/react";
import { Icon } from "@iconify/react";
import { memo, useMemo } from "react";

import { useUser } from "@/hooks";
import { getCurrencySymbol, formatNumber } from "@/libs/utils/format";

export interface ZipData {
  zipCode: string;
  city?: string;
  customers: number;
  revenue: number;
}

export interface GeoData {
  country: string;
  customers: number;
  revenue: number;
  avgOrderValue: number;
  percentage: number;
  zipCodes?: ZipData[];
}

interface GeographicDistributionProps {
  data?: GeoData[];
}

export const GeographicDistribution = memo(function GeographicDistribution({
  data,
}: GeographicDistributionProps) {
  const { primaryCurrency } = useUser();
  const currencySymbol = getCurrencySymbol(primaryCurrency);

  const geoData = useMemo(() => data ?? [], [data]);

  // Extract and sort all zip codes by revenue
  const topZipCodes = useMemo(() => {
    const allZipCodes: Array<ZipData & { country: string }> = [];

    geoData.forEach((country) => {
      if (country.zipCodes) {
        country.zipCodes.forEach((zip) => {
          allZipCodes.push({
            ...zip,
            country: country.country,
          });
        });
      }
    });

    // Sort by revenue and take top 5
    return allZipCodes.sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [geoData]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalRevenue = geoData.reduce((sum, item) => sum + item.revenue, 0);
    const totalCustomers = geoData.reduce(
      (sum, item) => sum + item.customers,
      0
    );
    const totalZipCodes = geoData.reduce(
      (sum, item) => sum + (item.zipCodes?.length || 0),
      0
    );
    const totalCountries = geoData.length;

    return {
      revenue: totalRevenue,
      customers: totalCustomers,
      zipCodes: totalZipCodes,
      countries: totalCountries,
    };
  }, [geoData]);

  // Format currency value
  const formatRevenue = (value: number) => {
    if (value >= 1000000) {
      return `${currencySymbol}${(value / 1000000).toFixed(2)}M`;
    }
    if (value >= 1000) {
      return `${currencySymbol}${(value / 1000).toFixed(0)}K`;
    }

    return `${currencySymbol}${value.toFixed(0)}`;
  };

  return (
    <Card className="p-6 bg-default-100/90 shadow-none dark:bg-content1 border border-default-50 rounded-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-default-900">
            Geographic Distribution
          </h3>
          <p className="text-sm text-default-500 mt-0.5">
            Customer locations by postal code
          </p>
        </div>
        <div className="text-sm text-default-800">
          <span className="font-medium">{formatNumber(totals.customers)}</span>
          <span className="text-default-400 ml-1">customers</span>
        </div>
      </div>

      {/* Top 5 Zip Codes */}
      <div className="space-y-3 mb-6">
        <p className="text-sm font-medium text-default-900">Top Postal Codes</p>
        {topZipCodes.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {topZipCodes.map((zip) => (
              <Tooltip
                key={`${zip.zipCode}-${zip.country}`}
                closeDelay={0}
                content={`${zip.city ? `${zip.city}, ` : ""}${zip.country} • ${formatNumber(zip.customers)} customers`}
              >
                <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-default-50 text-xs cursor-help">
                  <span className="text-default-600">{zip.zipCode}</span>
                  <span className="font-medium text-default-900">
                    {formatRevenue(zip.revenue)}
                  </span>
                </div>
              </Tooltip>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-default-400">
            <Icon
              className="mx-auto mb-2 text-default-300"
              icon="solar:map-point-wave-linear"
              width={32}
            />
            <p className="text-sm">No postal code data available</p>
          </div>
        )}
      </div>

      {/* Country Summary - Compact View */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-default-900">Countries</p>
        {geoData.length === 0 ? (
          <div className="p-4 text-sm text-default-500 border border-dashed border-default-200 rounded-xl">
            No geographic insights yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {geoData.slice(0, 4).map((country) => (
              <div
                key={country.country}
                className="flex items-center justify-between p-3 rounded-xl bg-background border border-default-50 text-xs"
              >
                <span className="text-default-600">{country.country}</span>
                <span className="font-medium text-default-900">
                  {formatRevenue(country.revenue)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Footer */}
      <div className="mt-6 pt-4 border-t ">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-default-500">Postal Codes</p>
            <p className="font-medium text-sm text-default-900">
              {totals.zipCodes}
            </p>
          </div>
          <div>
            <p className="text-xs text-default-500">Total Revenue</p>
            <p className="font-medium text-sm text-default-900">
              {formatRevenue(totals.revenue)}
            </p>
          </div>
          <div>
            <p className="text-xs text-default-500">Top Code</p>
            <p className="font-medium text-sm text-default-900">
              {topZipCodes[0]?.zipCode || "N/A"}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
});
