import { agentStore } from './agentStore.js';
import { spawn } from 'child_process';
import { mkdir, readdir, stat, readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const AGENTS_DIR = join(homedir(), 'ZeroProjects');

const AGENT_SYSTEM_INSTRUCTION = `You are working on a Zero Computer agent task. Work autonomously and show your progress.

IMPORTANT:
1. After completing a significant milestone, output: [CHECKPOINT] <description>
2. If you need user input, output: [QUESTION] <your question>
3. Show what you're doing as you work
4. Use the existing files in the project - don't start over
5. Test your code

Complete the full goal, not just the first step.`;

async function getDirectoryFiles(dir) {
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(`${entry.name}/`);
            } else {
                const s = await stat(path);
                files.push(`${entry.name} (${Math.round(s.size / 1024)}KB)`);
            }
        }
        return files;
    } catch {
        return [];
    }
}

async function readFileContent(filePath) {
    try {
        const content = await readFile(filePath, 'utf-8');
        // Truncate very large files
        if (content.length > 5000) {
            return content.slice(0, 2000) + '\n... (truncated) ...\n' + content.slice(-2000);
        }
        return content;
    } catch {
        return null;
    }
}

export async function executeAgent(agentId, broadcast) {
    const agent = await agentStore.get(agentId);
    if (!agent) return;

    const agentDir = agent.workingDir || join(AGENTS_DIR, agent.id);

    try {
        await mkdir(agentDir, { recursive: true });
    } catch (e) {
        await agentStore.update(agentId, { status: 'failed' });
        streamLog(agentId, broadcast, `❌ Failed to create directory: ${e.message}`, 'error');
        broadcastAgentUpdate(agentId, broadcast);
        return;
    }

    const fileList = await getDirectoryFiles(agentDir);

    await agentStore.update(agentId, {
        workingDir: agentDir,
        status: 'running',
        startedAt: new Date().toISOString()
    });

    // Record the user's goal as a thread entry if this is the first run
    if (agent.threads.length === 0 && agent.goal) {
        await agentStore.addThread(agentId, 'user', agent.goal);
    }

    broadcastAgentUpdate(agentId, broadcast);
    streamLog(agentId, broadcast, '🚀 Starting work...', 'info');

    try {
        let prompt = `${AGENT_SYSTEM_INSTRUCTION}\n\n`;
        prompt += `GOAL: ${agent.goal}\n`;
        prompt += `WORKING DIRECTORY: ${agentDir}\n\n`;

        if (fileList.length > 0) {
            prompt += `EXISTING FILES:\n${fileList.join('\n')}\n\n`;
            prompt += `These files already exist - build on them, don't start over.\n\n`;
        }

        // Include specified files with content
        if (agent.files && agent.files.length > 0) {
            prompt += `FOCUS FILES (read these carefully):\n`;
            for (const f of agent.files) {
                const content = await readFileContent(f.path);
                if (content) {
                    prompt += `\n--- ${f.path} ---\n${content}\n---\n`;
                } else {
                    prompt += `- ${f.path} (could not read)\n`;
                }
                if (f.description) {
                    prompt += `  Note: ${f.description}\n`;
                }
            }
            prompt += '\n';
        }

        if (agent.checkpoints?.length > 0) {
            prompt += `COMPLETED CHECKPOINTS:\n`;
            agent.checkpoints.forEach((cp, i) => {
                prompt += `${i + 1}. ${cp.summary}\n`;
            });
            prompt += `\nContinue from where we left off.\n\n`;
        }

        const answeredQuestions = (agent.pendingQuestions || []).filter(q => q.answer);
        if (answeredQuestions.length > 0) {
            prompt += `USER ANSWERS:\n`;
            for (const q of answeredQuestions) {
                prompt += `Q: ${q.question}\nA: ${q.answer}\n\n`;
            }
        }

        const unprocessedComments = (agent.comments || []).filter(c => !c.processed);
        if (unprocessedComments.length > 0) {
            streamLog(agentId, broadcast, `📝 Processing ${unprocessedComments.length} follow-up instruction(s)...`, 'info');
            prompt += `\n\nIMPORTANT - FOLLOW-UP INSTRUCTIONS FROM USER (address these first):\n`;
            for (const c of unprocessedComments) {
                prompt += `• ${c.text}\n`;
                streamLog(agentId, broadcast, `  → ${c.text}`, 'output');
                await agentStore.markCommentProcessed(agentId, c.id);
            }
            prompt += `\nPrioritize these instructions before continuing other work.\n`;
        }

        prompt += `Begin now.`;

        streamLog(agentId, broadcast, '🤖 Agent is working...', 'info');
        await runGeminiStreaming(agentId, prompt, agentDir, broadcast);

    } catch (error) {
        console.error('Agent execution error:', error);
        await agentStore.update(agentId, { status: 'failed' });
        streamLog(agentId, broadcast, `❌ Error: ${error.message}`, 'error');
        broadcastAgentUpdate(agentId, broadcast);
    }
}

async function runGeminiStreaming(agentId, prompt, workingDir, broadcast) {
    return new Promise(async (resolve) => {
        const child = spawn('gemini', ['--yolo', '--output-format', 'json', prompt], {
            cwd: workingDir,
            env: { ...process.env }
        });

        let hasError = false;
        let currentStep = 'Starting...';
        let stepCount = 0;
        let fullOutput = '';

        const ACTION_PATTERNS = [
            { pattern: /^(Creating|Making|Initializing|Setting up)\s+(.+)/i, type: 'creating' },
            { pattern: /^(Installing|Adding|Downloading)\s+(.+)/i, type: 'installing' },
            { pattern: /^(Writing|Editing|Updating|Modifying)\s+(.+)/i, type: 'writing' },
            { pattern: /^(Running|Executing|Starting|Building)\s+(.+)/i, type: 'running' },
            { pattern: /^(Reading|Analyzing|Checking)\s+(.+)/i, type: 'reading' },
            { pattern: /^(Done|Finished|Complete|Ready|Success)/i, type: 'done' },
            { pattern: /^(Error|Failed|Cannot|Could not)/i, type: 'error' },
            { pattern: /^(Okay|Ok,|I'll|I'm|I will|Let me)\s+(.+)/i, type: 'thinking' },
        ];

        const extractAction = (line) => {
            for (const { pattern, type } of ACTION_PATTERNS) {
                const match = line.match(pattern);
                if (match) return { type, action: match[0].slice(0, 60) };
            }
            return null;
        };

        const processLine = async (line) => {
            if (line.includes('DeprecationWarning')) return;
            if (line.includes('[WARN] Skipping')) return;
            if (line.includes('--trace-deprecation')) return;
            if (line.includes('YOLO mode')) return;
            if (line.includes('Loaded cached')) return;
            if (line.trim() === '') return;

            fullOutput += line + '\n';

            if (line.includes('[CHECKPOINT]')) {
                const summary = line.replace('[CHECKPOINT]', '').trim();
                await agentStore.addCheckpoint(agentId, { summary });
                streamLog(agentId, broadcast, `📍 ${summary}`, 'success');
                broadcastAgentUpdate(agentId, broadcast);
                return;
            }

            if (line.includes('[QUESTION]')) {
                const question = line.replace('[QUESTION]', '').trim();
                await agentStore.addQuestion(agentId, question);
                await agentStore.update(agentId, { status: 'waiting' });
                streamLog(agentId, broadcast, `❓ ${question}`, 'warning');
                broadcastAgentUpdate(agentId, broadcast);
                return;
            }

            const action = extractAction(line);
            if (action && action.type !== 'thinking') {
                stepCount++;
                currentStep = action.action;
                broadcast({
                    type: 'agent:progress',
                    agentId,
                    step: currentStep,
                    stepCount,
                    actionType: action.type
                });
            }

            streamLog(agentId, broadcast, line, 'output');
        };

        child.stdout.on('data', async (data) => {
            const lines = data.toString().split('\n');
            for (const line of lines) {
                await processLine(line);
            }
        });

        child.stderr.on('data', async (data) => {
            const text = data.toString().trim();
            if (text &&
                !text.includes('DeprecationWarning') &&
                !text.includes('[WARN]') &&
                !text.includes('YOLO mode') &&
                !text.includes('Loaded cached') &&
                !text.includes('credentials')) {
                hasError = true;
                streamLog(agentId, broadcast, text, 'error');
            }
        });

        child.on('error', async (err) => {
            hasError = true;
            await agentStore.update(agentId, { status: 'failed' });
            streamLog(agentId, broadcast, `❌ Failed to start: ${err.message}`, 'error');
            broadcastAgentUpdate(agentId, broadcast);
            resolve();
        });

        child.on('close', async (code) => {
            const agent = await agentStore.get(agentId);

            // Record agent's output as a thread entry
            if (fullOutput.trim()) {
                // Summarize: take first 500 chars as the thread content
                const summary = fullOutput.trim().slice(0, 500);
                await agentStore.addThread(agentId, 'agent', summary, {
                    exitCode: code,
                    stepCount,
                    fullLength: fullOutput.length
                });
            }

            if (agent.status !== 'waiting') {
                const unprocessedComments = (agent.comments || []).filter(c => !c.processed);

                if (code === 0 && unprocessedComments.length > 0) {
                    streamLog(agentId, broadcast, `📝 Processing ${unprocessedComments.length} pending comment(s)...`, 'info');
                    broadcastAgentUpdate(agentId, broadcast);
                    resolve();
                    setTimeout(() => executeAgent(agentId, broadcast), 1000);
                    return;
                } else if (code === 0 && !hasError) {
                    await agentStore.update(agentId, { status: 'completed' });
                    streamLog(agentId, broadcast, '✅ Completed!', 'success');
                } else if (code !== 0) {
                    await agentStore.update(agentId, { status: 'failed' });
                    streamLog(agentId, broadcast, `❌ Exited with code ${code}`, 'error');
                }
            }

            broadcastAgentUpdate(agentId, broadcast);
            resolve();
        });

        // Activity timeout
        let activityTimeout;
        const resetActivityTimeout = () => {
            clearTimeout(activityTimeout);
            activityTimeout = setTimeout(async () => {
                child.kill();
                await agentStore.update(agentId, { status: 'failed' });
                streamLog(agentId, broadcast, '⏱️ No activity for 3 minutes', 'error');
                broadcastAgentUpdate(agentId, broadcast);
            }, 180000);
        };
        resetActivityTimeout();
        child.stdout.on('data', resetActivityTimeout);

        // Hard timeout 15 min
        setTimeout(async () => {
            clearTimeout(activityTimeout);
            child.kill();
            await agentStore.update(agentId, { status: 'failed' });
            streamLog(agentId, broadcast, '⏱️ Timed out after 15 minutes', 'error');
            broadcastAgentUpdate(agentId, broadcast);
        }, 900000);
    });
}

async function streamLog(agentId, broadcast, message, type) {
    await agentStore.addLog(agentId, message, type);
    broadcast({
        type: 'agent:log',
        agentId,
        log: { message, type, timestamp: new Date().toISOString() }
    });
}

async function broadcastAgentUpdate(agentId, broadcast) {
    const agent = await agentStore.get(agentId);
    broadcast({ type: 'agent:updated', agent });
}

export async function continueAgent(agentId, broadcast) {
    const agent = await agentStore.get(agentId);
    if (!agent) return;

    const unanswered = (agent.pendingQuestions || []).filter(q => !q.answer);
    if (unanswered.length > 0) return;

    await executeAgent(agentId, broadcast);
}
