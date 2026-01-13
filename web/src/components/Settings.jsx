import React, { useState, useEffect } from 'react';

function Settings({ onBack }) {
    const [settings, setSettings] = useState({
        provider: 'claude',
        claudeApiKey: '',
        geminiApiKey: '',
        model: 'claude-sonnet-4-20250514'
    });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        fetch('/api/settings')
            .then(r => r.json())
            .then(setSettings);
    }, []);

    const handleSave = async () => {
        setSaving(true);
        const toSave = { ...settings };
        // Don't send masked keys
        if (toSave.claudeApiKey?.startsWith('••••')) delete toSave.claudeApiKey;
        if (toSave.geminiApiKey?.startsWith('••••')) delete toSave.geminiApiKey;

        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(toSave)
        });
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="settings">
            <div className="projects-header">
                <button className="back-btn" onClick={onBack}>←</button>
                <h2>Settings</h2>
            </div>

            <div className="settings-form">
                <div className="setting-group">
                    <label>AI Provider</label>
                    <div className="radio-group">
                        <label className={`radio-option ${settings.provider === 'claude' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="provider"
                                value="claude"
                                checked={settings.provider === 'claude'}
                                onChange={e => setSettings({ ...settings, provider: e.target.value })}
                            />
                            Claude
                        </label>
                        <label className={`radio-option ${settings.provider === 'gemini' ? 'selected' : ''}`}>
                            <input
                                type="radio"
                                name="provider"
                                value="gemini"
                                checked={settings.provider === 'gemini'}
                                onChange={e => setSettings({ ...settings, provider: e.target.value })}
                            />
                            Gemini
                        </label>
                    </div>
                </div>

                <div className="setting-group">
                    <label>Claude API Key</label>
                    <input
                        type="password"
                        className="setting-input"
                        placeholder="sk-ant-..."
                        value={settings.claudeApiKey}
                        onChange={e => setSettings({ ...settings, claudeApiKey: e.target.value })}
                    />
                </div>

                <div className="setting-group">
                    <label>Gemini API Key</label>
                    <input
                        type="password"
                        className="setting-input"
                        placeholder="AIza..."
                        value={settings.geminiApiKey}
                        onChange={e => setSettings({ ...settings, geminiApiKey: e.target.value })}
                    />
                </div>

                <button className="save-btn" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Settings'}
                </button>

                <p className="settings-note">
                    Your API keys are stored locally on your computer.
                </p>
            </div>
        </div>
    );
}

export default Settings;
