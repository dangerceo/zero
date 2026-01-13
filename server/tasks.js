import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { executeTask } from './agent.js';

// In-memory task store
class TaskStore {
    constructor() {
        this.tasks = new Map();
    }

    create(description) {
        const task = {
            id: uuidv4(),
            description,
            status: 'pending',
            progress: 0,
            logs: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.tasks.set(task.id, task);
        return task;
    }

    get(id) {
        return this.tasks.get(id);
    }

    getAll() {
        return Array.from(this.tasks.values())
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    update(id, updates) {
        const task = this.tasks.get(id);
        if (!task) return null;

        Object.assign(task, updates, { updatedAt: new Date().toISOString() });
        return task;
    }

    addLog(id, message, type = 'info') {
        const task = this.tasks.get(id);
        if (!task) return null;

        task.logs.push({
            message,
            type,
            timestamp: new Date().toISOString()
        });
        task.updatedAt = new Date().toISOString();
        return task;
    }

    delete(id) {
        return this.tasks.delete(id);
    }
}

export const taskStore = new TaskStore();

export function createTasksRouter(broadcast) {
    const router = express.Router();

    // Get all tasks
    router.get('/', (req, res) => {
        res.json(taskStore.getAll());
    });

    // Get single task
    router.get('/:id', (req, res) => {
        const task = taskStore.get(req.params.id);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.json(task);
    });

    // Create new task
    router.post('/', async (req, res) => {
        const { description } = req.body;

        if (!description || !description.trim()) {
            return res.status(400).json({ error: 'Description is required' });
        }

        const task = taskStore.create(description.trim());
        broadcast({ type: 'task:created', task });

        res.status(201).json(task);

        // Start executing the task in the background
        executeTask(task.id, broadcast);
    });

    // Update task
    router.patch('/:id', (req, res) => {
        const task = taskStore.update(req.params.id, req.body);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        broadcast({ type: 'task:updated', task });
        res.json(task);
    });

    // Cancel task
    router.post('/:id/cancel', (req, res) => {
        const task = taskStore.update(req.params.id, { status: 'cancelled' });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        broadcast({ type: 'task:updated', task });
        res.json(task);
    });

    // Delete task
    router.delete('/:id', (req, res) => {
        const deleted = taskStore.delete(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Task not found' });
        }
        broadcast({ type: 'task:deleted', id: req.params.id });
        res.status(204).send();
    });

    // Feedback on task
    router.post('/:id/feedback', (req, res) => {
        const { success } = req.body;
        const feedback = success ? 'success' : 'failed';
        const task = taskStore.update(req.params.id, { feedback });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }

        if (!success) {
            taskStore.addLog(req.params.id, 'User reported: task did not work as expected', 'warning');
        }

        broadcast({ type: 'task:updated', task });
        res.json(task);
    });

    return router;
}
