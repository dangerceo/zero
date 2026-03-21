import { watch } from 'fs';
import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { agentStore } from './agentStore.js';

// Active watchers: agentId → FSWatcher
const watchers = new Map();

/**
 * Watch conductor/tracks/ inside an agent's working directory.
 * When plan.md changes, parse phases/tasks and sync to agentStore tickets[].
 */
export function watchConductorTracks(agentId, workingDir, broadcast) {
    // Don't double-watch
    if (watchers.has(agentId)) return;

    const tracksDir = join(workingDir, 'conductor', 'tracks');

    // Check if dir exists before watching
    access(tracksDir).then(() => {
        startWatcher(agentId, tracksDir, broadcast);
    }).catch(() => {
        // Dir doesn't exist yet — poll until it does (Conductor creates it on first track)
        const poller = setInterval(async () => {
            try {
                await access(tracksDir);
                clearInterval(poller);
                startWatcher(agentId, tracksDir, broadcast);
            } catch {}
        }, 3000);

        // Stop polling after 5 minutes if nothing happens
        setTimeout(() => clearInterval(poller), 300000);
    });
}

function startWatcher(agentId, tracksDir, broadcast) {
    try {
        const watcher = watch(tracksDir, { recursive: true }, async (event, filename) => {
            if (!filename?.endsWith('plan.md') && !filename?.endsWith('metadata.json')) return;

            // Debounce: wait 500ms for writes to settle
            if (watcher._debounce) clearTimeout(watcher._debounce);
            watcher._debounce = setTimeout(async () => {
                await syncConductorState(agentId, tracksDir, broadcast);
            }, 500);
        });

        watchers.set(agentId, watcher);
        console.log(`🎼 Conductor watcher started for agent ${agentId}`);

        // Initial sync
        syncConductorState(agentId, tracksDir, broadcast);
    } catch (err) {
        console.error(`🎼 Conductor watcher failed for ${agentId}:`, err.message);
    }
}

async function syncConductorState(agentId, tracksDir, broadcast) {
    try {
        const { readdir, stat } = await import('fs/promises');
        const entries = await readdir(tracksDir, { withFileTypes: true });
        const allTickets = [];

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const trackDir = join(tracksDir, entry.name);

            // Read plan.md
            try {
                const planPath = join(trackDir, 'plan.md');
                const content = await readFile(planPath, 'utf-8');
                const tickets = parseConductorPlan(content, entry.name);
                allTickets.push(...tickets);
            } catch {}

            // Read metadata.json for track status
            try {
                const metaPath = join(trackDir, 'metadata.json');
                const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
                // Tag existing tickets with track metadata
                for (const t of allTickets) {
                    if (t.trackId === entry.name) {
                        t.trackStatus = meta.status || 'unknown';
                    }
                }
            } catch {}
        }

        if (allTickets.length > 0) {
            await agentStore.update(agentId, { tickets: allTickets });
            const agent = await agentStore.get(agentId);
            if (agent) {
                broadcast({ type: 'agent:updated', agent });
            }
        }
    } catch (err) {
        // tracksDir might not have any tracks yet
    }
}

/**
 * Parse Conductor's plan.md format into Zero tickets.
 * 
 * Format:
 *   ## Phase 1: Setup
 *   - [ ] Install dependencies
 *   - [x] Create project structure
 */
function parseConductorPlan(markdown, trackId) {
    const tickets = [];
    let currentPhase = null;
    const lines = markdown.split('\n');

    for (const line of lines) {
        // Phase header: "## Phase 1: Setup" or "## Phase: Setup"
        const phaseMatch = line.match(/^##\s+Phase\s*(\d*):\s*(.+)/i);
        if (phaseMatch) {
            const phaseNum = phaseMatch[1] || String(tickets.length + 1);
            currentPhase = {
                id: `${trackId}-phase-${phaseNum}`,
                trackId,
                title: phaseMatch[2].trim(),
                status: 'queued',
                subtasks: [],
                doneCount: 0,
                totalCount: 0
            };
            tickets.push(currentPhase);
            continue;
        }

        // Task line: "- [ ] Do something" or "- [x] Done thing"
        const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)/);
        if (taskMatch && currentPhase) {
            const done = taskMatch[1].toLowerCase() === 'x';
            currentPhase.subtasks.push({
                title: taskMatch[2].trim(),
                done
            });
            currentPhase.totalCount++;
            if (done) currentPhase.doneCount++;
        }
    }

    // Derive phase status from subtask completion
    for (const ticket of tickets) {
        if (ticket.totalCount === 0) {
            ticket.status = 'queued';
        } else if (ticket.doneCount === ticket.totalCount) {
            ticket.status = 'done';
        } else if (ticket.doneCount > 0) {
            ticket.status = 'firing';
        }
    }

    return tickets;
}

export function stopConductorWatcher(agentId) {
    const watcher = watchers.get(agentId);
    if (watcher) {
        watcher.close();
        watchers.delete(agentId);
        console.log(`🎼 Conductor watcher stopped for agent ${agentId}`);
    }
}

export function getActiveWatchers() {
    return Array.from(watchers.keys());
}
