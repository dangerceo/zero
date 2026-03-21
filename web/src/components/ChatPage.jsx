import React, { useState, useEffect, useRef, useCallback } from 'react';

function ChatPage({ embedded = false, initialAgentId = null }) {
    // Phase: 'browse' (pick dir) or 'chat' (connected)
    const [phase, setPhase] = useState('browse');
    const [selectedCwd, setSelectedCwd] = useState(null);

    // Browser state
    const [browsePath, setBrowsePath] = useState(null);
    const [browseItems, setBrowseItems] = useState([]);
    const [browseParent, setBrowseParent] = useState(null);
    const [browseLoading, setBrowseLoading] = useState(true);

    // Chat state
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [connected, setConnected] = useState(false);
    const [sessionStatus, setSessionStatus] = useState(null); // 'warm' | 'running' | null
    const [sessionId, setSessionId] = useState(null);
    const [sessionCwd, setSessionCwd] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [showSidebar, setShowSidebar] = useState(false);
    const ws = useRef(null);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    // ── Folder Browser ────────────────────────────────────────────────

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

    useEffect(() => {
        browse(); // Load home directory on mount
    }, [browse]);

    // ── Sessions ──────────────────────────────────────────────────────

    const fetchSessions = useCallback(() => {
        fetch('/api/chat/sessions')
            .then(r => r.json())
            .then(setSessions)
            .catch(() => {});
    }, []);

    useEffect(() => {
        fetchSessions();
        const interval = setInterval(fetchSessions, 5000);
        return () => clearInterval(interval);
    }, [fetchSessions]);

    // ── Initial Agent History ─────────────────────────────────────────

    useEffect(() => {
        if (!initialAgentId) return;
        setPhase('chat');
        setConnected(false); // It's just a historical log view
        
        // Fetch agent details to get threads and path
        fetch('/api/agents/' + initialAgentId)
            .then(res => res.json())
            .then(agent => {
                if (agent.workingDir || agent.path) {
                    setSessionCwd(agent.workingDir || agent.path);
                }
                if (agent.threads) {
                    const mapped = agent.threads.map(t => ({
                        role: t.role === 'agent' ? 'gemini' : t.role,
                        text: t.content
                    }));
                    setMessages(mapped);
                }
            })
            .catch(e => console.error("Failed to load agent history:", e));
    }, [initialAgentId]);

    // ── WebSocket ─────────────────────────────────────────────────────

    const connect = useCallback((cwd, resumeId = null) => {
        if (ws.current) ws.current.close();

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let url = protocol + '//' + window.location.host + '/chat';
        const params = new URLSearchParams();
        if (resumeId) params.set('resume', resumeId);
        if (cwd) params.set('cwd', cwd);
        const qs = params.toString();
        if (qs) url += '?' + qs;

        const socket = new WebSocket(url);
        ws.current = socket;

        socket.onopen = () => {
            setConnected(true);
            setPhase('chat');
        };

        socket.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);

                if (msg.type === 'session') {
                    setSessionId(msg.id);
                    setSessionCwd(msg.cwd || cwd);
                    setSessionStatus(msg.status || 'running');
                    if (msg.status === 'warm') {
                        setMessages(prev => [...prev, { role: 'meta', text: '● Warmed up in ' + (msg.cwd || cwd).split('/').pop() + ' — send a message to start' }]);
                    } else if (msg.resumed) {
                        setMessages(prev => [...prev, { role: 'meta', text: '● Resumed session ' + msg.id.slice(0, 8) }]);
                    } else {
                        setMessages(prev => [...prev, { role: 'meta', text: '● Connected — ' + (msg.cwd || cwd).split('/').pop() }]);
                    }
                    fetchSessions();
                }

                if (msg.type === 'status') {
                    setSessionStatus(msg.status);
                    if (msg.status === 'running') {
                        setMessages(prev => [...prev, { role: 'meta', text: '● Gemini started' }]);
                    }
                }

                if (msg.type === 'history') {
                    setMessages(msg.messages || []);
                }

                if (msg.type === 'output') {
                    setMessages(prev => {
                        const last = prev[prev.length - 1];
                        if (last?.streaming) {
                            return [...prev.slice(0, -1), { ...last, text: last.text + msg.text }];
                        }
                        return [...prev, { role: 'gemini', text: msg.text, streaming: true }];
                    });
                }

                if (msg.type === 'tool') {
                    setMessages(prev => {
                        const updated = prev.map(m => {
                            if (m.streaming) return { ...m, streaming: false };
                            return m;
                        });
                        updated.push({ ...msg.tool, role: 'tool' });
                        return updated;
                    });
                }

                if (msg.type === 'tool_update') {
                    setMessages(prev => {
                        return prev.map(m => {
                            if (m.role === 'tool' && m.id === msg.id) {
                                return { ...m, status: msg.status };
                            }
                            return m;
                        });
                    });
                }

                if (msg.type === 'meta') {
                    setMessages(prev => {
                        const updated = prev.map(m => m.streaming ? { ...m, streaming: false } : m);
                        const trimmed = msg.text.trim();
                        if (trimmed) updated.push({ role: 'meta', text: trimmed });
                        return updated;
                    });
                }

                if (msg.type === 'error') {
                    setMessages(prev => {
                        const updated = prev.map(m => m.streaming ? { ...m, streaming: false } : m);
                        updated.push({ role: 'error', text: msg.text });
                        return updated;
                    });
                }

                if (msg.type === 'closed') {
                    setConnected(false);
                    setMessages(prev => {
                        const updated = prev.map(m => m.streaming ? { ...m, streaming: false } : m);
                        updated.push({ role: 'meta', text: '● Session ended (exit ' + msg.code + ')' });
                        return updated;
                    });
                    fetchSessions();
                }
            } catch {
                setMessages(prev => [...prev, { role: 'gemini', text: e.data }]);
            }
        };

        socket.onclose = () => setConnected(false);
        socket.onerror = () => {};
    }, [fetchSessions]);

    // Cleanup
    useEffect(() => {
        return () => ws.current?.close();
    }, []);

    // Auto-scroll
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = () => {
        if (!input.trim() || !connected) return;
        setMessages(prev => {
            const updated = prev.map(m => m.streaming ? { ...m, streaming: false } : m);
            updated.push({ role: 'user', text: input });
            return updated;
        });
        ws.current?.send(JSON.stringify({ type: 'input', text: input }));
        setInput('');
        inputRef.current?.focus();
    };

    const interrupt = () => {
        ws.current?.send(JSON.stringify({ type: 'interrupt' }));
    };

    const resumeSession = (id) => {
        setMessages([]);
        setSessionId(null);
        connect(null, id);
        setConnected(false);
        setSessionStatus(null);
        setShowSidebar(false);
    };

    const backToBrowse = () => {
        ws.current?.close();
        setPhase('browse');
        setMessages([]);
        setSessionId(null);
        setSessionStatus(null);
        setConnected(false);
    };

    const keyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    // ── Render: Browse Phase ──────────────────────────────────────────

    if (phase === 'browse') {
        const dirs = browseItems.filter(i => i.isDir);
        const files = browseItems.filter(i => !i.isDir);
        const pathParts = browsePath ? browsePath.split('/').filter(Boolean) : [];

        return (
            <div className={embedded ? 'chat-page chat-embedded' : 'chat-page'}>
                <header className='chat-header'>
                    <div className='chat-header-left'>
                        <span className='chat-title'>Open in Gemini CLI</span>
                    </div>
                    <div className='chat-header-actions'>
                        <button className='mini-btn' onClick={() => setShowSidebar(!showSidebar)} title='Sessions'>
                            ☰ {sessions.filter(s => s.alive).length || ''}
                        </button>
                    </div>
                </header>

                <div className='chat-body'>
                    {showSidebar && (
                        <aside className='chat-sidebar'>
                            <h3 className='section-label'>Active Sessions</h3>
                            {sessions.filter(s => s.alive).map(s => (
                                <button
                                    key={s.id}
                                    className='chat-session-item'
                                    onClick={() => resumeSession(s.id)}
                                >
                                    <span className={'chat-conn-dot small on'} />
                                    <span className='chat-session-label'>
                                        {s.cwd ? s.cwd.split('/').pop() : s.id.slice(0, 8)}
                                    </span>
                                    {s.connected && <span className='chat-session-badge'>live</span>}
                                </button>
                            ))}
                            {sessions.filter(s => s.alive).length === 0 && (
                                <div className='chat-empty-sessions'>No active sessions</div>
                            )}
                        </aside>
                    )}

                    <div className='chat-messages' style={{ padding: '16px 20px' }}>
                        {/* Breadcrumb */}
                        <div className='chat-browse-breadcrumb'>
                            <button className='chat-browse-crumb' onClick={() => browse('/')}>~</button>
                            {pathParts.map((part, i) => (
                                <React.Fragment key={i}>
                                    <span className='chat-browse-sep'>/</span>
                                    <button
                                        className='chat-browse-crumb'
                                        onClick={() => browse('/' + pathParts.slice(0, i + 1).join('/'))}
                                    >
                                        {part}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>

                        {/* Select this directory button */}
                        <button
                            className='chat-browse-select'
                            onClick={() => connect(browsePath)}
                        >
                            Open Gemini here → {browsePath ? browsePath.split('/').pop() || '/' : '~'}
                        </button>

                        {browseLoading ? (
                            <div className='chat-empty-sessions'>Loading...</div>
                        ) : (
                            <div className='chat-browse-list'>
                                {browseParent && (
                                    <button className='chat-browse-item dir' onClick={() => browse(browseParent)}>
                                        <span className='chat-browse-icon'>↑</span>
                                        <span>..</span>
                                    </button>
                                )}
                                {dirs.map(item => (
                                    <button
                                        key={item.name}
                                        className='chat-browse-item dir'
                                        onClick={() => browse(browsePath + '/' + item.name)}
                                    >
                                        <span className='chat-browse-icon'>📁</span>
                                        <span>{item.name}</span>
                                    </button>
                                ))}
                                {files.slice(0, 20).map(item => (
                                    <div key={item.name} className='chat-browse-item file'>
                                        <span className='chat-browse-icon'>·</span>
                                        <span>{item.name}</span>
                                    </div>
                                ))}
                                {files.length > 20 && (
                                    <div className='chat-browse-item file' style={{ color: 'var(--fg3)' }}>
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

    // ── Render: Chat Phase ────────────────────────────────────────────

    return (
        <div className={embedded ? 'chat-page chat-embedded' : 'chat-page'}>
            <header className='chat-header'>
                <div className='chat-header-left'>
                    {initialAgentId ? (
                        <span className='chat-title'>History — {sessionCwd?.split('/').pop() || initialAgentId.slice(0, 8)}</span>
                    ) : (
                        <button className='back-btn' onClick={backToBrowse} title='Close Session'>
                            ✕
                        </button>
                    )}
                    {sessionStatus === 'running' && <span className='chat-conn-dot on ml-2' />}
                    {sessionStatus === 'warm' && <span className='chat-conn-dot warm ml-2' />}
                    {!initialAgentId && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--fg2)', fontFamily: 'var(--mono)' }}>{sessionCwd}</span>}
                </div>
                {!initialAgentId && (
                    <div className='chat-header-actions'>
                        {sessionStatus === 'running' && (
                            <button className='danger-btn' onClick={interrupt} style={{ minHeight: 'auto', padding: '4px 8px' }}>Stop</button>
                        )}
                        <button className='mini-btn' onClick={() => setShowSidebar(!showSidebar)} title='Sessions'>
                            ☰ {sessions.filter(s => s.alive).length || ''}
                        </button>
                    </div>
                )}
            </header>

            <div className='chat-body'>
                {!initialAgentId && showSidebar && (
                    <aside className='chat-sidebar'>
                        <h3 className='section-label'>Sessions</h3>
                        <button className='chat-session-item new' onClick={backToBrowse}>+ New Session</button>
                        {sessions.map(s => (
                            <button
                                key={s.id}
                                className={'chat-session-item ' + (s.id === sessionId ? 'active' : '') + (s.alive ? '' : ' dead')}
                                onClick={() => s.alive && resumeSession(s.id)}
                            >
                                <span className={'chat-conn-dot small ' + (s.alive ? 'on' : '')} />
                                <span className='chat-session-label'>
                                    {s.cwd ? s.cwd.split('/').pop() : s.id.slice(0, 8)}
                                </span>
                                {s.connected && <span className='chat-session-badge'>live</span>}
                            </button>
                        ))}
                        {sessions.length === 0 && <div className='chat-empty-sessions'>No active sessions</div>}
                    </aside>
                )}

                <div className='chat-messages'>
                    {messages.length === 0 && (
                        <div className='chat-welcome'>
                            <h2>Gemini CLI</h2>
                            <p>Connecting to {sessionCwd || '~'}...</p>
                        </div>
                    )}
                    {messages.map((m, i) => (
                        <div key={i} className={'chat-bubble role-' + m.role}>
                            {m.role === 'meta' || m.role === 'error' ? (
                                <span>{m.text}</span>
                            ) : m.role === 'tool' ? (
                                <details className='chat-tool-details'>
                                    <summary>
                                        <span className="tool-icon">🔧</span> {m.title}
                                        <span className={`tool-status status-${m.status}`}>{m.status}</span>
                                    </summary>
                                    <div className='chat-tool-content'>
                                        Tool ID: {m.id}
                                    </div>
                                </details>
                            ) : (
                                <>
                                    {m.role === 'user' && <div className='chat-bubble-label'>You</div>}
                                    {m.role === 'gemini' && <div className='chat-bubble-label'>Gemini</div>}
                                    <div className='chat-bubble-text'>
                                        {m.text}{m.streaming ? '▋' : ''}
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>
            </div>
        </div>
    );
}

export default ChatPage;
