import pty from 'node-pty-prebuilt-multiarch';
import { detectBlock } from './dangerHeuristics.js';
import EventEmitter from 'events';

/**
 * Manages PTY sessions for AI agents and detects interactive blocks.
 * @extends EventEmitter
 */
class DangerTerminal extends EventEmitter {
  /**
   * Initializes the DangerTerminal instance.
   */
  constructor() {
    super();
    /** @type {Map<string, Object>} Map of agentId to session details. */
    this.sessions = new Map();
  }

  /**
   * Spawns a new PTY session for an agent.
   * @param {string} agentId The unique ID of the agent.
   * @param {string} command The command to execute.
   * @param {Array<string>} args Arguments for the command.
   * @param {Object} options PTY and process options.
   * @returns {Object} The spawned ptyProcess.
   */
  spawn(agentId, command, args, options = {}) {
    if (this.sessions.has(agentId)) {
      this.kill(agentId);
    }

    const ptyProcess = pty.spawn(command, args, {
      name: 'xterm-color',
      cols: options.cols || 80,
      rows: options.rows || 24,
      cwd: options.cwd || process.cwd(),
      env: { ...process.env, ...options.env }
    });

    const session = {
      ptyProcess,
      output: '',
      lastActivity: Date.now(),
      isBlocked: false,
      checkInterval: null
    };

    ptyProcess.on('data', (data) => {
      session.output += data;
      session.lastActivity = Date.now();
      session.isBlocked = false; // Any new data unblocks temporarily
      this.emit('data', { agentId, data });
    });

    ptyProcess.on('exit', (exitCode, signal) => {
      this.stopMonitoring(agentId);
      this.sessions.delete(agentId);
      this.emit('exit', { agentId, exitCode, signal });
    });

    session.checkInterval = setInterval(() => {
      if (session.isBlocked) return;

      const block = detectBlock(session.output, session.lastActivity);
      if (block) {
        session.isBlocked = true;
        this.emit('block', { agentId, ...block });
      }
    }, 500);

    this.sessions.set(agentId, session);
    return ptyProcess;
  }

  /**
   * Writes data to an agent's PTY session.
   * @param {string} agentId The agent's ID.
   * @param {string} data The string data to write.
   */
  write(agentId, data) {
    const session = this.sessions.get(agentId);
    if (session) {
      session.ptyProcess.write(data);
      session.lastActivity = Date.now();
      session.isBlocked = false;
    }
  }

  /**
   * Kills an agent's PTY session.
   * @param {string} agentId The agent's ID.
   */
  kill(agentId) {
    const session = this.sessions.get(agentId);
    if (session) {
      this.stopMonitoring(agentId);
      session.ptyProcess.kill();
      this.sessions.delete(agentId);
    }
  }

  /**
   * Stops the block-detection monitoring for an agent.
   * @param {string} agentId The agent's ID.
   */
  stopMonitoring(agentId) {
    const session = this.sessions.get(agentId);
    if (session && session.checkInterval) {
      clearInterval(session.checkInterval);
      session.checkInterval = null;
    }
  }

  /**
   * Retrieves an active session for an agent.
   * @param {string} agentId The agent's ID.
   * @returns {Object|undefined} The session object if found.
   */
  getSession(agentId) {
    return this.sessions.get(agentId);
  }
}

/** @type {DangerTerminal} Singleton instance of DangerTerminal. */
export const dangerTerminal = new DangerTerminal();
