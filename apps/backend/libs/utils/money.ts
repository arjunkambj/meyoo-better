/**
 * Money utility functions for handling monetary values
 * Ensures all monetary values are stored with exactly 2 decimal places
 */

/**
 * Rounds a monetary value to 2 decimal places
 * Uses Math.round to avoid floating point precision issues
 *
 * @param value - The numeric value to round
 * @returns The value rounded to 2 decimal places
 *
 * @example
 * roundMoney(10.999) // returns 11.00
 * roundMoney(10.554) // returns 10.55
 * roundMoney(10.555) // returns 10.56
 */
export const roundMoney = (value: number | undefined | null): number => {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return 0;
  }

  return Math.round(value * 100) / 100;
};

/**
 * Safely parses a string to a monetary value with 2 decimal places
 *
 * @param value - The string value to parse
 * @param defaultValue - Default value if parsing fails (default: 0)
 * @returns Parsed and rounded monetary value
 */
export const parseMoney = (
  value: string | undefined | null,
  defaultValue: number = 0,
): number => {
  if (!value) return defaultValue;

  const parsed = parseFloat(value);

  if (Number.isNaN(parsed)) return defaultValue;

  return roundMoney(parsed);
};

/**
 * Sums an array of monetary values and rounds the result
 *
 * @param values - Array of numeric values to sum
 * @returns The sum rounded to 2 decimal places
 */
export const sumMoney = (values: (number | undefined | null)[]): number => {
  const sum = values.reduce((acc, val) => (acc ?? 0) + (val || 0), 0);

  return roundMoney(sum);
};

/**
 * Calculates a percentage of a monetary value and rounds the result
 *
 * @param value - The base monetary value
 * @param percentage - The percentage to calculate (e.g., 10 for 10%)
 * @returns The calculated percentage value rounded to 2 decimal places
 */
export const percentageOfMoney = (
  value: number,
  percentage: number,
): number => {
  return roundMoney((value * percentage) / 100);
};
