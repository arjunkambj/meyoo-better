Onboarding cost storage mapping:
- Operating/shipping/payment fees → stored in the `globalCosts` table via `saveInitialCosts` (types `operational`, `shipping`, `payment`).
- Variant-level COGS/handling/tax → stored exclusively in `variantCosts` and joined dynamically when variants are queried.
