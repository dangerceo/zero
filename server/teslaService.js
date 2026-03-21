class TeslaService {
    constructor() {
        this.data = {
            batteryLevel: 82,
            range: 310,
            isCharging: false,
            location: { lat: 37.7749, lon: -122.4194 },
            carName: 'Black Pearl',
            robotaxiStatus: 'available'
        };
        this.interval = null;
        this.broadcast = null;
    }

    start(broadcast) {
        this.broadcast = broadcast;
        this.update();
        this.interval = setInterval(() => this.update(), 60000); // 1 minute
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    async update() {
        // Mock update: change battery randomly
        this.data.batteryLevel = Math.max(0, Math.min(100, this.data.batteryLevel + (Math.random() > 0.5 ? 1 : -1)));
        
        if (this.broadcast) {
            this.broadcast({ type: 'tesla:update', data: this.data });
        }
    }

    getData() {
        return this.data;
    }
}

export const teslaService = new TeslaService();
