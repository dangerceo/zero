import React, { useState, useEffect, useCallback } from 'react';
import TaskList from './components/TaskList';
import NewTaskForm from './components/NewTaskForm';
import Header from './components/Header';
import ProjectsV2 from './components/ProjectsV2';
import Settings from './components/Settings';

function App() {
    const [tasks, setTasks] = useState([]);
    const [connected, setConnected] = useState(false);
    const [showNewTask, setShowNewTask] = useState(false);
    const [view, setView] = useState('tasks'); // 'tasks', 'projects', 'settings'

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;

        let ws;
        let reconnectTimeout;

        function connect() {
            ws = new WebSocket(wsUrl);

            ws.onopen = () => {
                setConnected(true);
            };

            ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                handleMessage(message);
            };

            ws.onclose = () => {
                setConnected(false);
                reconnectTimeout = setTimeout(connect, 2000);
            };

            ws.onerror = () => { };
        }

        connect();

        return () => {
            clearTimeout(reconnectTimeout);
            ws?.close();
        };
    }, []);

    const handleMessage = useCallback((message) => {
        switch (message.type) {
            case 'init':
                setTasks(message.tasks);
                break;
            case 'task:created':
                setTasks(prev => [message.task, ...prev]);
                break;
            case 'task:updated':
                setTasks(prev => prev.map(t =>
                    t.id === message.task.id ? message.task : t
                ));
                break;
            case 'task:deleted':
                setTasks(prev => prev.filter(t => t.id !== message.id));
                break;
            default:
                break;
        }
    }, []);

    const createTask = async (description) => {
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description })
            });
            if (response.ok) setShowNewTask(false);
        } catch (error) {
            console.error(error);
        }
    };

    const deleteTask = async (id) => {
        await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    };

    const cancelTask = async (id) => {
        await fetch(`/api/tasks/${id}/cancel`, { method: 'POST' });
    };

    const feedbackTask = async (id, success) => {
        const response = await fetch(`/api/tasks/${id}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success })
        });
        if (response.ok) {
            const updated = await response.json();
            setTasks(prev => prev.map(t => t.id === id ? updated : t));
        }
    };

    if (view === 'projects') {
        return <ProjectsV2 onBack={() => setView('tasks')} />;
    }

    if (view === 'settings') {
        return <Settings onBack={() => setView('tasks')} />;
    }

    return (
        <div className="app">
            <Header
                connected={connected}
                onProjectsClick={() => setView('projects')}
                onSettingsClick={() => setView('settings')}
            />

            <main className="main">
                {tasks.length === 0 ? (
                    <div className="empty-state">No tasks</div>
                ) : (
                    <TaskList tasks={tasks} onDelete={deleteTask} onCancel={cancelTask} onFeedback={feedbackTask} />
                )}
            </main>

            <button className="fab" onClick={() => setShowNewTask(true)}>+</button>

            {showNewTask && (
                <NewTaskForm onSubmit={createTask} onClose={() => setShowNewTask(false)} />
            )}
        </div>
    );
}

export default App;
