import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, TrendingUp, TrendingDown, Clock, Activity } from "lucide-react"
import DashboardCharts from "@/components/DashboardCharts"

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const productCount = await prisma.product.count()
  
  // Pending reviews
  const pendingReviews = await prisma.invoiceDraft.count({
    where: { status: "pending_review" }
  })

  // Get total purchases vs sales this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0,0,0,0)

  const transactions = await prisma.transaction.findMany({
    where: { transactionDate: { gte: startOfMonth } }
  })

  const totalPurchases = transactions.filter(t => t.transactionType === 'purchase').length
  const totalSales = transactions.filter(t => t.transactionType === 'sale').length

  const stats = [
    {
      title: "Total Inventory Items",
      value: productCount.toLocaleString(),
      icon: Package,
      description: "Unique products in system",
      trend: "active",
      color: "from-blue-500/20 to-blue-600/20 text-blue-600",
      bg: "bg-blue-500/10"
    },
    {
      title: "Pending Reviews",
      value: pendingReviews.toString(),
      icon: Clock,
      description: "Invoices needing approval",
      trend: pendingReviews > 0 ? "warning" : "neutral",
      color: "from-amber-500/20 to-amber-600/20 text-amber-600",
      bg: "bg-amber-500/10"
    },
    {
      title: "Monthly Purchases",
      value: totalPurchases.toString(),
      icon: TrendingDown,
      description: "Inward stock operations",
      trend: "positive",
      color: "from-emerald-500/20 to-emerald-600/20 text-emerald-600",
      bg: "bg-emerald-500/10"
    },
    {
      title: "Monthly Sales",
      value: totalSales.toString(),
      icon: TrendingUp,
      description: "Outward stock operations",
      trend: "positive",
      color: "from-violet-500/20 to-violet-600/20 text-violet-600",
      bg: "bg-violet-500/10"
    }
  ]

  // Prepare chart data (Last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0,0,0,0);

  const recentTransactions = await prisma.transaction.findMany({
    where: { transactionDate: { gte: sixMonthsAgo } },
    select: { transactionType: true, transactionDate: true }
  });

  const monthlyDataMap = new Map();
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const monthKey = d.toLocaleString('default', { month: 'short' });
    monthlyDataMap.set(monthKey, { name: monthKey, sales: 0, purchases: 0 });
  }

  recentTransactions.forEach(t => {
    const monthKey = t.transactionDate.toLocaleString('default', { month: 'short' });
    if (monthlyDataMap.has(monthKey)) {
      const data = monthlyDataMap.get(monthKey);
      if (t.transactionType === 'sale') data.sales++;
      if (t.transactionType === 'purchase') data.purchases++;
    }
  });

  const chartData = Array.from(monthlyDataMap.values()).reverse();

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Overview</h1>
          <p className="text-slate-500 mt-2 text-lg">Your automated inventory and accounting summary.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="group relative overflow-hidden rounded-2xl border bg-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1">
            <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-50 blur-2xl transition-all group-hover:scale-150 ${stat.color}`} />
            
            <div className="relative flex items-center justify-between">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color.split(' ').pop()}`} />
              </div>
            </div>
            
            <div className="relative mt-6">
              <h3 className="text-sm font-medium text-slate-500">{stat.title}</h3>
              <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p>
              <p className="mt-1 text-sm text-slate-400">{stat.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <DashboardCharts data={chartData} />
        <div className="rounded-2xl border bg-gradient-to-br from-indigo-500 to-violet-600 p-8 shadow-lg text-white">
          <h3 className="text-lg font-semibold opacity-90">System Status</h3>
          <div className="mt-6 space-y-4">
            <div className="flex justify-between items-center border-b border-white/20 pb-4">
              <span className="opacity-80">OCR Engine</span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">Online</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/20 pb-4">
              <span className="opacity-80">Telegram Bot</span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">Listening</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="opacity-80">Database</span>
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm">Connected</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
