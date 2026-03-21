# Implementation Plan: Unified Agent Proxy and Deployment Pipeline

## Phase 1: Storage Upgrade & Unified Schema [checkpoint: c0bdd2b]
- [x] Task: Refactor `agentStore.js` for Session Persistence 473dbfd
    - [x] Add `sessions` table/array to track live process metadata.
    - [x] Implement `Deployment` schema (status, URL, provider: 'cloudflare').
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Unified Agent Proxy Implementation [checkpoint: 36a26ca]
- [x] Task: Build `UnifiedAgentProxy.js` f03254b
    - [x] Merge logic from `chatService.js` and `agentExecutor.js`.
    - [x] Implement a unified event emitter for all agent activity.
- [x] Task: Integrate `danger-terminal` into Proxy f03254b
    - [x] Ensure all tool-driven shell commands use the heuristic harness.
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Cloudflare Integration & UI
- [x] Task: Implement Cloudflare Deployment Tool 80113
    - [x] Add `deployToCloudflare` tool to the backend.
    - [x] Handle wrangler/API authentication.
- [x] Task: Update Android & Web UI 80113
    - [x] Add "Deploy" button and deployment status indicators.
- [~] Task: End-to-End Verification
    - [ ] Verify: Create Agent -> Build Worker -> Deploy to Cloudflare -> View live on phone.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)