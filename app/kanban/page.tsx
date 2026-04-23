"use client";

import { useEffect, useState } from "react";

interface AgentSession {
  totalTokens: number;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
  model: string;
  session?: AgentSession;
}

interface SubagentInfo {
  toolId: string;
  label: string;
  activityEvents?: { key: string; text: string; at: number }[];
}

interface CronJobInfo {
  key: string;
  jobId: string;
  label: string;
  isRunning: boolean;
  lastRunAt: number;
  nextRunAt?: number;
  durationMs?: number;
  lastStatus: "success" | "running" | "failed";
  lastSummary?: string;
  consecutiveFailures: number;
}

interface AgentActivity {
  agentId: string;
  name: string;
  emoji: string;
  state: "idle" | "working" | "waiting" | "offline";
  currentTool?: string;
  toolStatus?: string;
  lastActive: number;
  subagents?: SubagentInfo[];
  cronJobs?: CronJobInfo[];
}

type KanbanColumn = "offline" | "idle" | "working";

const COLUMN_CONFIG: Record<KanbanColumn, { label: string; borderColor: string; badgeColor: string; dotColor: string; states: AgentActivity["state"][] }> = {
  offline: {
    label: "Offline",
    borderColor: "border-l-gray-500",
    badgeColor: "bg-gray-500/15 text-gray-400",
    dotColor: "bg-gray-500",
    states: ["offline"],
  },
  idle: {
    label: "Idle",
    borderColor: "border-l-amber-500",
    badgeColor: "bg-amber-500/15 text-amber-400",
    dotColor: "bg-amber-400",
    states: ["idle"],
  },
  working: {
    label: "Working",
    borderColor: "border-l-emerald-500",
    badgeColor: "bg-emerald-500/15 text-emerald-400",
    dotColor: "bg-emerald-400",
    states: ["working", "waiting"],
  },
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function timeAgo(lastActive: number): string {
  if (!lastActive) return "—";
  const diff = Date.now() - lastActive;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function KanbanCard({ activity, agent }: { activity: AgentActivity; agent?: Agent }) {
  const col = (Object.keys(COLUMN_CONFIG) as KanbanColumn[]).find((c) =>
    COLUMN_CONFIG[c].states.includes(activity.state)
  ) ?? "offline";
  const { borderColor, dotColor } = COLUMN_CONFIG[col];

  const activeSubagents = activity.subagents?.filter((s) => s.label) ?? [];
  const runningCrons = activity.cronJobs?.filter((c) => c.isRunning || c.lastStatus === "running") ?? [];
  const totalTokens = agent?.session?.totalTokens ?? 0;
  const model = agent?.model ?? "";
  const modelShort = model.includes("/") ? model.split("/").slice(1).join("/") : model;

  return (
    <div
      className={`rounded-xl border border-[var(--border)] border-l-4 ${borderColor} bg-[var(--card)] p-3 space-y-2 hover:border-[var(--accent)]/50 transition-colors`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg leading-none shrink-0">{activity.emoji || "🤖"}</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--text)] truncate">{activity.name}</div>
            {modelShort && (
              <div className="text-[10px] text-[var(--text-muted)] truncate">{modelShort}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-block w-2 h-2 rounded-full ${dotColor} ${
              col === "working" ? "animate-pulse" : ""
            }`}
          />
          <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
            {timeAgo(activity.lastActive)}
          </span>
        </div>
      </div>

      {/* Current task / subagents */}
      {col === "working" && (
        <div className="space-y-1">
          {activity.state === "waiting" ? (
            <div className="text-xs text-amber-400 flex items-center gap-1">
              <span>⏳</span> Waiting for input
            </div>
          ) : activity.currentTool ? (
            <div className="text-xs text-[var(--text-muted)]">
              <span className="text-[var(--accent)]">▶</span>{" "}
              <span className="font-medium text-[var(--text)]">{activity.currentTool}</span>
              {activity.toolStatus && (
                <span className="ml-1 opacity-70">— {activity.toolStatus}</span>
              )}
            </div>
          ) : null}
          {activeSubagents.length > 0 && (
            <div className="space-y-0.5 pl-2 border-l border-[var(--border)]">
              {activeSubagents.map((sub, i) => (
                <div key={i} className="text-xs text-[var(--text-muted)]">
                  <span className="text-[var(--accent)] mr-1">↳</span>
                  <span className="font-medium text-[var(--text)]">{sub.label}</span>
                  {sub.activityEvents && sub.activityEvents.length > 0 && (
                    <span className="ml-1 opacity-60 truncate">
                      — {sub.activityEvents[sub.activityEvents.length - 1].text}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {runningCrons.length > 0 && (
            <div className="space-y-0.5">
              {runningCrons.map((cron) => (
                <div key={cron.key} className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <span>⏰</span>
                  <span className="font-medium text-[var(--text)]">{cron.label}</span>
                  <span className="text-sky-400 text-[10px]">running</span>
                </div>
              ))}
            </div>
          )}
          {!activity.currentTool && activeSubagents.length === 0 && runningCrons.length === 0 && activity.state !== "waiting" && (
            <div className="text-xs text-[var(--text-muted)] opacity-60">Processing…</div>
          )}
        </div>
      )}

      {/* Footer: token count */}
      {totalTokens > 0 && (
        <div className="pt-1 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-muted)]">Total tokens</span>
          <span className="text-[10px] font-medium text-[var(--text)]">{formatTokens(totalTokens)}</span>
        </div>
      )}
    </div>
  );
}

function KanbanColumnView({
  col,
  activities,
  agentMap,
}: {
  col: KanbanColumn;
  activities: AgentActivity[];
  agentMap: Map<string, Agent>;
}) {
  const config = COLUMN_CONFIG[col];
  const cards = activities.filter((a) => config.states.includes(a.state));

  return (
    <div className="flex flex-col min-w-0 flex-1">
      {/* Column header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 mb-3 rounded-lg border-l-4 ${config.borderColor} bg-[var(--card)] border border-[var(--border)]`}
      >
        <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
        <span className="text-sm font-semibold text-[var(--text)]">{config.label}</span>
        <span
          className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${config.badgeColor}`}
        >
          {cards.length}
        </span>
      </div>

      {/* Cards */}
      <div className="space-y-2 flex-1">
        {cards.length === 0 ? (
          <div className="text-xs text-[var(--text-muted)] text-center py-6 opacity-50">
            No agents
          </div>
        ) : (
          cards.map((a) => (
            <KanbanCard key={a.agentId} activity={a} agent={agentMap.get(a.agentId)} />
          ))
        )}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const [activities, setActivities] = useState<AgentActivity[]>([]);
  const [agentMap, setAgentMap] = useState<Map<string, Agent>>(new Map());
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchData = async () => {
    try {
      const [actRes, cfgRes] = await Promise.all([
        fetch("/api/agent-activity", { cache: "no-store" }),
        fetch("/api/config", { cache: "no-store" }),
      ]);
      if (actRes.ok) {
        const d = await actRes.json();
        if (Array.isArray(d.agents)) setActivities(d.agents);
      }
      if (cfgRes.ok) {
        const d = await cfgRes.json();
        if (Array.isArray(d.agents)) {
          const map = new Map<string, Agent>();
          for (const a of d.agents) map.set(a.id, a);
          setAgentMap(map);
        }
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch {
      // silently ignore fetch errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, []);

  const columns: KanbanColumn[] = ["working", "idle", "offline"];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            📋 Agent Kanban
          </h1>
          <p className="text-[var(--text-muted)] text-xs mt-0.5">
            {activities.length} agents · live status
          </p>
        </div>
        {lastUpdated && (
          <span className="text-xs text-[var(--text-muted)]">Updated {lastUpdated}</span>
        )}
      </div>

      {/* Kanban columns */}
      <div className="flex flex-col md:flex-row gap-4">
        {columns.map((col) => (
          <KanbanColumnView
            key={col}
            col={col}
            activities={activities}
            agentMap={agentMap}
          />
        ))}
      </div>
    </div>
  );
}
