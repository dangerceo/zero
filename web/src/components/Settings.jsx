import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import Editor from '@monaco-editor/react';
import { WebContainer } from '@webcontainer/api';
import TeslaDashboard from './TeslaDashboard';

function Settings({ agents, agyProjects, onBack }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);
    const [inspectingProject, setInspectingProject] = useState(null);
    const [dashboardTab, setDashboardTab] = useState('workspaces'); 
    const [settings, setSettings] = useState({
        provider: 'claude',
        claudeApiKey: '',
        geminiApiKey: '',
        enableTunnel: true,
        enableAntigravity: true,
        enableTelemetry: true
    });
    const [androidUpdate, setAndroidUpdate] = useState(null);

    useEffect(() => {
        fetch('/api/settings').then(res => res.json()).then(setSettings).catch(console.error);
        fetch('/api/android/update').then(res => res.json()).then(setAndroidUpdate).catch(() => {});
    }, []);

    const saveSettings = async (newSettings) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
        });
    };

    const projects = [...agents, ...agyProjects];

    return (
        <div className='settings' style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px' }}>
            <div className='projects-header' style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                <button className='back-btn' onClick={onBack} style={{ background: 'none', border: '1px solid var(--border)', padding: '8px 16px', cursor: 'pointer' }}>← Back</button>
                <h2 style={{ margin: 0 }}>System Settings</h2>
            </div>

            <div className='dashboard-tabs' style={{ display: 'flex', gap: '24px', marginBottom: '32px', borderBottom: '1px solid var(--border)' }}>
                {['workspaces', 'modules', 'advanced'].map(t => (
                    <button 
                        key={t}
                        className={'tab-btn ' + (dashboardTab === t ? 'active' : '')}
                        onClick={() => setDashboardTab(t)}
                        style={{ background: 'none', border: 'none', padding: '12px 4px', color: dashboardTab === t ? 'var(--fg)' : 'var(--fg3)', borderBottom: dashboardTab === t ? '2px solid var(--accent)' : 'none', fontWeight: 'bold', cursor: 'pointer', textTransform: 'capitalize' }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {dashboardTab === 'workspaces' && (
                <div className='inspector-list' style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {projects.map(p => (
                        <div key={p.id} className='inspector-item' style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', background: 'var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h4 style={{ margin: '0 0 4px 0' }}>{p.name}</h4>
                                <code style={{ fontSize: '11px', color: 'var(--fg3)' }}>{p.path || p.workingDir || 'Remote'}</code>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--success)' }}>● {p.status || 'idle'}</div>
                        </div>
                    ))}
                </div>
            )}

            {dashboardTab === 'modules' && <TeslaDashboard />}

            {dashboardTab === 'advanced' && (
                <div className='advanced-settings' style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <section style={{ background: 'var(--bg2)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <h3 style={{ marginBottom: '16px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Mobile Distribution</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Android Application (APK)</div>
                                <div style={{ fontSize: '12px', color: 'var(--fg3)' }}>Latest build available for self-update.</div>
                            </div>
                            {androidUpdate ? (
                                <button 
                                    className='primary-btn' 
                                    onClick={() => window.open(androidUpdate.url)}
                                    style={{ padding: '8px 20px', fontSize: '12px', background: 'var(--success)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}
                                >
                                    Download v{androidUpdate.version}
                                </button>
                            ) : (
                                <div style={{ fontSize: '12px', color: 'var(--error)' }}>No APK found on server.</div>
                            )}
                        </div>
                    </section>

                    <section style={{ background: 'var(--bg2)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <h3 style={{ marginBottom: '16px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Connectivity & Modules</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                <span>Cloudflare Tunnel (Remote Access)</span>
                                <input type='checkbox' checked={settings.enableTunnel} onChange={e => saveSettings({ enableTunnel: e.target.checked })} />
                            </label>
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                <span>Antigravity Scanning (Brain Discovery)</span>
                                <input type='checkbox' checked={settings.enableAntigravity} onChange={e => saveSettings({ enableAntigravity: e.target.checked })} />
                            </label>
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                                <span>System & Tesla Telemetry</span>
                                <input type='checkbox' checked={settings.enableTelemetry} onChange={e => saveSettings({ enableTelemetry: e.target.checked })} />
                            </label>
                        </div>
                    </section>

                    <section style={{ background: 'var(--bg2)', padding: '20px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <h3 style={{ marginBottom: '16px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>AI Provider</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <select value={settings.provider} onChange={e => saveSettings({ provider: e.target.value })} style={{ padding: '8px', background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)' }}>
                                <option value='claude'>Anthropic Claude</option>
                                <option value='gemini'>Google Gemini</option>
                            </select>
                            {settings.provider === 'claude' ? (
                                <input type='password' placeholder='Claude API Key' value={settings.claudeApiKey} onChange={e => saveSettings({ claudeApiKey: e.target.value })} style={{ padding: '8px', background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)' }} />
                            ) : (
                                <input type='password' placeholder='Gemini API Key' value={settings.geminiApiKey} onChange={e => saveSettings({ geminiApiKey: e.target.value })} style={{ padding: '8px', background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)' }} />
                            )}
                        </div>
                    </section>
                    
                    <p style={{ fontSize: '12px', color: 'var(--fg3)', textAlign: 'center' }}>Restart Zero for some changes to take effect.</p>
                </div>
            )}
        </div>
    );
}

export default Settings;
