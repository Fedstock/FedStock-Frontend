import {
  AlertCircle,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  Truck,
} from "lucide-react";
import type {
  CsvIssue,
  CsvStatus,
  DashboardData,
  ForecastItem,
  ForecastPoint,
  InventoryItem,
  OrderRecommendation,
  SalesTrendPoint,
  TopProduct,
  ValidationItem,
} from "../types/dashboard";
import { average, clamp, formatCurrency, formatNumber, sum } from "./utils";
import { mockDashboardData } from "./mock-data";

type CsvRow = Record<string, string>;

const requiredColumns = ["item_id", "sale_date", "sales", "current_stock", "sell_price"];
const optionalColumns = ["category", "lead_time_days", "ordered_qty", "on_order_qty", "safety_stock", "reorder_point", "recommended_order_qty"];
const displayLabels: Record<string, string> = {
  item_id: "상품 번호",
  sale_date: "판매일",
  sales: "판매량",
  current_stock: "현재 재고",
  sell_price: "판매가",
  category: "상품 분류",
  lead_time_days: "입고 기간",
  ordered_qty: "입고 예정 수량",
  on_order_qty: "입고 예정 수량",
  safety_stock: "남겨둘 재고",
  reorder_point: "발주 기준",
  recommended_order_qty: "발주 추천 수량",
};

function parseLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === "\"" && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

export function parseCsvText(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];
  const [headerLine, ...lines] = normalized.split("\n").filter(Boolean);
  const headers = parseLine(headerLine).map((header) => header.trim());
  return lines.map((line) => {
    const values = parseLine(line);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function toNumber(value: string | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getRowDate(row: CsvRow) {
  return toDate(row.sale_date ?? row.date);
}

function getSales(row: CsvRow) {
  return toNumber(row.sales ?? row.quantity, 0);
}

function getItemName(row: CsvRow) {
  return row.item_name || row.itemId || row.item_id || "Unknown item";
}

function getCategory(row: CsvRow) {
  return row.category || row.cat_id || row.dept_id || getItemName(row).split("_")[0] || "Uncategorized";
}

function buildValidation(rows: CsvRow[]) {
  const headers = new Set(Object.keys(rows[0] ?? {}));
  const validation: ValidationItem[] = [
    ...requiredColumns.map((column) => ({
      column,
      label: displayLabels[column] ?? column,
      required: true,
      status: headers.has(column) ? "passed" : "failed",
      message: headers.has(column) ? "필수 항목 확인" : "필수 항목 누락",
    }) satisfies ValidationItem),
    ...optionalColumns.map((column) => ({
      column,
      label: displayLabels[column] ?? column,
      required: false,
      status: headers.has(column) ? "passed" : "warning",
      message: headers.has(column) ? "추가 항목 확인" : "없으면 화면에서 계산",
    }) satisfies ValidationItem),
  ];

  const issues: CsvIssue[] = [];
  const missingRequired = validation.filter((item) => item.required && item.status === "failed");
  if (missingRequired.length) {
    issues.push({
      severity: "error",
      message: `필수 항목 누락: ${missingRequired.map((item) => item.label).join(", ")}`,
    });
  }

  const invalidDateCount = rows.filter((row) => !getRowDate(row)).length;
  if (invalidDateCount > 0) {
    issues.push({
      severity: "warning",
      message: `${formatNumber(invalidDateCount)}개의 자료에서 날짜를 읽지 못했습니다.`,
    });
  }

  const negativeStockCount = rows.filter((row) => toNumber(row.current_stock, 0) < 0).length;
  if (negativeStockCount > 0) {
    issues.push({
      severity: "warning",
      message: `${formatNumber(negativeStockCount)}개의 자료에 음수 재고가 있습니다.`,
    });
  }

  return { validation, issues };
}

function createCsvStatus(fileName: string, rows: CsvRow[]): CsvStatus {
  const { validation, issues } = buildValidation(rows);
  const validDates = rows.map(getRowDate).filter((date): date is Date => date !== null);
  const uniqueProducts = new Set(rows.map((row) => row.item_id).filter(Boolean));
  const minDate = validDates.length ? new Date(Math.min(...validDates.map((date) => date.getTime()))) : null;
  const maxDate = validDates.length ? new Date(Math.max(...validDates.map((date) => date.getTime()))) : null;

  return {
    state: issues.some((issue) => issue.severity === "error") ? "failed" : "loaded",
    fileName,
    rowCount: rows.length,
    productCount: uniqueProducts.size,
    dateRange:
      minDate && maxDate
        ? `${minDate.toLocaleDateString("ko-KR")} - ${maxDate.toLocaleDateString("ko-KR")}`
        : undefined,
    uploadedAt: new Date().toLocaleString("ko-KR"),
    validation,
    issues,
  };
}

function groupRowsByItem(rows: CsvRow[]) {
  const groups = new Map<string, CsvRow[]>();
  rows.forEach((row) => {
    const key = row.item_id || row.id || "unknown";
    const existing = groups.get(key) ?? [];
    existing.push(row);
    groups.set(key, existing);
  });

  groups.forEach((group) => {
    group.sort((a, b) => (getRowDate(a)?.getTime() ?? 0) - (getRowDate(b)?.getTime() ?? 0));
  });
  return groups;
}

function buildForecastItems(groups: Map<string, CsvRow[]>): ForecastItem[] {
  return Array.from(groups.entries()).map(([itemId, group]) => {
    const latest = group[group.length - 1] ?? {};
    const recentSales = group.map(getSales);
    const rollingMean7 = toNumber(latest.rolling_mean_7, average(recentSales.slice(-7)));
    const rollingMean28 = toNumber(latest.rolling_mean_28, average(recentSales.slice(-28)));
    const trendGap = rollingMean28 > 0 ? ((rollingMean7 - rollingMean28) / rollingMean28) * 100 : 0;
    const forecastQty = Math.max(0, Number((rollingMean7 * 0.65 + rollingMean28 * 0.35).toFixed(1)));
    return {
      itemId,
      itemName: getItemName(latest),
      category: getCategory(latest),
      forecastQty,
      rollingMean7: Number(rollingMean7.toFixed(1)),
      rollingMean28: Number(rollingMean28.toFixed(1)),
      wowChangePct: Number(trendGap.toFixed(1)),
      trend: trendGap > 8 ? "up" : trendGap < -8 ? "down" : "stable",
      confidence: Math.round(clamp(88 - Math.abs(trendGap) * 0.45, 58, 96)),
    };
  });
}

function buildInventoryItems(groups: Map<string, CsvRow[]>, forecasts: ForecastItem[]): InventoryItem[] {
  const forecastMap = new Map(forecasts.map((item) => [item.itemId, item]));
  return Array.from(groups.entries()).map(([itemId, group]) => {
    const latest = group[group.length - 1] ?? {};
    const forecast = forecastMap.get(itemId);
    const currentStock = toNumber(latest.current_stock, Math.round((forecast?.rollingMean7 ?? 0) * 6));
    const expectedDailySales = forecast?.forecastQty ?? 0;
    const daysUntilStockout = expectedDailySales > 0 ? currentStock / expectedDailySales : null;
    return {
      itemId,
      itemName: getItemName(latest),
      category: getCategory(latest),
      currentStock,
      expectedDailySales,
      daysUntilStockout,
      status:
        daysUntilStockout === null
          ? "normal"
          : daysUntilStockout <= 3
            ? "critical"
            : daysUntilStockout <= 7
              ? "warning"
              : daysUntilStockout > 28
                ? "overstock"
                : "normal",
      trend: forecast?.trend ?? "stable",
    };
  });
}

function buildOrders(groups: Map<string, CsvRow[]>, inventory: InventoryItem[]): OrderRecommendation[] {
  const inventoryMap = new Map(inventory.map((item) => [item.itemId, item]));
  return Array.from(groups.entries()).map(([itemId, group]) => {
    const latest = group[group.length - 1] ?? {};
    const item = inventoryMap.get(itemId);
    const expectedDailySales = item?.expectedDailySales ?? 0;
    const leadTimeDays = toNumber(latest.lead_time_days, 4);
    const safetyStock = toNumber(latest.safety_stock, Math.round(expectedDailySales * leadTimeDays * 0.65));
    const reorderPoint = toNumber(latest.reorder_point, Math.round(expectedDailySales * leadTimeDays + safetyStock));
    const orderedQty = toNumber(latest.ordered_qty ?? latest.on_order_qty, 0);
    const currentStock = item?.currentStock ?? 0;
    const calculatedQty = Math.max(0, reorderPoint + safetyStock - currentStock - orderedQty);
    const recommendedOrderQty = toNumber(latest.recommended_order_qty, calculatedQty);
    const daysUntilStockout = item?.daysUntilStockout ?? null;
    const priority =
      currentStock < safetyStock || (daysUntilStockout ?? 999) <= leadTimeDays
        ? "high"
        : currentStock < reorderPoint
          ? "medium"
          : "low";
    return {
      itemId,
      itemName: getItemName(latest),
      category: getCategory(latest),
      currentStock,
      reorderPoint,
      safetyStock,
      leadTimeDays,
      orderedQty,
      recommendedOrderQty: Math.round(recommendedOrderQty),
      priority,
      reason:
        recommendedOrderQty > 0
          ? `현재 재고 ${formatNumber(currentStock)}개가 재주문 기준보다 낮아 보충 발주가 필요합니다.`
          : "현재 재고와 입고 예정 수량이 기준을 충족합니다.",
    };
  });
}

function buildSalesTrend(rows: CsvRow[]): SalesTrendPoint[] {
  const byDate = new Map<string, { sales: number; revenue: number }>();
  rows.forEach((row) => {
    const date = getRowDate(row);
    if (!date) return;
    const key = date.toISOString().slice(5, 10).replace("-", "/");
    const sales = getSales(row);
    const price = toNumber(row.sell_price, 0);
    const existing = byDate.get(key) ?? { sales: 0, revenue: 0 };
    byDate.set(key, {
      sales: existing.sales + sales,
      revenue: existing.revenue + sales * price,
    });
  });

  return Array.from(byDate.entries())
    .slice(-30)
    .map(([date, value], index, array) => {
      const recent = array.slice(Math.max(0, index - 6), index + 1).map(([, point]) => point.sales);
      return {
        date,
        sales: Math.round(value.sales),
        forecast: Math.round(average(recent)),
        revenue: Math.round(value.revenue),
      };
    });
}

function buildTopProducts(groups: Map<string, CsvRow[]>): TopProduct[] {
  return Array.from(groups.entries())
    .map(([itemId, group]) => {
      const latest = group[group.length - 1] ?? {};
      const sales = sum(group.map(getSales));
      const revenue = sum(group.map((row) => getSales(row) * toNumber(row.sell_price, 0)));
      return {
        itemId,
        itemName: getItemName(latest),
        category: getCategory(latest),
        sales: Math.round(sales),
        revenue: Math.round(revenue),
      };
    })
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 8);
}

function buildForecastSeries(salesTrend: SalesTrendPoint[]): ForecastPoint[] {
  return salesTrend.slice(-20).map((point) => ({
    date: point.date,
    actual: point.sales,
    predicted: point.forecast,
  }));
}

function metricCounts(inventory: InventoryItem[]) {
  return {
    critical: inventory.filter((item) => item.status === "critical").length,
    warning: inventory.filter((item) => item.status === "warning").length,
    normal: inventory.filter((item) => item.status === "normal").length,
    overstock: inventory.filter((item) => item.status === "overstock").length,
  };
}

function sparkline(values: number[], fallback: number) {
  const recent = values.filter((value) => Number.isFinite(value)).slice(-7);
  return recent.length >= 2 ? recent : [fallback * 0.84, fallback * 0.9, fallback * 0.96, fallback * 0.92, fallback];
}

export function buildDashboardFromCsv(fileName: string, rows: CsvRow[]) {
  const status = createCsvStatus(fileName, rows);
  if (status.state === "failed") {
    return { status, data: mockDashboardData };
  }

  const groups = groupRowsByItem(rows);
  const forecastItems = buildForecastItems(groups);
  const inventoryItems = buildInventoryItems(groups, forecastItems);
  const orderRecommendations = buildOrders(groups, inventoryItems);
  const salesTrend = buildSalesTrend(rows);
  const topProducts = buildTopProducts(groups);
  const counts = metricCounts(inventoryItems);
  const forecastTotal = sum(forecastItems.map((item) => item.forecastQty));
  const orderTotal = sum(orderRecommendations.map((item) => item.recommendedOrderQty));
  const revenueEstimate = sum(forecastItems.map((item) => {
    const itemRows = groups.get(item.itemId);
    const latest = itemRows ? itemRows[itemRows.length - 1] : undefined;
    return item.forecastQty * toNumber(latest?.sell_price, 0);
  }));
  const salesSparkline = sparkline(salesTrend.map((point) => point.sales), forecastTotal);
  const revenueSparkline = sparkline(salesTrend.map((point) => point.revenue), revenueEstimate);

  const data: DashboardData = {
    ...mockDashboardData,
    source: "csv",
    overviewMetrics: [
      { label: "오늘 예상 판매량", value: `${formatNumber(forecastTotal)}개`, helper: "올린 자료 기준 계산", sparkline: salesSparkline, trend: "up", icon: TrendingUp, tone: "primary" },
      { label: "품절 위험 상품", value: `${counts.critical}개`, helper: "3일 이내 소진 예상", sparkline: [counts.critical + 2, counts.critical + 1, counts.critical, counts.critical + 1, counts.critical], icon: Package, tone: "danger" },
      { label: "추천 발주 수량", value: `${formatNumber(orderTotal)}개`, helper: "재고 기준으로 계산", sparkline: [orderTotal * 0.72, orderTotal * 0.8, orderTotal * 0.91, orderTotal * 0.86, orderTotal], icon: ShoppingCart, tone: "warning" },
      { label: "예상 매출", value: formatCurrency(revenueEstimate), helper: "예상 판매량과 판매가 기준", sparkline: revenueSparkline, icon: DollarSign, tone: "success" },
    ],
    salesTrend,
    topProducts,
    forecastSeries: buildForecastSeries(salesTrend),
    inventoryMetrics: [
      { label: "품절 위험 상품", value: `${counts.critical}개`, helper: "3일 이내 소진", sparkline: [counts.critical + 2, counts.critical + 1, counts.critical, counts.critical + 1, counts.critical], icon: AlertCircle, tone: "danger" },
      { label: "주의 상품", value: `${counts.warning}개`, helper: "7일 이내 점검", sparkline: [counts.warning, counts.warning + 1, counts.warning, counts.warning, counts.warning], icon: Package, tone: "warning" },
      { label: "정상 상품", value: `${counts.normal}개`, helper: "운영 범위 내", sparkline: [counts.normal - 1, counts.normal, counts.normal, counts.normal + 1, counts.normal], icon: Package, tone: "success" },
      { label: "여유 재고", value: `${counts.overstock}개`, helper: "28일 이상 보유", sparkline: [counts.overstock, counts.overstock, counts.overstock + 1, counts.overstock, counts.overstock], icon: Package, tone: "info" },
    ],
    inventoryItems,
    orderMetrics: [
      { label: "발주 필요 상품", value: `${orderRecommendations.filter((item) => item.recommendedOrderQty > 0).length}개`, helper: "오늘 발주 제안", sparkline: [orderRecommendations.length - 2, orderRecommendations.length - 1, orderRecommendations.length], icon: ShoppingCart, tone: "primary" },
      { label: "추천 발주 수량", value: `${formatNumber(orderTotal)}개`, helper: "오늘 제안 수량", sparkline: [orderTotal * 0.72, orderTotal * 0.8, orderTotal * 0.91, orderTotal * 0.86, orderTotal], icon: ShoppingCart, tone: "warning" },
      { label: "먼저 발주할 상품", value: `${orderRecommendations.filter((item) => item.priority === "high").length}개`, helper: "입고 전에 떨어질 수 있음", sparkline: [2, 3, orderRecommendations.filter((item) => item.priority === "high").length], icon: Truck, tone: "danger" },
      { label: "평균 입고 기간", value: `${formatNumber(average(orderRecommendations.map((item) => item.leadTimeDays)))}일`, helper: "등록 상품 기준", sparkline: sparkline(orderRecommendations.map((item) => item.leadTimeDays), 4), icon: Truck, tone: "info" },
    ],
    orderRecommendations,
  };

  return { status, data };
}
