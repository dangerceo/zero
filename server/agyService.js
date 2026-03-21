import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

const execAsync = promisify(exec);

class AgyService {
    constructor() {
        this.projects = [];
        this.interval = null;
        this.broadcast = null;
    }

    start(broadcast) {
        this.broadcast = broadcast;
        this.poll();
        this.interval = setInterval(() => this.poll(), 60000); 
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    async poll() {
        try {
            const agyProjects = await this.getAgyProjects();
            const geminiProjects = await this.discoverGeminiProjects();
            const zeroProjects = await this.discoverZeroProjects();
            const sessions = await this.getGeminiSessions();

            const allProjects = [
                ...agyProjects,
                ...geminiProjects,
                ...zeroProjects,
                ...sessions
            ];

            if (JSON.stringify(allProjects) !== JSON.stringify(this.projects)) {
                this.projects = allProjects;
                if (this.broadcast) {
                    this.broadcast({ type: 'agy:projects', projects: this.projects });
                }
            }
        } catch (error) {
            console.error('Error in agyService polling:', error.message);
        }
    }

    async getAgyProjects() {
        try {
            const { stdout } = await execAsync('agy -s');
            return this.parseOutput(stdout);
        } catch { return []; }
    }

    async discoverZeroProjects() {
        const zeroDir = path.join(homedir(), 'ZeroProjects');
        if (!fs.existsSync(zeroDir)) return [];

        try {
            const dirs = fs.readdirSync(zeroDir);
            const projects = [];

            for (const id of dirs) {
                if (id.startsWith('.')) continue;
                const folderPath = path.join(zeroDir, id);
                if (!fs.statSync(folderPath).isDirectory()) continue;

                let name = id;
                const readmePath = path.join(folderPath, 'README.md');
                const pkgPath = path.join(folderPath, 'package.json');

                if (fs.existsSync(readmePath)) {
                    const content = fs.readFileSync(readmePath, 'utf8');
                    const match = content.match(/^# (.*)/);
                    if (match) name = match[1].trim();
                } else if (fs.existsSync(pkgPath)) {
                    try {
                        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                        if (pkg.name) name = pkg.name;
                    } catch {}
                }

                projects.push({
                    id: 'zero-project-' + id,
                    name,
                    type: 'zero-project',
                    status: 'stored',
                    path: folderPath
                });
            }
            return projects;
        } catch (e) { return []; }
    }

    async discoverGeminiProjects() {
        const brainDir = path.join(homedir(), '.gemini', 'antigravity', 'brain');
        if (!fs.existsSync(brainDir)) return [];

        try {
            const dirs = fs.readdirSync(brainDir);
            const projects = [];

            for (const id of dirs) {
                if (id === '.DS_Store') continue;
                const folderPath = path.join(brainDir, id);
                if (!fs.statSync(folderPath).isDirectory()) continue;

                const taskFile = path.join(folderPath, 'task.md');
                let name = id;

                if (fs.existsSync(taskFile)) {
                    const content = fs.readFileSync(taskFile, 'utf8');
                    const titleMatch = content.match(/^# (.*)/);
                    if (titleMatch) name = titleMatch[1];
                }

                projects.push({
                    id: 'gemini-brain-' + id,
                    name,
                    type: 'gemini-agent',
                    status: 'stored',
                    path: folderPath
                });
            }
            return projects.sort((a, b) => b.id.localeCompare(a.id));
        } catch (e) { return []; }
    }

    async getGeminiSessions() {
        try {
            const { stdout } = await execAsync('gemini --list-sessions');
            const sessions = [];
            const lines = stdout.split('\n');

            for (const line of lines) {
                const match = line.match(/^\s+(\d+)\.\s+(.*?)\s+\((.*?)\)\s+\[(.*?)\]/);
                if (match) {
                    sessions.push({
                        id: 'gemini-session-' + match[4],
                        name: match[2],
                        type: 'gemini-session',
                        status: 'active',
                        age: match[3]
                    });
                }
            }
            return sessions;
        } catch (e) { return []; }
    }

    parseOutput(stdout) {
        const projects = [];
        const windowMatches = stdout.matchAll(/Window \((.*?) — (.*?)\)/g);
        for (const match of windowMatches) {
            const name = match[1];
            if (!projects.find(p => p.name === name)) {
                projects.push({ id: 'agy-win-' + name, name, type: 'window', status: 'active' });
            }
        }
        const folderMatches = stdout.matchAll(/Folder \((.*?)\):/g);
        for (const match of folderMatches) {
            const name = match[1];
            if (!projects.find(p => p.name === name)) {
                projects.push({ id: 'agy-dir-' + name, name, type: 'folder', status: 'active' });
            }
        }
        return projects;
    }

    getProjects() {
        return this.projects;
    }
}

export const agyService = new AgyService();
