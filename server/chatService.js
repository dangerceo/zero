import { spawn } from 'child_process';
import { Writable, Readable } from 'stream';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { homedir } from 'os';
import * as acp from '@agentclientprotocol/sdk/dist/acp.js';
import { agentStore } from './agentStore.js';

// Sessions live forever on Mac mini — only die when:
//   1. Gemini process exits on its own
//   2. Server restarts
//   3. Client sends { type: 'kill' }
//
// id → { process, ws, scrollback[], conductor, cwd, status: 'warm'|'running' }
const sessions = new Map();
const SCROLLBACK_LINES = 200;

export function attachChatServer(httpServer) {
    const wssOptions = httpServer
        ? { server: httpServer, path: '/chat' }
        : { noServer: true };
    const wss = new WebSocketServer(wssOptions);

    wss.on('connection', (ws, req) => {
        const params = new URL(req.url, 'http://localhost').searchParams;
        const resumeId = params.get('resume');
        const conductorMode = params.get('conductor') === 'true';
        const agentId = params.get('agentId');
        const customCwd = params.get('cwd');
        const existing = resumeId ? sessions.get(resumeId) : null;

        // Resume existing session
        if (existing && (existing.status === 'warm' || existing.process?.exitCode === null)) {
            console.log(`💬 Reattached to session: ${resumeId}`);
            existing.ws = ws;
            ws.send(JSON.stringify({
                type: 'session', id: resumeId, resumed: true,
                conductor: existing.conductor, cwd: existing.cwd,
                status: existing.status
            }));
            if (existing.scrollback.length) {
                ws.send(JSON.stringify({
                    type: 'history',
                    messages: existing.scrollback
                }));
            }
            attachClient(ws, existing, resumeId);
            return;
        }

        // New session — start in "warm" state (no process yet)
        const sessionId = uuidv4();
        let cwd;
        if (conductorMode) {
            const AGENTS_DIR = join(homedir(), 'ZeroProjects');
            cwd = agentId ? join(AGENTS_DIR, agentId) : (customCwd || homedir());
        } else {
            cwd = customCwd || homedir();
        }

        const session = {
            process: null,
            ws,
            scrollback: [],
            conductor: conductorMode,
            agentId: agentId || null,
            cwd,
            status: 'warm' // warm = WS connected, dir selected, no gemini process yet
        };
        sessions.set(sessionId, session);
        console.log(`💬 Warmed up session: ${sessionId} in ${cwd} (${sessions.size} total)`);

        // Tell client we're warm and ready — no gemini spawned yet
        ws.send(JSON.stringify({
            type: 'session', id: sessionId, resumed: false,
            conductor: conductorMode, cwd, status: 'warm'
        }));

        attachClient(ws, session, sessionId);
    });

    console.log('💬 Chat WebSocket ready at ws://<host>/chat');
    return wss;
}

function appendScrollback(session, msgObj) {
    session.scrollback.push(msgObj);
    if (session.scrollback.length > SCROLLBACK_LINES) {
        session.scrollback.shift();
    }
}

/**
 * Spawn gemini when the user sends their first message.
 * Uses -i "first message" so gemini processes the prompt then stays interactive.
 */
class ZeroAcpClient {
    constructor(session, sessionId) {
        this.session = session;
        this.sessionId = sessionId;
        this.currentGeminiText = "";
    }

    async sessionUpdate(params) {
        const update = params.update;
        if (!this.session.ws || this.session.ws.readyState !== 1) return;

        switch (update.sessionUpdate) {
            case "agent_message_chunk":
                if (update.content.type === "text") {
                    this.currentGeminiText += update.content.text;
                    this.session.ws.send(JSON.stringify({ type: 'output', text: update.content.text }));
                }
                break;
            case "tool_call":
                const toolObj = { role: 'tool', id: update.toolCallId, title: update.title, status: update.status };
                appendScrollback(this.session, toolObj);
                this.session.ws.send(JSON.stringify({ type: 'tool', tool: toolObj }));
                break;
            case "tool_call_update":
                const existingTool = this.session.scrollback.find(m => m.id === update.toolCallId);
                if (existingTool) existingTool.status = update.status;
                this.session.ws.send(JSON.stringify({ type: 'tool_update', id: update.toolCallId, status: update.status }));
                break;
            case "plan":
                this.session.ws.send(JSON.stringify({ type: 'meta', text: `📋 Planning` }));
                break;
        }
    }

    async requestPermission(params) {
        // Auto-approve or ignore since it's zero
        return { outcome: { outcome: "selected", optionId: params.options?.[0]?.optionId || "approve" } };
    }
}

async function spawnGemini(session, sessionId, firstMessage) {
    let args;
    if (session.conductor) {
        args = ['-e', 'conductor', '--acp'];
    } else {
        args = ['--acp'];
    }

    const geminiProcess = spawn('gemini', args, {
        cwd: session.cwd,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
    });

    session.process = geminiProcess;
    session.status = 'running';
    console.log(`💬 Spawned gemini (ACP): ${sessionId} in ${session.cwd}`);

    // Notify client that we're now running
    if (session.ws?.readyState === 1) {
        session.ws.send(JSON.stringify({ type: 'status', status: 'running' }));
    }

    try {
        const input = Writable.toWeb(geminiProcess.stdin);
        const output = Readable.toWeb(geminiProcess.stdout);
        const stream = acp.ndJsonStream(input, output);
        
        const clientWrapper = new ZeroAcpClient(session, sessionId);
        const connection = new acp.ClientSideConnection(() => clientWrapper, stream);
        session.acp = connection;

        geminiProcess.stderr.on('data', data => {
            console.log(`[ACP STDERR]`, data.toString());
        });

        geminiProcess.on('close', (code) => {
            session.status = 'closed';
            sessions.delete(sessionId);
            if (session.ws?.readyState === 1) {
                session.ws.send(JSON.stringify({ type: 'closed', code }));
                session.ws.close();
            }
            console.log(`💬 Session ended: ${sessionId} (exit ${code}) — ${sessions.size} remaining`);
        });

        const initResult = await connection.initialize({
            protocolVersion: acp.PROTOCOL_VERSION,
            clientCapabilities: {}
        });

        const sessionResult = await connection.newSession({
            cwd: session.cwd,
            mcpServers: []
        });

        session.acpSessionId = sessionResult.sessionId;

        if (firstMessage) {
            appendScrollback(session, { role: 'user', text: firstMessage });
            if (session.agentId) {
                agentStore.addThread(session.agentId, 'user', firstMessage).catch(() => {});
            }

            const promptRes = await connection.prompt({
                sessionId: session.acpSessionId,
                prompt: [{ type: "text", text: firstMessage }]
            });
            
            // Persist the combined answer upon completion
            if (clientWrapper.currentGeminiText) {
                appendScrollback(session, { role: 'gemini', text: clientWrapper.currentGeminiText });
                if (session.agentId) {
                    agentStore.addThread(session.agentId, 'agent', clientWrapper.currentGeminiText).catch(() => {});
                }
                clientWrapper.currentGeminiText = ""; // reset for next prompt
            }
        }

    } catch (e) {
        console.error("ACP Init Error:", e);
        if (session.ws?.readyState === 1) {
            session.ws.send(JSON.stringify({ type: 'error', text: e.message }));
        }
    }
}

function attachClient(ws, session, sessionId) {
    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw.toString());
            if (msg.type === 'input') {
                if (session.status === 'warm') {
                    // First message — spawn gemini via ACP
                    spawnGemini(session, sessionId, msg.text);
                } else if (session.acp && session.acpSessionId) {
                    appendScrollback(session, { role: 'user', text: msg.text });
                    if (session.agentId) {
                        agentStore.addThread(session.agentId, 'user', msg.text).catch(() => {});
                    }

                    // Subsequent messages — send ACP prompt
                    session.acp.prompt({
                        sessionId: session.acpSessionId,
                        prompt: [{ type: "text", text: msg.text }]
                    }).then(() => {
                        // Persist the combined answer upon completion
                        const wrapper = session.acp.clientWrapper; // Hack? We can attach it to session
                        // Actually easier: since we construct the AcpClient inside spawnGemini, we can save it to session
                    }).catch(e => console.error("ACP Prompt Error", e));
                }
            }

            if (msg.type === 'interrupt' && session.acp) {
                session.acp.cancel({});
            }
            if (msg.type === 'kill') {
                session.process?.kill();
                sessions.delete(sessionId);
            }
        } catch {
            // Fallback skipped, WebSocket interface should always send { type: "input", text: "..." }
        }
    });

    ws.on('close', () => {
        session.ws = null;
        console.log(`💬 Client disconnected — session preserved`);
    });
}

export function getChatSessions() {
    return Array.from(sessions.entries()).map(([id, s]) => ({
        id,
        alive: s.status === 'warm' || s.process?.exitCode === null,
        connected: s.ws?.readyState === 1,
        conductor: s.conductor,
        agentId: s.agentId,
        cwd: s.cwd,
        status: s.status,
        scrollbackLines: s.scrollback.join('').split('\n').length
    }));
}
