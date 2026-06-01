import type { LucideIcon } from "lucide-react";
import {
  TrendingUp,
  Upload,
} from "lucide-react";
import { SalesTrendChart } from "../components/dashboard/SalesTrendChart";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import type { DashboardData, Metric } from "../types/dashboard";
import { formatNumber } from "../lib/utils";

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

function metricToneClass(tone: Metric["tone"]) {
  return {
    primary: "bg-blue-50 text-blue-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-500",
    danger: "bg-red-50 text-red-500",
    info: "bg-sky-50 text-sky-600",
    neutral: "bg-slate-50 text-slate-500",
  }[tone ?? "neutral"];
}

function isForecastMetric(metric: Metric) {
  return !/(품절|재고|발주)/.test(metric.label);
}

export function OverviewPage({ data }: { data: DashboardData }) {
  if (data.source === "empty") {
    return (
      <div className="mx-auto w-full max-w-[1080px]">
        <EmptyState
          icon={Upload}
          title="예상 판매량 파일이 필요합니다"
          description="자료 올리기에서 판매 이력 CSV를 선택하면 AI 분석 결과가 표시됩니다."
        />
      </div>
    );
  }

  const summaryCards: SummaryCard[] = data.overviewMetrics
    .filter(isForecastMetric)
    .map((metric) => ({
          label: metric.label,
          value: metric.value,
          helper: metric.helper,
          icon: metric.icon,
          tone: metricToneClass(metric.tone),
        }));
  const topForecastItems = [...data.forecastItems].slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-6">
      {summaryCards.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((metric) => (
            <CompactMetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      ) : null}

      {data.salesTrend.length ? (
        <Card className="overflow-hidden p-0">
          <div className="p-6 pb-2">
            <CardHeader className="mb-0">
              <div>
                <CardTitle>AI 예측 그래프</CardTitle>
                <CardDescription>업로드 CSV 기준 실제 판매량과 AI 예측 판매량을 비교합니다.</CardDescription>
              </div>
            </CardHeader>
          </div>
          <div className="px-6 pb-6">
            <SalesTrendChart data={data.salesTrend} />
          </div>
        </Card>
      ) : null}

      {data.source === "ai" && topForecastItems.length ? (
        <Card className="p-6">
          <CardHeader>
            <div>
              <CardTitle>AI 상품별 7일 예상 판매량</CardTitle>
              <CardDescription>로컬 AI 서버가 반환한 상품별 예측 결과입니다.</CardDescription>
            </div>
          </CardHeader>
          <div className="mt-2 divide-y divide-gray-100">
            {topForecastItems.map((item) => (
              <div key={item.itemId} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900" title={item.itemName}>
                    {item.itemName}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-400">{item.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold tracking-tight text-blue-600">{formatNumber(item.forecastQty)}개</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.forecastHorizonDays ? `${item.forecastHorizonDays}일 예상 판매량` : "예상 판매량"}
                  </p>
                  {typeof item.forecastDailyQty === "number" ? (
                    <p className="mt-1 text-xs text-slate-400">하루 평균 {formatNumber(item.forecastDailyQty)}개</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={TrendingUp}
          title="표시할 AI 예측 결과가 없습니다"
          description="CSV를 다시 업로드하거나 로컬 AI 서버 응답을 확인하세요."
        />
      )}
    </div>
  );
}
