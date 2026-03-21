# Specification: Danger Terminal Harness

## Goal
Build `danger-terminal`, a PTY-based harness that wraps agent execution or sub-command execution to detect and manage interactive terminal prompts (blocks/hangs), routing them to the Android Inbox for human intervention.

## Context
When an AI agent (running via the Gemini CLI) executes a sub-command that requires interactive input (e.g., `npm init`, password prompts), the process hangs. Currently, the server cannot easily distinguish this from a long-running process (like a build). We need a harness to detect these subtle blocked states, extract the prompt, pause the agent, and request user input via the existing intervention system.

## Requirements
1. **PTY Wrapper:** Wrap agent or tool executions in `node-pty` to capture raw `stdout` and inject `stdin`.
2. **Heuristic Block Detection:** Implement sophisticated heuristics to detect when a sub-command is waiting for input (e.g., quiet threshold + trailing prompt characters without newlines), distinguishing it from long-running output.
3. **Intervention Mapping:** When a block is detected, automatically generate a `type: "input"` intervention and route it to the Android Inbox.
4. **Input Injection:** Route the user's Inbox response back into the PTY's `stdin` and resume the process.
5. **Robust Test Suite:** Extensive test coverage to prevent false positives (e.g., builds) and handle various CLI prompt types (hidden inputs, choices, standard prompts).