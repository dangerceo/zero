import React, { useState } from 'react';

const STATUS_CONFIG = {
    queued: { emoji: '⏳', label: 'Queued' },
    prep: { emoji: '🔪', label: 'Prep' },
    firing: { emoji: '🔥', label: 'Firing' },
    plating: { emoji: '🍽️', label: 'Plating' },
    done: { emoji: '✅', label: 'Done' },
    '86d': { emoji: '🗑️', label: "86'd" },
    failed: { emoji: '💀', label: 'Died' }, // Separate graveyard
};

function isTicketBlocked(ticket, tickets) {
    if (!ticket.dependencies || ticket.dependencies.length === 0) return false;
    return ticket.dependencies.some(depId => {
        const dep = tickets.find(t => t.id === depId);
        return !dep || dep.status !== 'done';
    });
}

function getUnmetDependencies(ticket, tickets) {
    if (!ticket.dependencies) return [];
    return ticket.dependencies.reduce((unmet, depId) => {
        const dep = tickets.find(t => t.id === depId);
        if (!dep || dep.status !== 'done') {
            unmet.push(dep ? dep.title : depId.slice(0, 8));
        }
        return unmet;
    }, []);
}

const COLUMNS = [
    { name: 'Blocked / Waiting', filter: (t, tickets) => t.status === 'queued' && isTicketBlocked(t, tickets) },
    { name: 'Ready', filter: (t, tickets) => t.status === 'queued' && !isTicketBlocked(t, tickets) },
    { name: 'The Line', filter: (t, tickets) => ['prep', 'firing', 'plating'].includes(t.status) },
    { name: 'Completed', filter: (t, tickets) => ['done', '86d'].includes(t.status) }
];

function TicketCard({ ticket, allTickets }) {
    const cfg = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.queued;
    const isDone = ticket.status === 'done';
    const isFailed = ticket.status === 'failed' || ticket.status === '86d';
    const isBlocked = ticket.status === 'queued' && isTicketBlocked(ticket, allTickets || []);
    const unmetDeps = isBlocked ? getUnmetDependencies(ticket, allTickets || []) : [];

    return (
        <div className={'kds-ticket ' + (isFailed ? 'kds-ticket-failed' : isDone ? 'kds-ticket-done' : '')}>
            <div className='kds-ticket-header' style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <span className='kds-ticket-emoji'>{cfg.emoji}</span>
                    <span className='kds-ticket-title'>{ticket.title}</span>
                </div>
                {ticket.estimatedTokens && !isDone && !isFailed && (
                    <span className='kds-ticket-tokens' style={{ fontSize: '10px', color: 'var(--fg3)', whiteSpace: 'nowrap' }}>
                        ~{ticket.estimatedTokens} tkns
                    </span>
                )}
            </div>

            {isBlocked && unmetDeps.length > 0 && (
                <div className='kds-ticket-blocked-info' style={{ marginTop: '8px', fontSize: '10px', padding: '6px', background: 'rgba(255, 150, 0, 0.1)', borderLeft: '2px solid orange', borderRadius: '4px' }}>
                    <div style={{ color: 'orange', fontWeight: 'bold', marginBottom: '4px' }}>Waiting on:</div>
                    <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--fg2)' }}>
                        {unmetDeps.map((dep, i) => <li key={i}>{dep}</li>)}
                    </ul>
                </div>
            )}

            {ticket.status === 'failed' && (
                <div className='graveyard-logs'>
                    <div className='death-label'>💀 WORKER DIED</div>
                    {ticket.outputSummary && <div className='death-logs'>{ticket.outputSummary}</div>}
                </div>
            )}
            {!isFailed && ticket.outputSummary && (
                <div className='kds-ticket-summary' style={{ marginTop: '8px', fontSize: '11px', color: 'var(--fg2)' }}>
                    {ticket.outputSummary.slice(0, 100)}
                </div>
            )}
        </div>
    );
}

export default function KitchenDisplay({ tickets = [] }) {
    const [showGraveyard, setShowGraveyard] = useState(false);

    if (tickets.length === 0) return null;

    const boardTickets = tickets.filter(t => t.status !== 'failed');
    const deadTickets = tickets.filter(t => t.status === 'failed');

    const columns = COLUMNS.map(colDef => ({
        name: colDef.name,
        tickets: boardTickets.filter(t => colDef.filter(t, tickets))
    }));

    return (
        <div className='kds'>
            <div className='kds-header'>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <span className='kds-title'>🍳 The Pass</span>
                    {deadTickets.length > 0 && (
                        <button
                            className={'mini-btn ' + (showGraveyard ? 'active' : '')}
                            onClick={() => setShowGraveyard(!showGraveyard)}
                            style={{ color: 'var(--error)', borderColor: 'var(--error)' }}
                        >
                            💀 Graveyard ({deadTickets.length})
                        </button>
                    )}
                </div>
            </div>

            {showGraveyard ? (
                <div className='kitchen-graveyard' style={{ padding: '16px', background: 'rgba(217, 74, 74, 0.05)', borderRadius: '8px', border: '1px solid var(--error)', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '12px', textTransform: 'uppercase', marginBottom: '12px', color: 'var(--error)' }}>Recent Casualties</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                        {deadTickets.map(t => <TicketCard key={t.id} ticket={t} allTickets={tickets} />)}
                    </div>
                </div>
            ) : (
                <div className='kds-board'>
                    {columns.map((col) => (
                        <div key={col.name} className='kds-column'>
                            <div className='kds-column-header'>
                                {col.name}
                                {col.tickets.length > 0 && <span className='kds-column-count'>{col.tickets.length}</span>}
                            </div>
                            <div className='kds-column-body'>
                                {col.tickets.map(t => <TicketCard key={t.id} ticket={t} allTickets={tickets} />)}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{".graveyard-logs { margin-top: 8px; font-family: var(--mono); } .death-label { font-size: 9px; font-weight: 900; color: var(--error); letter-spacing: 1px; } .death-logs { font-size: 10px; background: #000; color: #ff5f56; padding: 6px; border-radius: 4px; margin-top: 4px; max-height: 80px; overflow-y: auto; white-space: pre-wrap; border: 1px solid #333; } .kds-column { min-width: 200px; }"}</style>
        </div>
    );
}
