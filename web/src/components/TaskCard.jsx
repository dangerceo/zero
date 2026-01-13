import React from 'react';

function TaskCard({ task, onDelete, onCancel, onFeedback }) {
    const isRunning = task.status === 'running';
    const isDone = task.status === 'completed' || task.status === 'failed';

    const handleFeedback = async (success) => {
        if (onFeedback) {
            onFeedback(task.id, success);
        }
    };

    return (
        <div className={`task-card status-${task.status}`}>
            <div className="task-description">{task.description}</div>
            <div className="task-meta">
                <div className={`task-status status-${task.status}`}>{task.status}</div>
                {isRunning && <div className="task-status">{task.progress}%</div>}
            </div>

            {isRunning && (
                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${task.progress}%` }} />
                </div>
            )}

            {task.logs.length > 0 && (
                <div className="task-logs">
                    {task.logs.slice(-3).map((log, i) => (
                        <div key={i} className="log-entry">• {log.message}</div>
                    ))}
                </div>
            )}

            {isDone && !task.feedback && (
                <div className="task-feedback">
                    <span className="feedback-label">Did this work?</span>
                    <button className="feedback-btn success" onClick={() => handleFeedback(true)}>✓ Yes</button>
                    <button className="feedback-btn fail" onClick={() => handleFeedback(false)}>✗ No</button>
                </div>
            )}

            {task.feedback === 'success' && (
                <div className="task-feedback-done">✓ Marked as successful</div>
            )}

            {task.feedback === 'failed' && (
                <div className="task-feedback-done fail">✗ Marked as failed - will improve</div>
            )}
        </div>
    );
}

export default TaskCard;
