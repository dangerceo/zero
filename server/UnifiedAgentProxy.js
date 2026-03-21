import { agentStore } from './agentStore.js';
import { dangerTerminal } from './dangerTerminal.js';
import { v4 as uuidv4 } from 'uuid';
import * as acp from '@agentclientprotocol/sdk/dist/acp.js';
import { Writable, Readable } from 'stream';

class UnifiedAcpClient {
    constructor(proxy, session) {
        this.proxy = proxy;
        this.session = session;
        this.currentGeminiText = "";
    }

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

    async requestPermission(params) {
        return { outcome: { outcome: "selected", optionId: params.options?.[0]?.optionId || "approve" } };
    }
}

/**
 * Unified proxy for all agent communication and execution.
 * Merges logic from agentExecutor.js and chatService.js.
 */
export class UnifiedAgentProxy {
    constructor(broadcast) {
        this.broadcast = broadcast;
        /** @type {Map<string, Object>} agentId -> session */
        this.sessions = new Map();
    }

    /**
     * Gets an existing session or creates a new one for an agent.
     * @param {string} agentId 
     * @param {Object} options 
     * @returns {Promise<Object>}
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
     * @param {string} prompt 
     * @param {boolean} resume 
     */
    async spawnAgent(agentId, prompt, resume = false) {
        const session = await this.getOrCreateSession(agentId);
        if (session.process) {
            this.killAgent(agentId);
        }

        const agent = await agentStore.get(agentId);
        const workingDir = agent.workingDir || process.cwd();

        const args = ['--acp'];
        if (resume) args.push('--resume');
        if (agent.useConductor) args.push('-e', 'conductor');

        const ptyProcess = dangerTerminal.spawn(agentId, 'gemini', args, {
            cwd: workingDir,
            env: { ...process.env }
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

    setupHeuristics(session) {
        const agentId = session.agentId;
        
        const onBlock = async (block) => {
            if (block.agentId !== agentId) return;
            
            const intervention = { type: block.type, message: block.message, options: block.options };
            await agentStore.addIntervention(agentId, intervention);
            await agentStore.update(agentId, { status: 'waiting' });
            
            this.broadcast({ type: 'notification:new', agentId, message: block.message, intervention });
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

    killAgent(agentId) {
        const session = this.sessions.get(agentId);
        if (session && session.process) {
            dangerTerminal.kill(agentId);
            session.process = null;
            session.status = 'idle';
        }
    }
}
