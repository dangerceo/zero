import React from 'react';
import { useStore } from '../store';
import Notification from './Notification';

function NotificationContainer() {
    const { notifications, dismissNotification } = useStore();

    return (
        <div style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
        }}>
            {notifications.map(n => (
                <Notification key={n.id} notification={n} onDismiss={dismissNotification} />
            ))}
        </div>
    );
}

export default NotificationContainer;
