Hooks Audit (apps/web)

Summary
- Total custom hooks exported: 51
- Total useQuery calls in apps/web: 47 (hooks directory: 35)
- Total useMutation calls in apps/web: 33 (hooks directory: 27)
- Unused custom hooks in apps/web (no usages outside hooks/):
  - useMediaQuery
- useShopifyTime
  - useTeamMembers
  - useTicket

All Custom Hooks (exported from apps/web/hooks)
- useAgent
- useAnalyticsDateRange
- useApiKeys
- useBilling
- useCost
- useCreateExpense
- useCreateIntegrationRequest
- useCreateShippingCost
- useCreateTicket
- useCreateTransactionFee
- useCurrentUser
- useCustomerAnalytics
- useDashboardOverview
- useDebounce
- useDeleteExpense
- useDeleteInvoice
- useDeleteTicket
- useDevTools
- useExpenses
- useFeatureAccess
- useInitialSyncStatus
- useIntegration
- useIntegrationStatus
- useInventoryAnalytics
- useInvoices
- useIsOnboarded
- useManualReturnRate
- useMediaQuery
- useOnboarding
- useOnboardingCosts
- useOrdersAnalytics
- useOrganization
- usePassword
- usePnLAnalytics
- useSaveVariantCosts
- useSetManualReturnRate
- useShippingCosts
- useShopifyProductVariantsPaginated
- useShopifyTime
- useTeamMembers
- useTeamMembersWithManagement
- useTeamStats
- useTicket
- useTickets
- useTransactionFees
- useUpdateExpense
- useUpdateOnboardingState
- useUpsertVariantCosts
- useUser
- useUserTickets

Per‑Hook: useQuery/useMutation counts (inside each hook file)
- apps/web/hooks/useApiKeys.ts — useQuery=1, useMutation=3
- apps/web/hooks/useAgent.ts — useQuery=0, useMutation=1
- apps/web/hooks/useMediaQuery.ts — useQuery=0, useMutation=0
- apps/web/hooks/usePassword.ts — useQuery=0, useMutation=0
- apps/web/hooks/onboarding/useOnboarding.tsx — useQuery=2, useMutation=4
- apps/web/hooks/onboarding/useOnboardingCosts.ts — useQuery=0, useMutation=1
- apps/web/hooks/mainapp/useBilling.ts — useQuery=2, useMutation=1
- apps/web/hooks/mainapp/useOrdersAnalytics.ts — useQuery=2, useMutation=0
- apps/web/hooks/mainapp/useDebounce.ts — useQuery=0, useMutation=0
- apps/web/hooks/mainapp/useShopifyTime.ts — useQuery=0, useMutation=0
- apps/web/hooks/mainapp/useDashboardOverview.ts — useQuery=1, useMutation=1
- apps/web/hooks/mainapp/useInventoryAnalytics.ts — useQuery=1, useMutation=0
- apps/web/hooks/mainapp/useInitialSyncStatus.ts — useQuery=1, useMutation=0
- apps/web/hooks/mainapp/useOrganization.ts — useQuery=1, useMutation=2
- apps/web/hooks/mainapp/useFeatureAccess.tsx — useQuery=0, useMutation=0
- apps/web/hooks/mainapp/useIntegrationRequests.ts — useQuery=0, useMutation=1
- apps/web/hooks/mainapp/useCustomerAnalytics.ts — useQuery=1, useMutation=0
- apps/web/hooks/mainapp/usePnLAnalytics.ts — useQuery=1, useMutation=0
- apps/web/hooks/mainapp/useUser.ts — useQuery=7, useMutation=2
- apps/web/hooks/mainapp/useIntegration.ts — useQuery=3, useMutation=0
- apps/web/hooks/mainapp/useTickets.ts — useQuery=3, useMutation=4
- apps/web/hooks/mainapp/useCost.ts — useQuery=5, useMutation=6
- apps/web/hooks/mainapp/useTeam.ts — useQuery=3, useMutation=0
- apps/web/hooks/mainapp/useInvoices.ts — useQuery=0, useMutation=1

Per‑Hook: usage locations (outside hooks/)
- useAgent — apps/web/components/agent/ChatUI.tsx
- useAnalyticsDateRange —
  apps/web/components/dashboard/(analytics)/customer-insights/CustomerInsightsView.tsx
  apps/web/components/dashboard/(analytics)/customers/CustomersView.tsx
  apps/web/components/dashboard/(analytics)/inventory/InventoryView.tsx
  apps/web/components/dashboard/(analytics)/orders-insights/OrdersInsightsView.tsx
  apps/web/components/dashboard/(analytics)/orders/OrdersView.tsx
  apps/web/components/dashboard/(analytics)/pnl/PnLView.tsx
  apps/web/components/dashboard/overview/UnifiedDashboard.tsx
- useApiKeys — apps/web/components/dashboard/(features)/settings/security/ApiKeyManagement.tsx
- useBilling —
  apps/web/components/dashboard/(features)/settings/billing/AvailablePlans.tsx
  apps/web/components/onboarding/billing/OnboardingBillingView.tsx
- useCost — apps/web/components/onboarding/client/SimpleCostsClient.tsx
- useCreateExpense — apps/web/components/dashboard/(features)/cost-management/OtherCostsTable.tsx
- useCreateIntegrationRequest — apps/web/components/dashboard/(features)/integrations/components/RequestIntegrationModal.tsx
- useCreateShippingCost — apps/web/components/dashboard/(features)/cost-management/ShippingCostTable.tsx
- useCreateTicket — apps/web/components/dashboard/(features)/settings/help/ContactSupport.tsx
- useCreateTransactionFee — apps/web/components/dashboard/(features)/cost-management/PaymentFeesTable.tsx
- useCurrentUser —
  apps/web/components/onboarding/client/MarketingIntegrationsClient.tsx
  apps/web/components/onboarding/client/ShopifyOnboardingClient.tsx
  apps/web/components/onboarding/client/VariantCostsClient.tsx
- useCustomerAnalytics —
  apps/web/components/dashboard/(analytics)/customer-insights/CustomerInsightsView.tsx
  apps/web/components/dashboard/(analytics)/customers/CustomersView.tsx
  apps/web/components/dashboard/(analytics)/orders-insights/OrdersInsightsView.tsx
- useDashboardOverview — apps/web/components/dashboard/overview/UnifiedDashboard.tsx
- useDebounce — apps/web/components/dashboard/layouts/DashboardSidebar.tsx
- useDeleteInvoice — apps/web/components/dashboard/(features)/settings/billing/InvoicesList.tsx
- useDeleteTicket — apps/web/components/dashboard/(features)/settings/help/HelpSettingsView.tsx
- useDevTools — apps/web/components/dashboard/overview/DevTools.tsx
- useFeatureAccess — apps/web/components/shared/billing/FeatureGate.tsx
- useInitialSyncStatus — apps/web/components/dashboard/overview/UnifiedDashboard.tsx
- useIntegration —
  apps/web/components/dashboard/(features)/integrations/IntegrationsView.tsx
  apps/web/components/onboarding/client/MarketingIntegrationsClient.tsx
- useIntegrationStatus — apps/web/components/dashboard/overview/DevTools.tsx
- useInventoryAnalytics — apps/web/components/dashboard/(analytics)/inventory/InventoryView.tsx
- useInvoices — apps/web/components/dashboard/(features)/settings/billing/InvoicesList.tsx
- useIsOnboarded — apps/web/components/dashboard/overview/DevTools.tsx
- useManualReturnRate —
  apps/web/components/dashboard/(features)/cost-management/ReturnRateSettings.tsx
  apps/web/components/onboarding/client/SimpleCostsClient.tsx
- useOnboarding —
  apps/web/components/onboarding/client/AccountSelectionClient.tsx
  apps/web/components/onboarding/client/CompleteOnboardingClient.tsx
  apps/web/components/onboarding/client/MarketingIntegrationsClient.tsx
  apps/web/components/onboarding/client/SimpleCostsClient.tsx
  apps/web/components/onboarding/client/VariantCostsClient.tsx
- useOnboardingCosts — apps/web/components/onboarding/client/SimpleCostsClient.tsx
- useOrdersAnalytics —
  apps/web/components/dashboard/(analytics)/customer-insights/CustomerInsightsView.tsx
  apps/web/components/dashboard/(analytics)/orders-insights/OrdersInsightsView.tsx
  apps/web/components/dashboard/(analytics)/orders/OrdersView.tsx
- useOrganization — apps/web/components/dashboard/(features)/settings/general/ProfileSection.tsx
- usePassword — apps/web/components/dashboard/(features)/settings/general/ProfileSection.tsx
- usePnLAnalytics — apps/web/components/dashboard/(analytics)/pnl/PnLView.tsx
- useSaveVariantCosts —
  apps/web/components/dashboard/(features)/cost-management/ProductCostTable.tsx
  apps/web/components/onboarding/client/VariantCostsClient.tsx
- useSetManualReturnRate — apps/web/components/dashboard/(features)/cost-management/ReturnRateSettings.tsx
- useShippingCosts — apps/web/components/dashboard/(features)/cost-management/ShippingCostTable.tsx
- useShopifyProductVariantsPaginated —
  apps/web/components/dashboard/(features)/cost-management/ProductCostTable.tsx
  apps/web/components/onboarding/client/VariantCostsClient.tsx
- useTeamMembersWithManagement — apps/web/components/dashboard/(features)/settings/team/TeamMembersList.tsx
- useTeamStats — apps/web/components/dashboard/(features)/settings/team/TeamSettingsView.tsx
- useTickets — apps/web/components/home/components/ContactForm.tsx
- useTransactionFees — apps/web/components/dashboard/(features)/cost-management/PaymentFeesTable.tsx
- useUpdateExpense —
  apps/web/components/dashboard/(features)/cost-management/OtherCostsTable.tsx
  apps/web/components/dashboard/(features)/cost-management/ShippingCostTable.tsx
- useUpdateOnboardingState —
  apps/web/components/onboarding/NavigationButtons.tsx
  apps/web/components/onboarding/client/AccountSelectionClient.tsx
  apps/web/components/onboarding/client/SimpleCostsClient.tsx
- useUpsertVariantCosts — apps/web/components/onboarding/client/VariantCostsClient.tsx
- useUser —
  apps/web/components/dashboard/(analytics)/customer-insights/components/CustomerOverviewCards.tsx
  apps/web/components/dashboard/(analytics)/customer-insights/components/CustomerTable.tsx
  apps/web/components/dashboard/(analytics)/inventory/components/InventoryOverviewCards.tsx
  apps/web/components/dashboard/(analytics)/inventory/components/ProductsTable.tsx
  apps/web/components/dashboard/(analytics)/orders-insights/components/CohortAnalysis.tsx
  apps/web/components/dashboard/(analytics)/orders-insights/components/GeographicDistribution.tsx
  apps/web/components/dashboard/(analytics)/orders/components/OrdersOverviewCards.tsx
  apps/web/components/dashboard/(analytics)/orders/components/OrdersTable.tsx
  apps/web/components/dashboard/(analytics)/pnl/components/PnLKPICards.tsx
  apps/web/components/dashboard/(analytics)/pnl/components/PnLTable.tsx
  apps/web/components/dashboard/(features)/settings/general/ProfileSection.tsx
  apps/web/components/dashboard/(features)/settings/help/ContactSupport.tsx
  apps/web/components/dashboard/(features)/settings/security/SecuritySettingsView.tsx
  apps/web/components/dashboard/(features)/settings/team/TeamMembersList.tsx
  apps/web/components/dashboard/(features)/settings/team/TeamSettingsView.tsx
  apps/web/components/dashboard/overview/DevTools.tsx
  apps/web/components/dashboard/overview/UnifiedDashboard.tsx
  apps/web/components/onboarding/client/SimpleCostsClient.tsx
- useUserTickets — apps/web/components/dashboard/(features)/settings/help/HelpSettingsView.tsx

Per‑Route Summary (page -> top-level component analysis)
- apps/web/app/(protected)/(dashboard)/overview/page.tsx
  - total: customHooks=4, useQuery=0, useMutation=0
  - components:
    - apps/web/components/dashboard/overview/UnifiedDashboard.tsx
      - customHooks: useAnalyticsDateRange, useDashboardOverview, useInitialSyncStatus, useUser
- apps/web/app/(protected)/(dashboard)/(features)/integrations/page.tsx
  - total: customHooks=1, useQuery=0, useMutation=0
  - components:
    - apps/web/components/dashboard/(features)/integrations/IntegrationsView.tsx
      - customHooks: useIntegration
- apps/web/app/(protected)/(dashboard)/(analytics)/orders/page.tsx
  - total: customHooks=2, useQuery=0, useMutation=0
  - components:
    - apps/web/components/dashboard/(analytics)/orders/OrdersView.tsx
      - customHooks: useAnalyticsDateRange, useOrdersAnalytics
- apps/web/app/(protected)/(dashboard)/(analytics)/pnl/page.tsx
  - total: customHooks=2, useQuery=0, useMutation=0
  - components:
    - apps/web/components/dashboard/(analytics)/pnl/PnLView.tsx
      - customHooks: useAnalyticsDateRange, usePnLAnalytics
- apps/web/app/(protected)/(dashboard)/(analytics)/customers/page.tsx
  - total: customHooks=2, useQuery=0, useMutation=0
  - components:
    - apps/web/components/dashboard/(analytics)/customers/CustomersView.tsx
      - customHooks: useAnalyticsDateRange, useCustomerAnalytics
- apps/web/app/(protected)/(dashboard)/(analytics)/inventory/page.tsx
  - total: customHooks=2, useQuery=0, useMutation=0
  - components:
    - apps/web/components/dashboard/(analytics)/inventory/InventoryView.tsx
      - customHooks: useAnalyticsDateRange, useInventoryAnalytics
- apps/web/app/(protected)/(dashboard)/(analytics)/orders-insights/page.tsx
  - total: customHooks=3, useQuery=0, useMutation=0
  - components:
    - apps/web/components/dashboard/(analytics)/orders-insights/OrdersInsightsView.tsx
      - customHooks: useAnalyticsDateRange, useCustomerAnalytics, useOrdersAnalytics
- apps/web/app/(protected)/(dashboard)/(analytics)/customer-insights/page.tsx
  - total: customHooks=3, useQuery=0, useMutation=0
  - components:
    - apps/web/components/dashboard/(analytics)/customer-insights/CustomerInsightsView.tsx
      - customHooks: useAnalyticsDateRange, useCustomerAnalytics, useOrdersAnalytics
- apps/web/app/(protected)/onboarding/accounts/page.tsx
  - total: customHooks=2, useQuery=1, useMutation=1
  - components:
    - apps/web/components/onboarding/client/AccountSelectionClient.tsx
      - customHooks: useOnboarding, useUpdateOnboardingState (also uses 1 useQuery, 1 useMutation)
- apps/web/app/(protected)/onboarding/billing/page.tsx
  - total: customHooks=1, useQuery=2, useMutation=0
  - components:
    - apps/web/components/onboarding/billing/OnboardingBillingView.tsx
      - customHooks: useBilling (also uses 2 useQuery)
- apps/web/app/(protected)/onboarding/complete/page.tsx
  - total: customHooks=1, useQuery=0, useMutation=0
  - components:
    - apps/web/components/onboarding/client/CompleteOnboardingClient.tsx
      - customHooks: useOnboarding
- apps/web/app/(protected)/onboarding/cost/page.tsx
  - total: customHooks=6, useQuery=0, useMutation=0
  - components:
    - apps/web/components/onboarding/client/SimpleCostsClient.tsx
      - customHooks: useCost, useManualReturnRate, useOnboarding, useOnboardingCosts, useUpdateOnboardingState, useUser
- apps/web/app/(protected)/onboarding/marketing/page.tsx
  - total: customHooks=3, useQuery=0, useMutation=0
  - components:
    - apps/web/components/onboarding/client/MarketingIntegrationsClient.tsx
      - customHooks: useCurrentUser, useIntegration, useOnboarding
- apps/web/app/(protected)/onboarding/products/page.tsx
  - total: customHooks=5, useQuery=0, useMutation=0
  - components:
    - apps/web/components/onboarding/client/VariantCostsClient.tsx
      - customHooks: useCurrentUser, useOnboarding, useSaveVariantCosts, useShopifyProductVariantsPaginated, useUpsertVariantCosts
- apps/web/app/(protected)/onboarding/shopify/page.tsx
  - total: customHooks=1, useQuery=0, useMutation=1
  - components:
    - apps/web/components/onboarding/client/ShopifyOnboardingClient.tsx
      - customHooks: useCurrentUser (also uses 1 useMutation)
- apps/web/app/(protected)/(dashboard)/(features)/cost-management/page.tsx
  - total: customHooks=0, useQuery=0, useMutation=0 (top-level component)
- apps/web/app/(protected)/(dashboard)/(features)/settings/page.tsx
  - total: customHooks=0, useQuery=0, useMutation=0 (top-level component)
- apps/web/app/(public)/* pages
  - total: customHooks=0, useQuery=0, useMutation=0 (marketing pages)

Notes
- Per‑route counts aggregate hooks and query/mutation usage in the page component and its top‑level imported components only. Deeper nested components may add additional usage not reflected here.
- Unused hooks list is scoped to apps/web; a hook may be used by other apps in the monorepo.
