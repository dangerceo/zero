import React, { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { Restty, getBuiltinTheme } from 'restty';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

export default function RawTerminal({
    cwd, cmd, existingSessionId,
    setConnected, setExited, setSessionId, disconnect,
    onSendInputReady,   // callback(fn) — parent receives a "send key" function
}) {
    const { notifications, dismissNotification } = useStore();
    const termContainerRef = useRef(null);
    const resttyRef = useRef(null);
    const terminalInstanceRef = useRef(null);
    const wsRef = useRef(null);

    useEffect(() => {
        let isCancelled = false;

        const initTerminal = async () => {
            if (!termContainerRef.current) return;

            // Clear container to prevent double-renders in Strict Mode
            termContainerRef.current.innerHTML = '';

            // Try Restty (modern, faster, but experimental/GPU-heavy)
            try {
                console.log("🖥️  Attempting Restty initialization...");
                const cols = Math.floor(termContainerRef.current.clientWidth / 9) || 80;
                const rows = Math.floor(termContainerRef.current.clientHeight / 18) || 24;

                const restty = new Restty({ root: termContainerRef.current });
                if (isCancelled) return;
                resttyRef.current = restty;

                try {
                    const theme = getBuiltinTheme("Aizen Dark");
                    if (theme) restty.applyTheme(theme);
                } catch {}

                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const params = new URLSearchParams({ cwd, cmd: cmd || 'bash', cols: String(cols), rows: String(rows) });

                let nextSessionId = existingSessionId || (Math.random().toString(36).substring(2, 12));
                if (existingSessionId) params.set('resume', existingSessionId);
                else params.set('id', nextSessionId);

                setSessionId(nextSessionId);
                const wsUrl = `${protocol}//${window.location.host}/pty?${params}`;

                restty.connectPty(wsUrl);
                if (isCancelled) {
                    restty.disconnectPty();
                    return;
                }
                setConnected(true);
                console.log("✅ Restty connected.");

                // Expose sendInput for mobile toolbar.
                // Restty manages its own internal WebSocket, so we inject input
                // via the server's HTTP endpoint to avoid kicking Restty's WS.
                const sendFn = (data) => {
                    fetch(`/api/pty/sessions/${nextSessionId}/input`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ data }),
                    }).catch(() => {});
                };
                if (onSendInputReady) onSendInputReady(sendFn);
                return;
            } catch (err) {
                console.warn("⚠️  Restty failed, falling back to xterm.js:", err);
                if (resttyRef.current) { resttyRef.current = null; }
            }

            // Fallback to xterm.js
            try {
                const term = new Terminal({
                    cursorBlink: true,
                    theme: { background: '#0d0d0d', foreground: '#cccccc' },
                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                    fontSize: 14
                });
                const fitAddon = new FitAddon();
                term.loadAddon(fitAddon);
                term.open(termContainerRef.current);
                fitAddon.fit();

                if (isCancelled) {
                    term.dispose();
                    return;
                }
                terminalInstanceRef.current = term;

                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const params = new URLSearchParams({
                    cwd, cmd: cmd || 'bash',
                    cols: String(term.cols), rows: String(term.rows)
                });

                let nextSessionId = existingSessionId || (Math.random().toString(36).substring(2, 12));
                if (existingSessionId) params.set('resume', existingSessionId);
                else params.set('id', nextSessionId);
                setSessionId(nextSessionId);

                const ws = new WebSocket(`${protocol}//${window.location.host}/pty?${params}`);
                wsRef.current = ws;

                term.onData(data => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'input', data }));
                    }
                });

                ws.onmessage = (ev) => {
                    try {
                        const msg = JSON.parse(ev.data);
                        if (msg.type === 'exit') setExited(true);
                    } catch {
                        term.write(ev.data);
                    }
                };
                ws.onopen = () => setConnected(true);
                ws.onclose = () => setConnected(false);

                // Expose sendInput for mobile toolbar
                const sendFn = (data) => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'input', data }));
                    }
                };
                if (onSendInputReady) onSendInputReady(sendFn);

                // Handle window resize for xterm
                const handleResize = () => {
                    fitAddon.fit();
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
                    }
                };
                window.addEventListener('resize', handleResize);
                ws.addEventListener('close', () => window.removeEventListener('resize', handleResize));

            } catch (err) {
                console.error("❌ All terminal initializations failed:", err);
            }
        };

        // Defer briefly to ensure container mounts
        setTimeout(initTerminal, 100);

        return () => {
            isCancelled = true;
            if (onSendInputReady) onSendInputReady(null);
            if (resttyRef.current) {
                try { resttyRef.current.disconnectPty(); } catch (e) {}
                resttyRef.current = null;
            }
            if (terminalInstanceRef.current) {
                try { terminalInstanceRef.current.dispose(); } catch (e) {}
                terminalInstanceRef.current = null;
            }
            if (wsRef.current) {
                try { wsRef.current.close(); } catch (e) {}
                wsRef.current = null;
            }
        };
    }, [cwd, cmd, existingSessionId, setConnected, setExited, setSessionId]);

    return (
        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            {/* Notifications */}
            {notifications && notifications.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    {notifications.map(n => (
                        n && n.message ? (
                            <div key={n.id} style={{
                                background: 'var(--bg2)',
                                border: '1px solid var(--border)',
                                padding: '10px',
                                borderRadius: '5px'
                            }}>
                                <p>{n.message}</p>
                                <button onClick={() => dismissNotification(n.id)}>Dismiss</button>
                            </div>
                        ) : null
                    ))}
                </div>
            )}

            <div
                ref={termContainerRef}
                className="terminal-container"
                style={{
                    flex: 1,
                    overflow: 'hidden',
                    background: '#0d0d0d',
                    minHeight: 0,
                }}
            />
        </div>
    );
}
