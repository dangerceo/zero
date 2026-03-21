import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';

const RawTerminal = React.lazy(() => import('./RawTerminal'));

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

    // Terminal phase state
    const [sessionCwd, setSessionCwd] = useState(null);
    const [sessionCmd, setSessionCmd] = useState(null);
    const [connected, setConnected] = useState(false);
    const [exited, setExited] = useState(false);
    const [sessionSeen, setSessionSeen] = useState(false);

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
    }, []);

    const disconnect = useCallback(() => {
        setPhase('browse');
        setConnected(false);
        setExited(false);
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
                        <button className="back-btn" onClick={() => navigate('/')} title="Back">←</button>
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

            {/* Lazy-loaded Terminal mounts here */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Suspense fallback={<div style={{ padding: '20px', color: 'var(--fg3)', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Terminal Modules...</div>}>
                    <RawTerminal
                        cwd={sessionCwd}
                        cmd={sessionCmd}
                        existingSessionId={sessionId}
                        setConnected={setConnected}
                        setExited={setExited}
                        setSessionId={setSessionId}
                        disconnect={disconnect}
                    />
                </Suspense>
            </div>
        </div>
    );
}
