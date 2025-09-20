import KPICard from "@/components/shared/KPICard";

export default function DashboardPage() {
  // Mock data - replace with actual Convex queries
  const metrics = {
    totalUsers: 1234,
    trialUsers: 456,
    paidUsers: 778,
    mrr: "$12,450",
    userChange: 12,
    trialChange: -5,
    paidChange: 18,
    mrrChange: 22,
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-500 mt-1">Monitor your platform metrics and user activity</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Total Users"
          value={metrics.totalUsers.toLocaleString()}
          change={metrics.userChange}
          icon="solar:users-group-two-rounded-linear"
          iconColor="text-blue-500"
        />
        <KPICard
          title="Trial Users"
          value={metrics.trialUsers.toLocaleString()}
          change={metrics.trialChange}
          icon="solar:clock-circle-linear"
          iconColor="text-yellow-500"
        />
        <KPICard
          title="Paid Users"
          value={metrics.paidUsers.toLocaleString()}
          change={metrics.paidChange}
          icon="solar:verified-check-linear"
          iconColor="text-green-500"
        />
        <KPICard
          title="MRR"
          value={metrics.mrr}
          change={metrics.mrrChange}
          icon="solar:dollar-minimalistic-linear"
          iconColor="text-purple-500"
        />
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Recent Signups</h2>
          <p className="text-gray-500">User list will appear here</p>
        </div>

        {/* Open Tickets */}
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Open Tickets</h2>
          <p className="text-gray-500">Support tickets will appear here</p>
        </div>
      </div>
    </div>
  );
}