import React, { useState, useEffect, useRef } from 'react';
import KitchenDisplay from './KitchenDisplay';
import WebContainerPreview from './WebContainerPreview';

function AgentDetail({ agent, onBack, embedded = false }) {
    const [todo, setTodo] = useState('');
    const [answer, setAnswer] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const [view, setView] = useState('chat');
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);

    const isWorking = agent.actuallyRunning;
    const unanswered = (agent.pendingQuestions || []).filter(q => !q.answer);
    const pendingTodos = (agent.todos || []).filter(t => !t.processed);

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
                {!embedded && <button className='back-btn' onClick={onBack}>←</button>}
                <div className='detail-title'>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <h1 style={{ flex: 1, minWidth: '200px' }}>{agent.name}</h1>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {!isWorking ? (
                                <>
                                    <button className='mini-btn' onClick={() => handleAction('resume')} style={{ background: 'var(--success)', color: '#fff', border: 'none' }}>▶ Resume</button>
                                    <button className='mini-btn' onClick={() => handleAction('start')}>🔄 Restart</button>
                                </>
                            ) : (
                                <button className='mini-btn' onClick={() => handleAction('stop')} style={{ color: 'var(--error)', borderColor: 'var(--error)' }}>⏹ Stop</button>
                            )}
                            <button className='mini-btn' onClick={archiveAgent}>📁 Archive</button>
                            <button className='mini-btn' onClick={deleteAgent} style={{ opacity: 0.5 }}>🗑️ Delete</button>
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
                {view === 'preview' && (agent.workingDir || agent.path) && <WebContainerPreview workingDir={agent.workingDir || agent.path} />}
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
