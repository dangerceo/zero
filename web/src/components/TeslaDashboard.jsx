import React, { useState, useEffect } from 'react';

function TeslaDashboard() {
    const [sysData, setSysData] = useState(null);
    const [teslaData, setTeslaData] = useState(null);

    useEffect(() => {
        const fetchTelemetry = () => {
            fetch('/api/sysmon').then(res => res.json()).then(setSysData).catch(console.error);
            fetch('/api/tesla').then(res => res.json()).then(setTeslaData).catch(console.error);
        };
        fetchTelemetry();
        const interval = setInterval(fetchTelemetry, 5000);
        return () => clearInterval(interval);
    }, []);

    if (!sysData || !teslaData) return <div className='loading-mini'>Initialising telemetry...</div>;

    const getBatteryColor = (p) => {
        if (p > 50) return 'var(--success)';
        if (p > 20) return 'var(--warning)';
        return 'var(--error)';
    };

    const hasBattery = sysData.battery && sysData.battery.hasBattery;

    return (
        <div className='tesla-dashboard'>
            <div className='agent-section'>
                <h2 className='section-label'>System Telemetry</h2>
                <div className='sys-grid'>
                    <div className='sys-card'>
                        <span className='sys-label'>CPU LOAD</span>
                        <div className='sys-value-row'>
                            <span className='sys-value'>{sysData.cpu.load}%</span>
                            <span className='sys-sub'>{sysData.cpu.temp}°C</span>
                        </div>
                        <div className='sys-bar-bg'>
                            <div className='sys-bar-fill' style={{ width: sysData.cpu.load + '%', background: 'var(--fg)' }} />
                        </div>
                    </div>
                    <div className='sys-card'>
                        <span className='sys-label'>MEMORY</span>
                        <div className='sys-value-row'>
                            <span className='sys-value'>{sysData.mem.percent}%</span>
                            <span className='sys-sub'>{sysData.mem.used}GB</span>
                        </div>
                        <div className='sys-bar-bg'>
                            <div className='sys-bar-fill' style={{ width: sysData.mem.percent + '%', background: 'var(--fg)' }} />
                        </div>
                    </div>
                    {hasBattery ? (
                        <div className='sys-card'>
                            <span className='sys-label'>LOCAL BATTERY</span>
                            <div className='sys-value-row'>
                                <span className='sys-value'>{sysData.battery.percent}%</span>
                                <span className='sys-sub'>{sysData.battery.isCharging ? 'CHARGING' : 'DISCHARGING'}</span>
                            </div>
                            <div className='sys-bar-bg'>
                                <div className='sys-bar-fill' style={{ width: sysData.battery.percent + '%', background: getBatteryColor(sysData.battery.percent) }} />
                            </div>
                        </div>
                    ) : (
                        <div className='sys-card'>
                            <span className='sys-label'>SYSTEM POWER</span>
                            <div className='sys-value-row'>
                                <span className='sys-value'>{Math.round(sysData.power.load * 1.5)}W</span>
                                <span className='sys-sub'>UPTIME: {Math.floor(sysData.power.uptime / 3600)}h</span>
                            </div>
                            <div className='sys-bar-bg'>
                                <div className='sys-bar-fill' style={{ width: sysData.power.load + '%', background: 'var(--accent)' }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className='agent-section'>
                <h2 className='section-label'>Tesla Fleet Status</h2>
                <div className='tesla-card-main'>
                    <div className='tesla-header-row'>
                        <span className='tesla-car-name'>{teslaData.carName}</span>
                        <span className='tesla-badge'>{teslaData.robotaxiStatus === 'available' ? 'ROBOTAXI READY' : 'MANUAL'}</span>
                    </div>
                    
                    <div className='tesla-stats-grid'>
                        <div className='tesla-stat'>
                            <span className='sys-label'>BATTERY</span>
                            <span className='tesla-val'>{teslaData.batteryLevel}%</span>
                        </div>
                        <div className='tesla-stat'>
                            <span className='sys-label'>RANGE</span>
                            <span className='tesla-val'>{teslaData.range} mi</span>
                        </div>
                        <div className='tesla-stat'>
                            <span className='sys-label'>STATUS</span>
                            <span className='tesla-val' style={{color: teslaData.isCharging ? 'var(--success)' : 'var(--fg2)'}}>
                                {teslaData.isCharging ? 'CHARGING' : 'PARKED'}
                            </span>
                        </div>
                    </div>

                    <div className='sys-bar-bg' style={{height: '8px', marginTop: '12px'}}>
                        <div className='sys-bar-fill' style={{ 
                            width: teslaData.batteryLevel + '%', 
                            background: getBatteryColor(teslaData.batteryLevel) 
                        }} />
                    </div>
                </div>
            </div>

            <style>{ ".tesla-dashboard { width: 100%; max-width: 800px; margin: 0 auto; } .sys-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-top: 8px; } .sys-card { background: var(--bg2); padding: 12px; border-radius: var(--radius); border: 1px solid var(--border); } .sys-label { font-size: 10px; font-weight: 700; color: var(--fg3); letter-spacing: 0.5px; } .sys-value-row { display: flex; justify-content: space-between; align-items: baseline; margin: 4px 0; } .sys-value { font-size: 18px; font-weight: 700; font-family: var(--mono); } .sys-sub { font-size: 11px; color: var(--fg2); font-family: var(--mono); } .sys-bar-bg { width: 100%; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; margin-top: 4px; } .sys-bar-fill { height: 100%; transition: width 0.5s ease-out; } .tesla-card-main { background: var(--bg2); padding: 16px; border-radius: var(--radius); border: 1px solid var(--border); margin-top: 8px; } .tesla-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; } .tesla-car-name { font-size: 18px; font-weight: 700; } .tesla-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border: 1px solid var(--accent); border-radius: 10px; color: var(--accent); } .tesla-stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; } .tesla-stat { display: flex; flex-direction: column; } .tesla-val { font-size: 16px; font-weight: 700; font-family: var(--mono); margin-top: 2px; }" }</style>
        </div>
    );
}

export default TeslaDashboard;
