import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import KitchenDisplay from './KitchenDisplay';
import TeslaDashboard from './TeslaDashboard';
import NotificationModule from './NotificationModule';
import AgentDetail from './AgentDetail';
import MemoryDetail from './MemoryDetail';
import ChatPage from './ChatPage';

function Home({ agents, agyProjects, previewPorts, connected, onSelectAgent, onSettingsClick, isExpanded, toggleExpand }) {
    const [goal, setGoal] = useState('');
    const [creating, setCreating] = useState(false);
    const [memories, setMemories] = useState([]);
    const [tab, setTab] = useState('inbox');
    const [selectedAgentId, setSelectedAgentId] = useState(null);
    const [selectedMemoryId, setSelectedMemoryId] = useState(null);
    const [selectedPreviewPort, setSelectedPreviewPort] = useState(null);
    const [showArchived, setShowArchived] = useState(false);
    const [targetProjectId, setTargetProjectId] = useState('new'); // 'new' or id
    const [globalAnswers, setGlobalAnswers] = useState({});
    const navigate = useNavigate();

    React.useEffect(() => {
        fetch('/api/pebble/zero/history')
            .then(res => res.json())
            .then(data => setMemories(data.sessions || []))
            .catch(e => console.error(e));
    }, []);

    const createAgent = async () => {
        if (!goal.trim()) return;
        setCreating(true);
        try {
            if (targetProjectId !== 'new') {
                // Add to existing project as a todo
                await fetch('/api/agents/' + targetProjectId + '/todo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ todo: goal })
                });
                setGoal('');
                if (isExpanded) setSelectedAgentId(targetProjectId);
                else onSelectAgent(targetProjectId);
            } else {
                // Create new project in playground
                const res = await fetch('/api/agents', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ goal, name: goal.slice(0, 50) })
                });
                const agent = await res.json();
                await fetch('/api/agents/' + agent.id + '/start', { method: 'POST' });
                setGoal('');
                if (isExpanded) {
                    setSelectedMemoryId(null);
                    setSelectedAgentId(agent.id);
                } else {
                    onSelectAgent(agent.id);
                }
            }
        } catch (e) { console.error(e); }
        setCreating(false);
    };

    const submitGlobalAnswer = async (agentId, qid) => {
        const text = globalAnswers[qid];
        if (!text?.trim()) return;
        try {
            await fetch('/api/agents/' + agentId + '/questions/' + qid + '/answer', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ answer: text }) 
            });
            await fetch('/api/agents/' + agentId + '/resume', { method: 'POST' });
            setGlobalAnswers(prev => {
                const next = { ...prev };
                delete next[qid];
                return next;
            });
        } catch (e) { console.error(e); }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            createAgent();
        }
    };

    const statusIcon = (status, actuallyRunning) => {
        if (status === 'running' && !actuallyRunning) return <span style={{ color: 'var(--error)' }}>⚠️</span>;
        switch (status) {
            case 'running': return <svg width="10" height="10" viewBox="0 0 10 10" style={{ fill: 'currentColor' }}><circle cx="5" cy="5" r="4" /></svg>;
            case 'completed': return <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 5l3 3 7-7" /></svg>;
            case 'failed': return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>;
            case 'waiting': return <span>?</span>;
            case 'paused': return <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zm8 0h4v16h-4z" /></svg>;
            default: return <svg width="10" height="10" viewBox="0 0 10 10" style={{ fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }}><circle cx="5" cy="5" r="4.2" /></svg>;
        }
    };

    const timeAgo = (ts) => {
        if (!ts) return '';
        const diff = Date.now() - new Date(ts).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'now';
        if (mins < 60) return mins + 'm';
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return hrs + 'h';
        return Math.floor(hrs / 24) + 'd';
    };

    const allItems = [...agents, ...(agyProjects || [])];
    const visibleItems = allItems.filter(a => showArchived ? a.archived : !a.archived);
    const active = visibleItems.filter(a => a.status === 'running' || a.status === 'planning' || a.status === 'waiting');
    const allTickets = agents.reduce((acc, a) => acc.concat(a.tickets || []), []);
    const deadWorkerCount = allTickets.filter(t => t.status === 'failed').length;

    const unansweredQuestions = [];
    visibleItems.forEach(agent => {
        if (agent.pendingQuestions) {
            agent.pendingQuestions.forEach(q => {
                if (!q.answer) {
                    unansweredQuestions.push({ agentId: agent.id, agentName: agent.name, question: q });
                }
            });
        }
    });

    const groupProjects = () => {
        const groups = {};
        const standalone = [];
        const combined = visibleItems.filter(a => !['running', 'planning', 'waiting'].includes(a.status));
        combined.forEach(p => {
            const path = p.workingDir || p.path;
            if (path) {
                const projectName = path.split('/').pop() || 'Project';
                if (!groups[projectName]) groups[projectName] = { name: projectName, items: [] };
                groups[projectName].items.push(p);
            } else standalone.push(p);
        });
        return { groups: Object.values(groups), standalone };
    };

    const { groups, standalone } = groupProjects();
    const selectedAgent = allItems.find(a => a.id === selectedAgentId);

    const selectItem = (id, type = 'agent') => {
        if (isExpanded) {
            setTab('inbox');
            if (type === 'agent') {
                setSelectedMemoryId(null);
                setSelectedPreviewPort(null);
                setSelectedAgentId(id);
            } else if (type === 'preview') {
                setSelectedAgentId(null);
                setSelectedMemoryId(null);
                setSelectedPreviewPort(id);
            } else {
                setSelectedAgentId(null);
                setSelectedPreviewPort(null);
                setSelectedMemoryId(id);
            }
        } else {
            if (type === 'agent') onSelectAgent(id);
            else if (type === 'preview') window.open('/host/' + id, '_blank');
            else navigate('/memory/' + encodeURIComponent(id));
        }
    };

    const renderAgentList = (isSidebar = false) => (
        <div className={isSidebar ? 'sidebar-list' : 'agent-list'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px' }}>
                <h2 className='section-label'>{showArchived ? 'ARCHIVED' : 'INBOX'}</h2>
                <button className='mini-btn' onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'View Active' : 'View Archived'}</button>
            </div>
            
            {!showArchived && unansweredQuestions.length > 0 && (
                <div className='agent-section' style={{ marginBottom: '24px' }}>
                    <h2 className='section-label' style={{ color: 'var(--warning)' }}>⚠️ ACTION NEEDED</h2>
                    {unansweredQuestions.map(q => (
                        <div key={q.question.id} className='question-card' style={{ background: 'var(--bg2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--warning)', marginBottom: '8px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--fg3)', marginBottom: '4px', textTransform: 'uppercase' }}>{q.agentName}</div>
                            <p style={{ margin: '0 0 8px 0', fontSize: '13px' }}>{q.question.question}</p>
                            <textarea 
                                placeholder='Your answer...' 
                                value={globalAnswers[q.question.id] || ''} 
                                onChange={e => setGlobalAnswers(prev => ({ ...prev, [q.question.id]: e.target.value }))} 
                                rows={2} 
                                style={{ width: '100%', boxSizing: 'border-box', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--fg)', padding: '8px', fontSize: '13px', marginBottom: '8px' }}
                            />
                            <button className='primary-btn' onClick={() => submitGlobalAnswer(q.agentId, q.question.id)} style={{ width: '100%' }}>Submit & Resume</button>
                        </div>
                    ))}
                </div>
            )}

            {active.length > 0 && (
                <div className='agent-section'>
                    {active.map(a => (
                        <button key={a.id} className={'agent-row ' + (isSidebar ? 'sidebar-item ' : '') + (selectedAgentId === a.id ? 'active' : '')} onClick={() => selectItem(a.id, 'agent')}>
                            <span className={'agent-status s-' + a.status}>{statusIcon(a.status, a.actuallyRunning)}</span>
                            <span className='agent-name'>{a.name}</span>
                            {a.updatedAt && <span className='agent-time'>{timeAgo(a.updatedAt)}</span>}
                        </button>
                    ))}
                </div>
            )}
            {groups.map(g => (
                <div key={g.name} className='agent-section'>
                    {!isSidebar && <h2 className='section-label'><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}><path d="M21 8V21H3V8M1 3H23V8H1V3ZM10 12H14" /></svg>{g.name}</h2>}
                    <div className={isSidebar ? '' : 'project-group-card'}>
                        {isSidebar && <div className='group-header'><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle', marginRight: '6px' }}><path d="M21 8V21H3V8M1 3H23V8H1V3ZM10 12H14" /></svg>{g.name}</div>}
                        {g.items.map(item => (
                            <button key={item.id} className={'agent-row grouped ' + (isSidebar ? 'sidebar-item ' : '') + (selectedAgentId === item.id ? 'active' : '')} onClick={() => selectItem(item.id, 'agent')}>
                                <span className={'agent-status s-' + item.status}>{statusIcon(item.status, item.actuallyRunning)}</span>
                                <span className='agent-name'>{item.name}</span>
                                {item.updatedAt && <span className='agent-time'>{timeAgo(item.updatedAt)}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
            {standalone.length > 0 && (
                <div className='agent-section'>
                    <h2 className='section-label'>Standalone</h2>
                    {standalone.map(a => (
                        <button key={a.id} className={'agent-row ' + (isSidebar ? 'sidebar-item ' : '') + (selectedAgentId === a.id ? 'active' : '')} onClick={() => selectItem(a.id, 'agent')}>
                            <span className={'agent-status s-' + a.status}>{statusIcon(a.status, a.actuallyRunning)}</span>
                            <span className='agent-name'>{a.name}</span>
                            {a.updatedAt && <span className='agent-time'>{timeAgo(a.updatedAt)}</span>}
                        </button>
                    ))}
                </div>
            )}
            {memories.length > 0 && !showArchived && (
                <div className='agent-section'>
                    <h2 className='section-label'>Zero Memories</h2>
                    {memories.map(m => (
                        <button key={m.id} className={'agent-row ' + (isSidebar ? 'sidebar-item ' : '') + (selectedMemoryId === m.id ? 'active' : '')} onClick={() => selectItem(m.id, 'memory')}>
                            <span className='agent-status'>{m.isLive ? <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="5"/></svg> : <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5" cy="5" r="4.2"/></svg>}</span>
                            <span className='agent-name'>{m.name.replace('- ', '').replace('* ', '')}</span>
                        </button>
                    ))}
                </div>
            )}
            {previewPorts && previewPorts.length > 0 && !showArchived && (
                <div className='agent-section'>
                    <h2 className='section-label'>Active Previews</h2>
                    {previewPorts.map(p => (
                        <button key={p.port} className={'agent-row ' + (isSidebar ? 'sidebar-item ' : '') + (selectedPreviewPort === p.port ? 'active' : '')} onClick={() => selectItem(p.port, 'preview')}>
                            <span className='agent-status'><svg width="10" height="10" viewBox="0 0 10 10" style={{ fill: 'var(--success)' }}><circle cx="5" cy="5" r="4" /></svg></span>
                            <span className='agent-name'>Port {p.port}</span>
                            <span className='agent-time' style={{ fontSize: '10px' }}>PROXIED</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    const ConnectionIndicator = () => (
        <div className={'conn-pill ' + (connected ? 'on' : 'off')}>
            <span className='conn-label'>{connected ? 'ALIVE' : 'OFFLINE'}</span>
        </div>
    );

    const GoalArea = () => (
        <div className='new-agent'>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--fg3)', textTransform: 'uppercase' }}>Target Project</span>
                <select 
                    value={targetProjectId} 
                    onChange={e => setTargetProjectId(e.target.value)}
                    style={{ background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '11px', padding: '2px 4px' }}
                >
                    <option value='new'>+ New Project (Playground)</option>
                    {allItems.filter(a => !a.archived).map(a => (
                        <option key={a.id} value={a.id}>{a.name.slice(0, 30)}</option>
                    ))}
                </select>
            </div>
            <textarea placeholder='What should the agent do?' value={goal} onChange={e => setGoal(e.target.value)} onKeyDown={handleKeyDown} rows={2} />
            <div className='new-agent-actions'>
                <button className='go-btn' onClick={createAgent} disabled={!goal.trim() || creating} style={{ width: '100%' }}>
                    {creating ? '...' : 'Launch Goal'}
                </button>
            </div>
        </div>
    );

    if (isExpanded) {
        return (
            <div className='home-expanded-layout'>
                <aside className='home-sidebar'>
                    <header className='sidebar-header-area'>
                        <div className='zero-title' style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h1 style={{ cursor: 'pointer' }} onClick={() => { setSelectedAgentId(null); setSelectedMemoryId(null); }}>Zero</h1>
                            <ConnectionIndicator />
                        </div>
                        <div className='dashboard-tabs' style={{ marginBottom: 0 }}>
                            <button className={'tab-btn ' + (tab === 'inbox' ? 'active' : '')} onClick={() => setTab('inbox')}>Inbox</button>
                            <button className={'tab-btn ' + (tab === 'kitchen' ? 'active' : '')} onClick={() => setTab('kitchen')}>
                                Kitchen {deadWorkerCount > 0 && <span style={{ color: 'var(--error)' }}>💀 {deadWorkerCount}</span>}
                            </button>
                            <button className={'tab-btn ' + (tab === 'telemetry' ? 'active' : '')} onClick={() => setTab('telemetry')}>HUD</button>
                            <button className={'tab-btn ' + (tab === 'chat' ? 'active' : '')} onClick={() => setTab('chat')}>Chat</button>
                            <button className='tab-btn' onClick={() => navigate('/terminal')} title='Raw Terminal'>
                                <svg width="16" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8l4 4-4 4M15 16h4"/></svg>
                            </button>
                        </div>
                    </header>
                    {tab === 'inbox' && (
                        <>
                            <GoalArea />
                            {renderAgentList(true)}
                        </>
                    )}
                    {tab === 'chat' && (
                        <>
                            {renderAgentList(true)}
                        </>
                    )}
                    <div className='sidebar-footer' style={{ padding: '12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <button className='icon-btn' onClick={toggleExpand}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg> Focus
                        </button>
                        <button className='settings-btn' onClick={onSettingsClick}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
                    </div>
                </aside>
                <main className='home-main-content'>
                    {tab === 'inbox' && (
                        selectedAgent ? (
                            <AgentDetail agent={selectedAgent} embedded={true} onBack={() => setSelectedAgentId(null)} />
                        ) : selectedMemoryId ? (
                            <MemoryDetail memoryId={selectedMemoryId} embedded={true} onBack={() => setSelectedMemoryId(null)} />
                        ) : selectedPreviewPort ? (
                            <div className='preview-iframe-wrapper' style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ padding: '8px 16px', background: 'var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: 'bold' }}>Preview: /host/{selectedPreviewPort}</div>
                                    <div>
                                        <button className='mini-btn' onClick={() => window.open(`/host/${selectedPreviewPort}`, '_blank')} style={{ marginRight: '8px' }}>Open in New Tab</button>
                                        <button className='mini-btn' onClick={() => setSelectedPreviewPort(null)}>Close</button>
                                    </div>
                                </div>
                                <iframe src={`/host/${selectedPreviewPort}`} style={{ flex: 1, border: 'none', width: '100%', height: '100%' }} />
                            </div>
                        ) : (
                            <div className='empty-state' style={{ margin: 'auto', textAlign: 'center' }}>
                                <h2>Zero Workstation</h2>
                                <p>Select an agent or project from the inbox to begin.</p>
                            </div>
                        )
                    )}
                    {tab === 'kitchen' && <div className='kitchen-view' style={{ width: '100%' }}><KitchenDisplay tickets={allTickets} /></div>}
                    {tab === 'telemetry' && (
                        <div className='hud-view' style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', width: '100%' }}>
                            <TeslaDashboard />
                            <NotificationModule />
                        </div>
                    )}
                    {tab === 'chat' && (
                        selectedAgent ? (
                            <ChatPage embedded={true} initialAgentId={selectedAgent.id} key={selectedAgent.id} />
                        ) : (
                            <div className='empty-state' style={{ margin: 'auto', textAlign: 'center' }}>
                                <h2>Chat Logs</h2>
                                <p>Select an agent from the sidebar to browse chat history.</p>
                            </div>
                        )
                    )}
                </main>
            </div>
        );
    }

    return (
        <div className='zero-app'>
            <header className='zero-header'>
                <div className='zero-title'><h1>Zero</h1><ConnectionIndicator /></div>
                <div className='header-actions'>
                    <button className='icon-btn' onClick={toggleExpand} title='Expand HUD'>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                    </button>
                    <button className='settings-btn' onClick={onSettingsClick}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></button>
                </div>
            </header>
            <div className='dashboard-tabs'>
                <button className={'tab-btn ' + (tab === 'inbox' ? 'active' : '')} onClick={() => setTab('inbox')}>Inbox</button>
                <button className={'tab-btn ' + (tab === 'kitchen' ? 'active' : '')} onClick={() => setTab('kitchen')}>
                    Kitchen {deadWorkerCount > 0 && <span style={{ color: 'var(--error)' }}>💀 {deadWorkerCount}</span>}
                </button>
                <button className={'tab-btn ' + (tab === 'chat' ? 'active' : '')} onClick={() => setTab('chat')}>Chat</button>
                <button className='tab-btn' onClick={() => navigate('/terminal')} title='Raw Terminal'>
                    <svg width="16" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8l4 4-4 4M15 16h4"/></svg>
                </button>
            </div>
            {tab === 'inbox' ? (
                <>
                    <GoalArea />
                    {renderAgentList(false)}
                </>
            ) : tab === 'kitchen' ? (
                <div className='kitchen-view'><KitchenDisplay tickets={allTickets} /></div>
            ) : tab === 'chat' ? (
                <ChatPage embedded={true} />
            ) : null}
        </div>
    );
}

export default Home;
