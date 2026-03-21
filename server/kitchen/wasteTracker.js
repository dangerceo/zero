import { TICKET_STATUS } from './ticket.js';

/**
 * Waste flags — types of inefficiency the Kitchen detects.
 */
export const WASTE_TYPE = {
    IDLE_SPIN: 'idle_spin',           // Agent talking but not changing files
    TOKEN_OVERRUN: 'token_overrun',   // Actual tokens >> estimated
    DUPLICATE_WORK: 'duplicate_work', // Two tickets touching same files
    ABANDONED: 'abandoned',           // Ticket queued but never started
    RETRY_STORM: 'retry_storm'        // Same ticket failing repeatedly
};

/**
 * Check for idle spin: the agent produced N characters of output
 * but changed 0 files. Classic "thinking out loud" waste.
 */
export function detectIdleSpin(ticket, outputLength, filesChanged) {
    if (outputLength > 1000 && filesChanged.length === 0) {
        return {
            type: WASTE_TYPE.IDLE_SPIN,
            detail: `${outputLength} chars of output, 0 files changed`,
            severity: outputLength > 5000 ? 'high' : 'medium'
        };
    }
    return null;
}

/**
 * Check for token overrun: actual consumption > 2x estimate.
 */
export function detectTokenOverrun(ticket) {
    if (ticket.estimatedTokens && ticket.actualTokens > ticket.estimatedTokens * 2) {
        return {
            type: WASTE_TYPE.TOKEN_OVERRUN,
            detail: `Estimated ${ticket.estimatedTokens}, used ${ticket.actualTokens} (${Math.round(ticket.actualTokens / ticket.estimatedTokens)}x)`,
            severity: ticket.actualTokens > ticket.estimatedTokens * 5 ? 'high' : 'medium'
        };
    }
    return null;
}

/**
 * Check for duplicate work: two tickets modified the same file(s).
 */
export function detectDuplicateWork(tickets) {
    const flags = [];
    const fileMap = new Map(); // file → [ticket IDs that touched it]

    for (const ticket of tickets) {
        for (const file of (ticket.filesChanged || [])) {
            if (!fileMap.has(file)) fileMap.set(file, []);
            fileMap.get(file).push(ticket.id);
        }
    }

    for (const [file, ticketIds] of fileMap) {
        if (ticketIds.length > 1) {
            flags.push({
                type: WASTE_TYPE.DUPLICATE_WORK,
                detail: `${file} modified by ${ticketIds.length} tickets: ${ticketIds.join(', ')}`,
                severity: 'medium'
            });
        }
    }

    return flags;
}

/**
 * Generate a waste report for an order (agent).
 */
export function generateWasteReport(tickets) {
    const report = {
        totalTickets: tickets.length,
        completed: tickets.filter(t => t.status === TICKET_STATUS.DONE).length,
        cancelled: tickets.filter(t => t.status === TICKET_STATUS.EIGHTY_SIXED).length,
        failed: tickets.filter(t => t.status === TICKET_STATUS.FAILED).length,
        estimatedTokens: 0,
        actualTokens: 0,
        wasteFlags: [],
        efficiency: 1.0
    };

    for (const ticket of tickets) {
        if (ticket.estimatedTokens) report.estimatedTokens += ticket.estimatedTokens;
        report.actualTokens += ticket.actualTokens || 0;

        // Collect waste flags from individual tickets
        report.wasteFlags.push(...(ticket.wasteFlags || []));

        // Check for token overrun
        const overrun = detectTokenOverrun(ticket);
        if (overrun) report.wasteFlags.push(overrun);
    }

    // Check for duplicate work across all tickets
    report.wasteFlags.push(...detectDuplicateWork(tickets));

    // Check for abandoned tickets
    const abandoned = tickets.filter(t =>
        t.status === TICKET_STATUS.QUEUED &&
        tickets.some(other => other.status === TICKET_STATUS.DONE)
    );
    for (const t of abandoned) {
        report.wasteFlags.push({
            type: WASTE_TYPE.ABANDONED,
            detail: `Ticket "${t.title}" was never started`,
            severity: 'low'
        });
    }

    // Efficiency: ratio of estimated to actual tokens (clamped 0-1)
    if (report.estimatedTokens > 0 && report.actualTokens > 0) {
        report.efficiency = Math.min(1, report.estimatedTokens / report.actualTokens);
    }

    return report;
}
