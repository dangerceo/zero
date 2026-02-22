import { exec } from 'child_process';
import { promisify } from 'util';

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
        this.interval = setInterval(() => this.poll(), 30000); // Poll every 30 seconds
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    async poll() {
        try {
            const { stdout } = await execAsync('agy -s');
            const newProjects = this.parseOutput(stdout);

            if (JSON.stringify(newProjects) !== JSON.stringify(this.projects)) {
                this.projects = newProjects;
                if (this.broadcast) {
                    this.broadcast({ type: 'agy:projects', projects: this.projects });
                }
            }
        } catch (error) {
            console.error('Error polling agy -s:', error.message);
        }
    }

    parseOutput(stdout) {
        const projects = [];
        const lines = stdout.split('\n');

        // Parse "Window (...)" entries
        const windowMatches = stdout.matchAll(/Window \((.*?) — (.*?)\)/g);
        for (const match of windowMatches) {
            const name = match[1];
            if (!projects.find(p => p.name === name)) {
                projects.push({
                    id: `agy-win-${name}`,
                    name,
                    type: 'window',
                    status: 'active'
                });
            }
        }

        // Parse "Folder (...)" entries
        const folderMatches = stdout.matchAll(/Folder \((.*?)\):/g);
        for (const match of folderMatches) {
            const name = match[1];
            if (!projects.find(p => p.name === name)) {
                projects.push({
                    id: `agy-dir-${name}`,
                    name,
                    type: 'folder',
                    status: 'active'
                });
            }
        }

        return projects;
    }

    getProjects() {
        return this.projects;
    }
}

export const agyService = new AgyService();
