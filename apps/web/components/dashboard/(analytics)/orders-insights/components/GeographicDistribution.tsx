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

  const defaultData: GeoData[] = [
    {
      country: "United States",
      customers: 1245,
      revenue: 450000,
      avgOrderValue: 362,
      percentage: 45,
      zipCodes: [
        { zipCode: "10001", city: "New York", customers: 342, revenue: 125000 },
        {
          zipCode: "90001",
          city: "Los Angeles",
          customers: 289,
          revenue: 105000,
        },
        { zipCode: "60601", city: "Chicago", customers: 198, revenue: 72000 },
        { zipCode: "77001", city: "Houston", customers: 156, revenue: 56000 },
        { zipCode: "85001", city: "Phoenix", customers: 134, revenue: 48000 },
      ],
    },
    {
      country: "United Kingdom",
      customers: 534,
      revenue: 180000,
      avgOrderValue: 337,
      percentage: 19,
      zipCodes: [
        { zipCode: "SW1A 1AA", city: "London", customers: 245, revenue: 82000 },
        {
          zipCode: "M1 1AE",
          city: "Manchester",
          customers: 98,
          revenue: 33000,
        },
        {
          zipCode: "B1 1AA",
          city: "Birmingham",
          customers: 78,
          revenue: 26000,
        },
        { zipCode: "G1 1AA", city: "Glasgow", customers: 67, revenue: 22000 },
      ],
    },
    {
      country: "Canada",
      customers: 389,
      revenue: 125000,
      avgOrderValue: 321,
      percentage: 14,
      zipCodes: [
        { zipCode: "M5H 2N2", city: "Toronto", customers: 156, revenue: 50000 },
        {
          zipCode: "V6B 4Y8",
          city: "Vancouver",
          customers: 98,
          revenue: 31000,
        },
        { zipCode: "H2X 1Y7", city: "Montreal", customers: 78, revenue: 25000 },
        { zipCode: "T2P 1J9", city: "Calgary", customers: 57, revenue: 19000 },
      ],
    },
  ];

  const geoData = data || defaultData;

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
    <Card className="p-6 bg-white dark:bg-content1 border-none shadow-sm rounded-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-default-900">Geographic Distribution</h3>
          <p className="text-sm text-default-500 mt-0.5">
            Customer locations by postal code
          </p>
        </div>
        <div className="text-sm text-default-600">
          <span className="font-medium">{formatNumber(totals.customers)}</span>
          <span className="text-default-400 ml-1">customers</span>
        </div>
      </div>

      {/* Top 5 Zip Codes */}
      <div className="space-y-3 mb-6">
        <p className="text-sm font-medium text-default-900">
          Top Postal Codes
        </p>
        {topZipCodes.length > 0 ? (
          topZipCodes.map((zip, index) => {
            const percentage =
              totals.revenue > 0 ? (zip.revenue / totals.revenue) * 100 : 0;

            return (
              <div
                key={`${zip.zipCode}-${zip.country}`}
                className="p-3 rounded-xl bg-white dark:bg-default-50 border border-default-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-default-100 text-default-600 font-medium text-xs">
                      {index + 1}
                    </div>
                    <div>
                      <Tooltip
                        closeDelay={0}
                        content={`${formatNumber(zip.customers)} customers from postal code ${zip.zipCode}`}
                      >
                        <p className="font-medium text-sm cursor-help">
                          {zip.zipCode}
                        </p>
                      </Tooltip>
                      <p className="text-xs text-default-500">
                        {zip.city && `${zip.city}, `}
                        {zip.country} • {formatNumber(zip.customers)}{" "}
                        customers
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-sm">
                      {formatRevenue(zip.revenue)}
                    </p>
                    <p className="text-xs text-default-500">
                      {percentage.toFixed(1)}% of total
                    </p>
                  </div>
                </div>
                <div className="h-1 bg-default-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary-400"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
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
        <div className="grid grid-cols-2 gap-2">
          {geoData.slice(0, 4).map((country) => (
            <div
              key={country.country}
              className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-default-50 border border-default-100 text-xs"
            >
              <span className="text-default-600">{country.country}</span>
              <span className="font-medium text-default-900">
                {formatRevenue(country.revenue)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="mt-6 pt-4 border-t border-default-100">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-default-500">Postal Codes</p>
            <p className="font-medium text-sm text-default-900">{totals.zipCodes}</p>
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
