import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { networkInterfaces } from 'os';
import QRCode from 'qrcode';
import chalk from 'chalk';
import boxen from 'boxen';
import open from 'open';

import { createTasksRouter, taskStore } from './tasks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3847;
const isDev = process.env.NODE_ENV !== 'production';

// Middleware
app.use(express.json());

// Get local IP address
function getLocalIP() {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// WebSocket connection handling
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(chalk.green('📱 Phone connected!'));

  // Send current tasks on connect
  ws.send(JSON.stringify({
    type: 'init',
    tasks: taskStore.getAll()
  }));

  ws.on('close', () => {
    clients.delete(ws);
    console.log(chalk.yellow('📱 Phone disconnected'));
  });
});

// Broadcast updates to all connected clients
export function broadcast(message) {
  const data = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data);
    }
  }
}

// API Routes
app.use('/api/tasks', createTasksRouter(broadcast));

// Projects API (V2 - persistent projects)
import { projectStore } from './projectStore.js';

app.get('/api/v2/projects', async (req, res) => {
  const projects = await projectStore.getAll();
  res.json(projects);
});

app.post('/api/v2/projects', async (req, res) => {
  const project = await projectStore.create(req.body);
  broadcast({ type: 'project:created', project });
  res.status(201).json(project);
});

// Create a special "Zero" project that edits itself
app.post('/api/v2/projects/zero', async (req, res) => {
  const { goal } = req.body;
  const project = await projectStore.create({
    name: '🔧 Zero Self-Edit',
    goal: goal || 'Improve Zero Computer',
    workingDir: '/Users/dalnk/Desktop/zero' // Points to Zero's own codebase
  });
  broadcast({ type: 'project:created', project });
  res.status(201).json(project);
});

app.get('/api/v2/projects/:id', async (req, res) => {
  const project = await projectStore.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });
  res.json(project);
});

app.patch('/api/v2/projects/:id', async (req, res) => {
  const project = await projectStore.update(req.params.id, req.body);
  if (!project) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'project:updated', project });
  res.json(project);
});

app.post('/api/v2/projects/:id/questions/:qid/answer', async (req, res) => {
  const project = await projectStore.answerQuestion(
    req.params.id,
    req.params.qid,
    req.body.answer
  );
  if (!project) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'project:updated', project });
  res.json(project);
});

app.delete('/api/v2/projects/:id', async (req, res) => {
  const deleted = await projectStore.delete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  broadcast({ type: 'project:deleted', id: req.params.id });
  res.status(204).send();
});

// Start/continue project execution
import { executeProject, continueProject } from './projectExecutor.js';

app.post('/api/v2/projects/:id/start', async (req, res) => {
  const project = await projectStore.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });

  // Start in background
  executeProject(req.params.id, broadcast);
  res.json({ status: 'started' });
});

app.post('/api/v2/projects/:id/continue', async (req, res) => {
  const project = await projectStore.get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Not found' });

  continueProject(req.params.id, broadcast);
  res.json({ status: 'continuing' });
});

// Add follow-up comment to project queue
app.post('/api/v2/projects/:id/comments', async (req, res) => {
  const { comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'Comment required' });

  const project = await projectStore.addComment(req.params.id, comment);
  if (!project) return res.status(404).json({ error: 'Not found' });

  broadcast({ type: 'project:updated', project });
  res.json(project);
});

// Legacy projects API (reads from agy brain)
import { getProjects, getProjectDetails } from './projects.js';

app.get('/api/projects', async (req, res) => {
  const projects = await getProjects();
  res.json(projects);
});

app.get('/api/projects/:id', async (req, res) => {
  const details = await getProjectDetails(req.params.id);
  if (!details) return res.status(404).json({ error: 'Not found' });
  res.json(details);
});

// Settings API
import { getSettings, saveSettings } from './settings.js';

app.get('/api/settings', async (req, res) => {
  const settings = await getSettings();
  // Mask API keys for security
  res.json({
    ...settings,
    claudeApiKey: settings.claudeApiKey ? '••••' + settings.claudeApiKey.slice(-4) : '',
    geminiApiKey: settings.geminiApiKey ? '••••' + settings.geminiApiKey.slice(-4) : ''
  });
});

app.post('/api/settings', async (req, res) => {
  const updated = await saveSettings(req.body);
  res.json({ success: true });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', connectedClients: clients.size });
});

// Always serve static files from the built web app
app.use(express.static(join(__dirname, '../web/dist')));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(join(__dirname, '../web/dist/index.html'));
});


// Start server
server.listen(PORT, '0.0.0.0', async () => {
  const localIP = getLocalIP();
  const url = `http://${localIP}:${PORT}`;

  // Generate QR code
  const qrCode = await QRCode.toString(url, { type: 'terminal', small: true });

  console.clear();
  console.log(boxen(
    chalk.bold.cyan('⚡ Zero Computer') + '\n\n' +
    chalk.white('Scan this QR code with your phone:\n\n') +
    qrCode + '\n' +
    chalk.gray('Or open: ') + chalk.underline.blue(url) + '\n\n' +
    chalk.dim('Press Ctrl+C to stop'),
    {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    }
  ));
});
