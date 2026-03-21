import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * TerminalPage — raw PTY terminal using restty (WebGPU-powered)
 * Connects to ws://.../pty and streams real ANSI output from node-pty.
 */
export default function TerminalPage() {
    const navigate = useNavigate();

    // Browse phase state
    const [phase, setPhase] = useState('browse');
    const [browsePath, setBrowsePath] = useState(null);
    const [browseItems, setBrowseItems] = useState([]);
    const [browseParent, setBrowseParent] = useState(null);
    const [browseLoading, setBrowseLoading] = useState(true);

    // Active Sessions state
    const [sessions, setSessions] = useState([]);

    // Terminal phase state
    const [sessionId, setSessionId] = useState(null);

    // Terminal phase state
    const [sessionCwd, setSessionCwd] = useState(null);
    const [connected, setConnected] = useState(false);
    const [exited, setExited] = useState(false);

    const termContainerRef = useRef(null);
    const resttyRef = useRef(null);
    const wsRef = useRef(null);
    const resizeObserverRef = useRef(null);

    // ── Folder Browser ──────────────────────────────────────────────────

    const browse = useCallback((path) => {
        setBrowseLoading(true);
        const url = path ? '/api/files/browse?path=' + encodeURIComponent(path) : '/api/files/browse';
        fetch(url)
            .then(r => r.json())
            .then(data => {
                setBrowsePath(data.path);
                setBrowseItems(data.items || []);
                setBrowseParent(data.parent);
                setBrowseLoading(false);
            })
            .catch(() => setBrowseLoading(false));
    }, []);

    useEffect(() => { browse(); }, [browse]);

    // ── Active Sessions ──────────────────────────────────────────────────

    const fetchSessions = useCallback(() => {
        fetch('/api/pty/sessions')
            .then(r => r.json())
            .then(data => setSessions(data))
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(() => {
            if (phase === 'browse') fetchSessions();
        }, 5000);
        return () => clearInterval(interval);
    }, [phase, fetchSessions]);

    const killSession = useCallback(async (e, id) => {
        e.stopPropagation();
        await fetch(`/api/pty/sessions/${id}`, { method: 'DELETE' });
        fetchSessions();
    }, [fetchSessions]);

    // ── Terminal Lifecycle ───────────────────────────────────────────────

    const openTerminal = useCallback(async (cwd, cmd = 'gemini', existingSessionId = null) => {
        setSessionCwd(cwd);
        setSessionId(existingSessionId);
        setPhase('terminal');
        setExited(false);
        setConnected(false);

        // Defer until the terminal container is mounted
        await new Promise(r => setTimeout(r, 80));

        if (!termContainerRef.current) return;

        // Dynamically import restty (ESM, heavier — load only when needed)
        const { Restty } = await import('restty');

        const cols = Math.floor(termContainerRef.current.clientWidth / 8) || 220;
        const rows = Math.floor(termContainerRef.current.clientHeight / 17) || 50;

        try {
            const restty = new Restty({
                root: termContainerRef.current,
            });
            resttyRef.current = restty;

            // Optional: apply a builtin theme just in case default is invisible
            import('restty').then(({ getBuiltinTheme }) => {
                const theme = getBuiltinTheme("Aizen Dark");
                if (theme) restty.applyTheme(theme);
            }).catch(() => {});

            // Build WebSocket URL
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const params = new URLSearchParams({ cwd, cmd, cols: String(cols), rows: String(rows) });
            if (existingSessionId) params.set('resume', existingSessionId);
            
            const wsUrl = `${protocol}//${window.location.host}/pty?${params}`;

            // Restty manages its own WebSocket connection internally.
            restty.connectPty(wsUrl);
            setConnected(true);

        } catch (err) {
            console.error("Failed to initialize Restty:", err);
        }
    }, []);

    const disconnect = useCallback(() => {
        if (resttyRef.current) {
            try { resttyRef.current.disconnectPty(); } catch (e) {}
            resttyRef.current = null;
        }
        setPhase('browse');
        setConnected(false);
        setExited(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (resttyRef.current) {
                try { resttyRef.current.disconnectPty(); } catch (e) {}
            }
        };
    }, []);

    // ── Render: Browse Phase ──────────────────────────────────────────

    if (phase === 'browse') {
        const dirs = browseItems.filter(i => i.isDir);
        const files = browseItems.filter(i => !i.isDir);
        const pathParts = browsePath ? browsePath.split('/').filter(Boolean) : [];

        return (
            <div className="chat-page">
                <header className="chat-header">
                    <div className="chat-header-left">
                        <button className="back-btn" onClick={() => navigate('/')} title="Back">←</button>
                        <span className="chat-title">⌨ Terminal</span>
                    </div>
                </header>

                <div className="chat-body">
                    <div className="chat-messages" style={{ padding: '16px 20px' }}>
                        {/* Breadcrumb */}
                        <div className="chat-browse-breadcrumb">
                            <button className="chat-browse-crumb" onClick={() => browse('/')}>~</button>
                            {pathParts.map((part, i) => (
                                <React.Fragment key={i}>
                                    <span className="chat-browse-sep">/</span>
                                    <button
                                        className="chat-browse-crumb"
                                        onClick={() => browse('/' + pathParts.slice(0, i + 1).join('/'))}
                                    >
                                        {part}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>

                        <button
                            className="chat-browse-select"
                            onClick={() => openTerminal(browsePath || '~', 'gemini', null)}
                        >
                            Open Terminal here → {browsePath ? (browsePath.split('/').pop() || '/') : '~'}
                        </button>

                        {/* Active Sessions List */}
                        {sessions.length > 0 && (
                            <div className="chat-sessions mb-4 mt-2">
                                <h3 className="section-title">Active Sessions</h3>
                                <div className="chat-sessions-list">
                                    {sessions.map(sess => (
                                        <div 
                                            key={sess.id}
                                            className="chat-session-item"
                                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                        >
                                            <div 
                                                className="chat-session-info" 
                                                style={{flex: 1, cursor: 'pointer', padding: '4px 0'}}
                                                onClick={() => openTerminal(sess.cwd, sess.cmd, sess.id)}
                                            >
                                                <span className="chat-conn-dot on" style={{marginRight: 8}}></span>
                                                <span style={{color: 'var(--fg)', fontSize: '13px'}}>{sess.cwd}</span>
                                            </div>
                                            <button 
                                                className="danger-btn" 
                                                style={{ padding: '4px 8px', minHeight: 'auto', fontSize: '11px', flexShrink: 0 }}
                                                onClick={e => killSession(e, sess.id)}
                                            >
                                                ✕ Kill
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {browseLoading ? (
                            <div className="chat-empty-sessions">Loading...</div>
                        ) : (
                            <div className="chat-browse-list">
                                {browseParent && (
                                    <button className="chat-browse-item dir" onClick={() => browse(browseParent)}>
                                        <span className="chat-browse-icon">↑</span>
                                        <span>..</span>
                                    </button>
                                )}
                                {dirs.map(item => (
                                    <button
                                        key={item.name}
                                        className="chat-browse-item dir"
                                        onClick={() => browse(browsePath + '/' + item.name)}
                                    >
                                        <span className="chat-browse-icon">📁</span>
                                        <span>{item.name}</span>
                                    </button>
                                ))}
                                {files.slice(0, 20).map(item => (
                                    <div key={item.name} className="chat-browse-item file">
                                        <span className="chat-browse-icon">·</span>
                                        <span>{item.name}</span>
                                    </div>
                                ))}
                                {files.length > 20 && (
                                    <div className="chat-browse-item file" style={{ color: 'var(--fg3)' }}>
                                        +{files.length - 20} more files
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Render: Terminal Phase ────────────────────────────────────────

    return (
        <div className="chat-page terminal-page">
            <header className="chat-header">
                <div className="chat-header-left">
                    <button className="back-btn" onClick={disconnect} title="Disconnect">✕</button>
                    {connected
                        ? <span className="chat-conn-dot on ml-2" />
                        : <span className="chat-conn-dot ml-2" />
                    }
                    <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--fg2)', fontFamily: 'var(--mono)' }}>
                        {sessionCwd}
                    </span>
                </div>
                <div className="chat-header-actions">
                    {exited && (
                        <span style={{ fontSize: '12px', color: 'var(--fg3)' }}>Process exited</span>
                    )}
                    <button className="danger-btn" onClick={() => {
                        if (sessionId) killSession({ stopPropagation: () => {} }, sessionId);
                        disconnect();
                    }} style={{ minHeight: 'auto', padding: '4px 8px', marginRight: '8px' }}>
                        Kill Process
                    </button>
                    <button className="primary-btn" onClick={disconnect}
                        style={{ minHeight: 'auto', padding: '4px 8px' }}>
                        Detach
                    </button>
                </div>
            </header>

            {/* restty mounts here — fills remaining space */}
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
