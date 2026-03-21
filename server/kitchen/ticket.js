import { v4 as uuidv4 } from 'uuid';

// Ticket statuses mirror kitchen workflow
export const TICKET_STATUS = {
    QUEUED: 'queued',     // On the board, waiting
    PREP: 'prep',         // Gathering files/context (mise en place)
    FIRING: 'firing',     // Gemini CLI is actively executing
    PLATING: 'plating',   // Summarizing output, listing file changes
    DONE: 'done',         // Complete, acceptance criteria met
    EIGHTY_SIXED: '86d',  // Cancelled / no longer needed
    FAILED: 'failed'      // Execution failed
};

export const TICKET_PRIORITY = {
    FIRE: 1,      // Urgent, do now
    NEXT: 2,      // Up next
    BACKLOG: 3    // Can wait
};

/**
 * Create a new Ticket — the atomic unit of work in the Kitchen.
 */
export function createTicket(data) {
    return {
        id: uuidv4(),
        orderId: data.orderId,                          // Parent agent/order ID
        title: data.title || 'Untitled ticket',
        description: data.description || '',
        acceptance: data.acceptance || [],               // How BOH knows it's done
        priority: data.priority || TICKET_PRIORITY.NEXT,
        station: null,                                   // Which gemini process is on it
        status: TICKET_STATUS.QUEUED,
        dependencies: data.dependencies || [],           // Ticket IDs that must finish first
        estimatedTokens: data.estimatedTokens || null,
        actualTokens: 0,
        outputSummary: '',
        filesChanged: [],
        wasteFlags: [],
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null
    };
}

/**
 * Check if a ticket's dependencies are all met within a list of tickets.
 */
export function areDependenciesMet(ticket, allTickets) {
    if (!ticket.dependencies || ticket.dependencies.length === 0) return true;
    return ticket.dependencies.every(depId => {
        const dep = allTickets.find(t => t.id === depId);
        return dep && (dep.status === TICKET_STATUS.DONE);
    });
}

/**
 * Get the next ticket to fire: queued, dependencies met, highest priority.
 */
export function getNextTicket(tickets) {
    const ready = tickets
        .filter(t => t.status === TICKET_STATUS.QUEUED)
        .filter(t => areDependenciesMet(t, tickets))
        .sort((a, b) => a.priority - b.priority);
    return ready[0] || null;
}

/**
 * Validate tickets from Expo: each must have a title, description, and acceptance criteria.
 */
export function validateTickets(tickets) {
    const errors = [];
    const ids = new Set(tickets.map(t => t.id));

    for (const ticket of tickets) {
        if (!ticket.title || ticket.title === 'Untitled ticket') {
            errors.push(`Ticket ${ticket.id}: missing title`);
        }
        if (!ticket.description) {
            errors.push(`Ticket ${ticket.id}: missing description`);
        }
        if (!ticket.acceptance || ticket.acceptance.length === 0) {
            errors.push(`Ticket ${ticket.id}: missing acceptance criteria`);
        }
        // Check for dangling dependencies
        for (const depId of (ticket.dependencies || [])) {
            if (!ids.has(depId)) {
                errors.push(`Ticket ${ticket.id}: dependency ${depId} not found`);
            }
        }
    }

    // Check for circular dependencies
    const visited = new Set();
    const inStack = new Set();

    function hasCycle(id) {
        if (inStack.has(id)) return true;
        if (visited.has(id)) return false;
        visited.add(id);
        inStack.add(id);
        const ticket = tickets.find(t => t.id === id);
        if (ticket) {
            for (const depId of (ticket.dependencies || [])) {
                if (hasCycle(depId)) return true;
            }
        }
        inStack.delete(id);
        return false;
    }

    for (const ticket of tickets) {
        visited.clear();
        inStack.clear();
        if (hasCycle(ticket.id)) {
            errors.push(`Circular dependency detected involving ticket ${ticket.id}`);
            break;
        }
    }

    return { valid: errors.length === 0, errors };
}
