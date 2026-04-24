import { OfficeState } from './engine/officeState'

export interface SubagentInfo {
  toolId: string
  label: string
  sessionKey?: string
  childSessionKey?: string
  activityEvents?: Array<{ key: string; text: string; at: number }>
}

export interface AgentActivity {
  agentId: string
  name: string
  emoji: string
  state: 'idle' | 'working' | 'waiting' | 'offline'
  currentTask?: string
  currentTool?: string
  toolStatus?: string
  lastActive: number
  subagents?: SubagentInfo[]
}

/** Track which subagent keys were active last sync, per parent agent */
const prevSubagentKeys = new Map<string, Set<string>>()

/** Track previous agent states to detect offline→working transitions */
const prevAgentStates = new Map<string, string>()
/** Track last real snippet text pushed per agent to avoid duplicates */
const lastRealSnippet = new Map<string, string>()

/** Debounce high-five: track last task text that triggered it so we don't repeat */
const lastHighFiveTrigger = new Map<string, string>()

/** Returns true if the task text is a high-five / celebrate command */
function isHighFiveCommand(text: string): boolean {
  const t = text.toLowerCase()
  return (
    t.includes('high five') || t.includes('high-five') || t.includes('highfive') ||
    t.includes('give a high') || t.includes('celebrate') || t.includes('great job team') ||
    t.includes('well done team') || t.includes('nice work team') || t.includes('fist bump')
  )
}

export function syncAgentsToOffice(
  activities: AgentActivity[],
  office: OfficeState,
  agentIdMap: Map<string, number>,
  nextIdRef: { current: number },
): void {
  const currentAgentIds = new Set(activities.map(a => a.agentId))

  // Remove agents that are no longer present
  for (const [agentId, charId] of agentIdMap) {
    if (!currentAgentIds.has(agentId)) {
      office.removeAllSubagents(charId)
      office.removeAgent(charId)
      agentIdMap.delete(agentId)
      prevSubagentKeys.delete(agentId)
    }
  }

  for (const activity of activities) {
    if (activity.state === 'offline') {
      if (agentIdMap.has(activity.agentId)) {
        const charId = agentIdMap.get(activity.agentId)!
        office.removeAllSubagents(charId)
        office.removeAgent(charId)
        agentIdMap.delete(activity.agentId)
        prevSubagentKeys.delete(activity.agentId)
      }
      prevAgentStates.set(activity.agentId, 'offline')
      continue
    }

    let charId = agentIdMap.get(activity.agentId)
    if (charId !== undefined && !office.characters.has(charId)) {
      agentIdMap.delete(activity.agentId)
      charId = undefined
    }
    if (charId === undefined) {
      charId = nextIdRef.current++
      agentIdMap.set(activity.agentId, charId)
      // Spawn at door if agent was previously offline or is brand new
      const wasOffline = prevAgentStates.get(activity.agentId) === 'offline'
      const isNew = !prevAgentStates.has(activity.agentId)
      office.addAgent(charId, undefined, undefined, undefined, undefined, wasOffline || isNew)
    }

    // Set label, avoiding duplicated values like "main (main)"
    const ch = office.characters.get(charId)
    if (ch) {
      const displayName = activity.name?.trim()
      ch.label = displayName && displayName !== activity.agentId
        ? `${displayName} (${activity.agentId})`
        : activity.agentId
    }

    switch (activity.state) {
      case 'working':
        office.setAgentActive(charId, true)
        office.setAgentTool(charId, activity.currentTool || null)
        // Push real activity text as speech bubble (prefer task over tool name)
        {
          const bubbleText = activity.currentTask
            ? activity.currentTask.slice(0, 80)
            : activity.currentTool
              ? activity.currentTool.slice(0, 80)
              : null
          if (bubbleText && lastRealSnippet.get(activity.agentId) !== bubbleText) {
            lastRealSnippet.set(activity.agentId, bubbleText)
            office.pushRealActivitySnippet(charId, bubbleText)
          }
          // Detect high-five command in task text
          if (activity.currentTask && isHighFiveCommand(activity.currentTask)) {
            const prev = lastHighFiveTrigger.get(activity.agentId)
            if (prev !== activity.currentTask) {
              lastHighFiveTrigger.set(activity.agentId, activity.currentTask)
              office.triggerHighFive()
            }
          }
        }
        break
      case 'idle':
        office.setAgentActive(charId, false)
        office.setAgentTool(charId, null)
        lastRealSnippet.delete(activity.agentId)
        lastHighFiveTrigger.delete(activity.agentId)
        break
      case 'waiting':
        office.setAgentActive(charId, true)
        office.showWaitingBubble(charId)
        break
    }

    // Sync subagents
    const currentSubKeys = new Set<string>()
    if (activity.subagents) {
      for (const sub of activity.subagents) {
        const subKey = sub.sessionKey ? `${sub.sessionKey}::${sub.toolId}` : sub.toolId
        currentSubKeys.add(subKey)
        const existingSubId = office.getSubagentId(charId, subKey)
        if (existingSubId === null) {
          const subId = office.addSubagent(charId, subKey)
          office.setAgentActive(subId, true)
          const subCh = office.characters.get(subId)
          if (subCh) subCh.label = office.getTempWorkerLabel()
        } else {
          const subCh = office.characters.get(existingSubId)
          if (subCh) {
            subCh.label = office.getTempWorkerLabel()
            office.setAgentActive(existingSubId, true)
          }
        }
      }
    }

    // Remove subagents that are no longer active
    const prevKeys = prevSubagentKeys.get(activity.agentId)
    if (prevKeys) {
      for (const subKey of prevKeys) {
        if (!currentSubKeys.has(subKey)) {
          office.removeSubagent(charId, subKey)
        }
      }
    }
    prevSubagentKeys.set(activity.agentId, currentSubKeys)
    prevAgentStates.set(activity.agentId, activity.state)
  }
}
