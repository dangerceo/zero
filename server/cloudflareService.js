import { spawn } from 'child_process';
import { agentStore } from './agentStore.js';

/**
 * Deploys an agent's project to Cloudflare using wrangler.
 * @param {string} agentId 
 * @param {function} broadcast 
 * @returns {Promise<Object>}
 */
export async function deployToCloudflare(agentId, broadcast) {
    const agent = await agentStore.get(agentId);
    if (!agent) throw new Error('Agent not found');

    const workingDir = agent.workingDir;
    if (!workingDir) throw new Error('Working directory not set');

    broadcast({ 
        type: 'agent:log', 
        agentId, 
        log: { message: '🚀 Deploying to Cloudflare...', type: 'info', timestamp: new Date().toISOString() } 
    });

    return new Promise((resolve, reject) => {
        // Use npx to run the locally installed wrangler
        const child = spawn('npx', ['wrangler', 'deploy'], {
            cwd: workingDir,
            env: { ...process.env },
            shell: true
        });

        let output = '';
        child.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            broadcast({ 
                type: 'agent:log', 
                agentId, 
                log: { message: text, type: 'output', timestamp: new Date().toISOString() } 
            });
        });

        child.stderr.on('data', (data) => {
            broadcast({ 
                type: 'agent:log', 
                agentId, 
                log: { message: data.toString(), type: 'error', timestamp: new Date().toISOString() } 
            });
        });

        child.on('close', async (code) => {
            if (code === 0) {
                // Extract URL from wrangler output
                const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i);
                const url = urlMatch ? urlMatch[0] : null;
                
                await agentStore.addDeployment(agentId, {
                    provider: 'cloudflare',
                    status: 'success',
                    url
                });
                
                broadcast({ 
                    type: 'agent:log', 
                    agentId, 
                    log: { message: `✅ Deployment successful! URL: ${url}`, type: 'success', timestamp: new Date().toISOString() } 
                });
                
                // Also broadcast deployment update
                const updatedAgent = await agentStore.get(agentId);
                broadcast({ type: 'agent:updated', agent: updatedAgent });
                
                resolve({ success: true, url });
            } else {
                await agentStore.addDeployment(agentId, {
                    provider: 'cloudflare',
                    status: 'failed'
                });
                reject(new Error(`Deployment failed with code ${code}`));
            }
        });
    });
}
