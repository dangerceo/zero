import React, { useState, useEffect, useRef } from 'react';

function AgentDetail({ agent, onBack }) {
    const [comment, setComment] = useState('');
    const [answer, setAnswer] = useState('');
    const [showLogs, setShowLogs] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [filePath, setFilePath] = useState('');
    const logsEndRef = useRef(null);

    const isRunning = agent.status === 'running';
    const canContinue = ['completed', 'failed', 'paused', 'idle'].includes(agent.status);
    const unanswered = (agent.pendingQuestions || []).filter(q => !q.answer);
    const pendingComments = (agent.comments || []).filter(c => !c.processed);

    useEffect(() => {
        if (!isRunning) return;
        const start = agent.startedAt ? new Date(agent.startedAt) : new Date();
        const timer = setInterval(() => {
            setElapsed(Math.floor((Date.now() - start) / 1000));
        }, 1000);
        return () => clearInterval(timer);
    }, [isRunning, agent.startedAt]);

    useEffect(() => {
        if (showLogs) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [agent.logs, showLogs]);

    const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const addComment = async () => {
        if (!comment.trim()) return;
        await fetch(`/api/agents/${agent.id}/comment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment })
        });
        setComment('');
    };

    const submitAnswer = async (qid) => {
        if (!answer.trim()) return;
        await fetch(`/api/agents/${agent.id}/questions/${qid}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer })
        });
        setAnswer('');
        await fetch(`/api/agents/${agent.id}/continue`, { method: 'POST' });
    };

    const continueWorking = async () => {
        await fetch(`/api/agents/${agent.id}/start`, { method: 'POST' });
    };

    const deleteAgent = async () => {
        await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
        onBack();
    };

    const addFile = async () => {
        if (!filePath.trim()) return;
        await fetch(`/api/agents/${agent.id}/files`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: filePath.trim() })
        });
        setFilePath('');
    };

    const removeFile = async (path) => {
        await fetch(`/api/agents/${agent.id}/files`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
    };

    const commentKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addComment();
        }
    };

    return (
        <div className="zero-app">
            <header className="detail-header">
                <button className="back-btn" onClick={onBack}>←</button>
                <div className="detail-title">
                    <h1>{agent.name}</h1>
                    <span className={`status-label s-${agent.status}`}>
                        {agent.status}
                        {isRunning && ` · ${fmt(elapsed)}`}
                    </span>
                </div>
            </header>

            {/* Thread */}
            {(agent.threads || []).length > 0 && (
                <section className="threads">
                    <h2 className="section-label">Thread</h2>
                    {agent.threads.map(t => (
                        <div key={t.id} className={`thread-entry t-${t.role}`}>
                            <div className="thread-role">{t.role === 'user' ? 'You' : 'Agent'}</div>
                            <div className="thread-content">{t.content}</div>
                        </div>
                    ))}
                </section>
            )}

            {/* Questions */}
            {unanswered.length > 0 && (
                <section className="questions">
                    <h2 className="section-label">Input needed</h2>
                    {unanswered.map(q => (
                        <div key={q.id} className="question-card">
                            <p>{q.question}</p>
                            <textarea
                                placeholder="Your answer..."
                                value={answer}
                                onChange={e => setAnswer(e.target.value)}
                                rows={2}
                            />
                            <button className="primary-btn" onClick={() => submitAnswer(q.id)}>
                                Submit & Continue
                            </button>
                        </div>
                    ))}
                </section>
            )}

            {/* Reply box */}
            <section className="reply-box">
                <textarea
                    id="agent-reply-input"
                    placeholder="Steer the agent..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    onKeyDown={commentKeyDown}
                    rows={2}
                />
                <button
                    id="send-comment-btn"
                    className="go-btn"
                    onClick={addComment}
                    disabled={!comment.trim()}
                >
                    Send
                </button>
            </section>

            {pendingComments.length > 0 && (
                <div className="pending-list">
                    {pendingComments.map(c => (
                        <div key={c.id} className="pending-item">📝 {c.text}</div>
                    ))}
                </div>
            )}

            {/* Continue / actions */}
            {canContinue && (
                <div className="action-row">
                    <button className="primary-btn" onClick={continueWorking}>▶ Continue</button>
                    <button className="danger-btn" onClick={deleteAgent}>Delete</button>
                </div>
            )}

            {/* Files */}
            <section className="files-section">
                <h2 className="section-label">
                    Files ({(agent.files || []).length})
                </h2>
                {(agent.files || []).map(f => (
                    <div key={f.path} className="file-row">
                        <span className="file-path">{f.path}</span>
                        <button className="x-btn" onClick={() => removeFile(f.path)}>×</button>
                    </div>
                ))}
                <div className="add-file-row">
                    <input
                        type="text"
                        placeholder="/path/to/file"
                        value={filePath}
                        onChange={e => setFilePath(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addFile(); }}
                    />
                    <button className="go-btn" onClick={addFile} disabled={!filePath.trim()}>+</button>
                </div>
            </section>

            {/* Checkpoints */}
            {(agent.checkpoints || []).length > 0 && (
                <section className="checkpoints">
                    <h2 className="section-label">Checkpoints</h2>
                    {agent.checkpoints.map((cp, i) => (
                        <div key={cp.id} className="checkpoint">
                            <span className="cp-num">#{i + 1}</span> {cp.summary}
                        </div>
                    ))}
                </section>
            )}

            {/* Logs */}
            <section className="logs-section">
                <button className="section-toggle" onClick={() => setShowLogs(!showLogs)}>
                    Logs ({(agent.logs || []).length}) {showLogs ? '▼' : '▶'}
                </button>
                {showLogs && (
                    <div className="logs-output">
                        {(agent.logs || []).map((log, i) => (
                            <div key={i} className={`log-line l-${log.type}`}>{log.message}</div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                )}
            </section>
        </div>
    );
}

export default AgentDetail;
