import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const AGY_DIR = join(homedir(), '.gemini', 'antigravity');

export async function getProjects() {
    const brainDir = join(AGY_DIR, 'brain');
    const projects = [];

    try {
        const entries = await readdir(brainDir);

        for (const entry of entries) {
            if (entry.startsWith('.')) continue;

            const projectPath = join(brainDir, entry);
            const projectStat = await stat(projectPath);

            if (!projectStat.isDirectory()) continue;

            // Try to read task.md or implementation_plan.md for project info
            let name = entry;
            let summary = '';
            let status = 'unknown';

            try {
                const taskPath = join(projectPath, 'task.md');
                const taskContent = await readFile(taskPath, 'utf-8');

                // Extract first heading as name
                const headingMatch = taskContent.match(/^#\s+(.+)/m);
                if (headingMatch) name = headingMatch[1];

                // Count completed vs total items
                const totalItems = (taskContent.match(/- \[[ x]\]/g) || []).length;
                const completedItems = (taskContent.match(/- \[x\]/gi) || []).length;

                if (totalItems > 0) {
                    status = `${completedItems}/${totalItems} done`;
                }

                summary = taskContent.slice(0, 200);
            } catch (e) {
                // No task.md, try implementation_plan.md
                try {
                    const planPath = join(projectPath, 'implementation_plan.md');
                    const planContent = await readFile(planPath, 'utf-8');
                    const headingMatch = planContent.match(/^#\s+(.+)/m);
                    if (headingMatch) name = headingMatch[1];
                    summary = planContent.slice(0, 200);
                } catch (e2) {
                    // No plan either
                }
            }

            projects.push({
                id: entry,
                name,
                status,
                summary: summary.replace(/\n/g, ' ').slice(0, 100),
                updatedAt: projectStat.mtime.toISOString()
            });
        }

        // Sort by most recently updated
        projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    } catch (e) {
        console.error('Error reading projects:', e.message);
    }

    return projects;
}

export async function getProjectDetails(projectId) {
    const projectPath = join(AGY_DIR, 'brain', projectId);

    try {
        const files = await readdir(projectPath);
        const details = { id: projectId, files: [] };

        for (const file of files) {
            if (file.endsWith('.md')) {
                const content = await readFile(join(projectPath, file), 'utf-8');
                details.files.push({ name: file, content });
            }
        }

        return details;
    } catch (e) {
        return null;
    }
}
