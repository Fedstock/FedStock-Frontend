import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  Upload,
} from "lucide-react";
import { DashboardShell } from "./components/layout/DashboardShell";
import { CsvUploadPage } from "./pages/CsvUploadPage";
import { OverviewPage } from "./pages/OverviewPage";
import { emptyCsvStatus, emptyDashboardData } from "./lib/empty-data";
import type { CsvStatus, DashboardData, PageDefinition, PageId } from "./types/dashboard";

const pages: PageDefinition[] = [
  {
    id: "upload",
    label: "자료 올리기",
    title: "자료 올리기",
    subtitle: "예상 판매량 파일을 먼저 올려 AI 분석을 시작하세요.",
    icon: Upload,
  },
  {
    id: "overview",
    label: "AI 예측 결과",
    title: "AI 예측 결과",
    subtitle: "로컬 AI 모델이 계산한 상품별 예상 판매량을 확인하세요.",
    icon: LayoutDashboard,
  },
];

export default function App() {
  const [activePage, setActivePage] = useState<PageId>("upload");
  const [dashboardData, setDashboardData] = useState<DashboardData>(emptyDashboardData);
  const [csvStatus, setCsvStatus] = useState<CsvStatus>(emptyCsvStatus);

  const headerSummary = useMemo(() => {
    const hasAiResult = dashboardData.source === "ai";

    switch (activePage) {
      case "upload":
        return hasAiResult
          ? "AI 모델 분석 결과가 반영됐습니다. 예측 결과 화면에서 확인하세요."
          : "예상 판매량 파일을 올리면 로컬 AI 모델로 분석합니다.";
      case "overview":
      default:
        return hasAiResult
          ? "로컬 AI 모델이 반환한 상품별 예측 판매량을 확인하세요."
          : "자료 올리기에서 예상 판매량 파일을 먼저 선택하세요.";
    }
  }, [activePage, dashboardData]);

  const pageContent = useMemo(() => {
    switch (activePage) {
      case "upload":
        return (
          <CsvUploadPage
            csvStatus={csvStatus}
            onCsvLoaded={(status, data) => {
              setCsvStatus(status);
              setDashboardData(data);
            }}
          />
        );
      case "overview":
      default:
        return <OverviewPage data={dashboardData} />;
    }
  }, [activePage, csvStatus, dashboardData]);

  return (
    <DashboardShell
      pages={pages}
      activePage={activePage}
      onPageChange={setActivePage}
      dataSource={dashboardData.source}
      headerSummary={headerSummary}
    >
      {pageContent}
    </DashboardShell>
  );
}
