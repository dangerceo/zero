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

import { agentStore } from './agentStore.js';
import { executeAgent, continueAgent, stopAgent, isAgentActuallyRunning } from './agentExecutor.js';
import { agyService } from './agyService.js';
import { generateWasteReport } from './kitchen/wasteTracker.js';
import { sysmonService } from './sysmonService.js';
import { teslaService } from './teslaService.js';
import { notificationService } from './notificationService.js';
import { getSettings, saveSettings } from './settings.js';
import { attachChatServer, getChatSessions } from './chatService.js';
import { attachPtyServer, getActiveTerminalSessions, killTerminalSession } from './ptyService.js';

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

wss.on('connection', async (ws) => {
  clients.add(ws);
  const agents = await agentStore.getAll();
  const enhancedAgents = agents.map(a => ({ ...a, actuallyRunning: isAgentActuallyRunning(a.id) }));
  ws.send(JSON.stringify({ type: 'init', agents: enhancedAgents, projects: agyService.getProjects(), notifications: notificationService.getNotifications() }));
  ws.send(JSON.stringify({ type: 'sysmon:update', data: sysmonService.getData() }));
  ws.send(JSON.stringify({ type: 'tesla:update', data: teslaService.getData() }));
  ws.on('close', () => clients.delete(ws));
});

const PORT = process.env.PORT || 3847;
const cleanStr = (s) => (s || '').replace(/[^\x00-\x7F]/g, '').trim();

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

app.get('/api/settings', async (req, res) => { res.json(await getSettings()); });
app.post('/api/settings', async (req, res) => { res.json(await saveSettings(req.body)); });

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
    
    // Then resolve as intervention
    const agent = await agentStore.resolveIntervention(req.params.id, interventionId, response);
    if (!agent) return res.status(404).send('Agent not found');
    
    // Resume agent if it was waiting and now unblocked
    if (agent.status === 'running' && !isAgentActuallyRunning(agent.id)) {
        executeAgent(agent.id, broadcast, true);
    }
    
    broadcast({ type: 'agent:updated', agent: { ...agent, actuallyRunning: isAgentActuallyRunning(agent.id) } });
    res.json({ status: 'ok' });
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

app.get('/api/pebble/tasks', async (req, res) => {
  try {
    const agents = await agentStore.getAll();
    const tasks = agents
      .filter(a => (a.status === 'running' || a.status === 'planning' || a.status === 'waiting') && !a.archived)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 10)
      .map(a => ({ id: a.id.slice(0, 8), name: ((isAgentActuallyRunning(a.id) ? '● ' : '○ ') + cleanStr(a.name)).slice(0, 28) }));
    res.json({ tasks: tasks.length ? tasks : [{ id: 'none', name: 'No active agents' }] });
  } catch (e) { res.status(500).json({ tasks: [{ id: 'err', name: 'API Error' }] }); }
});

app.get('/api/agents', async (req, res) => { 
    const agents = await agentStore.getAll();
    res.json(agents.map(a => ({ ...a, actuallyRunning: isAgentActuallyRunning(a.id) }))); 
});

app.post('/api/agents', async (req, res) => {
  const agent = await agentStore.create(req.body);
  broadcast({ type: 'agent:created', agent });
  res.json(agent);
});

app.post('/api/agents/:id/start', async (req, res) => { await executeAgent(req.params.id, broadcast, false); res.json({ status: 'ok' }); });
app.post('/api/agents/:id/resume', async (req, res) => { await executeAgent(req.params.id, broadcast, true); res.json({ status: 'ok' }); });
app.post('/api/agents/:id/stop', async (req, res) => { await stopAgent(req.params.id); res.json({ status: 'ok' }); });
app.post('/api/agents/:id/archive', async (req, res) => {
    const agent = await agentStore.update(req.params.id, { archived: true });
    broadcast({ type: 'agent:updated', agent });
    res.json({ status: 'ok' });
});

app.post('/api/agents/:id/todo', async (req, res) => {
  const agent = await agentStore.addTodo(req.params.id, req.body.todo);
  broadcast({ type: 'agent:updated', agent: { ...agent, actuallyRunning: isAgentActuallyRunning(agent.id) } });
  if (!isAgentActuallyRunning(agent.id)) executeAgent(req.params.id, broadcast, true);
  res.json({ status: 'ok' });
});

app.delete('/api/agents/:id', async (req, res) => { 
    await stopAgent(req.params.id);
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

// Serving static files including Android distribution
app.use(express.static(join(__dirname, '../web/dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(join(__dirname, '../web/dist/index.html'));
});

const chatWss = attachChatServer(null); // noServer mode — we handle upgrade below
const ptyWss  = attachPtyServer(null);  // noServer mode — raw PTY terminal

// Route WebSocket upgrades: /chat → chatWss, /pty → ptyWss, everything else → main wss
server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    if (pathname === '/chat') {
        chatWss.handleUpgrade(request, socket, head, (ws) => {
            chatWss.emit('connection', ws, request);
        });
    } else if (pathname === '/pty') {
        ptyWss.handleUpgrade(request, socket, head, (ws) => {
            ptyWss.emit('connection', ws, request);
        });
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
  if (settings.enableTelemetry) { sysmonService.start(broadcast); teslaService.start(broadcast); }
  if (settings.enableAntigravity) agyService.start(broadcast);
  notificationService.start(broadcast);
  if (settings.enableTunnel) startTunnel(PORT, process.env.ZERO_TOKEN);
});
