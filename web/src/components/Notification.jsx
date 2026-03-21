import React from 'react';

function Notification({ notification, onDismiss }) {
    return (
        <div style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            padding: '10px',
            borderRadius: '5px'
        }}>
            <p>{notification.message}</p>
            <button onClick={() => onDismiss(notification.id)}>Dismiss</button>
        </div>
    );
}

export default Notification;
