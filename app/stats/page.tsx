"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface DayStat {
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  messageCount: number;
  avgResponseMs: number;
}

interface StatsData {
  agentId: string;
  daily: DayStat[];
  weekly: DayStat[];
  monthly: DayStat[];
}

type TimeRange = "daily" | "weekly" | "monthly";

const RANGE_LABELS: Record<TimeRange, string> = {
  daily: "按天",
  weekly: "按周",
  monthly: "按月",
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function formatMs(ms: number): string {
  if (!ms) return "-";
  if (ms < 1000) return ms + "ms";
  return (ms / 1000).toFixed(1) + "s";
}

// SVG Bar Chart component
function BarChart({
  data,
  labelKey,
  bars,
  height = 220,
}: {
  data: DayStat[];
  labelKey: "date";
  bars: { key: keyof DayStat; color: string; label: string }[];
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">
        暂无数据
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 60, left: 60 };
  const width = Math.max(600, data.length * (bars.length * 24 + 16) + padding.left + padding.right);
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Find max value across all bars
  let maxVal = 0;
  for (const d of data) {
    for (const b of bars) {
      const v = d[b.key] as number;
      if (v > maxVal) maxVal = v;
    }
  }
  if (maxVal === 0) maxVal = 1;

  // Y-axis ticks
  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((maxVal / tickCount) * i));

  const groupWidth = chartW / data.length;
  const barWidth = Math.min(20, (groupWidth - 8) / bars.length);

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="text-[var(--text-muted)]">
        {/* Y-axis grid + labels */}
        {ticks.map((tick, i) => {
          const y = padding.top + chartH - (tick / maxVal) * chartH;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" opacity={0.15} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="currentColor">
                {formatTokens(tick)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const groupX = padding.left + i * groupWidth;
          return (
            <g key={d.date}>
              {bars.map((b, bi) => {
                const v = d[b.key] as number;
                const barH = (v / maxVal) * chartH;
                const x = groupX + (groupWidth - bars.length * barWidth) / 2 + bi * barWidth;
                const y = padding.top + chartH - barH;
                return (
                  <g key={b.key}>
                    <rect x={x} y={y} width={barWidth - 2} height={barH} fill={b.color} rx={2} opacity={0.85}>
                      <title>{`${b.label}: ${formatTokens(v)}`}</title>
                    </rect>
                  </g>
                );
              })}
              {/* X-axis label */}
              <text
                x={groupX + groupWidth / 2}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                fontSize={10}
                fill="currentColor"
                transform={`rotate(-30, ${groupX + groupWidth / 2}, ${height - padding.bottom + 16})`}
              >
                {d.date}
              </text>
            </g>
          );
        })}

        {/* Axes */}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartH} stroke="currentColor" opacity={0.3} />
        <line x1={padding.left} y1={padding.top + chartH} x2={width - padding.right} y2={padding.top + chartH} stroke="currentColor" opacity={0.3} />
      </svg>
    </div>
  );
}

// Response time chart (separate scale)
function ResponseTimeChart({ data, height = 220 }: { data: DayStat[]; height?: number }) {
  const filtered = data.filter((d) => d.avgResponseMs > 0);
  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-[var(--text-muted)] text-sm">
        暂无响应时间数据
      </div>
    );
  }

  const padding = { top: 20, right: 20, bottom: 60, left: 60 };
  const width = Math.max(600, filtered.length * 40 + padding.left + padding.right);
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...filtered.map((d) => d.avgResponseMs));
  const barWidth = Math.min(28, chartW / filtered.length - 8);

  const tickCount = 4;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((maxVal / tickCount) * i));

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="text-[var(--text-muted)]">
        {ticks.map((tick, i) => {
          const y = padding.top + chartH - (tick / maxVal) * chartH;
          return (
            <g key={i}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" opacity={0.15} />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize={10} fill="currentColor">
                {formatMs(tick)}
              </text>
            </g>
          );
        })}
        {filtered.map((d, i) => {
          const groupW = chartW / filtered.length;
          const x = padding.left + i * groupW + (groupW - barWidth) / 2;
          const barH = (d.avgResponseMs / maxVal) * chartH;
          const y = padding.top + chartH - barH;
          return (
            <g key={d.date}>
              <rect x={x} y={y} width={barWidth} height={barH} fill="#f59e0b" rx={2} opacity={0.85}>
                <title>{`${d.date}: ${formatMs(d.avgResponseMs)}`}</title>
              </rect>
              <text
                x={padding.left + i * groupW + groupW / 2}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                fontSize={10}
                fill="currentColor"
                transform={`rotate(-30, ${padding.left + i * groupW + groupW / 2}, ${height - padding.bottom + 16})`}
              >
                {d.date}
              </text>
            </g>
          );
        })}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + chartH} stroke="currentColor" opacity={0.3} />
        <line x1={padding.left} y1={padding.top + chartH} x2={width - padding.right} y2={padding.top + chartH} stroke="currentColor" opacity={0.3} />
      </svg>
    </div>
  );
}

export default function StatsPage() {
  const searchParams = useSearchParams();
  const agentId = searchParams.get("agent") || "";
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<TimeRange>("daily");

  useEffect(() => {
    if (!agentId) return;
    fetch(`/api/stats/${agentId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setStats(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [agentId]);

  if (!agentId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400">缺少 agent 参数</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400">加载失败: {error}</p>
      </div>
    );
  }

  if (!stats) return null;

  const currentData = stats[range];
  const totalInput = currentData.reduce((s, d) => s + d.inputTokens, 0);
  const totalOutput = currentData.reduce((s, d) => s + d.outputTokens, 0);
  const totalMessages = currentData.reduce((s, d) => s + d.messageCount, 0);

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">📊 {agentId} 消息统计</h1>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            Token 消耗与响应时间分析
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time range selector */}
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {(Object.keys(RANGE_LABELS) as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-2 text-sm transition ${
                  range === r
                    ? "bg-[var(--accent)] text-[var(--bg)] font-medium"
                    : "bg-[var(--card)] text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
          <Link
            href={`/sessions?agent=${agentId}`}
            className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition"
          >
            📋 会话列表
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] text-sm hover:border-[var(--accent)] transition"
          >
            ← 首页
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">总 Input Token</div>
          <div className="text-xl font-bold text-blue-400">{formatTokens(totalInput)}</div>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">总 Output Token</div>
          <div className="text-xl font-bold text-emerald-400">{formatTokens(totalOutput)}</div>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">总消息数</div>
          <div className="text-xl font-bold text-purple-400">{totalMessages}</div>
        </div>
        <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <div className="text-xs text-[var(--text-muted)] mb-1">数据周期</div>
          <div className="text-xl font-bold text-[var(--text)]">{currentData.length} {RANGE_LABELS[range].slice(1)}</div>
        </div>
      </div>

      {/* Token chart */}
      <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--text)]">🔢 Token 消耗</h2>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" /> Input</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> Output</span>
          </div>
        </div>
        <BarChart
          data={currentData}
          labelKey="date"
          bars={[
            { key: "inputTokens", color: "#3b82f6", label: "Input" },
            { key: "outputTokens", color: "#10b981", label: "Output" },
          ]}
        />
      </div>

      {/* Response time chart */}
      {range === "daily" && (
        <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-sm font-semibold text-[var(--text)] mb-4">⏱️ 平均响应时间</h2>
          <ResponseTimeChart data={currentData} />
        </div>
      )}
    </main>
  );
}
