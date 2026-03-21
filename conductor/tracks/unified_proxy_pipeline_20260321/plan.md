# Implementation Plan: Unified Agent Proxy and Deployment Pipeline

## Phase 1: Storage Upgrade & Unified Schema [checkpoint: c0bdd2b]
- [x] Task: Refactor `agentStore.js` for Session Persistence 473dbfd
    - [x] Add `sessions` table/array to track live process metadata.
    - [x] Implement `Deployment` schema (status, URL, provider: 'cloudflare').
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Unified Agent Proxy Implementation
- [ ] Task: Build `UnifiedAgentProxy.js`
    - [ ] Merge logic from `chatService.js` and `agentExecutor.js`.
    - [ ] Implement a unified event emitter for all agent activity.
- [ ] Task: Integrate `danger-terminal` into Proxy
    - [ ] Ensure all tool-driven shell commands use the heuristic harness.
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Cloudflare Integration & UI
- [ ] Task: Implement Cloudflare Deployment Tool
    - [ ] Add `deployToCloudflare` tool to the backend.
    - [ ] Handle wrangler/API authentication.
- [ ] Task: Update Android & Web UI
    - [ ] Add "Deploy" button and deployment status indicators.
- [ ] Task: End-to-End Verification
    - [ ] Verify: Create Agent -> Build Worker -> Deploy to Cloudflare -> View live on phone.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)