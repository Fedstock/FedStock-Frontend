import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BarChart3,
  DollarSign,
  PackageCheck,
  PackageOpen,
  ShoppingCart,
  TrendingUp,
  Truck,
} from "lucide-react";
import { SalesTrendChart } from "../components/dashboard/SalesTrendChart";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import type { DashboardData } from "../types/dashboard";
import { average, formatCurrency, formatNumber } from "../lib/utils";

type SummaryCard = {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  tone: string;
};

function CompactMetricCard({ metric }: { metric: SummaryCard }) {
  const Icon = metric.icon;

  return (
    <Card className="rounded-[18px] p-4 shadow-[0_10px_28px_rgb(15,23,42,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-400">{metric.label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{metric.value}</p>
          {metric.helper ? <p className="mt-2 truncate text-xs text-slate-400">{metric.helper}</p> : null}
        </div>
        <div className={`rounded-2xl p-2.5 ${metric.tone}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    </Card>
  );
}

export function OverviewPage({ data }: { data: DashboardData }) {
  const latestTrendPoint = data.salesTrend[data.salesTrend.length - 1];
  const latestSales = latestTrendPoint?.sales ?? 0;
  const latestRevenue = latestTrendPoint?.revenue ?? 0;
  const criticalInventoryCount = data.inventoryItems.filter((item) => item.status === "critical").length;
  const normalInventoryCount = data.inventoryItems.filter((item) => item.status === "normal").length;
  const orderItems = data.orderRecommendations.filter((item) => item.recommendedOrderQty > 0);
  const recommendedOrderTotal = orderItems.reduce((total, item) => total + item.recommendedOrderQty, 0);
  const averageLeadTime = average(data.orderRecommendations.map((item) => item.leadTimeDays));

  const summaryCards: SummaryCard[] = [
    {
      label: "오늘 예상 판매량",
      value: `${formatNumber(latestSales)}개`,
      helper: "최근 흐름 기준",
      icon: TrendingUp,
      tone: "bg-blue-50 text-blue-600",
    },
    {
      label: "품절 위험 상품",
      value: `${criticalInventoryCount}개`,
      helper: "3일 이내 소진 예상",
      icon: AlertCircle,
      tone: "bg-red-50 text-red-500",
    },
    {
      label: "추천 발주 총량",
      value: `${formatNumber(recommendedOrderTotal)}개`,
      helper: "오늘 발주 필요",
      icon: ShoppingCart,
      tone: "bg-amber-50 text-amber-500",
    },
    {
      label: "예상 매출",
      value: formatCurrency(latestRevenue),
      helper: "오늘 판매 기준",
      icon: DollarSign,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "판매 상위 상품",
      value: `${data.topProducts.length}개`,
      helper: "Top 상품 기준",
      icon: BarChart3,
      tone: "bg-sky-50 text-sky-600",
    },
    {
      label: "정상 재고",
      value: `${normalInventoryCount}개`,
      helper: "운영 범위 내",
      icon: PackageCheck,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "발주 추천 상품",
      value: `${orderItems.length}개`,
      helper: "수량 확인 필요",
      icon: PackageOpen,
      tone: "bg-indigo-50 text-indigo-600",
    },
    {
      label: "평균 입고 기간",
      value: `${formatNumber(averageLeadTime)}일`,
      helper: "등록 상품 기준",
      icon: Truck,
      tone: "bg-slate-50 text-slate-500",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((metric) => (
          <CompactMetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="p-6 pb-2">
          <CardHeader className="mb-0">
            <div>
              <CardTitle>판매 그래프</CardTitle>
              <CardDescription>최근 실제 판매와 앞으로의 예상 판매를 비교합니다.</CardDescription>
            </div>
          </CardHeader>
        </div>
        <div className="px-6 pb-6">
          <SalesTrendChart data={data.salesTrend} />
        </div>
      </Card>
    </div>
  );
}
