# Implementation Plan: Unblock agents via interactive notifications and inbox

## Phase 1: Backend & Protocol Foundation
- [ ] Task: Define the Agent Intervention Schema (ACP-compatible)
    - [ ] Create `server/interventionModel.js` to define schema.
    - [ ] Update `agentStore.js` to handle intervention state.
- [ ] Task: Implement Intervention API Endpoints
    - [ ] Add `POST /api/agents/:id/intervene` to `server/index.js`.
    - [ ] Add `GET /api/notifications/active` for fetching pending requests.
- [ ] Task: Update Agent Executor for Interventions
    - [ ] Modify `agentExecutor.js` to trigger notifications when an agent is blocked.
    - [ ] Ensure agent execution pauses and waits for the intervention response.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Backend & Protocol Foundation' (Protocol in workflow.md)

## Phase 2: Android Core & Notifications
- [ ] Task: Implement Interactive Notification Handlers
    - [ ] Add `QuickReplyReceiver` and `QuickActionReceiver` in Android.
    - [ ] Update `NotificationHelper` to support RemoteInput (text) and Action buttons.
- [ ] Task: Create Intervention Data Models in Android
    - [ ] Define `Intervention` and `Choice` data classes.
    - [ ] Update `AgentsRepository` to handle the new `/api/agents/:id/intervene` endpoint.
- [ ] Task: Implement Notification Triggers and Sync
    - [ ] Ensure the Android app receives and displays intervention notifications via the existing monitoring service.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Android Core & Notifications' (Protocol in workflow.md)

## Phase 3: Android Inbox UI & Polish
- [ ] Task: Build the Inbox Screen in Jetpack Compose
    - [ ] Create `InboxScreen.kt` with a list of active interventions.
    - [ ] Design Material 3 cards for different intervention types (Text vs. Choice).
- [ ] Task: Integrate Inbox with App Navigation
    - [ ] Add "Inbox" to the `BottomNavBar` and `MainViewModel`.
    - [ ] Ensure deep-linking from notifications to the Inbox works correctly.
- [ ] Task: End-to-End Verification & Polish
    - [ ] Verify full flow: Agent blocks -> Notification -> User response -> Agent resumes.
    - [ ] Final UI/UX polish for Material 3 compliance.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Android Inbox UI & Polish' (Protocol in workflow.md)
