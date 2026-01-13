import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SKILLS_DIR = join(__dirname, '../skills');

// Find a matching skill for the given task description
export async function findSkill(description) {
    try {
        const files = await readdir(SKILLS_DIR);
        const skillFiles = files.filter(f => f.endsWith('.json'));

        const lowerDesc = description.toLowerCase();

        for (const file of skillFiles) {
            const content = await readFile(join(SKILLS_DIR, file), 'utf-8');
            const skill = JSON.parse(content);

            // Check if any trigger matches
            const matches = skill.triggers?.some(trigger =>
                lowerDesc.includes(trigger.toLowerCase())
            );

            if (matches) {
                // Increment usage count
                skill.timesUsed = (skill.timesUsed || 0) + 1;
                await writeFile(join(SKILLS_DIR, file), JSON.stringify(skill, null, 2));
                return skill;
            }
        }
    } catch (error) {
        // Skills directory might be empty or not exist
        console.log('No skills found:', error.message);
    }

    return null;
}

// Save a new skill
export async function saveSkill(skill) {
    const filename = `${skill.name}.json`;
    const fullSkill = {
        ...skill,
        createdAt: new Date().toISOString(),
        timesUsed: 0
    };

    await writeFile(
        join(SKILLS_DIR, filename),
        JSON.stringify(fullSkill, null, 2)
    );

    return fullSkill;
}

// Get all skills
export async function getAllSkills() {
    try {
        const files = await readdir(SKILLS_DIR);
        const skillFiles = files.filter(f => f.endsWith('.json'));

        const skills = await Promise.all(
            skillFiles.map(async (file) => {
                const content = await readFile(join(SKILLS_DIR, file), 'utf-8');
                return JSON.parse(content);
            })
        );

        return skills.sort((a, b) => (b.timesUsed || 0) - (a.timesUsed || 0));
    } catch (error) {
        return [];
    }
}

// Delete a skill
export async function deleteSkill(name) {
    const { unlink } = await import('fs/promises');
    await unlink(join(SKILLS_DIR, `${name}.json`));
}
