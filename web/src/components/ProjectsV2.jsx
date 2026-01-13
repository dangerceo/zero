import React, { useState, useEffect, useRef } from 'react';

function ProjectsV2({ onBack }) {
    const [projects, setProjects] = useState([]);
    const [selected, setSelected] = useState(null);
    const [newGoal, setNewGoal] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        const res = await fetch('/api/v2/projects');
        setProjects(await res.json());
        setLoading(false);
    };

    const createProject = async () => {
        if (!newGoal.trim()) return;
        const res = await fetch('/api/v2/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal: newGoal, name: newGoal.slice(0, 50) })
        });
        const project = await res.json();
        setProjects([project, ...projects]);
        setNewGoal('');

        await fetch(`/api/v2/projects/${project.id}/start`, { method: 'POST' });
        setSelected(project);
    };

    const createZeroProject = async () => {
        const goal = newGoal.trim() || 'Improve Zero Computer based on user feedback';
        const res = await fetch('/api/v2/projects/zero', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goal })
        });
        const project = await res.json();
        setProjects([project, ...projects]);
        setNewGoal('');

        await fetch(`/api/v2/projects/${project.id}/start`, { method: 'POST' });
        setSelected(project);
    };

    if (selected) {
        return <ProjectDetail
            project={selected}
            onBack={() => { setSelected(null); loadProjects(); }}
            onUpdate={setSelected}
        />;
    }

    return (
        <div className="projects-v2">
            <div className="projects-header">
                <button className="back-btn" onClick={onBack}>←</button>
                <h2>Projects</h2>
            </div>

            <div className="new-project">
                <textarea
                    placeholder="Describe what you want to build..."
                    value={newGoal}
                    onChange={e => setNewGoal(e.target.value)}
                    rows={3}
                />
                <div className="project-buttons">
                    <button onClick={createProject} disabled={!newGoal.trim()}>
                        Start Project
                    </button>
                    <button className="zero-btn" onClick={createZeroProject}>
                        🔧 Edit Zero
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="loading">Loading...</div>
            ) : projects.length === 0 ? (
                <div className="empty-state">No projects yet</div>
            ) : (
                <div className="project-list">
                    {projects.map(p => (
                        <div
                            key={p.id}
                            className={`project-card status-${p.status}`}
                            onClick={() => setSelected(p)}
                        >
                            <div className="project-name">{p.name}</div>
                            <div className="project-meta">
                                <span className={`project-status ${p.status}`}>{p.status}</span>
                                {p.confidence && (
                                    <span className={`confidence ${p.confidence >= 70 ? 'high' : 'low'}`}>
                                        {p.confidence}%
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ProjectDetail({ project: initialProject, onBack, onUpdate }) {
    const [project, setProject] = useState(initialProject);
    const [answer, setAnswer] = useState('');
    const [comment, setComment] = useState('');
    const [showLogs, setShowLogs] = useState(false); // Collapsed by default for mobile
    const [copyStatus, setCopyStatus] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const [currentStep, setCurrentStep] = useState('Starting...');
    const [stepCount, setStepCount] = useState(0);
    const logsEndRef = useRef(null);

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'project:updated' && msg.project?.id === project.id) {
                setProject(msg.project);
                onUpdate(msg.project);
            }
            if (msg.type === 'project:log' && msg.projectId === project.id) {
                setProject(prev => ({
                    ...prev,
                    logs: [...(prev.logs || []), msg.log]
                }));
            }
            // Handle new progress events
            if (msg.type === 'project:progress' && msg.projectId === project.id) {
                setCurrentStep(msg.step);
                setStepCount(msg.stepCount);
            }
        };

        return () => ws.close();
    }, [project.id]);

    useEffect(() => {
        if (project.status !== 'working') return;

        const startTime = project.startedAt ? new Date(project.startedAt) : new Date();
        const timer = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);

        return () => clearInterval(timer);
    }, [project.status, project.startedAt]);

    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [project.logs]);

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const copyLogsToClipboard = () => {
        const logText = (project.logs || []).map(log => log.message).join('\n');
        navigator.clipboard.writeText(logText).then(() => {
            setCopyStatus('Copied!');
            setTimeout(() => setCopyStatus(''), 2000);
        });
    };

    const submitAnswer = async (qid) => {
        if (!answer.trim()) return;
        await fetch(`/api/v2/projects/${project.id}/questions/${qid}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answer })
        });
        setAnswer('');
        await fetch(`/api/v2/projects/${project.id}/continue`, { method: 'POST' });
    };

    const addComment = async () => {
        if (!comment.trim()) return;
        await fetch(`/api/v2/projects/${project.id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment })
        });
        setComment('');
    };

    const continueWorking = async () => {
        await fetch(`/api/v2/projects/${project.id}/start`, { method: 'POST' });
    };

    const unansweredQuestions = (project.pendingQuestions || []).filter(q => !q.answer);
    const isWorking = project.status === 'working';
    const canContinue = ['completed', 'failed', 'paused'].includes(project.status);
    const pendingComments = (project.comments || []).filter(c => !c.processed);

    return (
        <div className="project-detail">
            <div className="projects-header">
                <button className="back-btn" onClick={onBack}>←</button>
                <h2>{project.name}</h2>
            </div>

            {/* Status with confidence and timer */}
            <div className="status-row">
                <div className={`status-badge ${project.status}`}>
                    {isWorking && <span className="pulse"></span>}
                    {project.status}
                </div>
                {project.confidence && (
                    <div className={`confidence-badge ${project.confidence >= 70 ? 'high' : 'low'}`}>
                        {project.confidence}% likely to finish
                    </div>
                )}
                {isWorking && (
                    <span className="elapsed-time">{formatTime(elapsed)}</span>
                )}
            </div>

            {/* Confidence reason */}
            {project.confidenceReason && (
                <div className="confidence-reason">{project.confidenceReason}</div>
            )}

            {/* Pending Questions */}
            {unansweredQuestions.length > 0 && (
                <div className="questions-section">
                    <h3>🤔 Your input needed:</h3>
                    {unansweredQuestions.map(q => (
                        <div key={q.id} className="question-card">
                            <p>{q.question}</p>
                            <textarea
                                placeholder="Your answer..."
                                value={answer}
                                onChange={e => setAnswer(e.target.value)}
                                rows={2}
                            />
                            <button onClick={() => submitAnswer(q.id)}>
                                Submit & Continue
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Continue button */}
            {canContinue && (
                <button className="continue-btn" onClick={continueWorking}>
                    ▶ Continue Working
                </button>
            )}

            {/* Add follow-up comment */}
            <div className="comment-section">
                <h3>💬 Add follow-up instructions</h3>
                <div className="comment-input">
                    <textarea
                        placeholder="e.g., Also add dark mode..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                        rows={2}
                    />
                    <button onClick={addComment} disabled={!comment.trim()}>
                        Add to Queue
                    </button>
                </div>
                {pendingComments.length > 0 && (
                    <div className="pending-comments">
                        {pendingComments.map(c => (
                            <div key={c.id} className="pending-comment">
                                📝 {c.text}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Checkpoints */}
            {(project.checkpoints?.length > 0) && (
                <div className="checkpoints-section">
                    <h3>📍 Checkpoints</h3>
                    {project.checkpoints.map((cp, i) => (
                        <div key={cp.id} className="checkpoint-card">
                            <div className="checkpoint-num">#{i + 1}</div>
                            <div className="checkpoint-summary">{cp.summary}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Progress Card - Mobile Friendly */}
            {isWorking && (
                <div className="progress-card">
                    <div className="progress-step">{currentStep}</div>
                    <div className="progress-meta">
                        <span className="step-count">Step {stepCount}</span>
                        <span className="elapsed-time">{formatTime(elapsed)}</span>
                    </div>
                </div>
            )}

            {/* Live Terminal Output - Collapsed by default */}
            <div className="terminal-section">
                <div className="terminal-header">
                    <h3 onClick={() => setShowLogs(!showLogs)}>
                        📋 Full Logs <span className="toggle">{showLogs ? '▼' : '▶'}</span>
                        <span className="log-count">({(project.logs || []).length})</span>
                    </h3>
                    <div className="terminal-actions">
                        <button
                            onClick={copyLogsToClipboard}
                            disabled={!project.logs || project.logs.length === 0}
                        >
                            Copy
                        </button>
                        <span className="copy-status">{copyStatus}</span>
                    </div>
                </div>
                {showLogs && (
                    <div className="terminal-output">
                        {(project.logs || []).map((log, i) => (
                            <div key={i} className={`terminal-line ${log.type}`}>
                                {log.message}
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                )}
            </div>
        </div>
    );
}

export default ProjectsV2;
