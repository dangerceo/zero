import { projectStore } from './projectStore.js';
import { spawn } from 'child_process';
import { mkdir, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const PROJECTS_DIR = join(homedir(), 'ZeroProjects');

const PROJECT_SYSTEM_INSTRUCTION = `You are working on a Zero Computer project. Work autonomously and show your progress.

IMPORTANT:
1. After completing a significant milestone, output: [CHECKPOINT] <description>
2. If you need user input, output: [QUESTION] <your question>
3. Show what you're doing as you work
4. Use the existing files in the project - don't start over
5. Test your code

Complete the full goal, not just the first step.`;

// Get file list from project directory
async function getProjectFiles(dir) {
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

export async function executeProject(projectId, broadcast) {
    const project = await projectStore.get(projectId);
    if (!project) return;

    const projectDir = project.workingDir || join(PROJECTS_DIR, project.id);

    try {
        await mkdir(projectDir, { recursive: true });
    } catch (e) {
        await projectStore.update(projectId, { status: 'failed' });
        streamLog(projectId, broadcast, `❌ Failed to create directory: ${e.message}`, 'error');
        broadcastProjectUpdate(projectId, broadcast);
        return;
    }

    // Get existing files for context
    const fileList = await getProjectFiles(projectDir);

    // Start immediately - no confidence assessment delay
    await projectStore.update(projectId, {
        workingDir: projectDir,
        status: 'working',
        startedAt: new Date().toISOString()
    });

    broadcastProjectUpdate(projectId, broadcast);
    streamLog(projectId, broadcast, '🚀 Starting work...', 'info');

    try {
        // Build prompt with full context
        let prompt = `${PROJECT_SYSTEM_INSTRUCTION}\n\n`;
        prompt += `PROJECT GOAL: ${project.goal}\n`;
        prompt += `WORKING DIRECTORY: ${projectDir}\n\n`;

        // Include existing files
        if (fileList.length > 0) {
            prompt += `EXISTING FILES:\n${fileList.join('\n')}\n\n`;
            prompt += `These files already exist - build on them, don't start over.\n\n`;
        }

        // Include completed checkpoints
        if (project.checkpoints?.length > 0) {
            prompt += `COMPLETED CHECKPOINTS:\n`;
            project.checkpoints.forEach((cp, i) => {
                prompt += `${i + 1}. ${cp.summary}\n`;
            });
            prompt += `\nContinue from where we left off.\n\n`;
        }

        // Include answered questions
        const answeredQuestions = (project.pendingQuestions || []).filter(q => q.answer);
        if (answeredQuestions.length > 0) {
            prompt += `USER ANSWERS:\n`;
            for (const q of answeredQuestions) {
                prompt += `Q: ${q.question}\nA: ${q.answer}\n\n`;
            }
        }

        // Include unprocessed comments (follow-up instructions)
        const unprocessedComments = (project.comments || []).filter(c => !c.processed);
        if (unprocessedComments.length > 0) {
            streamLog(projectId, broadcast, `📝 Processing ${unprocessedComments.length} follow-up instruction(s)...`, 'info');
            prompt += `\n\nIMPORTANT - FOLLOW-UP INSTRUCTIONS FROM USER (address these first):\n`;
            for (const c of unprocessedComments) {
                prompt += `• ${c.text}\n`;
                streamLog(projectId, broadcast, `  → ${c.text}`, 'output');
                await projectStore.markCommentProcessed(projectId, c.id);
            }
            prompt += `\nPrioritize these instructions before continuing other work.\n`;
        }

        prompt += `Begin now.`;

        streamLog(projectId, broadcast, '🤖 Gemini is working...', 'info');
        await runGeminiStreaming(projectId, prompt, projectDir, broadcast);

    } catch (error) {
        console.error('Project execution error:', error);
        await projectStore.update(projectId, { status: 'failed' });
        streamLog(projectId, broadcast, `❌ Error: ${error.message}`, 'error');
        broadcastProjectUpdate(projectId, broadcast);
    }
}

async function runGeminiStreaming(projectId, prompt, workingDir, broadcast) {
    return new Promise(async (resolve) => {
        const child = spawn('gemini', ['--yolo', '--output-format', 'text', prompt], {
            cwd: workingDir,
            env: { ...process.env }
        });

        let hasError = false;
        let currentStep = 'Starting...';
        let stepCount = 0;

        // Patterns to extract meaningful actions
        const ACTION_PATTERNS = [
            { pattern: /^(Creating|Making|Initializing|Setting up)\s+(.+)/i, type: 'creating' },
            { pattern: /^(Installing|Adding|Downloading)\s+(.+)/i, type: 'installing' },
            { pattern: /^(Writing|Editing|Updating|Modifying)\s+(.+)/i, type: 'writing' },
            { pattern: /^(Running|Executing|Starting|Building)\s+(.+)/i, type: 'running' },
            { pattern: /^(Done|Finished|Complete|Ready|Success)/i, type: 'done' },
            { pattern: /^(Error|Failed|Cannot|Could not)/i, type: 'error' },
            { pattern: /^(Okay|Ok,|I'll|I'm|I will|Let me)\s+(.+)/i, type: 'thinking' },
        ];

        const extractAction = (line) => {
            for (const { pattern, type } of ACTION_PATTERNS) {
                const match = line.match(pattern);
                if (match) {
                    return { type, action: match[0].slice(0, 50) };
                }
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

            if (line.includes('[CHECKPOINT]')) {
                const summary = line.replace('[CHECKPOINT]', '').trim();
                await projectStore.addCheckpoint(projectId, { summary });
                streamLog(projectId, broadcast, `📍 ${summary}`, 'success');
                broadcastProjectUpdate(projectId, broadcast);
                return;
            }

            if (line.includes('[QUESTION]')) {
                const question = line.replace('[QUESTION]', '').trim();
                await projectStore.addQuestion(projectId, question);
                await projectStore.update(projectId, { status: 'waiting' });
                streamLog(projectId, broadcast, `❓ ${question}`, 'warning');
                broadcastProjectUpdate(projectId, broadcast);
                return;
            }

            // Extract key actions for progress
            const action = extractAction(line);
            if (action && action.type !== 'thinking') {
                stepCount++;
                currentStep = action.action;

                // Send structured progress event
                broadcast({
                    type: 'project:progress',
                    projectId,
                    step: currentStep,
                    stepCount,
                    actionType: action.type
                });
            }

            // Still log for full output (collapsible)
            streamLog(projectId, broadcast, line, 'output');
        };

        child.stdout.on('data', async (data) => {
            const lines = data.toString().split('\n');
            for (const line of lines) {
                await processLine(line);
            }
        });

        child.stderr.on('data', async (data) => {
            const text = data.toString().trim();
            // Filter out known non-error messages from gemini
            if (text &&
                !text.includes('DeprecationWarning') &&
                !text.includes('[WARN]') &&
                !text.includes('YOLO mode') &&
                !text.includes('Loaded cached') &&
                !text.includes('credentials')) {
                hasError = true;
                streamLog(projectId, broadcast, text, 'error');
            }
        });

        child.on('error', async (err) => {
            hasError = true;
            await projectStore.update(projectId, { status: 'failed' });
            streamLog(projectId, broadcast, `❌ Failed to start: ${err.message}`, 'error');
            broadcastProjectUpdate(projectId, broadcast);
            resolve();
        });

        child.on('close', async (code) => {
            const project = await projectStore.get(projectId);

            if (project.status !== 'waiting') {
                // Check for pending comments before marking complete
                const unprocessedComments = (project.comments || []).filter(c => !c.processed);

                if (code === 0 && unprocessedComments.length > 0) {
                    // More work to do - re-run with comments
                    streamLog(projectId, broadcast, `📝 Processing ${unprocessedComments.length} pending comment(s)...`, 'info');
                    broadcastProjectUpdate(projectId, broadcast);
                    resolve();
                    // Schedule continuation after a brief delay
                    setTimeout(() => executeProject(projectId, broadcast), 1000);
                    return;
                } else if (code === 0 && !hasError) {
                    await projectStore.update(projectId, { status: 'completed' });
                    streamLog(projectId, broadcast, '✅ Project completed!', 'success');
                } else if (code !== 0) {
                    await projectStore.update(projectId, { status: 'failed' });
                    streamLog(projectId, broadcast, `❌ Exited with code ${code}`, 'error');
                }
            }

            broadcastProjectUpdate(projectId, broadcast);
            resolve();
        });

        // Activity timeout - reset every time we get output
        let activityTimeout;
        const resetActivityTimeout = () => {
            clearTimeout(activityTimeout);
            activityTimeout = setTimeout(async () => {
                child.kill();
                await projectStore.update(projectId, { status: 'failed' });
                streamLog(projectId, broadcast, '⏱️ No activity for 3 minutes - timed out', 'error');
                broadcastProjectUpdate(projectId, broadcast);
            }, 180000); // 3 minutes of no activity
        };
        resetActivityTimeout();

        // Also reset on stdout
        child.stdout.on('data', resetActivityTimeout);

        // Hard timeout after 15 minutes regardless
        setTimeout(async () => {
            clearTimeout(activityTimeout);
            child.kill();
            await projectStore.update(projectId, { status: 'failed' });
            streamLog(projectId, broadcast, '⏱️ Timed out after 15 minutes', 'error');
            broadcastProjectUpdate(projectId, broadcast);
        }, 900000);
    });
}

async function streamLog(projectId, broadcast, message, type) {
    await projectStore.addLog(projectId, message, type);
    broadcast({
        type: 'project:log',
        projectId,
        log: { message, type, timestamp: new Date().toISOString() }
    });
}

async function broadcastProjectUpdate(projectId, broadcast) {
    const project = await projectStore.get(projectId);
    broadcast({ type: 'project:updated', project });
}

export async function continueProject(projectId, broadcast) {
    const project = await projectStore.get(projectId);
    if (!project) return;

    const unanswered = (project.pendingQuestions || []).filter(q => !q.answer);
    if (unanswered.length > 0) return;

    await executeProject(projectId, broadcast);
}
