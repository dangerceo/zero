import React, { useState, useEffect, useRef } from 'react';

function MemoryDetail({ memoryId, onBack, embedded = false }) {
    const [memory, setMemory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDetails, setShowDetails] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        setLoading(true);
        fetch('/api/pebble/zero/history/full?id=' + encodeURIComponent(memoryId))
            .then(res => res.json())
            .then(data => {
                setMemory(data);
                setLoading(false);
            })
            .catch(e => {
                console.error(e);
                setLoading(false);
            });
    }, [memoryId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [memory, showDetails]);

    if (loading) return <div style={{ padding: '32px' }}>Loading memory...</div>;
    if (!memory) return <div style={{ padding: '32px' }}>Memory not found</div>;

    // Compression Logic: Group 'I will...' statements or tool-heavy sequences
    const compressedMessages = [];
    let buffer = [];

    const flushBuffer = () => {
        if (buffer.length > 0) {
            compressedMessages.push({
                type: 'compressed-actions',
                count: buffer.length,
                summary: buffer.map(m => m.content.slice(0, 40) + '...').join('\n')
            });
            buffer = [];
        }
    };

    memory.messages.forEach((msg) => {
        const isAction = msg.role === 'assistant' && 
                         (msg.content.toLowerCase().startsWith('i will') || 
                          msg.content.toLowerCase().startsWith('ok, i will') ||
                          (msg.toolCalls && msg.toolCalls.length > 0));

        if (isAction && !showDetails) {
            buffer.push(msg);
        } else {
            flushBuffer();
            compressedMessages.push(msg);
        }
    });
    flushBuffer();

    return (
        <div className={embedded ? 'agent-detail-embedded' : 'zero-app memory-view'}>
            <header className='detail-header'>
                {!embedded && <button className='back-btn' onClick={onBack} title="Back">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>}
                <div className='detail-title'>
                    <h1>{memory.name}</h1>
                    <div className='status-row'>
                        <span className='status-label s-completed'>Archived Session</span>
                        <div className='view-toggle' style={{ marginLeft: '12px' }}>
                            <button 
                                className={'v-btn ' + (showDetails ? 'active' : '')}
                                onClick={() => setShowDetails(!showDetails)}
                                style={{ fontSize: '10px', padding: '2px 8px' }}
                            >
                                {showDetails ? 'Condensed' : 'Detailed'}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <section className='unified-chat v-chat'>
                {compressedMessages.map((msg, i) => {
                    if (msg.type === 'compressed-actions') {
                        return (
                            <div key={i} className='chat-checkpoint' style={{ cursor: 'help' }} title={msg.summary}>
                                ⚡️ {msg.count} actions compressed
                            </div>
                        );
                    }

                    return (
                        <React.Fragment key={i}>
                            {showDetails && msg.thoughts && msg.thoughts.length > 0 && (
                                <div className='thought-block' style={{ margin: '8px 32px', padding: '8px 12px', background: 'var(--bg2)', borderLeft: '2px solid var(--fg3)', fontSize: '12px', color: 'var(--fg3)', borderRadius: '4px' }}>
                                    <div style={{ fontWeight: 'bold', marginBottom: '4px', opacity: 0.7 }}>THOUGHTS:</div>
                                    {msg.thoughts.map((t, ti) => (
                                        <div key={ti} style={{ marginBottom: '4px' }}>
                                            <span style={{ color: 'var(--accent)' }}>• {t.subject}:</span> {t.description}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {showDetails && msg.toolCalls && msg.toolCalls.length > 0 && (
                                <div className='tool-block' style={{ margin: '8px 32px', padding: '8px 12px', background: 'var(--bg2)', borderLeft: '2px solid var(--accent)', fontSize: '11px', fontFamily: 'var(--mono)', color: 'var(--fg2)', borderRadius: '4px' }}>
                                    {msg.toolCalls.map((tc, tci) => (
                                        <div key={tci} style={{ marginBottom: '2px' }}>
                                            <span style={{ opacity: 0.6 }}>λ</span> {tc.name}(...)
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className={'thread-entry t-' + msg.role}>
                                <div className='thread-role'>{msg.role === 'user' ? 'You' : 'Zero'}</div>
                                <div className='thread-content' style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                                    {msg.content}
                                </div>
                            </div>
                        </React.Fragment>
                    );
                })}
                <div ref={messagesEndRef} />
            </section>
        </div>
    );
}

export default MemoryDetail;
