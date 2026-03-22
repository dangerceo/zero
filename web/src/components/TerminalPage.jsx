import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';

import ErrorBoundary from './ErrorBoundary';

const RawTerminal = React.lazy(() => import('./RawTerminal'));

// ── Mobile Key definitions ──────────────────────────────────────────────────

const CTRL_KEYS = [
    { label: 'C', seq: '\x03', title: 'Ctrl+C (interrupt)' },
    { label: 'D', seq: '\x04', title: 'Ctrl+D (EOF/logout)' },
    { label: 'Z', seq: '\x1a', title: 'Ctrl+Z (suspend)' },
    { label: 'L', seq: '\x0c', title: 'Ctrl+L (clear screen)' },
    { label: 'A', seq: '\x01', title: 'Ctrl+A (start of line)' },
    { label: 'E', seq: '\x05', title: 'Ctrl+E (end of line)' },
    { label: 'U', seq: '\x15', title: 'Ctrl+U (clear line)' },
    { label: 'R', seq: '\x12', title: 'Ctrl+R (history search)' },
];

const ARROW_KEYS = [
    { label: '↑', seq: '\x1b[A', title: 'Arrow Up' },
    { label: '↓', seq: '\x1b[B', title: 'Arrow Down' },
    { label: '←', seq: '\x1b[D', title: 'Arrow Left' },
    { label: '→', seq: '\x1b[C', title: 'Arrow Right' },
];

const SPECIAL_KEYS = [
    { label: 'Tab', seq: '\t', title: 'Tab (autocomplete)' },
    { label: 'Esc', seq: '\x1b', title: 'Escape' },
    { label: 'Bksp', seq: '\x7f', title: 'Backspace' },
    { label: '↵', seq: '\r', title: 'Enter' },
];

/**
 * TerminalPage — shell for the file picker and lazily-loaded PTY terminal
 */
export default function TerminalPage() {
    const navigate = useNavigate();

    // Browse phase state
    const [phase, setPhase] = useState('browse');
    const [browsePath, setBrowsePath] = useState(null);
    const [browseItems, setBrowseItems] = useState([]);
    const [browseParent, setBrowseParent] = useState(null);
    const [browseLoading, setBrowseLoading] = useState(true);
    const [modules, setModules] = useState([]);
    const [selectedModule, setSelectedModule] = useState('');

    // Active Sessions state
    const [sessions, setSessions] = useState([]);

    // Terminal phase state
    const [sessionId, setSessionId] = useState(null);
    const [sessionCwd, setSessionCwd] = useState(null);
    const [sessionCmd, setSessionCmd] = useState(null);
    const [connected, setConnected] = useState(false);
    const [exited, setExited] = useState(false);
    const [sessionSeen, setSessionSeen] = useState(false);

    // Mobile toolbar state
    const [showMobileBar, setShowMobileBar] = useState(false);
    const [ctrlMode, setCtrlMode] = useState(false);          // toggle ctrl key row
    const [typeText, setTypeText] = useState('');
    const sendInputRef = useRef(null);                         // populated by RawTerminal

    useEffect(() => {
        // Auto-detect mobile and show bar
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
            || window.matchMedia('(pointer: coarse)').matches;
        if (isMobile) setShowMobileBar(true);
    }, []);

    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.json())
            .then(data => {
                setModules(data.modules || []);
                const enabledModule = (data.modules || []).find(m => m.enabled);
                if (enabledModule) {
                    setSelectedModule(enabledModule.id);
                }
            });
    }, []);

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
            fetchSessions();
        }, 2000);
        return () => clearInterval(interval);
    }, [fetchSessions]);

    // ── Terminal Lifecycle ───────────────────────────────────────────────

    const openTerminal = useCallback((cwd, cmd, existingSessionId = null) => {
        setSessionCwd(cwd);
        setSessionCmd(cmd);
        setSessionId(existingSessionId);
        setPhase('terminal');
        setExited(false);
        setConnected(false);
        sendInputRef.current = null;
    }, []);

    const disconnect = useCallback(() => {
        setPhase('browse');
        setConnected(false);
        setExited(false);
        sendInputRef.current = null;
    }, []);

    // Track active session exit
    useEffect(() => {
        if (phase === 'terminal' && sessionId) {
            const isAlive = sessions.some(s => s.id === sessionId);
            if (!sessionSeen && isAlive) {
                setSessionSeen(true);
            } else if (sessionSeen && !isAlive) {
                disconnect();
            }
        } else {
            setSessionSeen(false);
        }
    }, [sessions, phase, sessionId, sessionSeen, disconnect]);

    const killSession = useCallback(async (e, id) => {
        e.stopPropagation();
        await fetch(`/api/pty/sessions/${id}`, { method: 'DELETE' });
        fetchSessions();
    }, [fetchSessions]);

    // ── Mobile key send ───────────────────────────────────────────────

    const sendKey = useCallback((seq) => {
        if (sendInputRef.current) {
            sendInputRef.current(seq);
        }
    }, []);

    const sendTyped = useCallback(() => {
        if (typeText && sendInputRef.current) {
            sendInputRef.current(typeText + '\r');
            setTypeText('');
        }
    }, [typeText]);

    // ── Render: Browse Phase ──────────────────────────────────────────

    if (phase === 'browse') {
        const dirs = browseItems.filter(i => i.isDir);
        const files = browseItems.filter(i => !i.isDir);
        const pathParts = browsePath ? browsePath.split('/').filter(Boolean) : [];
        const selectedModuleCmd = modules.find(m => m.id === selectedModule)?.command;

        return (
            <div className="chat-page">
                <header className="chat-header">
                    <div className="chat-header-left">
                        <button className="back-btn" onClick={() => navigate('/')} title="Back">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        </button>
                        <span className="chat-title">⌨ Terminal</span>
                    </div>
                    <div className="chat-header-actions">
                        <select
                            value={selectedModule}
                            onChange={e => setSelectedModule(e.target.value)}
                            style={{
                                background: 'var(--bg2)',
                                color: 'var(--fg)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius)',
                                padding: '4px 8px',
                                marginRight: '8px'
                            }}
                        >
                            {modules.map(m => (
                                <option key={m.id} value={m.id} disabled={!m.enabled}>{m.name}</option>
                            ))}
                        </select>
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
                            onClick={() => openTerminal(browsePath || '~', selectedModuleCmd, null)}
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
                    {/* Mobile keyboard toggle */}
                    <button
                        className={`term-kb-toggle${showMobileBar ? ' active' : ''}`}
                        onClick={() => setShowMobileBar(v => !v)}
                        title="Toggle mobile keyboard"
                        aria-label="Toggle keyboard toolbar"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="6" width="20" height="13" rx="2"/>
                            <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>
                        </svg>
                    </button>
                    <button className="danger-btn" onClick={() => {
                        if (sessionId) killSession({ stopPropagation: () => {} }, sessionId);
                        disconnect();
                    }} style={{ minHeight: 'auto', padding: '4px 8px', marginRight: '8px' }}>
                        Kill
                    </button>
                    <button className="primary-btn" onClick={disconnect}
                        style={{ minHeight: 'auto', padding: '4px 8px' }}>
                        Detach
                    </button>
                </div>
            </header>

            {/* Lazy-loaded Terminal mounts here */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                <Suspense fallback={<div style={{ padding: '20px', color: 'var(--fg3)', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Terminal Modules...</div>}>
                    <ErrorBoundary fallback={
                        <div style={{ padding: '20px', color: 'var(--fg-danger)', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            <h3 style={{ margin: '0 0 10px' }}>Terminal Component Failed to Load</h3>
                            <p style={{ margin: '0 0 20px', color: 'var(--fg3)', fontSize: '14px' }}>
                                This might be due to a browser or hardware incompatibility.
                            </p>
                            <button className="primary-btn" onClick={disconnect}>
                                Back to File Browser
                            </button>
                        </div>
                    }>
                        <RawTerminal
                            cwd={sessionCwd}
                            cmd={sessionCmd}
                            existingSessionId={sessionId}
                            setConnected={setConnected}
                            setExited={setExited}
                            setSessionId={setSessionId}
                            disconnect={disconnect}
                            onSendInputReady={(fn) => { sendInputRef.current = fn; }}
                        />
                    </ErrorBoundary>
                </Suspense>
            </div>

            {/* ── Mobile Keyboard Toolbar ─────────────────────────────────── */}
            {showMobileBar && (
                <div className="term-mobile-bar">

                    {/* Row 1: Arrow keys */}
                    <div className="term-key-row">
                        <span className="term-key-label">ARROWS</span>
                        {ARROW_KEYS.map(k => (
                            <button
                                key={k.label}
                                className="term-key-btn arrow"
                                onPointerDown={(e) => { e.preventDefault(); sendKey(k.seq); }}
                                title={k.title}
                            >
                                {k.label}
                            </button>
                        ))}
                        <div className="term-key-spacer" />
                        {SPECIAL_KEYS.map(k => (
                            <button
                                key={k.label}
                                className="term-key-btn special"
                                onPointerDown={(e) => { e.preventDefault(); sendKey(k.seq); }}
                                title={k.title}
                            >
                                {k.label}
                            </button>
                        ))}
                    </div>

                    {/* Ctrl row toggle */}
                    <div className="term-key-row">
                        <button
                            className={`term-key-btn ctrl-toggle${ctrlMode ? ' active' : ''}`}
                            onPointerDown={(e) => { e.preventDefault(); setCtrlMode(v => !v); }}
                            title="Show Ctrl key shortcuts"
                        >
                            ^CTRL
                        </button>
                        {ctrlMode && CTRL_KEYS.map(k => (
                            <button
                                key={k.label}
                                className="term-key-btn ctrl"
                                onPointerDown={(e) => { e.preventDefault(); sendKey(k.seq); }}
                                title={k.title}
                            >
                                ^{k.label}
                            </button>
                        ))}
                    </div>

                    {/* Row 3: Text send */}
                    <div className="term-key-row term-type-row">
                        <input
                            className="term-type-input"
                            type="text"
                            value={typeText}
                            onChange={e => setTypeText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendTyped(); } }}
                            placeholder="Type & send…"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                        />
                        <button
                            className="term-type-send"
                            onPointerDown={(e) => { e.preventDefault(); sendTyped(); }}
                            disabled={!typeText}
                        >
                            ↵ Send
                        </button>
                    </div>

                </div>
            )}
        </div>
    );
}
