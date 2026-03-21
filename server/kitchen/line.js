import { spawn } from 'child_process';
import { readdir, stat, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { TICKET_STATUS } from './ticket.js';
import { detectIdleSpin } from './wasteTracker.js';

async function getDirectoryFiles(dir) {
    try {
        const entries = await readdir(dir, { withFileTypes: true });
        const files = [];
        for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const path = join(dir, entry.name);
            if (entry.isFile()) files.push(entry.name);
            else if (entry.isDirectory()) {
                const subFiles = await getDirectoryFiles(path);
                files.push(...subFiles.map(f => entry.name + '/' + f));
            }
        }
        return files;
    } catch { return []; }
}

export async function fireTicket(ticket, workingDir, orderContext, onUpdate) {
    const notify = (event, data = {}) => {
        if (onUpdate) onUpdate(ticket, { event, ...data });
    };

    console.log('[LINE] Starting ticket: ' + ticket.title);
    ticket.status = TICKET_STATUS.PREP;
    ticket.startedAt = new Date().toISOString();
    notify('prep');

    await mkdir(workingDir, { recursive: true });
    const existingFiles = await getDirectoryFiles(workingDir);

    let prompt = 'You are executing a specific ticket in a larger project.\n\n';
    prompt += 'PROJECT GOAL: ' + orderContext.goal + '\n\n';
    prompt += 'YOUR TICKET: ' + ticket.title + '\n';
    prompt += 'DESCRIPTION: ' + ticket.description + '\n\n';
    prompt += 'ACCEPTANCE CRITERIA:\n';
    ticket.acceptance.forEach((a, i) => { prompt += '  ' + (i + 1) + '. ' + a + '\n'; });
    prompt += '\nWORKING DIRECTORY: ' + workingDir + '\n';

    if (existingFiles.length > 0) prompt += '\nEXISTING FILES:\n' + existingFiles.join('\n') + '\n';

    if (orderContext.completedTickets && orderContext.completedTickets.length > 0) {
        prompt += '\nPREVIOUSLY COMPLETED WORK:\n';
        for (const ct of orderContext.completedTickets) {
            prompt += '- ' + ct.title + ': ' + (ct.outputSummary || 'done');
            if (ct.filesChanged.length > 0) prompt += ' (files: ' + ct.filesChanged.join(', ') + ')';
            prompt += '\n';
        }
    }

    prompt += '\nFOCUS: Complete ONLY this ticket. Do not work on other tasks.\nWhen done, summarize what you did.\n';

    ticket.status = TICKET_STATUS.FIRING;
    notify('firing');

    const result = await runGeminiForTicket(prompt, workingDir, ticket, notify);

    ticket.status = TICKET_STATUS.PLATING;
    notify('plating');

    const afterFiles = await getDirectoryFiles(workingDir);
    const newFiles = afterFiles.filter(f => !existingFiles.includes(f));
    ticket.filesChanged = newFiles.length > 0 ? newFiles : afterFiles.slice(0, 10);
    ticket.outputSummary = result.summary;
    ticket.actualTokens = result.tokenEstimate;

    const idleWaste = detectIdleSpin(ticket, result.outputLength, ticket.filesChanged);
    if (idleWaste) ticket.wasteFlags.push(idleWaste);

    if (result.exitCode === 0) {
        ticket.status = TICKET_STATUS.DONE;
        ticket.completedAt = new Date().toISOString();
        notify('done');
    } else {
        ticket.status = TICKET_STATUS.FAILED;
        ticket.completedAt = new Date().toISOString();
        // Specifically detect process death
        const deathReason = result.signal ? 'Killed by signal ' + result.signal : 'Exited with code ' + result.exitCode;
        notify('failed', { exitCode: result.exitCode, signal: result.signal, error: result.error || 'Worker thread died unexpectedly (' + deathReason + ')' });
    }

    return ticket;
}

function runGeminiForTicket(prompt, workingDir, ticket, notify) {
    return new Promise((resolve) => {
        const child = spawn('gemini', ['--yolo', '--output-format', 'json', prompt], {
            cwd: workingDir,
            env: { ...process.env }
        });

        child.stdin.end();

        let fullOutput = '';
        let lastText = '';
        let stepCount = 0;
        let hasError = false;
        let errorMsg = '';
        let buffer = '';

        child.stdout.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.type === 'text') {
                        fullOutput += parsed.text;
                        lastText = parsed.text;
                        if (parsed.text.length < 200) notify('output', { text: parsed.text });
                    }
                    if (parsed.type === 'call') {
                        stepCount++;
                        const step = parsed.call.name + '(' + Object.keys(parsed.call.args || {}).join(', ') + ')';
                        notify('step', { step, stepCount });
                    }
                    if (parsed.type === 'error') {
                        hasError = true;
                        errorMsg = parsed.error;
                        notify('error', { error: parsed.error });
                    }
                } catch {
                    if (line.trim()) {
                        fullOutput += line;
                        notify('output', { text: line });
                    }
                }
            }
        });

        child.stderr.on('data', (data) => {
            const text = data.toString().trim();
            if (text && !text.includes('DeprecationWarning') && !text.includes('[WARN]') && !text.includes('YOLO mode') && !text.includes('Loaded cached') && !text.includes('credentials')) {
                hasError = true;
                errorMsg = text;
            }
        });

        child.on('error', (err) => {
            resolve({ exitCode: 1, summary: 'Failed to start gemini: ' + err.message, outputLength: 0, tokenEstimate: 0, error: err.message });
        });

        child.on('close', (code, signal) => {
            const tokenEstimate = Math.round(fullOutput.length / 4);
            const summary = lastText.slice(0, 300) || 'Completed';
            resolve({ exitCode: code, signal, summary, outputLength: fullOutput.length, tokenEstimate, error: hasError ? errorMsg : null });
        });
    });
}
