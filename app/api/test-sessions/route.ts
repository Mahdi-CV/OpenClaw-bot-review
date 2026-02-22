import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const OPENCLAW_HOME = path.join(process.env.HOME || "/root", ".openclaw");
const CONFIG_PATH = path.join(OPENCLAW_HOME, "openclaw.json");

export async function POST() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw);
    const gatewayPort = config.gateway?.port || 18789;
    const gatewayToken = config.gateway?.auth?.token || "";

    let agentList = config.agents?.list || [];
    if (agentList.length === 0) {
      try {
        const agentsDir = path.join(OPENCLAW_HOME, "agents");
        const dirs = fs.readdirSync(agentsDir, { withFileTypes: true });
        agentList = dirs
          .filter((d: any) => d.isDirectory() && !d.name.startsWith("."))
          .map((d: any) => ({ id: d.name }));
      } catch {}
      if (agentList.length === 0) agentList = [{ id: "main" }];
    }

    const results = [];
    for (const agent of agentList) {
      const agentId = agent.id;
      const sessionKey = `agent:${agentId}:main`;
      const startTime = Date.now();
      try {
        const resp = await fetch(`http://127.0.0.1:${gatewayPort}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${gatewayToken}`,
            "x-openclaw-agent-id": agentId,
            "x-openclaw-session-key": sessionKey,
          },
          body: JSON.stringify({
            model: `openclaw:${agentId}`,
            messages: [{ role: "user", content: "Health check: reply with OK" }],
            max_tokens: 64,
          }),
          signal: AbortSignal.timeout(100000),
        });
        const data = await resp.json();
        const elapsed = Date.now() - startTime;
        if (!resp.ok) {
          results.push({ agentId, ok: false, error: data.error?.message || "API error", elapsed });
        } else {
          const reply = data.choices?.[0]?.message?.content || "";
          results.push({ agentId, ok: true, reply: reply.slice(0, 200) || "(no reply)", elapsed });
        }
      } catch (err: any) {
        const elapsed = Date.now() - startTime;
        const isTimeout = err.name === "TimeoutError" || err.name === "AbortError";
        results.push({
          agentId, ok: false,
          error: isTimeout ? "Timeout (100s)" : (err.message || "Unknown error").slice(0, 300),
          elapsed,
        });
      }
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
