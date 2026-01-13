import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '../data');
const PROJECTS_FILE = join(DATA_DIR, 'projects.json');

// Project schema
function createProject(data) {
    return {
        id: uuidv4(),
        name: data.name || 'Untitled Project',
        goal: data.goal || '',
        status: 'planning', // planning, working, paused, waiting, completed, failed
        workingDir: data.workingDir || null,
        checkpoints: [],
        pendingQuestions: [],
        comments: [],  // Follow-up instructions queue
        confidence: null, // 0-100 rating on likelihood of independent completion
        confidenceReason: null,
        currentTask: null,
        logs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}


// In-memory store with disk persistence
class ProjectStore {
    constructor() {
        this.projects = new Map();
        this.loaded = false;
    }

    async ensureLoaded() {
        if (this.loaded) return;
        try {
            await mkdir(DATA_DIR, { recursive: true });
            const data = await readFile(PROJECTS_FILE, 'utf-8');
            const projects = JSON.parse(data);
            for (const p of projects) {
                this.projects.set(p.id, p);
            }
        } catch (e) {
            // File doesn't exist yet, that's fine
        }
        this.loaded = true;
    }

    async save() {
        await mkdir(DATA_DIR, { recursive: true });
        const projects = Array.from(this.projects.values());
        await writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2));
    }

    async create(data) {
        await this.ensureLoaded();
        const project = createProject(data);
        this.projects.set(project.id, project);
        await this.save();
        return project;
    }

    async get(id) {
        await this.ensureLoaded();
        return this.projects.get(id);
    }

    async getAll() {
        await this.ensureLoaded();
        return Array.from(this.projects.values())
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    async update(id, updates) {
        await this.ensureLoaded();
        const project = this.projects.get(id);
        if (!project) return null;
        Object.assign(project, updates, { updatedAt: new Date().toISOString() });
        await this.save();
        return project;
    }

    async addLog(id, message, type = 'info') {
        await this.ensureLoaded();
        const project = this.projects.get(id);
        if (!project) return null;
        project.logs.push({
            message,
            type,
            timestamp: new Date().toISOString()
        });
        project.updatedAt = new Date().toISOString();
        await this.save();
        return project;
    }

    async addCheckpoint(id, checkpoint) {
        await this.ensureLoaded();
        const project = this.projects.get(id);
        if (!project) return null;
        project.checkpoints.push({
            id: uuidv4(),
            ...checkpoint,
            createdAt: new Date().toISOString()
        });
        project.updatedAt = new Date().toISOString();
        await this.save();
        return project;
    }

    async addQuestion(id, question) {
        await this.ensureLoaded();
        const project = this.projects.get(id);
        if (!project) return null;
        project.pendingQuestions.push({
            id: uuidv4(),
            question,
            answer: null,
            createdAt: new Date().toISOString()
        });
        project.status = 'waiting';
        project.updatedAt = new Date().toISOString();
        await this.save();
        return project;
    }

    async answerQuestion(projectId, questionId, answer) {
        await this.ensureLoaded();
        const project = this.projects.get(projectId);
        if (!project) return null;
        const q = project.pendingQuestions.find(q => q.id === questionId);
        if (q) {
            q.answer = answer;
            q.answeredAt = new Date().toISOString();
        }
        // Resume if no more unanswered questions
        const unanswered = project.pendingQuestions.filter(q => !q.answer);
        if (unanswered.length === 0 && project.status === 'waiting') {
            project.status = 'working';
        }
        project.updatedAt = new Date().toISOString();
        await this.save();
        return project;
    }

    async addComment(id, comment) {
        await this.ensureLoaded();
        const project = this.projects.get(id);
        if (!project) return null;
        if (!project.comments) project.comments = [];
        project.comments.push({
            id: uuidv4(),
            text: comment,
            processed: false,
            createdAt: new Date().toISOString()
        });
        project.updatedAt = new Date().toISOString();
        await this.save();
        return project;
    }

    async markCommentProcessed(projectId, commentId) {
        await this.ensureLoaded();
        const project = this.projects.get(projectId);
        if (!project) return null;
        const comment = (project.comments || []).find(c => c.id === commentId);
        if (comment) comment.processed = true;
        project.updatedAt = new Date().toISOString();
        await this.save();
        return project;
    }

    async delete(id) {
        await this.ensureLoaded();
        const deleted = this.projects.delete(id);
        if (deleted) await this.save();
        return deleted;
    }
}

export const projectStore = new ProjectStore();
