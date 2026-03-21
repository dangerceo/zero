import si from 'systeminformation';

class SysmonService {
    constructor() {
        this.data = {
            cpu: { load: 0, temp: 0 },
            mem: { used: 0, total: 0, percent: 0 },
            battery: { percent: 0, isCharging: false, hasBattery: false },
            power: { uptime: 0, load: 0 },
            os: { platform: '', release: '', uptime: 0 }
        };
        this.interval = null;
        this.broadcast = null;
    }

    start(broadcast) {
        this.broadcast = broadcast;
        this.update();
        this.interval = setInterval(() => this.update(), 5000); 
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    async update() {
        try {
            const cpuLoad = await si.currentLoad();
            const cpuTemp = await si.cpuTemperature();
            const mem = await si.mem();
            const battery = await si.battery();
            const os = await si.osInfo();
            const time = si.time();

            this.data = {
                cpu: {
                    load: Math.round(cpuLoad.currentLoad),
                    temp: Math.round(cpuTemp.main || 0)
                },
                mem: {
                    used: Math.round(mem.active / 1024 / 1024 / 1024 * 10) / 10,
                    total: Math.round(mem.total / 1024 / 1024 / 1024 * 10) / 10,
                    percent: Math.round(mem.active / mem.total * 100)
                },
                battery: {
                    hasBattery: battery.hasBattery,
                    percent: battery.percent,
                    isCharging: battery.isCharging
                },
                power: {
                    uptime: time.uptime,
                    load: Math.round(cpuLoad.currentLoad) // Proxy for power on desktops
                },
                os: {
                    platform: os.platform,
                    release: os.release,
                    uptime: time.uptime
                }
            };

            if (this.broadcast) {
                this.broadcast({ type: 'sysmon:update', data: this.data });
            }
        } catch (error) { }
    }

    getData() {
        return this.data;
    }
}

export const sysmonService = new SysmonService();
