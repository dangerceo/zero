# Specification: Unified Agent Proxy and Deployment Pipeline

## Goal
Unify all agent communication and execution paths into a single `UnifiedAgentProxy` service, upgrade storage for full session tracking, and implement a one-click deployment pipeline to Cloudflare.

## Context
Currently, agent management is split between `agentExecutor.js` (CLI-like runs) and `chatService.js` (ACP-based chat). This makes state tracking and mobile synchronization complex. We need a single service that acts as a proxy for all agent interactions, combined with a robust deployment pipeline to reach feature parity with modern dev platforms like Replit.

## Requirements
1. **Unified Agent Proxy:**
    - A single service to manage agent spawning, whether for background tasks or interactive chat.
    - Integration of the `danger-terminal` harness into all shell-based tool calls.
    - Unified WebSocket events for terminal output, chat chunks, and interventions.
2. **Proper Storage (Enhanced AgentStore):**
    - Track the full state of "live" sessions, including scrollback, active tool calls, and deployment metadata.
    - Persist agent context across restarts more effectively.
3. **Cloudflare Deployment Pipeline:**
    - Implement a "Push to Cloudflare" tool/action.
    - Store Cloudflare credentials/tokens securely in the backend settings.
    - Display deployment status and live URL in the UI.
4. **Android UI Parity:**
    - Add a "Deploy" button to the Android Assistant view.
    - Ensure the live deployment URL is easily accessible from the phone.

## Success Criteria
- All agent interactions (chat and terminal) flow through one backend service.
- Agent sessions can be resumed perfectly from both web and mobile.
- A "Hello World" worker can be deployed to Cloudflare directly from the Android app.