import { agentStore } from './agentStore.js';
import { spawn } from 'child_process';
import { mkdir, readdir, stat, readFile } from 'fs/promises';
export { readdir, stat, readFile };
import { join } from 'path';
import { homedir } from 'os';
import { runKitchen } from './kitchen/pass.js';

const AGENTS_DIR = join(homedir(), 'ZeroProjects');
const activeProcesses = new Map();
const lastProgressTime = new Map();

const AGENT_SYSTEM_INSTRUCTION = 'You are working on a Zero Computer agent task. ' +
    'Work autonomously and show your progress. IMPORTANT: 1. After completing ' +
    'a significant milestone, output: [CHECKPOINT] <description> 2. If you ' +
    'need user input, output: [QUESTION] <your question> 3. Show what you are ' +
    'doing as you work 4. Use the existing files in the project - dont start ' +
    'over 5. Test your code. Complete the full goal, not just the first step.';

async function getDirectoryFiles(dir) {
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const path = join(dir, entry.name);
            if (entry.isDirectory()) files.push(entry.name + '/');
            else {
                const s = await stat(path);
                files.push(entry.name + ' (' + Math.round(s.size / 1024) + 'KB)');
            }
        }
        return files;
    } catch { return []; }
}

export function isAgentActuallyRunning(agentId) {
    return activeProcesses.has(agentId);
}

export async function stopAgent(agentId) {
    const process = activeProcesses.get(agentId);
    if (process) {
        process.kill();
        activeProcesses.delete(agentId);
        await agentStore.update(agentId, { status: 'paused' });
        return true;
    }
    return false;
}

export async function executeAgent(agentId, broadcast, resume = false) {
    if (activeProcesses.has(agentId)) await stopAgent(agentId);
    const agent = await agentStore.get(agentId);
    if (!agent) return;

    const agentDir = agent.workingDir || join(AGENTS_DIR, agent.id);
    try { await mkdir(agentDir, { recursive: true }); } catch (e) { }

    await agentStore.update(agentId, { workingDir: agentDir, status: 'running', startedAt: new Date().toISOString() });
    if (agent.threads.length === 0 && agent.goal) await agentStore.addThread(agentId, 'user', agent.goal);
    broadcastAgentUpdate(agentId, broadcast);

    if (!resume) {
        try { await runKitchen(agentId, broadcast); return; } catch (e) { }
    }

    streamLog(agentId, broadcast, (resume ? '🔄 Resuming session...' : '🚀 Starting work...'), 'info', true);

    try {
        const fileList = await getDirectoryFiles(agentDir);
        let prompt = resume ? 'Resume work.' : (AGENT_SYSTEM_INSTRUCTION + '\n\nGOAL: ' + agent.goal + '\n\n');
        
        const unprocessedTodos = (agent.todos || []).filter(t => !t.processed);
        if (unprocessedTodos.length > 0) {
            prompt += '\n\nNEW DIRECTIVES:\n';
            for (const t of unprocessedTodos) {
                prompt += '• ' + t.text + '\n';
                await agentStore.markTodoProcessed(agentId, t.id);
            }
        }

        await runGeminiStreaming(agentId, prompt, agentDir, broadcast, resume);
    } catch (error) {
        await agentStore.update(agentId, { status: 'failed' });
        streamLog(agentId, broadcast, '❌ Error: ' + error.message, 'error', true);
        broadcastAgentUpdate(agentId, broadcast);
    }
}

async function runGeminiStreaming(agentId, prompt, workingDir, broadcast, resume = false) {
    return new Promise((resolve) => {
        const args = ['--yolo', '--output-format', 'json'];
        if (resume) args.push('--resume');
        args.push(prompt);

        const child = spawn('gemini', args, { cwd: workingDir, env: { ...process.env } });
        activeProcesses.set(agentId, child);
        child.stdin.end();

        let fullOutput = '';
        const processChunk = async (line) => {
            try {
                const data = JSON.parse(line);
                if (data.type === 'text') {
                    fullOutput += data.text;
                    if (data.text.includes('[CHECKPOINT]')) {
                        const summary = data.text.split('[CHECKPOINT]')[1].split('\n')[0].trim();
                        await agentStore.addCheckpoint(agentId, { summary });
                        streamLog(agentId, broadcast, '📍 ' + summary, 'success', true);
                    } else if (data.text.includes('[INTERVENTION]')) {
                        try {
                            const json = data.text.split('[INTERVENTION]')[1].split('\n')[0].trim();
                            const intervention = JSON.parse(json);
                            await agentStore.addIntervention(agentId, intervention);
                            await agentStore.update(agentId, { status: 'waiting' });
                            streamLog(agentId, broadcast, '🛡️ Intervention: ' + (intervention.message || intervention.type), 'warning', true);
                            broadcast({ type: 'notification:new', agentId, message: intervention.message, intervention });
                        } catch (e) {
                            streamLog(agentId, broadcast, '❌ Failed to parse intervention JSON: ' + e.message, 'error', true);
                        }
                    } else if (data.text.includes('[QUESTION]')) {
                        const question = data.text.split('[QUESTION]')[1].split('\n')[0].trim();
                        // Also treat [QUESTION] as an intervention for the Android app
                        await agentStore.addIntervention(agentId, {
                            type: 'input',
                            message: question
                        });
                        await agentStore.addQuestion(agentId, question);
                        await agentStore.update(agentId, { status: 'waiting' });
                        streamLog(agentId, broadcast, '❓ ' + question, 'warning', true);
                        broadcast({ 
                            type: 'notification:new', 
                            agentId, 
                            message: question, 
                            intervention: { type: 'input', message: question } 
                        });
                    } else streamLog(agentId, broadcast, data.text, 'output');
                }
                if (data.type === 'call') {
                    const now = Date.now();
                    const lastTime = lastProgressTime.get(agentId) || 0;
                    // Throttle progress updates to once every 5 seconds to reduce notification noise
                    if (now - lastTime > 5000) {
                        const callName = data.call.name + '(' + Object.keys(data.call.args || {}).join(', ') + ')';
                        broadcast({ type: 'agent:progress', agentId, step: callName });
                        lastProgressTime.set(agentId, now);
                    }
                }
            } catch (e) { if (line.trim()) streamLog(agentId, broadcast, line, 'output'); }
        };

        let buffer = '';
        child.stdout.on('data', async (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) if (line.trim()) await processChunk(line);
        });

        child.on('close', async (code) => {
            activeProcesses.delete(agentId);
            lastProgressTime.delete(agentId);
            if (fullOutput.trim()) await agentStore.addThread(agentId, 'agent', fullOutput.trim().slice(0, 500));
            await agentStore.update(agentId, { status: code === 0 ? 'completed' : 'failed' });
            streamLog(agentId, broadcast, code === 0 ? '✅ Done' : '❌ Failed', code === 0 ? 'success' : 'error', true);
            broadcastAgentUpdate(agentId, broadcast);
            resolve();
        });
    });
}

async function streamLog(agentId, broadcast, message, type, notify = false) {
    await agentStore.addLog(agentId, message, type);
    broadcast({ 
        type: 'agent:log', 
        agentId, 
        log: { message, type, timestamp: new Date().toISOString() },
        notify 
    });
}

async function broadcastAgentUpdate(agentId, broadcast) {
    const agent = await agentStore.get(agentId);
    if (agent) {
        agent.actuallyRunning = activeProcesses.has(agentId);
        broadcast({ type: 'agent:updated', agent });
    }
}

export async function continueAgent(agentId, broadcast) {
    await executeAgent(agentId, broadcast, true);
}
