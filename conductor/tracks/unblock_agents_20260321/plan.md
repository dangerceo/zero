# Implementation Plan: Unblock agents via interactive notifications and inbox

## Phase 1: Backend & Protocol Foundation [checkpoint: f8d15d1]
- [x] Task: Define the Agent Intervention Schema (ACP-compatible)
    - [x] Create `server/interventionModel.js` to define schema.
    - [x] Update `agentStore.js` to handle intervention state.
- [x] Task: Implement Intervention API Endpoints
    - [x] Add `POST /api/agents/:id/intervene` to `server/index.js`.
    - [x] Add `GET /api/notifications/active` for fetching pending requests.
- [x] Task: Update Agent Executor for Interventions
    - [x] Modify `agentExecutor.js` to trigger notifications when an agent is blocked.
    - [x] Ensure agent execution pauses and waits for the intervention response.
- [x] Task: Conductor - User Manual Verification 'Phase 1: Backend & Protocol Foundation' (Protocol in workflow.md)

## Phase 2: Android Core & Notifications [checkpoint: 5294fdf]
- [x] Task: Implement Interactive Notification Handlers
    - [x] Add `QuickReplyReceiver` and `QuickActionReceiver` in Android.
    - [x] Update `NotificationHelper` to support RemoteInput (text) and Action buttons.
- [x] Task: Create Intervention Data Models in Android
    - [x] Define `Intervention` and `Choice` data classes.
    - [x] Update `AgentsRepository` to handle the new `/api/agents/:id/intervene` endpoint.
- [x] Task: Implement Notification Triggers and Sync
    - [x] Ensure the Android app receives and displays intervention notifications via the existing monitoring service.
- [x] Task: Conductor - User Manual Verification 'Phase 2: Android Core & Notifications' (Protocol in workflow.md)

## Phase 3: Android Inbox UI & Polish
- [x] Task: Build the Inbox Screen in Jetpack Compose
    - [x] Create `InboxScreen.kt` with a list of active interventions.
    - [x] Design Material 3 cards for different intervention types (Text vs. Choice).
- [x] Task: Integrate Inbox with App Navigation
    - [x] Add "Inbox" to the `BottomNavBar` and `MainViewModel`.
    - [x] Ensure deep-linking from notifications to the Inbox works correctly.
- [~] Task: End-to-End Verification & Polish
    - [ ] Verify full flow: Agent blocks -> Notification -> User response -> Agent resumes.
    - [ ] Final UI/UX polish for Material 3 compliance.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Android Inbox UI & Polish' (Protocol in workflow.md)
