import { taskStore } from './tasks.js';
import { terminalActions } from './automation/terminal.js';

// Simplified: No LLM planner layer - just use gemini directly
export async function executeTask(taskId, broadcast) {
    const task = taskStore.get(taskId);
    if (!task) return;

    taskStore.update(taskId, { status: 'running', progress: 5 });
    taskStore.addLog(taskId, 'Starting...', 'info');
    broadcast({ type: 'task:updated', task: taskStore.get(taskId) });

    try {
        taskStore.addLog(taskId, 'Running with Gemini...', 'info');
        taskStore.update(taskId, { progress: 20 });
        broadcast({ type: 'task:updated', task: taskStore.get(taskId) });

        // Just use gemini directly - no separate "planning" step
        const result = await terminalActions.gemini({
            prompt: task.description,
            workingDir: process.env.HOME
        });

        // Log meaningful output (filter noise)
        if (result?.stdout) {
            let output = result.stdout
                .split('\n')
                .filter(line => {
                    if (line.includes('DeprecationWarning')) return false;
                    if (line.includes('[WARN] Skipping')) return false;
                    if (line.includes('--trace-deprecation')) return false;
                    if (line.includes('YOLO mode')) return false;
                    if (line.includes('Loaded cached')) return false;
                    if (line.trim() === '') return false;
                    return true;
                })
                .join('\n')
                .trim();

            if (output) {
                if (output.length > 800) {
                    output = output.slice(0, 400) + '\n...\n' + output.slice(-400);
                }
                taskStore.addLog(taskId, output, 'info');
                broadcast({ type: 'task:updated', task: taskStore.get(taskId) });
            }
        }

        if (result?.success === false) {
            const error = result.error || result.stderr || 'Task failed';
            taskStore.addLog(taskId, `Error: ${error}`, 'error');
            broadcast({ type: 'task:updated', task: taskStore.get(taskId) });
        }

        taskStore.update(taskId, { status: 'completed', progress: 100 });
        taskStore.addLog(taskId, '✓ Task completed', 'success');
        broadcast({ type: 'task:updated', task: taskStore.get(taskId) });

    } catch (error) {
        console.error('Task error:', error);
        taskStore.update(taskId, { status: 'failed', progress: 0 });
        taskStore.addLog(taskId, `Failed: ${error.message}`, 'error');
        broadcast({ type: 'task:updated', task: taskStore.get(taskId) });
    }
}
