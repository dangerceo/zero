import { agentStore } from '../agentStore.js';
import { decompose, replan, suggestNextSteps } from './expo.js';
import { fireTicket } from './line.js';
import { getNextTicket, validateTickets, TICKET_STATUS } from './ticket.js';
import { chromium } from 'playwright';
import { join } from 'path';
import { writeFile } from 'fs/promises';

export async function runKitchen(agentId, broadcast) {
    const agent = await agentStore.get(agentId);
    if (!agent) return;
    const workingDir = agent.workingDir;

    const log = (msg, type = 'info') => {
        agentStore.addLog(agentId, msg, type);
        broadcast({ type: 'agent:log', agentId, log: { message: msg, type, timestamp: new Date().toISOString() } });
    };

    const broadcastUpdate = async () => {
        const updated = await agentStore.get(agentId);
        broadcast({ type: 'agent:updated', agent: updated });
    };

    try {
        await agentStore.update(agentId, { status: 'planning' });
        await broadcastUpdate();
        log('🎩 Expo is planning the order...', 'info');

        const context = { existingFiles: [], checkpoints: agent.checkpoints || [] };
        try {
            const { readdir } = await import('fs/promises');
            const entries = await readdir(workingDir);
            context.existingFiles = entries.filter(f => !f.startsWith('.') && f !== 'node_modules').slice(0, 50);
        } catch (e) { }

        let tickets;
        try {
            tickets = await decompose(agentId, agent.goal, context);
            if (!tickets || tickets.length === 0) throw new Error('Expo returned no tickets');
        } catch (error) {
            log('❌ Expo failed: ' + error.message, 'error');
            throw error;
        }

        const validation = validateTickets(tickets);
        if (!validation.valid) log('⚠️ Ticket validation issues: ' + validation.errors.join('; '), 'warning');

        await agentStore.update(agentId, { tickets, status: 'running' });
        await broadcastUpdate();

        log('📋 ' + tickets.length + ' ticket(s) on the board', 'info');

        let retryCount = {};
        while (true) {
            const refreshed = await agentStore.get(agentId);
            const allTickets = refreshed.tickets || [];
            const nextTicket = getNextTicket(allTickets);
            if (!nextTicket) break;

            const completedTickets = allTickets.filter(t => t.status === TICKET_STATUS.DONE);
            const updatedTicket = await fireTicket(nextTicket, workingDir, { goal: agent.goal, completedTickets }, (ticket, event) => {
                if (event.event === 'failed') {
                    log('💀 WORKER DIED: ' + ticket.title, 'error');
                } else if (event.event === 'done') {
                    log('✅ ' + ticket.title + ' — done', 'success');
                }
                broadcast({ type: 'ticket:updated', agentId, ticket });
            });

            const ticketIndex = allTickets.findIndex(t => t.id === updatedTicket.id);
            if (ticketIndex >= 0) allTickets[ticketIndex] = updatedTicket;
            await agentStore.update(agentId, { tickets: allTickets });

            if (updatedTicket.status === TICKET_STATUS.FAILED) {
                const key = updatedTicket.id;
                retryCount[key] = (retryCount[key] || 0) + 1;
                if (retryCount[key] < 2) {
                    log('🔄 Retrying ticket: ' + updatedTicket.title, 'warning');
                    updatedTicket.status = TICKET_STATUS.QUEUED;
                    await agentStore.update(agentId, { tickets: allTickets });
                } else {
                    updatedTicket.status = TICKET_STATUS.EIGHTY_SIXED;
                    await agentStore.update(agentId, { tickets: allTickets });
                }
            }
            broadcast({ type: 'ticket:completed', agentId, ticket: updatedTicket });
            await broadcastUpdate();
        }

        const finalAgent = await agentStore.get(agentId);
        const finalTickets = finalAgent.tickets || [];
        const doneCount = finalTickets.filter(t => t.status === TICKET_STATUS.DONE).length;
        
        try {
            log('📸 Taking completion screenshot...', 'info');
            const browser = await chromium.launch();
            const page = await browser.newPage();
            await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 5000 }).catch(() => {});
            const buffer = await page.screenshot();
            await writeFile(join(workingDir, 'completion-screenshot.png'), buffer);
            await browser.close();
            log('✅ Screenshot saved: completion-screenshot.png', 'success');
        } catch (e) { }

        log('\n🍽️ Order complete: ' + doneCount + '/' + finalTickets.length + ' done', 'success');
        await agentStore.update(agentId, { status: 'completed', completedAt: new Date().toISOString() });
        await broadcastUpdate();
    } catch (error) { 
        log('❌ Kitchen Error: ' + error.message, 'error');
        await agentStore.update(agentId, { status: 'failed' });
        await broadcastUpdate();
    }
}
