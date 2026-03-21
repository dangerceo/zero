import { agentStore } from '../server/agentStore.js';
import assert from 'assert';

async function testAgentStore() {
    console.log('🧪 Testing AgentStore Upgrades...');
    
    const agent = await agentStore.create({ name: 'Test Agent' });
    
    // Test sessions array
    console.log('Checking sessions array...');
    assert.ok(Array.isArray(agent.sessions), 'Agent should have a sessions array');
    
    // Test deployments array
    console.log('Checking deployments array...');
    assert.ok(Array.isArray(agent.deployments), 'Agent should have a deployments array');
    
    // Test addSession
    console.log('Testing addSession...');
    const session = await agentStore.addSession(agent.id, { type: 'chat', status: 'active' });
    assert.strictEqual(session.type, 'chat', 'Session type should match');
    const updatedAgent = await agentStore.get(agent.id);
    assert.strictEqual(updatedAgent.sessions.length, 1, 'Agent should have 1 session');
    
    // Test addDeployment
    console.log('Testing addDeployment...');
    const deployment = await agentStore.addDeployment(agent.id, { provider: 'cloudflare', status: 'deployed', url: 'https://test.workers.dev' });
    assert.strictEqual(deployment.provider, 'cloudflare', 'Deployment provider should match');
    const finalAgent = await agentStore.get(agent.id);
    assert.strictEqual(finalAgent.deployments.length, 1, 'Agent should have 1 deployment');

    // Test getSessions
    console.log('Testing getSessions...');
    const sessions = await agentStore.getSessions(agent.id);
    assert.strictEqual(sessions.length, 1, 'Should return 1 session');
    assert.strictEqual(sessions[0].id, session.id, 'Session ID should match');

    // Test getDeployments
    console.log('Testing getDeployments...');
    const deployments = await agentStore.getDeployments(agent.id);
    assert.strictEqual(deployments.length, 1, 'Should return 1 deployment');
    assert.strictEqual(deployments[0].id, deployment.id, 'Deployment ID should match');

    console.log('✅ Tests passed!');
}

testAgentStore().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
