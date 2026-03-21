# Implementation Plan: Danger Terminal Harness

## Phase 1: Test Infrastructure & Heuristics Core [checkpoint: 820fe4c]
- [x] Task: Setup Test Harness for PTY
    - [x] Create mock CLI scripts (e.g., password prompt, long-build, standard prompt, numbered choice list).
    - [x] Write initial test cases defining the expected heuristic behavior.
- [x] Task: Implement Heuristic Block Detection
    - [x] Build the detection logic (timeouts, regex matching for trailing prompts).
    - [x] Implement basic choice list extraction (regex-based parsing of numbered options).
    - [x] Ensure all tests pass, validating no false positives on long-running tasks.
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Danger Terminal Service Integration [checkpoint: 9414efe]
- [x] Task: Build `danger-terminal.js` Service
    - [x] Wrap process execution using `node-pty`.
    - [x] Integrate the heuristic detection engine to monitor `stdout`.
- [x] Task: Integrate with Agent Executor
    - [x] Modify `server/agentExecutor.js` to route execution through `danger-terminal`.
    - [x] Wire the "block detected" event to the `agentStore.addIntervention` pipeline.
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Input Injection & Polish [checkpoint: 1fffeb6]
- [x] Task: Implement Stdin Injection
    - [x] Add endpoint/logic to pipe intervention responses back to the PTY.
    - [x] Ensure the agent successfully unblocks and continues.
- [x] Task: End-to-End Verification
    - [x] Test the full loop from agent spawning a blocked process -> Android notification -> User response -> Agent resumes.
- [x] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase: Review Fixes
- [x] Task: Apply review suggestions 766e5f4