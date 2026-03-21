# Technology Stack: Zero Computer

## Languages
- **JavaScript (ESM):** Primary language for the backend server and web dashboard.
- **Kotlin:** Primary language for the Android mobile application.

## Backend
- **Node.js (Express):** Core server framework for handling API requests and serving the web app.
- **WebSocket (ws):** Real-time communication for terminal streaming and agent updates.
- **node-pty:** PTY support for providing full terminal access on macOS.
- **UnifiedAgentProxy:** Internal service unifying ACP chat and PTY execution paths.

## Frontend
- **React (Vite):** Modern frontend library for the web-based control dashboard.
- **React Router:** For managing client-side navigation.
- **xterm.js:** Providing a high-performance terminal emulator in the browser.
- **Monaco Editor:** High-quality code editor for writing automation scripts.

## Mobile (Android)
- **Jetpack Compose:** Declarative UI toolkit for a modern, Material 3-compliant experience.
- **Retrofit & Moshi:** Type-safe HTTP client and JSON parsing for API communication.
- **CameraX & ML Kit:** For barcode scanning and other computer vision tasks.
- **Interactive Notifications:** Android RemoteInput and Action buttons for real-time agent unblocking.
- **DataStore:** For persistent local storage of settings and data.

## Database & Storage
- **JSON-based storage:** Lightweight, file-based JSON storage for agents, projects, and notifications located in the `data/` directory.

## Infrastructure
- **Vite:** Build tool and development server for the web frontend.
- **Gradle:** Build system for the Android mobile application.
- **Wrangler:** CLI tool for Cloudflare Workers deployment and management.
