# Specification: Unblock agents via interactive notifications and inbox

## Goal
The goal of this track is to enable users to quickly respond to AI agent "interventions" (requests for input or decision-making) directly from their Android device using interactive notifications (quick reply, multiple choice) and a centralized inbox UI.

## Context
AI agents often encounter situations where they need user clarification, permission, or a decision to proceed (e.g., a "blocked" state). Currently, the system lacks a streamlined way for users to unblock these agents without manual intervention in the web dashboard.

## Requirements
1. **Agent Intervention Protocol:** Define a standardized JSON structure for agent "interventions" (e.g., `type: "input"`, `type: "choice"`, `type: "confirmation"`).
2. **Backend Intervention API:**
    - `POST /api/agents/:id/intervene`: Send a response back to a blocked agent.
    - `GET /api/notifications/active`: Fetch current active interventions.
3. **Android Interactive Notifications:**
    - Support "Quick Reply" (text input) in notifications.
    - Support "Quick Actions" (multiple choice buttons) in notifications.
    - Deep-link into the specific agent's inbox view.
4. **Android Inbox UI:**
    - A dedicated "Inbox" screen showing all agents currently awaiting user input.
    - Modern Material 3 cards for each intervention.
5. **Real-time Synchronization:** Ensure notifications are dismissed on the phone when an intervention is resolved (via WebSocket).

## Success Criteria
- A user receives a notification when an agent is blocked.
- The user can unblock the agent directly from the notification (text or choice).
- The user can see all pending interventions in the Android app's inbox.
- The agent resumes execution immediately upon receiving the user's response.
