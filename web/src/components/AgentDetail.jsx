import React, { useState, useEffect, useRef } from 'react';
import KitchenDisplay from './KitchenDisplay';
import WebContainerPreview from './WebContainerPreview';
import { useStore } from '../store';

function AgentDetail({ agent, onBack, embedded = false }) {
    const { previewPorts } = useStore();
    const [todo, setTodo] = useState('');
    const [answer, setAnswer] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const [view, setView] = useState('chat');
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);

    const isWorking = agent.actuallyRunning;
    const unanswered = (agent.pendingQuestions || []).filter(q => !q.answer);
    const pendingTodos = (agent.todos || []).filter(t => !t.processed);
    
    // Check if this project has a live dev stream
    const activePort = previewPorts?.find(p => p.path && (p.path === agent?.workingDir || p.path === agent?.path || p.path?.startsWith(agent?.workingDir || agent?.path)));

    useEffect(() => {
        if (!isWorking) return;
        const start = agent.startedAt ? new Date(agent.startedAt) : new Date();
        const timer = setInterval(() => {
            setElapsed(Math.floor((Date.now() - start) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [isWorking, agent.startedAt, agent.id]);

    const allMessages = [
        ...(agent.threads || []).map(t => ({ ...t, _type: 'thread', _ts: new Date(t.timestamp || t.ts || 0).getTime() })),
        ...(agent.logs || []).map(l => ({ ...l, _type: 'log', _ts: new Date(l.timestamp || 0).getTime() })),
        ...(agent.checkpoints || []).map(c => ({ ...c, _type: 'checkpoint', _ts: new Date(c.createdAt || 0).getTime() }))
    ].sort((a, b) => a._ts - b._ts);

    const chatMessages = allMessages.filter(msg => {
        if (msg._type === 'thread') return true;
        if (msg._type === 'checkpoint') return true;
        if (msg._type === 'log') return ['success', 'error', 'warning'].includes(msg.type);
        return false;
    });

    const displayMessages = view === 'chat' ? chatMessages : allMessages;

    useEffect(() => {
        if (view !== 'preview') messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [displayMessages.length, view, agent.id]);

    const fmt = (s) => Math.floor(s / 60) + ':' + (s % 60).toString().padStart(2, '0');

    const handleAction = async (endpoint) => {
        setError(null);
        try {
            const res = await fetch('/api/agents/' + agent.id + '/' + endpoint, { method: 'POST' });
            if (!res.ok) {
                const text = await res.text();
                setError(text || 'Action failed');
            }
        } catch (e) {
            setError(e.message);
        }
    };

    const addTodo = async () => {
        if (!todo.trim()) return;
        setError(null);
        try {
            await fetch('/api/agents/' + agent.id + '/todo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ todo }) });
            setTodo('');
        } catch (e) { setError(e.message); }
    };

    const submitAnswer = async (qid) => {
        if (!answer.trim()) return;
        setError(null);
        try {
            await fetch('/api/agents/' + agent.id + '/questions/' + qid + '/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer }) });
            setAnswer('');
            handleAction('resume');
        } catch (e) { setError(e.message); }
    };

    const deleteAgent = async () => {
        if (!confirm('Delete this agent?')) return;
        handleAction('stop');
        await fetch('/api/agents/' + agent.id, { method: 'DELETE' });
        onBack();
    };

    const archiveAgent = async () => {
        setError(null);
        try {
            const res = await fetch('/api/agents/' + agent.id + '/archive', { method: 'POST' });
            if (res.ok) onBack();
            else setError('Archive failed');
        } catch (e) { setError(e.message); }
    };

    const todoKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTodo(); } };

    return (
        <div className={embedded ? 'agent-detail-embedded' : 'zero-app'}>

            <header className='detail-header'>
                {!embedded && <button className='back-btn' onClick={onBack} title="Back">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>}
                <div className='detail-title'>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <h1 style={{ flex: 1, minWidth: '200px' }}>{agent.name}</h1>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {!isWorking ? (
                                <>
                                    <button className='mini-btn' onClick={() => handleAction('resume')} style={{ background: 'var(--success)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg> Resume
                                    </button>
                                    <button className='mini-btn' onClick={() => handleAction('start')} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> Restart
                                    </button>
                                </>
                            ) : (
                                <button className='mini-btn' onClick={() => handleAction('stop')} style={{ color: 'var(--error)', borderColor: 'var(--error)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg> Stop
                                </button>
                            )}
                            <button className='mini-btn' onClick={archiveAgent} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> Archive
                            </button>
                            <button className='mini-btn' onClick={deleteAgent} style={{ opacity: 0.5, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg> Delete
                            </button>
                        </div>
                    </div>
                    {error && <div style={{ color: 'var(--error)', fontSize: '11px', fontWeight: 'bold', marginTop: '4px' }}>⚠️ {error}</div>}
                    <div className='status-row'>
                        <span className={'status-label s-' + agent.status}>
                            {agent.status}
                            {isWorking && (' · ' + fmt(elapsed))}
                        </span>
                        <div className='view-toggle'>
                            <button className={'v-btn ' + (view === 'chat' ? 'active' : '')} onClick={() => setView('chat')}>Chat</button>
                            {(agent.tickets || []).length > 0 && <button className={'v-btn ' + (view === 'kitchen' ? 'active' : '')} onClick={() => setView('kitchen')}>Kitchen</button>}
                            {(agent.workingDir || agent.path) && <button className={'v-btn ' + (view === 'preview' ? 'active' : '')} onClick={() => setView('preview')}>Preview</button>}
                            <button className={'v-btn ' + (view === 'logs' ? 'active' : '')} onClick={() => setView('logs')}>Logs</button>
                        </div>
                    </div>
                </div>
            </header>

            <div className='content-canvas' style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {view === 'preview' && (agent.workingDir || agent.path) && (
                    activePort ? (
                        <div className='preview-iframe-wrapper' style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '8px 16px', background: 'var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ fontWeight: 'bold' }}>Native Project Preview <span style={{ color: 'var(--fg3)', fontSize: '11px', marginLeft: '6px', fontWeight: 'normal' }}>Local Proxy: {activePort.port}</span></div>
                                <button className='mini-btn' onClick={() => window.open(`/host/${activePort.port}`, '_blank')} style={{ background: 'var(--bg)', color: 'var(--fg)', cursor: 'pointer', padding: '4px 12px' }}>↗ Pop Out Native View</button>
                            </div>
                            <iframe src={`/host/${activePort.port}`} style={{ flex: 1, border: 'none', width: '100%', height: '100%', background: '#fff' }} />
                        </div>
                    ) : (
                        <WebContainerPreview workingDir={agent.workingDir || agent.path} />
                    )
                )}
                {view === 'kitchen' && (agent.tickets || []).length > 0 && <div style={{ overflowY: 'auto', flex: 1 }}><KitchenDisplay tickets={agent.tickets} /></div>}
                {(view === 'chat' || view === 'logs') && (
                    <section className={'unified-chat v-' + view} style={{ flex: 1, overflowY: 'auto' }}>
                        {displayMessages.map((msg, i) => {
                            if (msg._type === 'thread') return (<div key={'thread-' + (msg.id || i)} className={'thread-entry t-' + msg.role}><div className='thread-role'>{msg.role === 'user' ? 'You' : 'Agent'}</div><div className='thread-content'>{msg.content}</div></div>);
                            if (msg._type === 'log') return (<div key={'log-' + i} className={'chat-log-line l-' + msg.type}><span className='log-prefix'>›</span> {msg.message}</div>);
                            if (msg._type === 'checkpoint') return (<div key={'cp-' + (msg.id || i)} className='chat-checkpoint'>📍 {msg.summary}</div>);
                            return null;
                        })}
                        <div ref={messagesEndRef} />
                    </section>
                )}
            </div>

            {view !== 'preview' && (
                <>
                    {unanswered.length > 0 && (
                        <section className='questions'>
                            <h2 className='section-label'>Input needed</h2>
                            {unanswered.map(q => (
                                <div key={q.id} className='question-card'>
                                    <p>{q.question}</p>
                                    <textarea placeholder='Your answer...' value={answer} onChange={e => setAnswer(e.target.value)} rows={2} />
                                    <button className='primary-btn' onClick={() => submitAnswer(q.id)}>Submit & Continue</button>
                                </div>
                            ))}
                        </section>
                    )}
                    <section className='reply-box'><textarea placeholder='Add a todo...' value={todo} onChange={e => setTodo(e.target.value)} onKeyDown={todoKeyDown} rows={2} /><button className='go-btn' onClick={addTodo} disabled={!todo.trim()}>Send</button></section>
                    {pendingTodos.length > 0 && <div className='pending-list'>{pendingTodos.map(t => <div key={t.id} className='pending-item'>📝 {t.text}</div>)}</div>}
                </>
            )}
            
            <style>{ ".agent-detail-embedded { flex: 1; display: flex; flex-direction: column; height: 100%; overflow: hidden; } .mini-btn { background: var(--bg2); border: 1px solid var(--border); border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer; color: var(--fg2); } .mini-btn:hover { border-color: var(--fg); color: var(--fg); }" }</style>
        </div>
    );
}

export default AgentDetail;
