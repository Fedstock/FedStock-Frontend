import { useRef, useState, type DragEvent } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Database,
  FileSpreadsheet,
  Upload,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "../components/ui/EmptyState";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Card, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import type { CsvStatus, DashboardData, ValidationItem } from "../types/dashboard";
import { analyzeCsvWithAi } from "../lib/ai-api";
import { formatNumber } from "../lib/utils";

type CsvUploadPageProps = {
  csvStatus: CsvStatus;
  onCsvLoaded: (status: CsvStatus, data: DashboardData) => void;
};

type UploadTargetProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  buttonLabel: string;
  selectedFileName?: string;
  disabled?: boolean;
  isActive: boolean;
  onBrowse: () => void;
  onDropFile: (file: File) => void;
  onDragStateChange: (isDragging: boolean) => void;
};

function UploadTarget({
  icon: Icon,
  title,
  description,
  buttonLabel,
  selectedFileName,
  disabled = false,
  isActive,
  onBrowse,
  onDropFile,
  onDragStateChange,
}: UploadTargetProps) {
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onDragStateChange(false);
    const file = event.dataTransfer.files[0];
    if (file) onDropFile(file);
  };

  return (
    <div
      className={`flex min-h-[280px] flex-col justify-between rounded-[18px] border border-dashed p-5 transition ${
        isActive ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[rgba(15,23,42,0.12)] bg-slate-50"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        onDragStateChange(true);
      }}
      onDragLeave={() => onDragStateChange(false)}
      onDrop={handleDrop}
    >
      <div>
        <div className="mb-4 inline-flex rounded-2xl bg-white p-3 text-[#2563EB] shadow-sm">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-[#111827]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[#6B7280]">{description}</p>
      </div>
      <div className="mt-6 space-y-3">
        {selectedFileName ? (
          <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3 text-sm">
            <p className="text-xs font-medium text-[#6B7280]">선택된 파일</p>
            <p className="mt-1 break-all font-semibold text-[#111827]">{selectedFileName}</p>
          </div>
        ) : null}
        <Button type="button" onClick={onBrowse} disabled={disabled}>
          <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
          {buttonLabel}
        </Button>
      </div>
    </div>
  );
}

function ValidationRow({ item }: { item: ValidationItem }) {
  const Icon = item.status === "passed" ? CheckCircle : item.status === "failed" ? XCircle : AlertTriangle;
  const tone = item.status === "passed" ? "success" : item.status === "failed" ? "danger" : "warning";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(15,23,42,0.08)] py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${item.status === "passed" ? "text-emerald-600" : item.status === "failed" ? "text-red-600" : "text-amber-600"}`} aria-hidden="true" />
        <div>
          <p className="font-medium text-[#1F2937]">{item.label}</p>
          <p className="text-sm text-[#6B7280]">{item.message}</p>
        </div>
      </div>
      <Badge tone={tone}>{item.required ? "필수" : "선택"}</Badge>
    </div>
  );
}

export function CsvUploadPage({
  csvStatus,
  onCsvLoaded,
}: CsvUploadPageProps) {
  const forecastInputRef = useRef<HTMLInputElement | null>(null);
  const [isDraggingForecast, setIsDraggingForecast] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleForecastFile = async (file: File) => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const result = await analyzeCsvWithAi(file);
      onCsvLoaded(result.status, result.data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "AI 서버 분석에 실패했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1080px] space-y-6">
      <div className="grid auto-rows-min gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <Card className="p-6">
          <div className="grid gap-4">
            <UploadTarget
              icon={Upload}
              title="예상 판매량 파일"
              description="판매 이력 CSV를 로컬 AI 서버로 보내 상품별 예상 판매량을 계산합니다."
              buttonLabel={isAnalyzing ? "AI 분석 중" : "파일 선택"}
              selectedFileName={csvStatus.fileName}
              disabled={isAnalyzing}
              isActive={isDraggingForecast}
              onBrowse={() => forecastInputRef.current?.click()}
              onDropFile={(file) => void handleForecastFile(file)}
              onDragStateChange={setIsDraggingForecast}
            />
          </div>
          {errorMessage ? (
            <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}
          <input
            ref={forecastInputRef}
            className="sr-only"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleForecastFile(file);
            }}
          />
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>파일 요약</CardTitle>
              <CardDescription>예상 판매량 분석에 사용된 파일입니다.</CardDescription>
            </div>
            <Database className="h-5 w-5 text-[#6B7280]" aria-hidden="true" />
          </CardHeader>
          {csvStatus.state === "empty" ? (
            <EmptyState icon={FileSpreadsheet} title="아직 올린 파일이 없습니다" description="예상 판매량 파일을 올리면 자료 개수, 상품 수, 기간이 표시됩니다." />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-[#6B7280]">파일명</p>
                <p className="mt-1 break-all font-semibold text-[#111827]">{csvStatus.fileName}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-[#6B7280]">자료 개수</p>
                  <p className="mt-1 text-xl font-semibold text-[#111827]">{formatNumber(csvStatus.rowCount)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs text-[#6B7280]">상품 수</p>
                  <p className="mt-1 text-xl font-semibold text-[#111827]">{formatNumber(csvStatus.productCount)}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-[#6B7280]">날짜 범위</p>
                <p className="mt-1 text-sm font-medium text-[#111827]">{csvStatus.dateRange ?? "확인 필요"}</p>
              </div>
              <div>
                <p className="text-sm text-[#6B7280]">올린 시각</p>
                <p className="mt-1 text-sm font-medium text-[#111827]">{csvStatus.uploadedAt}</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid auto-rows-min gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>필수 항목 확인</CardTitle>
              <CardDescription>예상 판매량 분석에 필요한 항목을 확인합니다.</CardDescription>
            </div>
          </CardHeader>
          {csvStatus.validation.length ? (
            <div>
              {csvStatus.validation.map((item) => (
                <ValidationRow key={item.column} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle} title="확인 대기 중" description="예상 판매량 파일을 올리면 필요한 항목이 들어 있는지 확인합니다." />
          )}
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>오류 및 경고</CardTitle>
              <CardDescription>업로드 품질을 빠르게 점검합니다.</CardDescription>
            </div>
          </CardHeader>
          {csvStatus.issues.length ? (
            <div className="space-y-3">
              {csvStatus.issues.map((issue) => (
                <div
                  key={issue.message}
                  className={`rounded-2xl border p-4 text-sm ${
                    issue.severity === "error"
                      ? "border-red-100 bg-red-50 text-red-700"
                      : "border-amber-100 bg-amber-50 text-amber-700"
                  }`}
                >
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
                    <p>{issue.message}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CheckCircle} title="문제 없음" description="현재 업로드 상태에서는 치명적인 오류가 없습니다." />
          )}
        </Card>
      </div>
    </div>
  );
}
