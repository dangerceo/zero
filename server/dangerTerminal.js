import pty from 'node-pty-prebuilt-multiarch';
import { detectBlock } from './dangerHeuristics.js';
import EventEmitter from 'events';

class DangerTerminal extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map(); // agentId -> { ptyProcess, output, lastActivity, isBlocked }
  }

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

  write(agentId, data) {
    const session = this.sessions.get(agentId);
    if (session) {
      session.ptyProcess.write(data);
      session.lastActivity = Date.now();
      session.isBlocked = false;
    }
  }

  kill(agentId) {
    const session = this.sessions.get(agentId);
    if (session) {
      this.stopMonitoring(agentId);
      session.ptyProcess.kill();
      this.sessions.delete(agentId);
    }
  }

  stopMonitoring(agentId) {
    const session = this.sessions.get(agentId);
    if (session && session.checkInterval) {
      clearInterval(session.checkInterval);
      session.checkInterval = null;
    }
  }

  getSession(agentId) {
    return this.sessions.get(agentId);
  }
}

export const dangerTerminal = new DangerTerminal();
