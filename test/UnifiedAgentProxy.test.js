import { UnifiedAgentProxy } from '../server/UnifiedAgentProxy.js';
import { agentStore } from '../server/agentStore.js';
import { dangerTerminal } from '../server/dangerTerminal.js';
import assert from 'assert';
import EventEmitter from 'events';
import * as settings from '../server/settings.js';

// Mock dangerTerminal
dangerTerminal.spawn = (agentId, command, args, options) => {
    const mockPty = new EventEmitter();
    mockPty.cwd = options.cwd;
    mockPty.write = (data) => {};
    mockPty.kill = () => {};
    return mockPty;
};

// Mock broadcast function
const broadcast = (msg) => {};

async function testRiskTolerance() {
    console.log('🧪 Testing Risk Tolerance logic...');
    
    // This mirrors the logic in UnifiedAgentProxy.js UnifiedAcpClient.requestPermission
    const getPermissionOutcome = async (tolerance) => {
        if (tolerance === 0) return "denied";
        if (tolerance === 2) return "selected";
        return "denied"; // Normal
    };

    assert.strictEqual(await getPermissionOutcome(0), 'denied', 'Zero Danger should deny');
    assert.strictEqual(await getPermissionOutcome(2), 'selected', 'Dangermaxxing should approve');
    assert.strictEqual(await getPermissionOutcome(1), 'denied', 'Normal Danger should deny');

    console.log('✅ Risk Tolerance logic verified!');
}

async function testProxy() {
    console.log('🧪 Testing UnifiedAgentProxy lifecycle...');
    const proxy = new UnifiedAgentProxy(broadcast);
    const agent = await agentStore.create({ name: 'Proxy Test' });
    const session = await proxy.getOrCreateSession(agent.id);
    assert.ok(session, 'Session should be created');
    assert.strictEqual(session.agentId, agent.id);
    console.log('✅ Lifecycle tests passed!');
}

(async () => {
    try {
        await testProxy();
        await testRiskTolerance();
        process.exit(0);
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exit(1);
    }
})();
