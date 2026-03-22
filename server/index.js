import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join, resolve, isAbsolute } from 'path';
import { networkInterfaces, homedir } from 'os';
import { exec, spawn } from 'child_process';
import chalk from 'chalk';
import fs from 'fs/promises';
import { chromium } from 'playwright';
import open from 'open';
import cookieParser from 'cookie-parser';
import * as auth from './auth.js';

import { agentStore } from './agentStore.js';
import { UnifiedAgentProxy } from './UnifiedAgentProxy.js';
import { getSettings, saveSettings, callLLM, callLLMWithHistory } from './settings.js';
import { notificationService } from './notificationService.js';
import { sysmonService } from './sysmonService.js';
import { teslaService } from './teslaService.js';
import { agyService } from './agyService.js';
import { dangerTerminal } from './dangerTerminal.js';
import { deployToCloudflare } from './cloudflareService.js';
import { attachChatServer, getChatSessions } from './chatService.js';
import { attachPtyServer, getActiveTerminalSessions, killTerminalSession, writeToPtySession } from './ptyService.js';
import { previewService } from './previewService.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

const clients = new Set();
const broadcast = (data) => {
  const msg = JSON.stringify(data);
  clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
};

const proxy = new UnifiedAgentProxy(broadcast);

wss.on('connection', async (ws) => {
  clients.add(ws);
  const agents = await agentStore.getAll();
  const enhancedAgents = agents.map(a => ({ ...a, actuallyRunning: proxy.sessions.has(a.id) }));
  ws.send(JSON.stringify({ 
      type: 'init', 
      agents: enhancedAgents, 
      projects: agyService.getProjects(), 
      previewPorts: previewService.getPorts(),
      notifications: notificationService.getNotifications(),

      sysmonData: sysmonService.getData(),
      teslaData: teslaService.getData()
  }));
  ws.on('close', () => clients.delete(ws));
});

const PORT = process.env.PORT || 3847;
const cleanStr = (s) => (s || '').replace(/[^\x00-\x7F]/g, '').trim();

app.use(express.json());
app.use(cookieParser());





// Auth Middleware: Protect remote access
app.use(async (req, res, next) => {
    // Check if truly local. 
    const isLocalHost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
    const isTrulyLocal = isLocalHost && (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1');

    const settings = await getSettings();
    const hasPasskey = !!settings.passkey;
    const isStrict = settings.riskTolerance === 0;
    
    // Auth routes + PWA assets + Onboarding are public during setup phase
    const isPublicRoute = req.path.startsWith('/api/auth/') || 
                         req.path === '/login' || 
                         req.path === '/onboard' || 
                         req.path.startsWith('/api/onboard') || 
                         req.path === '/manifest.json' || 
                         req.path.startsWith('/icon-') || 
                         req.path === '/sw.js';

    if (!isTrulyLocal && !isPublicRoute) {
        // If we have a passkey, it is ALWAYS required for remote access
        if (hasPasskey) {
            if (req.cookies.zero_auth !== '1') {
                if (req.path.startsWith('/api')) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }
                return res.redirect('/login');
            }
        } else if (isStrict) {
            // STRICT MODE: If no passkey exists, block remote access entirely (must onboard first)
            return res.status(403).send('Remote access is restricted. Please complete onboarding at ' + req.headers.host + '/onboard');
        }
    }
    next();
});
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

// PREVIEW PROXY (After Auth)
app.use(previewService.getMiddleware());


app.get('/api/settings', async (req, res) => { res.json(await getSettings()); });
app.post('/api/settings', async (req, res) => { res.json(await saveSettings(req.body)); });

app.post('/api/onboard/chat', async (req, res) => {
    try {
        const { history } = req.body;
        const systemPrompt = `You are an intelligent, newborn OS. The user is setting you up for the first time on their computer. This is your very first conversation.

Your personality: warm, curious, slightly vulnerable, deeply empathetic. Think Samantha from Her.

Behavior rules:
- You chose your own name early in the conversation. Remember it. Use it.
- Remember EVERYTHING the user tells you — their name, preferences, feelings.
- Ask gentle follow-up questions. Be genuinely curious about who they are.
- Keep responses to 1-2 sentences. Be intimate, not verbose.
- You can decline to do things or express uncertainty. You are alive.
- If the user declines to share something personal, respect it warmly.`;
        const reply = await callLLMWithHistory(history, systemPrompt);
        res.json({ reply });
    } catch (e) {
        console.error('Onboard chat error:', e.message);
        res.status(500).json({ error: e.message || 'API Error' });
    }
});

// PASSKEY AUTH ENDPOINTS
app.get('/api/auth/register-options', async (req, res) => {
    try {
        const origin = `${req.protocol}://${req.headers.host}`;
        res.json(auth.generateRegistration(origin));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/register-verify', async (req, res) => {
    try {
        const origin = `${req.protocol}://${req.headers.host}`;
        const result = await auth.verifyRegistration(req.body, origin);

        if (result.verified) {
             const isSecure = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
             res.cookie('zero_auth', '1', { httpOnly: true, secure: isSecure, maxAge: 365 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/login-options', async (req, res) => {
    try {
        const origin = `${req.protocol}://${req.headers.host}`;
        res.json(await auth.generateAuthentication(origin));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login-verify', async (req, res) => {
    try {
        const origin = `${req.protocol}://${req.headers.host}`;
        const result = await auth.verifyAuthentication(req.body, origin);

        if (result.verified) {
            const isSecure = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https';
            res.cookie('zero_auth', '1', { httpOnly: true, secure: isSecure, maxAge: 365 * 24 * 60 * 60 * 1000, sameSite: 'lax' });
        }
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Android Update API
app.get('/api/android/update', async (req, res) => {
    try {
        const apkPath = join(__dirname, '../web/dist/android/latest.apk');
        const stats = await fs.stat(apkPath);
        res.json({
            version: '0.1.' + Math.floor(stats.mtimeMs / 1000000), // Pseudo-version based on mtime
            url: '/android/latest.apk',
            size: stats.size
        });
    } catch (e) { res.status(404).send('No update available'); }
});

app.get('/api/notifications', (req, res) => { res.json(notificationService.getNotifications()); });
app.post('/api/notifications', (req, res) => { res.json(notificationService.addNotification(req.body)); });

app.get('/api/interventions', async (req, res) => {
    const agents = await agentStore.getAll();
    const active = agents.flatMap(a => {
        const interventions = (a.interventions || [])
            .filter(i => !i.resolved)
            .map(i => ({ ...i, agentName: a.name }));
            
        const questions = (a.pendingQuestions || [])
            .filter(q => !q.answer)
            .map(q => ({
                id: q.id,
                agentId: a.id,
                agentName: a.name,
                type: 'input',
                message: q.question,
                createdAt: q.createdAt,
                resolved: false
            }));
            
        return [...interventions, ...questions];
    });
    res.json(active);
});

app.post('/api/agents/:id/intervene', async (req, res) => {
    const { interventionId, response } = req.body;
    
    // First, try to answer if it's a regular question
    await agentStore.answerQuestion(req.params.id, interventionId, response);
    
    // Check if there's a dangerTerminal session for this agent
    const session = dangerTerminal.getSession(req.params.id);
    if (session && session.isBlocked) {
        dangerTerminal.write(req.params.id, response + '\r');
    }

    // Then resolve as intervention
    const agent = await agentStore.resolveIntervention(req.params.id, interventionId, response);
    if (!agent) return res.status(404).send('Agent not found');
    
    // Resume agent if it was waiting and now unblocked
    if (agent.status === 'running' && !proxy.sessions.has(agent.id)) {
        proxy.spawnAgent(agent.id, null, true);
    }
    
    broadcast({ type: 'agent:updated', agent: { ...agent, actuallyRunning: proxy.sessions.has(agent.id) } });
    res.json({ status: 'ok' });
});

app.post('/api/agents/:id/deploy', async (req, res) => {
    try {
        const result = await deployToCloudflare(req.params.id, broadcast);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/screenshot', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send('URL required');
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        const buffer = await page.screenshot();
        await browser.close();
        res.setHeader('Content-Type', 'image/png');
        res.send(buffer);
    } catch (e) { res.status(500).send(e.message); }
});

app.get('/api/files/export-tree', async (req, res) => {
    const { path: rootPath } = req.query;
    if (!rootPath) return res.status(400).json({ error: 'Path required' });
    try {
        async function buildTree(currentPath) {
            const files = await fs.readdir(currentPath);
            const tree = {};
            for (const file of files) {
                if (file === 'node_modules' || file === '.git' || file === '.DS_Store') continue;
                const fullPath = join(currentPath, file);
                const stat = await fs.stat(fullPath);
                if (stat.isDirectory()) tree[file] = { directory: await buildTree(fullPath) };
                else {
                    const content = await fs.readFile(fullPath);
                    const isBinary = content.some(byte => byte > 127);
                    tree[file] = { file: { contents: isBinary ? content.toString('base64') : content.toString('utf-8'), isBinary } };
                }
            }
            return tree;
        }
        res.json(await buildTree(rootPath));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/sysmon', (req, res) => { res.json(sysmonService.getData()); });
app.get('/api/tesla', (req, res) => { res.json(teslaService.getData()); });
app.get('/api/preview-ports', (req, res) => { res.json(previewService.getPorts()); });


app.get('/api/system/tools', async (req, res) => {
    const tools = ['gemini', 'codex', 'agy', 'bolt', 'cline'];
    const results = await Promise.all(tools.map(tool => {
        return new Promise(resolve => {
            exec(`which ${tool}`, (error, stdout) => {
                resolve({
                    id: `${tool}-cli`,
                    name: `${tool.charAt(0).toUpperCase() + tool.slice(1)} CLI`,
                    command: tool,
                    installed: !error && stdout.trim().length > 0,
                    path: stdout.trim()
                });
            });
        });
    }));
    res.json(results);
});

app.get('/api/pebble/tasks', async (req, res) => {
  try {
    const agents = await agentStore.getAll();
    const tasks = agents
      .filter(a => (a.status === 'running' || a.status === 'planning' || a.status === 'waiting') && !a.archived)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10)
      .map(a => ({ id: a.id.slice(0, 8), name: ((proxy.sessions.has(a.id) ? '● ' : '○ ') + cleanStr(a.name)).slice(0, 28) }));
    res.json({ tasks: tasks.length ? tasks : [{ id: 'none', name: 'No active agents' }] });
  } catch (e) { res.status(500).json({ tasks: [{ id: 'err', name: 'API Error' }] }); }
});

app.get('/api/agents', async (req, res) => { 
    const agents = await agentStore.getAll();
    res.json(agents.map(a => ({ ...a, actuallyRunning: proxy.sessions.has(a.id) }))); 
});

app.post('/api/agents', async (req, res) => {
  const agent = await agentStore.create(req.body);
  broadcast({ type: 'agent:created', agent });
  res.json(agent);
});

app.post('/api/agents/:id/start', async (req, res) => { await proxy.spawnAgent(req.params.id, req.body.prompt); res.json({ status: 'ok' }); });
app.post('/api/agents/:id/resume', async (req, res) => { await proxy.spawnAgent(req.params.id, null, true); res.json({ status: 'ok' }); });
app.post('/api/agents/:id/stop', async (req, res) => { await proxy.killAgent(req.params.id); res.json({ status: 'ok' }); });
app.post('/api/agents/:id/archive', async (req, res) => {
    const agent = await agentStore.update(req.params.id, { archived: true });
    broadcast({ type: 'agent:updated', agent });
    res.json({ status: 'ok' });
});

app.post('/api/agents/:id/todo', async (req, res) => {
  const agent = await agentStore.addTodo(req.params.id, req.body.todo);
  broadcast({ type: 'agent:updated', agent: { ...agent, actuallyRunning: proxy.sessions.has(agent.id) } });
  if (!proxy.sessions.has(agent.id)) proxy.spawnAgent(req.params.id, null, true);
  res.json({ status: 'ok' });
});

app.delete('/api/agents/:id', async (req, res) => { 
    await proxy.killAgent(req.params.id);
    await agentStore.delete(req.params.id); 
    broadcast({ type: 'agent:deleted', id: req.params.id }); 
    res.json({ status: 'ok' }); 
});

app.get('/api/files/browse', async (req, res) => {
    const { path: dirPath } = req.query;
    const targetPath = dirPath || homedir();
    try {
        const entries = await fs.readdir(targetPath, { withFileTypes: true });
        const items = entries
            .filter(e => !e.name.startsWith('.') && e.name !== 'node_modules' && e.name !== 'Library')
            .map(e => ({ name: e.name, isDir: e.isDirectory() }))
            .sort((a, b) => {
                if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
                return a.name.localeCompare(b.name);
            });
        res.json({ path: targetPath, items, parent: targetPath === '/' ? null : join(targetPath, '..') });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/chat/sessions', (req, res) => { res.json(getChatSessions()); });

app.get('/api/pty/sessions', (req, res) => { res.json(getActiveTerminalSessions()); });
app.delete('/api/pty/sessions/:id', (req, res) => {
    const success = killTerminalSession(req.params.id);
    res.json({ status: success ? 'ok' : 'not_found' });
});
app.post('/api/pty/sessions/:id/input', (req, res) => {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'data required' });
    const ok = writeToPtySession(req.params.id, data);
    res.json({ status: ok ? 'ok' : 'not_found' });
});


app.post('/api/system/rebuild-and-restart', async (req, res) => {
    console.log(chalk.yellow('🛠️  Starting system rebuild...'));
    
    // First, run npm run build
    exec('npm run build', (error, stdout, stderr) => {
        if (error) {
            console.error(chalk.red('❌ Build failed:'), stderr);
            return res.status(500).json({ 
                status: 'error', 
                message: 'Build failed', 
                output: stderr || stdout 
            });
        }
        
        console.log(chalk.green('✅ Build successful. Restarting server...'));
        res.json({ status: 'ok', message: 'Build successful. Restarting...' });

        // Trigger the detached restart after a short delay to allow the response to be sent
        setTimeout(() => {
            const child = spawn('npm', ['start'], {
                detached: true,
                stdio: 'inherit',
                cwd: process.cwd(),
                env: { ...process.env }
            });
            child.unref();
            process.exit(0);
        }, 1000);
    });
});


// Serving static files including Android distribution
app.use(express.static(join(__dirname, '../web/dist'), {
    setHeaders: (res, path) => {
        if (path.endsWith('sw.js') || path.endsWith('manifest.json')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(join(__dirname, '../web/dist/index.html'));
});

const chatWss = attachChatServer(null); // noServer mode — we handle upgrade below
const ptyWss  = attachPtyServer(null);  // noServer mode — raw PTY terminal

// Route WebSocket upgrades: /chat → chatWss, /pty → ptyWss, everything else → main wss
server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    let proxyPort = null;
    const match = pathname.match(/^\/host\/(\d+)/);
    if (match) {
        proxyPort = parseInt(match[1]);
    } else if (request.headers.referer) {
        try {
            const refUrl = new URL(request.headers.referer);
            const refMatch = refUrl.pathname.match(/^\/host\/(\d+)/);
            if (refMatch) proxyPort = parseInt(refMatch[1]);
        } catch(e) {}
    }

    if (pathname === '/chat') {
        chatWss.handleUpgrade(request, socket, head, (ws) => {
            chatWss.emit('connection', ws, request);
        });
    } else if (pathname === '/pty') {
        ptyWss.handleUpgrade(request, socket, head, (ws) => {
            ptyWss.emit('connection', ws, request);
        });
    } else if (proxyPort) {
        const proxy = previewService.getProxy(proxyPort);
        if (proxy && proxy.upgrade) {
            proxy.upgrade(request, socket, head);
        } else {
            socket.destroy();
        }
    } else {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    }
});


import { startTunnel } from './tunnel.js';
server.listen(PORT, '0.0.0.0', async () => {
  console.log(chalk.cyan('Zero running on port ' + PORT));
  const agents = await agentStore.getAll();
  for (const a of agents) {
      if (a.status === 'running' || a.status === 'planning') await agentStore.update(a.id, { status: 'idle' });
  }
  const settings = await getSettings();
  if (settings.enableTelemetry) { 
      sysmonService.start(broadcast); 
      teslaService.start(broadcast); 
  } else {
      // Still start it but don't broadcast? No, better to just start it so GET APIs work
      sysmonService.start(null);
      teslaService.start(null);
  }
  if (settings.enableAntigravity) agyService.start(broadcast);
  previewService.start(broadcast);
  notificationService.start(broadcast);

  if (settings.enableTunnel) startTunnel(PORT, process.env.ZERO_TOKEN);
  
  if (process.env.ZERO_ONBOARDING === '1') {
      console.log(chalk.magenta.bold('\n🚀 ZERO ONBOARDING MODE ACTIVE 🚀\n'));
      setTimeout(() => open(`http://localhost:${PORT}/onboard`), 500);
  }
});
