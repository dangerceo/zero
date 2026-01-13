import React from 'react';
import TaskCard from './TaskCard';

function TaskList({ tasks, onDelete, onCancel, onFeedback }) {
    return (
        <div className="task-list">
            {tasks.map(task => (
                <TaskCard
                    key={task.id}
                    task={task}
                    onDelete={() => onDelete(task.id)}
                    onCancel={() => onCancel(task.id)}
                    onFeedback={onFeedback}
                />
            ))}
        </div>
    );
}

export default TaskList;
