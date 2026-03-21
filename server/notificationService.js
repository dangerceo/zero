class NotificationService {
    constructor() {
        this.notifications = [];
        this.broadcast = null;
    }

    start(broadcast) {
        this.broadcast = broadcast;
    }

    addNotification(notif) {
        // Expected format: { id, app, title, text, timestamp, priority }
        const newNotif = {
            id: Date.now().toString(),
            app: notif.app || 'Unknown',
            title: notif.title || 'No Title',
            text: notif.text || '',
            timestamp: new Date().toISOString(),
            priority: notif.priority || 'normal'
        };
        
        this.notifications.unshift(newNotif);
        // Keep only last 50
        this.notifications = this.notifications.slice(0, 50);

        if (this.broadcast) {
            this.broadcast({ type: 'notification:new', data: newNotif });
        }
        return newNotif;
    }

    getNotifications() {
        return this.notifications;
    }

    clearAll() {
        this.notifications = [];
        if (this.broadcast) {
            this.broadcast({ type: 'notification:clear' });
        }
    }
}

export const notificationService = new NotificationService();
