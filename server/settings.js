import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SETTINGS_FILE = join(__dirname, '../.settings.json');

const defaults = {
    provider: 'claude', // 'claude' or 'gemini'
    claudeApiKey: '',
    geminiApiKey: '',
    model: 'claude-sonnet-4-20250514'
};

export async function getSettings() {
    try {
        const data = await readFile(SETTINGS_FILE, 'utf-8');
        return { ...defaults, ...JSON.parse(data) };
    } catch {
        return defaults;
    }
}

export async function saveSettings(settings) {
    const current = await getSettings();
    const updated = { ...current, ...settings };
    await writeFile(SETTINGS_FILE, JSON.stringify(updated, null, 2));
    return updated;
}

export async function callLLM(prompt, systemPrompt = '') {
    const settings = await getSettings();

    if (settings.provider === 'claude' && settings.claudeApiKey) {
        return await callClaude(prompt, systemPrompt, settings);
    } else if (settings.provider === 'gemini' && settings.geminiApiKey) {
        return await callGemini(prompt, systemPrompt, settings);
    } else {
        throw new Error('No API key configured. Go to Settings.');
    }
}

async function callClaude(prompt, systemPrompt, settings) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.claudeApiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: settings.model || 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: systemPrompt || 'You are a helpful assistant that plans computer automation tasks.',
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Claude API error: ${err}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
}

async function callGemini(prompt, systemPrompt, settings) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${settings.geminiApiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt }]
            }]
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Gemini API error: ${err}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
