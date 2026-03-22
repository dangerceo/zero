import si from 'systeminformation';

async function test() {
    console.log('Fetching system info...');
    const cpuLoad = await si.currentLoad();
    const cpuTemp = await si.cpuTemperature();
    const mem = await si.mem();
    const battery = await si.battery();
    const graphics = await si.graphics();
    const time = si.time();

    console.log('CPU Load:', cpuLoad.currentLoad);
    console.log('CPU Temp:', cpuTemp.main);
    console.log('Memory Percent:', (mem.active / mem.total * 100));
    console.log('Battery Has:', battery.hasBattery);
    console.log('Uptime:', time.uptime);
    console.log('Graphics:', JSON.stringify(graphics, null, 2));
}

test().catch(console.error);
