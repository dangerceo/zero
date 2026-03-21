# Implementation Plan: Danger Terminal Harness

## Phase 1: Test Infrastructure & Heuristics Core
- [ ] Task: Setup Test Harness for PTY
    - [ ] Create mock CLI scripts (e.g., password prompt, long-build, standard prompt).
    - [ ] Write initial test cases defining the expected heuristic behavior.
- [ ] Task: Implement Heuristic Block Detection
    - [ ] Build the detection logic (timeouts, regex matching for trailing prompts).
    - [ ] Ensure all tests pass, validating no false positives on long-running tasks.
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Danger Terminal Service Integration
- [ ] Task: Build `danger-terminal.js` Service
    - [ ] Wrap process execution using `node-pty`.
    - [ ] Integrate the heuristic detection engine to monitor `stdout`.
- [ ] Task: Integrate with Agent Executor
    - [ ] Modify `server/agentExecutor.js` to route execution through `danger-terminal`.
    - [ ] Wire the "block detected" event to the `agentStore.addIntervention` pipeline.
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Input Injection & Polish
- [ ] Task: Implement Stdin Injection
    - [ ] Add endpoint/logic to pipe intervention responses back to the PTY.
    - [ ] Ensure the agent successfully unblocks and continues.
- [ ] Task: End-to-End Verification
    - [ ] Test the full loop from agent spawning a blocked process -> Android notification -> User response -> Agent resumes.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)