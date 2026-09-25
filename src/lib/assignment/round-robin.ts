import type { SupabaseClient } from '@supabase/supabase-js'

export interface RoundRobinOptions {
  onlineOnly?: boolean
}

/**
 * Resolves the next agent to be assigned a conversation using Balanced Round-Robin.
 *
 * Algorithm:
 * 1. Find all active team members with agent/admin/owner roles in this account.
 * 2. If onlineOnly is requested (or if online agents exist), filter by active presence
 *    (status='online' and heartbeated within the last 75s).
 * 3. Fall back to all active agents if no agents are currently online.
 * 4. Rank candidates by:
 *    - Lowest number of currently 'open' conversations (workload balance)
 *    - Oldest last-assigned timestamp (true round-robin tie breaker)
 */
export async function resolveNextAgent(
  db: SupabaseClient,
  accountId: string,
  opts: RoundRobinOptions = {}
): Promise<string | null> {
  try {
    // 1. Fetch eligible team members in the account
    const { data: members, error: membersErr } = await db
      .from('profiles')
      .select('user_id, account_role')
      .eq('account_id', accountId)

    if (membersErr || !members || members.length === 0) {
      return null
    }

    // Filter to roles that can handle chats (owner, admin, agent)
    const eligibleMembers = members.filter(
      (m) => m.account_role === 'owner' || m.account_role === 'admin' || m.account_role === 'agent'
    )

    if (eligibleMembers.length === 0) {
      return null
    }

    if (eligibleMembers.length === 1) {
      return eligibleMembers[0].user_id
    }

    const candidateIds = eligibleMembers.map((m) => m.user_id)

    // 2. Check presence
    const cutoff = new Date(Date.now() - 75_000).toISOString()
    const { data: presenceList } = await db
      .from('member_presence')
      .select('user_id, status, last_seen_at')
      .eq('account_id', accountId)
      .in('user_id', candidateIds)
      .eq('status', 'online')
      .gte('last_seen_at', cutoff)

    const onlineUserIds = new Set((presenceList || []).map((p) => p.user_id))

    // Select candidate pool: prefer online agents
    let pool = candidateIds
    if (onlineUserIds.size > 0) {
      pool = candidateIds.filter((id) => onlineUserIds.has(id))
    } else if (opts.onlineOnly) {
      // User strictly requested online only, but no one is online
      return null
    }

    if (pool.length === 1) {
      return pool[0]
    }

    // 3. Compute workload (number of open conversations per agent)
    const { data: openConvs } = await db
      .from('conversations')
      .select('assigned_agent_id')
      .eq('account_id', accountId)
      .eq('status', 'open')
      .in('assigned_agent_id', pool)

    const workloadMap = new Map<string, number>()
    for (const id of pool) {
      workloadMap.set(id, 0)
    }
    if (openConvs) {
      for (const row of openConvs) {
        if (row.assigned_agent_id && workloadMap.has(row.assigned_agent_id)) {
          workloadMap.set(
            row.assigned_agent_id,
            (workloadMap.get(row.assigned_agent_id) || 0) + 1
          )
        }
      }
    }

    // 4. Compute last assignment time for round-robin tie break
    const { data: recentAssignments } = await db
      .from('conversations')
      .select('assigned_agent_id, created_at')
      .eq('account_id', accountId)
      .in('assigned_agent_id', pool)
      .order('created_at', { ascending: false })

    const lastAssignedMap = new Map<string, number>()
    for (const id of pool) {
      lastAssignedMap.set(id, 0)
    }
    if (recentAssignments) {
      for (const row of recentAssignments) {
        if (row.assigned_agent_id && !lastAssignedMap.get(row.assigned_agent_id)) {
          lastAssignedMap.set(
            row.assigned_agent_id,
            new Date(row.created_at).getTime()
          )
        }
      }
    }

    // 5. Sort candidates: primary = fewest open chats; secondary = oldest assignment
    pool.sort((a, b) => {
      const loadA = workloadMap.get(a) || 0
      const loadB = workloadMap.get(b) || 0
      if (loadA !== loadB) {
        return loadA - loadB
      }
      const timeA = lastAssignedMap.get(a) || 0
      const timeB = lastAssignedMap.get(b) || 0
      return timeA - timeB
    })

    return pool[0]
  } catch (err) {
    console.error('[round-robin] Error resolving next agent:', err)
    return null
  }
}

/**
 * Auto-assigns an unassigned conversation if the account has auto-assignment enabled.
 * Returns the assigned agent ID or null if skipped/failed.
 */
export async function autoAssignConversation(
  db: SupabaseClient,
  accountId: string,
  conversationId: string
): Promise<string | null> {
  try {
    // Check account auto-assignment settings
    const { data: account, error: accErr } = await db
      .from('accounts')
      .select('auto_assign_enabled, auto_assign_online_only')
      .eq('id', accountId)
      .maybeSingle()

    if (accErr || !account) {
      return null
    }

    // If auto-assignment is disabled, do nothing
    if (account.auto_assign_enabled === false) {
      return null
    }

    const nextAgentId = await resolveNextAgent(db, accountId, {
      onlineOnly: account.auto_assign_online_only ?? false,
    })

    if (!nextAgentId) {
      return null
    }

    const { error: updateErr } = await db
      .from('conversations')
      .update({ assigned_agent_id: nextAgentId })
      .eq('id', conversationId)
      .is('assigned_agent_id', null) // Only assign if currently unassigned

    if (updateErr) {
      console.error('[round-robin] Error updating conversation assignment:', updateErr)
      return null
    }

    return nextAgentId
  } catch (err) {
    console.error('[round-robin] autoAssignConversation error:', err)
    return null
  }
}
