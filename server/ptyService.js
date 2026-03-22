import { WebSocketServer } from 'ws';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

// node-pty-prebuilt-multiarch must be imported as CJS because it's a native module
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pty = require('node-pty-prebuilt-multiarch');

const activeSessions = new Map(); // sessionId → { id, proc, ws, buffer, cwd, cmd, startedAt }
const MAX_BUFFER_SIZE = 100 * 1024; // Keep last 100KB of ANSI output

export function attachPtyServer(httpServer) {
    const wssOptions = httpServer
        ? { server: httpServer, path: '/pty' }
        : { noServer: true };
    const wss = new WebSocketServer(wssOptions);

    wss.on('connection', (ws, req) => {
        const params = new URL(req.url, 'http://localhost').searchParams;
        const sessionId = params.get('resume');

        const cols = parseInt(params.get('cols') || '220', 10);
        const rows = parseInt(params.get('rows') || '50', 10);

        if (sessionId && activeSessions.has(sessionId)) {
            // ── Resume Existing Session ────
            const session = activeSessions.get(sessionId);
            
            // Disconnect old WS if exists
            if (session.ws && session.ws !== ws && session.ws.readyState === 1) {
                session.ws.close();
            }
            session.ws = ws;
            
            console.log(`🖥️  PTY [${sessionId.slice(0, 8)}] Reconnected`);
            
            // Resize immediately to match new terminal container
            session.proc.resize(cols, rows);

            // Replay the buffered ANSI history instantly
            if (session.buffer) {
                ws.send(session.buffer);
            }

            // Ignore input for 250ms after reconnecting so Restty doesn't reply 
            // "ghostty" to old Device Attribute requests found during scrollback replay.
            session.ignoreInputUntil = Date.now() + 250;

            attachWsToSession(ws, session);
        } else {
            // ── Create New Session ────
            const id = params.get('id') || randomUUID();
            const cwd = params.get('cwd') || homedir();
            const cmd = params.get('cmd') || 'gemini';
            const shell = process.env.SHELL || '/bin/zsh';

            console.log(`🖥️  PTY [${id.slice(0, 8)}] Spawning: ${shell} -c "${cmd}" in ${cwd}`);

            let proc;
            try {
                proc = pty.spawn(shell, ['-l', '-c', cmd], {
                    name: 'xterm-256color',
                    cols,
                    rows,
                    cwd,
                    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
                });
            } catch (err) {
                console.error(`🖥️  PTY spawn error:`, err.message);
                ws.send(JSON.stringify({ type: 'error', text: err.message }));
                ws.close();
                return;
            }

            const session = {
                id,
                proc,
                ws,
                buffer: '',
                cwd,
                cmd,
                startedAt: Date.now(),
                ignoreInputUntil: 0
            };

            activeSessions.set(id, session);

            // PTY → Output Buffer & WebSocket
            proc.onData((data) => {
                session.buffer += data;
                if (session.buffer.length > MAX_BUFFER_SIZE) {
                    session.buffer = session.buffer.slice(-MAX_BUFFER_SIZE);
                }
                if (session.ws && session.ws.readyState === 1) {
                    session.ws.send(data);
                }
            });

            proc.onExit(({ exitCode, signal }) => {
                activeSessions.delete(id);
                console.log(`🖥️  PTY [${id.slice(0, 8)}] exited (code=${exitCode})`);
                if (session.ws && session.ws.readyState === 1) {
                    session.ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
                    session.ws.close();
                }
            });

            // Inform the client of their new ID via a custom metadata payload
            // This happens BEFORE we send real PTY output.
            ws.send(JSON.stringify({ type: 'session_id', id }));

            attachWsToSession(ws, session);
        }
    });

    console.log('🖥️  PTY WebSocket ready at ws://<host>/pty');
    return wss;
}

function attachWsToSession(ws, session) {
    ws.on('message', (raw) => {
        const str = raw.toString();
        try {
            const msg = JSON.parse(str);
            if (msg.type === 'resize' && msg.cols && msg.rows) {
                session.proc.resize(parseInt(msg.cols, 10), parseInt(msg.rows, 10));
            } else if (msg.type === 'input') {
                if (Date.now() >= session.ignoreInputUntil) {
                    session.proc.write(msg.data);
                }
            }
        } catch {
            // Not JSON — treat as raw input (restty xterm compatibility)
            if (Date.now() >= session.ignoreInputUntil) {
                session.proc.write(str);
            }
        }
    });

    ws.on('close', () => {
        console.log(`🖥️  PTY [${session.id.slice(0, 8)}] WS disconnected, process kept alive`);
        if (session.ws === ws) {
            session.ws = null;
        }
    });

    ws.on('error', () => {
        if (session.ws === ws) {
            session.ws = null;
        }
    });
}

// REST API Methods
export function getActiveTerminalSessions() {
    return Array.from(activeSessions.values()).map(s => ({
        id: s.id,
        cwd: s.cwd,
        cmd: s.cmd,
        startedAt: s.startedAt
    }));
}

export function killTerminalSession(id) {
    const session = activeSessions.get(id);
    if (!session) return false;
    
    try {
        session.proc.kill();
    } catch {}
    
    if (session.ws) {
        session.ws.close();
    }
    
    activeSessions.delete(id);
    return true;
}

export function getPtyStats() {
    return { active: activeSessions.size };
}

/**
 * Inject raw input into a session's PTY process directly,
 * without needing a WebSocket connection. Safe to call while
 * Restty or xterm already holds the WebSocket.
 */
export function writeToPtySession(id, data) {
    const session = activeSessions.get(id);
    if (!session) return false;
    session.proc.write(data);
    return true;
}

