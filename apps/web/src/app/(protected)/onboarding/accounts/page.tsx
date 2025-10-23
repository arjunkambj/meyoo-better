import AccountSelectionClient from "@/components/onboarding/client/AccountSelectionClient";

export default function AccountsPage() {
  return (
    <section className="max-w-3xl mx-auto h-full">
      {/* Header */}
      <div className="mb-12 text-center flex flex-col lg:text-left">
        <h1 className="text-2xl lg:text-3xl font-bold text-default-900 mb-2">
          Select Your Ad Accounts
        </h1>
        <p className="text-lg text-default-600">
          Choose which ad accounts to track and set your primary account
        </p>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        <AccountSelectionClient />
      </div>
    </section>
  );
}
