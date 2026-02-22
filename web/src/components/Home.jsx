import React, { useState } from 'react';

function Home({ agents, connected, onSelectAgent, onSettingsClick }) {
    const [goal, setGoal] = useState('');
    const [files, setFiles] = useState('');
    const [showFiles, setShowFiles] = useState(false);
    const [creating, setCreating] = useState(false);

    const createAgent = async () => {
        if (!goal.trim()) return;
        setCreating(true);
        try {
            const fileList = files.trim()
                ? files.split('\n').filter(f => f.trim()).map(f => ({ path: f.trim(), description: '' }))
                : [];
            const res = await fetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal, name: goal.slice(0, 50), files: fileList })
            });
            const agent = await res.json();
            await fetch(`/api/agents/${agent.id}/start`, { method: 'POST' });
            setGoal('');
            setFiles('');
            setShowFiles(false);
            onSelectAgent(agent.id);
        } catch (e) {
            console.error(e);
        }
        setCreating(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            createAgent();
        }
    };

    const statusIcon = (status) => {
        switch (status) {
            case 'running': return '●';
            case 'completed': return '✓';
            case 'failed': return '✗';
            case 'waiting': return '?';
            case 'paused': return '‖';
            default: return '○';
        }
    };

    const timeAgo = (ts) => {
        if (!ts) return '';
        const diff = Date.now() - new Date(ts).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'now';
        if (mins < 60) return `${mins}m`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h`;
        return `${Math.floor(hrs / 24)}d`;
    };

    const active = agents.filter(a => a.status === 'running' || a.status === 'waiting');
    const rest = agents.filter(a => a.status !== 'running' && a.status !== 'waiting');

    return (
        <div className="zero-app">
            <header className="zero-header">
                <div className="zero-title">
                    <h1>Zero</h1>
                    <span className={`conn-dot ${connected ? 'on' : 'off'}`} />
                </div>
                <button className="settings-btn" onClick={onSettingsClick} aria-label="Settings">⚙</button>
            </header>

            <div className="new-agent">
                <textarea
                    id="agent-goal-input"
                    placeholder="What should the agent do?"
                    value={goal}
                    onChange={e => setGoal(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                />
                {showFiles && (
                    <textarea
                        id="agent-files-input"
                        className="files-input"
                        placeholder="File paths (one per line)&#10;/path/to/file.js&#10;/path/to/other.py"
                        value={files}
                        onChange={e => setFiles(e.target.value)}
                        rows={3}
                    />
                )}
                <div className="new-agent-actions">
                    <button
                        className="link-btn"
                        onClick={() => setShowFiles(!showFiles)}
                    >
                        {showFiles ? '− files' : '+ files'}
                    </button>
                    <button
                        id="create-agent-btn"
                        className="go-btn"
                        onClick={createAgent}
                        disabled={!goal.trim() || creating}
                    >
                        {creating ? '...' : 'Go'}
                    </button>
                </div>
            </div>

            {agents.length === 0 ? (
                <div className="empty-state">
                    <p>No agents running.</p>
                </div>
            ) : (
                <div className="agent-list">
                    {active.length > 0 && (
                        <div className="agent-section">
                            <h2 className="section-label">Active</h2>
                            {active.map(a => (
                                <button key={a.id} className="agent-row" onClick={() => onSelectAgent(a.id)}>
                                    <span className={`agent-status s-${a.status}`}>{statusIcon(a.status)}</span>
                                    <span className="agent-name">{a.name}</span>
                                    <span className="agent-time">{timeAgo(a.updatedAt)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    {rest.length > 0 && (
                        <div className="agent-section">
                            {active.length > 0 && <h2 className="section-label">History</h2>}
                            {rest.map(a => (
                                <button key={a.id} className="agent-row" onClick={() => onSelectAgent(a.id)}>
                                    <span className={`agent-status s-${a.status}`}>{statusIcon(a.status)}</span>
                                    <span className="agent-name">{a.name}</span>
                                    <span className="agent-time">{timeAgo(a.updatedAt)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default Home;
