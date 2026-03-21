import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '../data');
const AGENTS_FILE = join(DATA_DIR, 'agents.json');
const OLD_PROJECTS_FILE = join(DATA_DIR, 'projects.json');

// Agent schema
function createAgent(data) {
    return {
        id: uuidv4(),
        name: data.name || 'Untitled',
        goal: data.goal || '',
        status: 'idle', // idle, running, paused, waiting, completed, failed
        workingDir: data.workingDir || null,
        files: data.files || [], // [{ path, description }]
        threads: [],   // [{ id, role: 'user'|'agent', content, timestamp, metadata }]
        tickets: [],   // Kitchen tickets [{ id, title, status, ... }]
        interventions: [], // AI agent interventions [{ id, type, message, options, resolved, response, ... }]
        checkpoints: [],
        pendingQuestions: [],
        todos: [],
        logs: [],
        useConductor: data.useConductor || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

// Migrate old project to agent schema
function migrateProject(p) {
    return {
        id: p.id,
        name: p.name || 'Migrated Project',
        goal: p.goal || '',
        status: p.status === 'planning' ? 'idle' : (p.status === 'working' ? 'running' : p.status),
        workingDir: p.workingDir || null,
        files: [],
        threads: [],
        tickets: [],
        checkpoints: p.checkpoints || [],
        pendingQuestions: p.pendingQuestions || [],
        todos: p.todos || p.comments || [],
        logs: (p.logs || []).slice(-50), // keep last 50 logs to avoid bloat
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: p.updatedAt || new Date().toISOString()
    };
}

class AgentStore {
    constructor() {
        this.agents = new Map();
        this.loaded = false;
    }

    async ensureLoaded() {
        if (this.loaded) return;
        try {
            await mkdir(DATA_DIR, { recursive: true });

            // Try loading agents.json first
            try {
                const data = await readFile(AGENTS_FILE, 'utf-8');
                const agents = JSON.parse(data);
                for (const a of agents) {
                    this.agents.set(a.id, a);
                }
                this.loaded = true;
                return;
            } catch {
                // agents.json doesn't exist yet
            }

            // Migrate from old projects.json
            try {
                const data = await readFile(OLD_PROJECTS_FILE, 'utf-8');
                const projects = JSON.parse(data);
                for (const p of projects) {
                    const agent = migrateProject(p);
                    this.agents.set(agent.id, agent);
                }
                // Save migrated data
                await this.save();
                console.log(`Migrated ${projects.length} projects to agents`);
            } catch {
                // No old data either, start fresh
            }
        } catch {
            // Data dir creation failed
        }
        this.loaded = true;
    }

    async save() {
        await mkdir(DATA_DIR, { recursive: true });
        const agents = Array.from(this.agents.values());
        await writeFile(AGENTS_FILE, JSON.stringify(agents, null, 2));
    }

    async create(data) {
        await this.ensureLoaded();
        const agent = createAgent(data);
        this.agents.set(agent.id, agent);
        await this.save();
        return agent;
    }

    async get(id) {
        await this.ensureLoaded();
        return this.agents.get(id);
    }

    async getAll() {
        await this.ensureLoaded();
        return Array.from(this.agents.values())
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    async update(id, updates) {
        await this.ensureLoaded();
        const agent = this.agents.get(id);
        if (!agent) return null;
        Object.assign(agent, updates, { updatedAt: new Date().toISOString() });
        await this.save();
        return agent;
    }

    async addLog(id, message, type = 'info') {
        await this.ensureLoaded();
        const agent = this.agents.get(id);
        if (!agent) return null;
        agent.logs.push({ message, type, timestamp: new Date().toISOString() });
        agent.updatedAt = new Date().toISOString();
        await this.save();
        return agent;
    }

    async addThread(id, role, content, metadata = null) {
        await this.ensureLoaded();
        const agent = this.agents.get(id);
        if (!agent) return null;
        agent.threads.push({
            id: uuidv4(),
            role,
            content,
            timestamp: new Date().toISOString(),
            metadata
        });
        agent.updatedAt = new Date().toISOString();
        await this.save();
        return agent;
    }

    async addIntervention(id, intervention) {
        await this.ensureLoaded();
        const agent = this.agents.get(id);
        if (!agent) return null;
        if (!agent.interventions) agent.interventions = [];
        const newIntervention = {
            id: uuidv4(),
            ...intervention,
            createdAt: new Date().toISOString(),
            resolved: false,
            response: null
        };
        agent.interventions.push(newIntervention);
        agent.status = 'waiting';
        agent.updatedAt = new Date().toISOString();
        await this.save();
        return newIntervention;
    }

    async resolveIntervention(agentId, interventionId, response) {
        await this.ensureLoaded();
        const agent = this.agents.get(agentId);
        if (!agent) return null;
        const inv = (agent.interventions || []).find(i => i.id === interventionId);
        if (inv) {
            inv.resolved = true;
            inv.response = response;
            inv.resolvedAt = new Date().toISOString();
            
            // Also check if there's a corresponding pendingQuestion with the same message
            const q = (agent.pendingQuestions || []).find(q => q.question === inv.message && !q.answer);
            if (q) {
                q.answer = response;
                q.answeredAt = new Date().toISOString();
            }
        }
        const unresolved = (agent.interventions || []).filter(i => !i.resolved);
        const unansweredQuestions = (agent.pendingQuestions || []).filter(q => !q.answer);
        
        if (unresolved.length === 0 && unansweredQuestions.length === 0 && agent.status === 'waiting') {
            agent.status = 'running';
        }
        agent.updatedAt = new Date().toISOString();
        await this.save();
        return agent;
    }

    async addCheckpoint(id, checkpoint) {
        await this.ensureLoaded();
        const agent = this.agents.get(id);
        if (!agent) return null;
        agent.checkpoints.push({
            id: uuidv4(),
            ...checkpoint,
            createdAt: new Date().toISOString()
        });
        agent.updatedAt = new Date().toISOString();
        await this.save();
        return agent;
    }

    async addQuestion(id, question) {
        await this.ensureLoaded();
        const agent = this.agents.get(id);
        if (!agent) return null;
        agent.pendingQuestions.push({
            id: uuidv4(),
            question,
            answer: null,
            createdAt: new Date().toISOString()
        });
        agent.status = 'waiting';
        agent.updatedAt = new Date().toISOString();
        await this.save();
        return agent;
    }

    async answerQuestion(agentId, questionId, answer) {
        await this.ensureLoaded();
        const agent = this.agents.get(agentId);
        if (!agent) return null;
        const q = agent.pendingQuestions.find(q => q.id === questionId);
        if (q) {
            q.answer = answer;
            q.answeredAt = new Date().toISOString();
        }
        const unanswered = agent.pendingQuestions.filter(q => !q.answer);
        if (unanswered.length === 0 && agent.status === 'waiting') {
            agent.status = 'running';
        }
        agent.updatedAt = new Date().toISOString();
        await this.save();
        return agent;
    }

    async addTodo(id, text) {
        await this.ensureLoaded();
        const agent = this.agents.get(id);
        if (!agent) return null;
        if (!agent.todos) agent.todos = [];
        agent.todos.push({
            id: uuidv4(),
            text,
            processed: false,
            createdAt: new Date().toISOString()
        });
        // Also add to thread as user message
        agent.threads.push({
            id: uuidv4(),
            role: 'user',
            content: text,
            timestamp: new Date().toISOString()
        });
        agent.updatedAt = new Date().toISOString();
        await this.save();
        return agent;
    }

    async markTodoProcessed(agentId, todoId) {
        await this.ensureLoaded();
        const agent = this.agents.get(agentId);
        if (!agent) return null;
        const todo = (agent.todos || []).find(t => t.id === todoId);
        if (todo) todo.processed = true;
        agent.updatedAt = new Date().toISOString();
        await this.save();
        return agent;
    }

    async setFiles(id, files) {
        await this.ensureLoaded();
        const agent = this.agents.get(id);
        if (!agent) return null;
        agent.files = files;
        agent.updatedAt = new Date().toISOString();
        await this.save();
        return agent;
    }

    async addFile(id, file) {
        await this.ensureLoaded();
        const agent = this.agents.get(id);
        if (!agent) return null;
        agent.files.push(file);
        agent.updatedAt = new Date().toISOString();
        await this.save();
        return agent;
    }

    async removeFile(id, filePath) {
        await this.ensureLoaded();
        const agent = this.agents.get(id);
        if (!agent) return null;
        agent.files = agent.files.filter(f => f.path !== filePath);
        agent.updatedAt = new Date().toISOString();
        await this.save();
        return agent;
    }

    async delete(id) {
        await this.ensureLoaded();
        const deleted = this.agents.delete(id);
        if (deleted) await this.save();
        return deleted;
    }
}

export const agentStore = new AgentStore();
