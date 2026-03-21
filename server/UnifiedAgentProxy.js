/**
 * @fileoverview Unified proxy for all agent communication and execution.
 */

import { agentStore } from './agentStore.js';
import { dangerTerminal } from './dangerTerminal.js';
import { getSettings } from './settings.js';
import { Writable, Readable } from 'stream';
import * as acp from '@agentclientprotocol/sdk';
import { notificationService } from './notificationService.js';

/**
 * Custom ACP client to pipe events back to the proxy.
 */
class UnifiedAcpClient {
    /**
     * @param {UnifiedAgentProxy} proxy The parent proxy.
     * @param {Object} session The agent session.
     */
    constructor(proxy, session) {
        this.proxy = proxy;
        this.session = session;
        this.currentGeminiText = "";
    }

    /**
     * Handles ACP session updates and broadcasts them.
     * @param {Object} params 
     */
    async sessionUpdate(params) {
        const update = params.update;
        const agentId = this.session.agentId;

        switch (update.sessionUpdate) {
            case "agent_message_chunk":
                if (update.content.type === "text") {
                    this.currentGeminiText += update.content.text;
                    this.proxy.broadcast({ type: 'output', agentId, text: update.content.text });
                }
                break;
            case "tool_call":
                this.proxy.broadcast({ type: 'tool', agentId, tool: { id: update.toolCallId, title: update.title, status: update.status } });
                break;
            case "tool_call_update":
                this.proxy.broadcast({ type: 'tool_update', agentId, id: update.toolCallId, status: update.status });
                break;
            case "plan":
                this.proxy.broadcast({ type: 'meta', agentId, text: `📋 Planning` });
                break;
        }
    }

    /**
     * Auto-approves or denies permission requests based on risk tolerance settings.
     * @param {Object} params 
     * @returns {Promise<Object>}
     */
    async requestPermission(params) {
        const settings = await getSettings();
        const tolerance = settings.riskTolerance ?? 1; // Default to Normal Danger

        // Zero Danger (0)
        if (tolerance === 0) {
            console.log(`🛡️  Zero Danger: Denying permission request: ${params.title || 'unnamed task'}`);
            return { outcome: { outcome: "denied", reason: "Zero Danger mode is active." } };
        }

        // Dangermaxxing (2)
        if (tolerance === 2) {
            console.log(`☠️  Dangermaxxing: Auto-approving: ${params.title || 'unnamed task'}`);
            return { outcome: { outcome: "selected", optionId: params.options?.[0]?.optionId || "approve" } };
        }

        // Normal Danger (1)
        // For now, we auto-approve only if it looks like a read-only or common operation, 
        // but since we don't have a granular filter yet, we'll ask for anything non-trivial.
        // In a real MVP, we'd have a UI for this. Here we'll default to 'ask' (deny in this headless proxy).
        console.log(`⚡ Normal Danger: Requesting user intervention for: ${params.title || 'unnamed task'}`);
        return { outcome: { outcome: "denied", reason: "Requires user confirmation in Normal Danger mode." } };
    }
}

/**
 * Unified proxy for all agent communication and execution.
 * Merges logic from agentExecutor.js and chatService.js.
 */
export class UnifiedAgentProxy {
    /**
     * @param {function} broadcast The main WebSocket broadcast function.
     */
    constructor(broadcast) {
        this.broadcast = broadcast;
        /** @type {Map<string, Object>} agentId -> session */
        this.sessions = new Map();
    }

    /**
     * Gets an existing session or creates a new one for an agent.
     * @param {string} agentId 
     * @param {Object} options 
     * @returns {Promise<Object>} The session object.
     */
    async getOrCreateSession(agentId, options = {}) {
        let session = this.sessions.get(agentId);
        if (!session) {
            const agent = await agentStore.get(agentId);
            if (!agent) throw new Error('Agent not found');
            
            session = {
                agentId,
                status: 'idle',
                process: null,
                acp: null,
                acpSessionId: null,
                scrollback: [],
                createdAt: new Date().toISOString()
            };
            this.sessions.set(agentId, session);
            // Record session in store
            await agentStore.addSession(agentId, { 
                type: 'unified', 
                status: 'idle' 
            });
        }
        return session;
    }

    /**
     * Spawns an agent using the unified PTY + ACP proxy.
     * @param {string} agentId 
     * @param {string} prompt The initial user prompt.
     * @param {boolean} resume Whether to resume the agent's last session.
     */
    async spawnAgent(agentId, prompt, resume = false) {
        const session = await this.getOrCreateSession(agentId);
        if (session.process) {
            this.killAgent(agentId);
        }

        const agent = await agentStore.get(agentId);
        const workingDir = agent.workingDir || process.cwd();

        const settings = await getSettings();
        const module = settings.modules.find(m => m.enabled);
        const command = module ? module.command : 'gemini';
        const tolerance = settings.riskTolerance ?? 1;

        console.log(`🤖 Spawning agent [${agentId}] with command [${command}] (Safety: ${tolerance === 2 ? 'Dangermaxxing' : tolerance === 0 ? 'Zero Danger' : 'Normal'})`);

        const args = ['--acp'];
        if (resume) args.push('--resume');
        if (agent.useConductor) args.push('-e', 'conductor');

        const ptyProcess = dangerTerminal.spawn(agentId, command, args, {
            cwd: workingDir,
            env: { 
                ...process.env, 
                ZERO_RISK_TOLERANCE: String(tolerance),
                ZERO_COMPUTER_AFFINITY: String(settings.computerAffinity || 2)
            }
        });

        session.process = ptyProcess;
        session.status = 'running';
        
        await this.setupAcp(session, ptyProcess);
        this.setupHeuristics(session);

        await agentStore.update(agentId, { status: 'running' });
        this.broadcast({ type: 'status', agentId, status: 'running' });

        if (prompt) {
            await session.acp.prompt({
                sessionId: session.acpSessionId,
                prompt: [{ type: "text", text: prompt }]
            });
        }
    }

    /**
     * Sets up the Agent Client Protocol (ACP) bridge for a session.
     * @param {Object} session 
     * @param {Object} ptyProcess The node-pty process.
     */
    async setupAcp(session, ptyProcess) {
        const agentId = session.agentId;
        
        const readable = new ReadableStream({
            start(controller) {
                dangerTerminal.on('data', (payload) => {
                    if (payload.agentId === agentId) controller.enqueue(payload.data);
                });
            }
        });
        
        const writable = new WritableStream({
            write(chunk) {
                dangerTerminal.write(agentId, chunk);
            }
        });

        const stream = acp.ndJsonStream(writable, readable);
        const clientWrapper = new UnifiedAcpClient(this, session);
        const connection = new acp.ClientSideConnection(() => clientWrapper, stream);
        
        session.acp = connection;

        await connection.initialize({
            protocolVersion: acp.PROTOCOL_VERSION,
            clientCapabilities: {}
        });

        const sessionResult = await connection.newSession({
            cwd: ptyProcess.cwd,
            mcpServers: []
        });

        session.acpSessionId = sessionResult.sessionId;
    }

    /**
     * Wires up danger-terminal events for a session.
     * @param {Object} session 
     */
    setupHeuristics(session) {
        const agentId = session.agentId;
        
        const onBlock = async (block) => {
            if (block.agentId !== agentId) return;
            
            const intervention = { type: block.type, message: block.message, options: block.options };
            await agentStore.addIntervention(agentId, intervention);
            await agentStore.update(agentId, { status: 'waiting' });
            
            notificationService.addNotification({ title: 'Agent Intervention', text: block.message, agentId, intervention });
        };

        const onExit = (payload) => {
            if (payload.agentId !== agentId) return;
            
            dangerTerminal.off('block', onBlock);
            dangerTerminal.off('exit', onExit);
            
            session.process = null;
            session.status = 'idle';
            agentStore.update(agentId, { status: payload.exitCode === 0 ? 'completed' : 'failed' });
            this.broadcast({ type: 'status', agentId, status: 'idle' });
        };

        dangerTerminal.on('block', onBlock);
        dangerTerminal.on('exit', onExit);
    }

    /**
     * Kills an agent's PTY session and cleans up listeners.
     * @param {string} agentId 
     */
    killAgent(agentId) {
        const session = this.sessions.get(agentId);
        if (session && session.process) {
            dangerTerminal.kill(agentId);
            session.process = null;
            session.status = 'idle';
        }
    }
}
