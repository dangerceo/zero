import React, { useState, useEffect } from 'react';

function NotificationModule() {
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
        fetch('/api/notifications').then(res => res.json()).then(setNotifications).catch(console.error);

        // We could use WebSocket here, but for now let's just poll or wait for updates
        // Actually, let's just poll every 10s for simplicity in this module
        const interval = setInterval(() => {
            fetch('/api/notifications').then(res => res.json()).then(setNotifications).catch(console.error);
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const getTime = (ts) => {
        const d = new Date(ts);
        return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    };

    return (
        <div className='notification-module'>
            <div className='agent-section'>
                <h2 className='section-label'>Mobile Sync: Messages & Security</h2>
                <div className='notif-list' style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {notifications.length === 0 ? (
                        <div className='empty-state' style={{ padding: '20px' }}>No synced notifications.</div>
                    ) : (
                        notifications.map(n => (
                            <div key={n.id} className='notif-card' style={{ 
                                background: 'var(--bg2)', 
                                border: '1px solid var(--border)', 
                                borderRadius: 'var(--radius)', 
                                padding: '12px',
                                borderLeft: n.app.toLowerCase().includes('eufy') ? '4px solid var(--error)' : '4px solid var(--accent)'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--fg3)' }}>{n.app}</span>
                                    <span style={{ fontSize: '10px', color: 'var(--fg3)', fontFamily: 'var(--mono)' }}>{getTime(n.timestamp)}</span>
                                </div>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '2px' }}>{n.title}</div>
                                <div style={{ fontSize: '13px', color: 'var(--fg2)', lineHeight: '1.4' }}>{n.text}</div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default NotificationModule;
