import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Grid3x3, Info } from "lucide-react";
import { fetchMatrix, fetchRefs, riskKeys } from "./api";
import { cellColor, cellText, RiskLevel } from "./types";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Label } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/EmptyState";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const PROB_LABELS: Record<number, string> = {
  5: "Hampir Pasti",
  4: "Sangat Mungkin",
  3: "Mungkin",
  2: "Jarang",
  1: "Sangat Jarang",
};

const IMPACT_LABELS: Record<number, string> = {
  1: "Tidak Signifikan",
  2: "Minor",
  3: "Moderat",
  4: "Mayor",
  5: "Katastrofik",
};

const LEVEL_META: { key: RiskLevel; label: string; range: string }[] = [
  { key: "LOW", label: "Low", range: "1–5" },
  { key: "MEDIUM", label: "Medium", range: "6–10" },
  { key: "HIGH", label: "High", range: "11–15" },
  { key: "VERY_HIGH", label: "Very High", range: "16–25" },
];

export function MatrixPage() {
  const { user } = useAuth();
  const isMr = user?.role === "MR";

  const [type, setType] = useState<"inherent" | "residual">("inherent");
  const [branchId, setBranchId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const refs = useQuery({ queryKey: riskKeys.refs, queryFn: fetchRefs, staleTime: 5 * 60_000 });

  const params = useMemo(
    () => ({
      type,
      ...(branchId ? { branchId } : {}),
      ...(categoryId ? { categoryId } : {}),
    }),
    [type, branchId, categoryId],
  );

  const matrix = useQuery({
    queryKey: riskKeys.matrix(params),
    queryFn: () => fetchMatrix(params),
    placeholderData: (prev) => prev,
  });

  const cellMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of matrix.data?.cells ?? []) map.set(`${c.prob}-${c.impact}`, c.count);
    return map;
  }, [matrix.data]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Risk Matrix"
        description="Pemetaan risiko berdasarkan Probability dan Impact (skala 1–5)"
        icon={Grid3x3}
      />

      <Card>
        <CardBody className="flex flex-wrap items-end gap-3">
          <div className="flex rounded border border-border overflow-hidden shrink-0">
            {(["inherent", "residual"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={cn(
                  "px-3 py-2 text-xs font-medium capitalize transition-colors",
                  type === t ? "bg-primary-500 text-white" : "bg-white text-content-secondary hover:bg-slate-50",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {isMr && (
            <div className="w-full sm:w-52">
              <Label htmlFor="mx-branch">Branch</Label>
              <Select id="mx-branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Semua Branch</option>
                {refs.data?.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="w-full sm:w-52">
            <Label htmlFor="mx-category">Kategori</Label>
            <Select id="mx-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Semua Kategori</option>
              {refs.data?.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>

          <p className="ml-auto text-xs text-content-secondary">
            Total risiko: <strong className="text-content-primary">{matrix.data?.total ?? 0}</strong>
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={`Matrix ${type === "inherent" ? "Inherent" : "Residual"}`}
            subtitle="Jumlah risiko pada setiap kombinasi Probability × Impact"
          />
          <CardBody className="overflow-x-auto">
            {matrix.isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : matrix.isError ? (
              <ErrorState message="Matrix gagal dimuat" onRetry={() => void matrix.refetch()} />
            ) : (
              <div className="min-w-[520px]">
                <div className="grid grid-cols-[110px_repeat(5,minmax(0,1fr))] gap-1">
                  <div />
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="text-center">
                      <p className="text-xs font-semibold text-content-primary">{i}</p>
                      <p className="text-[10px] leading-tight text-content-muted">{IMPACT_LABELS[i]}</p>
                    </div>
                  ))}

                  {[5, 4, 3, 2, 1].map((p) => (
                    <div key={p} className="contents">
                      <div className="flex flex-col justify-center pr-1 text-right">
                        <p className="text-xs font-semibold text-content-primary">{p}</p>
                        <p className="text-[10px] leading-tight text-content-muted">{PROB_LABELS[p]}</p>
                      </div>
                      {[1, 2, 3, 4, 5].map((i) => {
                        const count = cellMap.get(`${p}-${i}`) ?? 0;
                        const score = p * i;
                        const bg = cellColor(score);
                        const fg = cellText(score);
                        return (
                          <div
                            key={i}
                            title={`P${p} × I${i} = ${score} · ${count} risiko`}
                            className="relative flex h-16 items-center justify-center rounded transition-transform hover:scale-[1.03] hover:shadow-md"
                            style={{ backgroundColor: bg, color: fg }}
                          >
                            {count > 0 ? (
                              <span className="text-lg font-bold leading-none">{count}</span>
                            ) : (
                              <span className="text-xs opacity-60">–</span>
                            )}
                            <span className="absolute right-1 top-1 text-[9px] font-semibold opacity-80">{score}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-2xs text-content-muted">
                  <Info className="h-3 w-3" aria-hidden="true" />
                  Angka pada sel menunjukkan jumlah risiko; angka kecil kanan atas adalah skor (P × I).
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Distribusi Level" subtitle="Jumlah risiko per tingkat risiko" />
          <CardBody className="space-y-2.5">
            {LEVEL_META.map((l) => {
              const count = matrix.data?.levels?.[l.key] ?? 0;
              const total = matrix.data?.total ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const score = l.key === "VERY_HIGH" ? 16 : l.key === "HIGH" ? 11 : l.key === "MEDIUM" ? 6 : 1;
              return (
                <div key={l.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-content-primary">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cellColor(score) }} aria-hidden="true" />
                      {l.label}
                      <span className="text-2xs font-normal text-content-muted">({l.range})</span>
                    </span>
                    <span className="text-content-secondary">
                      {count} · {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded bg-slate-100">
                    <div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: cellColor(score) }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-border text-2xs text-content-muted">
              {type === "residual"
                ? "Hanya risiko yang sudah memiliki penilaian residual yang dihitung."
                : "Seluruh risiko aktif pada cakupan filter yang dipilih."}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
