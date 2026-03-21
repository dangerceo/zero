# Refactoring Plan

This plan outlines the steps to refactor the application to improve its architecture, efficiency, and maintainability.

## Phase 1: Backend Standardization

The goal of this phase is to consolidate agent execution logic into a single, modern service (`UnifiedAgentProxy.js`) and remove the legacy `agentExecutor.js`.

### Step 1.1: Integrate `UnifiedAgentProxy`

- **Create an instance of `UnifiedAgentProxy` in `server/index.js`**. This instance will manage all agent sessions.
- **Replace `executeAgent` calls:**
    - In the `/api/agents/:id/start` endpoint, replace `executeAgent(req.params.id, broadcast, false)` with `proxy.spawnAgent(req.params.id, req.body.prompt)`.
    - In the `/api/agents/:id/resume` endpoint, replace `executeAgent(req.params.id, broadcast, true)` with `proxy.spawnAgent(req.params.id, null, true)`.
- **Replace `stopAgent` calls:**
    - In the `/api/agents/:id/stop` endpoint, replace `stopAgent(req.params.id)` with `proxy.killAgent(req.params.id)`.

### Step 1.2: Remove `agentExecutor.js`

- Once all calls to `agentExecutor.js` have been replaced, delete the `server/agentExecutor.js` file.
- Remove the import from `server/index.js`.

## Phase 2: Frontend Refactoring

The goal of this phase is to improve the frontend architecture by introducing a state management library and creating reusable components.

### Step 2.1: Introduce State Management

- **Add a state management library (e.g., Zustand).**
- **Create a global store** to manage agents, notifications, and other shared state.
- **Refactor `App.jsx`** to use the global store instead of local state.

### Step 2.2: Create Reusable Notification Component

- **Create a `Notification.jsx` component.** This component will display a single notification and have a dismiss button.
- **Create a `NotificationContainer.jsx` component.** This component will get the notifications from the global store and render a `Notification` for each one.
- **Remove the notification UI** from `App.jsx` and `TerminalPage.jsx`.

## Phase 3: Enforce Service Boundaries

The goal of this phase is to ensure all notifications are routed through the `notificationService`.

- **Review the codebase** for any instances where notifications are created directly.
- **Refactor these instances** to use `notificationService.addNotification()`.
