import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { networkInterfaces } from 'os';
import chalk from 'chalk';

import { agentStore } from './agentStore.js';
import { executeAgent, continueAgent } from './agentExecutor.js';
import { agyService } from './agyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3847;

// Middleware
app.use(express.json());

// WebSocket
const clients = new Set();

export function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(data);
    }
  }
}

// Start agy monitoring
agyService.start(broadcast);

wss.on('connection', async (ws) => {
  clients.add(ws);
  console.log(chalk.green('📱 Client connected'));

  // Send current agents on connect
  const agents = await agentStore.getAll();
  ws.send(JSON.stringify({ type: 'init', agents }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(chalk.yellow('📱 Client disconnected'));
  });
});

app.get('/api/agy/projects', (req, res) => {
  res.json(agyService.getProjects());
});

// ─── Agent API ───────────────────────────────────────────

app.get('/api/agents', async (req, res) => {
  const agents = await agentStore.getAll();
  res.json(agents);
});

app.post('/api/agents', async (req, res) => {
  const { name, goal, workingDir, files } = req.body;
  const agent = await agentStore.create({
    name: name || (goal || '').slice(0, 50),
    goal: goal || name || '',
    workingDir: workingDir || null,
    files: files || []
  });
  broadcast({ type: 'agent:created', agent });
  res.status(201).json(agent);
});

// Create a "Zero self-edit" agent
app.post('/api/agents/zero', async (req, res) => {
  const { goal } = req.body;
  const agent = await agentStore.create({
    name: '🔧 Zero Self-Edit',
    goal: goal || 'Improve Zero Computer',
    workingDir: '/Users/dalnk/Desktop/zero'
  });
  broadcast({ type: 'agent:created', agent });
  res.status(201).json(agent);
});

app.get('/api/agents/:id', async (req, res) => {
  const agent = await agentStore.get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Not found' });
  res.json(agent);
});

app.patch('/api/agents/:id', async (req, res) => {
  const agent = await agentStore.update(req.params.id, req.body);
  if (!agent) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'agent:updated', agent });
  res.json(agent);
});

app.delete('/api/agents/:id', async (req, res) => {
  const deleted = await agentStore.delete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'agent:deleted', id: req.params.id });
  res.status(204).send();
});

// Start agent execution
app.post('/api/agents/:id/start', async (req, res) => {
  const agent = await agentStore.get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Not found' });
  executeAgent(req.params.id, broadcast);
  res.json({ status: 'started' });
});

// Continue agent
app.post('/api/agents/:id/continue', async (req, res) => {
  const agent = await agentStore.get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Not found' });
  continueAgent(req.params.id, broadcast);
  res.json({ status: 'continuing' });
});

// Add comment / quick reply
app.post('/api/agents/:id/comment', async (req, res) => {
  const { comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'Comment required' });
  const agent = await agentStore.addComment(req.params.id, comment);
  if (!agent) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'agent:updated', agent });
  res.json(agent);
});

// Answer a question
app.post('/api/agents/:id/questions/:qid/answer', async (req, res) => {
  const agent = await agentStore.answerQuestion(
    req.params.id,
    req.params.qid,
    req.body.answer
  );
  if (!agent) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'agent:updated', agent });
  res.json(agent);
});

// Get threads
app.get('/api/agents/:id/threads', async (req, res) => {
  const agent = await agentStore.get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Not found' });
  res.json(agent.threads || []);
});

// File management
app.get('/api/agents/:id/files', async (req, res) => {
  const agent = await agentStore.get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Not found' });
  res.json(agent.files || []);
});

app.post('/api/agents/:id/files', async (req, res) => {
  const { path, description } = req.body;
  if (!path) return res.status(400).json({ error: 'Path required' });
  const agent = await agentStore.addFile(req.params.id, { path, description: description || '' });
  if (!agent) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'agent:updated', agent });
  res.json(agent);
});

app.delete('/api/agents/:id/files', async (req, res) => {
  const { path } = req.body;
  if (!path) return res.status(400).json({ error: 'Path required' });
  const agent = await agentStore.removeFile(req.params.id, path);
  if (!agent) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'agent:updated', agent });
  res.json(agent);
});

// ─── Settings API ────────────────────────────────────────

import { getSettings, saveSettings } from './settings.js';

app.get('/api/settings', async (req, res) => {
  const settings = await getSettings();
  res.json({
    ...settings,
    claudeApiKey: settings.claudeApiKey ? '••••' + settings.claudeApiKey.slice(-4) : '',
    geminiApiKey: settings.geminiApiKey ? '••••' + settings.geminiApiKey.slice(-4) : ''
  });
});

app.post('/api/settings', async (req, res) => {
  await saveSettings(req.body);
  res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', connectedClients: clients.size });
});

// Static files
app.use(express.static(join(__dirname, '../web/dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(join(__dirname, '../web/dist/index.html'));
});

import { startTunnel } from './tunnel.js';

server.listen(PORT, '0.0.0.0', () => {
  console.log(chalk.cyan(`⚡ Zero running on port ${PORT}`));
  const token = process.env.ZERO_TOKEN;
  startTunnel(PORT, token);
});
