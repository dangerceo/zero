import { agentStore } from './agentStore.js';

// Very simple, conservative heuristic leak detector.
// This is intentionally biased toward false-positives over misses.
const LEAK_PATTERNS = [
  /sk_(live|test)_[0-9a-zA-Z]{10,}/i,                // Stripe-style keys
  /AIza[0-9A-Za-z\-_]{35}/,                          // Google API key
  /AKIA[0-9A-Z]{16}/,                                // AWS access key id
  /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, // PEM private keys
  /xox[baprs]-[0-9]{10,}/i,                          // Slack tokens
  /(ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{20,}/,          // GitHub tokens
  /SECRET_KEY[^A-Za-z0-9]/i,
  /access[_-]?token[^A-Za-z0-9]/i,
  /authorization:\s*Bearer\s+[0-9A-Za-z\.\-_]{16,}/i
];

function detectLeak(message) {
  if (!message || typeof message !== 'string') return null;
  for (const pattern of LEAK_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return {
        pattern: pattern.toString(),
        sample: match[0]
      };
    }
  }
  return null;
}

function initSecurity(agent) {
  // Default to medium trust, no violations.
  return {
    trustLevel: 1, // 0 = low, 1 = medium, 2 = high
    violationCount: 0,
    violations: [],
    locked: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export async function ensureAgentSecurity(agentId) {
  const agent = await agentStore.get(agentId);
  if (!agent) return null;
  if (!agent.security) {
    agent.security = initSecurity(agent);
    await agentStore.update(agentId, { security: agent.security });
  }
  return agent.security;
}

export async function processAgentLog(agentId, log) {
  const { message, type } = log;

  const leak = detectLeak(message);
  if (!leak) {
    // Still ensure the security object exists for this agent.
    await ensureAgentSecurity(agentId);
    return;
  }

  const agent = await agentStore.get(agentId);
  if (!agent) return;

  const now = new Date().toISOString();
  const security = agent.security || initSecurity(agent);

  const nextViolationCount = (security.violationCount || 0) + 1;
  const nextTrustLevel = Math.max(0, (security.trustLevel ?? 1) - 1);

  const violationEntry = {
    id: `${agentId}:${nextViolationCount}`,
    kind: 'possible_leak',
    details: leak,
    sourceType: type,
    createdAt: now
  };

  const updatedSecurity = {
    ...security,
    trustLevel: nextTrustLevel,
    violationCount: nextViolationCount,
    violations: [...(security.violations || []), violationEntry],
    updatedAt: now
  };

  // If trust has fallen to the lowest level, automatically "lock" the agent.
  // This does NOT require a human in the loop; it simply stops further
  // autonomous execution until the system widens the role again.
  let updates = { security: updatedSecurity };

  if (nextTrustLevel === 0 && !security.locked) {
    updatedSecurity.locked = true;
    updates = {
      ...updates,
      status: 'paused'
    };
  }

  await agentStore.update(agentId, updates);

  // Also append a high-signal log line for observability.
  await agentStore.addLog(
    agentId,
    `🔐 Security: detected possible secret in output (pattern ${leak.pattern}); ` +
      `trust level now ${nextTrustLevel}`,
    'warning'
  );
}

