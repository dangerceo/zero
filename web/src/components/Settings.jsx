import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import TeslaDashboard from './TeslaDashboard';

function Settings({ agents, agyProjects, previewPorts, onBack }) {
    const { id: routeId } = useParams();
    const navigate = useNavigate();
    const [selectedProject, setSelectedProject] = useState(null);
    const [inspectingProject, setInspectingProject] = useState(null);
    const [fileTree, setFileTree] = useState(null);
    const [openFile, setOpenFile] = useState(null);
    const [fileContent, setFileContent] = useState('');
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
    const [systemTools, setSystemTools] = useState([]);
    const [maintenanceStatus, setMaintenanceStatus] = useState('idle'); // idle, building, success, error
    const [maintenanceError, setMaintenanceError] = useState(null);
    const [collapsedSections, setCollapsedSections] = useState({
        'automation-tool': false,
        'danger-model': false,
        'maintenance': false,
        'mobile-dist': true,
        'security': true,
        'ai-provider': true
    });

    const toggleSection = (id) => {
        setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const projects = [...agents, ...agyProjects];

    useEffect(() => {
        fetch('/api/settings').then(res => res.json()).then(setSettings).catch(console.error);
        fetch('/api/android/update').then(res => res.json()).then(setAndroidUpdate).catch(() => {});
        fetch('/api/system/tools').then(res => res.json()).then(setSystemTools).catch(() => {});
    }, []);

    useEffect(() => {
        if (routeId) {
            const p = projects.find(proj => proj.id === routeId);
            if (p) {
                setInspectingProject(p);
                loadProjectTree(p);
            }
        } else {
            setInspectingProject(null);
        }
    }, [routeId, agents.length, agyProjects.length]);

    const loadProjectTree = async (project) => {
        const path = project.workingDir || project.path;
        if (!path) return;
        try {
            const res = await fetch('/api/files/browse?path=' + encodeURIComponent(path));
            const data = await res.json();
            setFileTree(data);
        } catch (e) { console.error('Failed to load file tree:', e); }
    };

    const joinPaths = (p1, p2) => {
        if (!p1) return p2;
        if (!p2) return p1;
        return p1.endsWith('/') ? p1 + p2 : p1 + '/' + p2;
    };

    const handleFileClick = async (item) => {
        if (item.isDir) {
            try {
                const newPath = joinPaths(fileTree.path, item.name);
                const res = await fetch('/api/files/browse?path=' + encodeURIComponent(newPath));
                const data = await res.json();
                setFileTree(data);
            } catch (e) { console.error(e); }
        } else {
            setOpenFile(item.name);
            const fullPath = joinPaths(fileTree.path, item.name);
            try {
                const res = await fetch('/api/files/export-tree?path=' + encodeURIComponent(fullPath));
                const data = await res.json();
                const fileData = data[item.name]?.file;
                if (fileData) {
                    setFileContent(fileData.isBinary ? 'Binary file (cannot display)' : fileData.contents);
                }
            } catch (e) { console.error(e); }
        }
    };

    const saveSettings = async (newSettings) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
        });
    };

    const handleRebuildAndRestart = async () => {
        if (!window.confirm('This will rebuild the frontend and restart the Zero server. You will be disconnected temporarily. Continue?')) return;
        
        setMaintenanceStatus('building');
        setMaintenanceError(null);
        
        try {
            const res = await fetch('/api/system/rebuild-and-restart', { method: 'POST' });
            const data = await res.json();
            
            if (data.status === 'ok') {
                setMaintenanceStatus('success');
            } else {
                setMaintenanceStatus('error');
                setMaintenanceError(data.output || data.message || 'Unknown error');
            }
        } catch (err) {
            setMaintenanceStatus('error');
            setMaintenanceError(err.message);
        }
    };

    if (inspectingProject) {
        return (
            <div className='settings ide-mode'>
                <div className='ide-layout' style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                    <div className='sidebar-header' style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button className='icon-btn' onClick={() => navigate('/dashboard')} title='Back to Projects'>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                        </button>
                        <span className='project-name' style={{ fontWeight: 'bold' }}>{inspectingProject.name}</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                            <button className='mini-btn' onClick={() => window.open(window.location.protocol + '//' + window.location.host + '/api/files/export-tree?path=' + encodeURIComponent(inspectingProject.workingDir || inspectingProject.path))}>Export</button>
                        </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                        <aside className='ide-sidebar' style={{ width: '240px', borderRight: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', flexDirection: 'column' }}>
                            <div className='sidebar-tree' style={{ padding: '8px', overflowY: 'auto', flex: 1 }}>
                                {fileTree ? (
                                    <>
                                        <div style={{ fontSize: '10px', color: 'var(--fg3)', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileTree.path}</div>
                                        {fileTree.parent && (
                                            <div className='tree-item' onClick={async () => {
                                                const res = await fetch('/api/files/browse?path=' + encodeURIComponent(fileTree.parent));
                                                setFileTree(await res.json());
                                            }}>
                                                <span className='tree-icon'>📁</span> ..
                                            </div>
                                        )}
                                        {fileTree.items.map(item => (
                                            <div key={item.name} className={'tree-item ' + (openFile === item.name ? 'active' : '')} onClick={() => handleFileClick(item)}>
                                                <span className='tree-icon'>{item.isDir ? '📁' : '📄'}</span> {item.name}
                                            </div>
                                        ))}
                                    </>
                                ) : <div className='loading-mini'>Loading tree...</div>}
                            </div>
                        </aside>
                        <main className='ide-editor-area' style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
                            <div className='editor-tabs' style={{ background: '#252526', padding: '0 8px', height: '35px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #111' }}>
                                {openFile && <div className='active-tab' style={{ background: '#1e1e1e', color: '#fff', padding: '0 12px', height: '100%', display: 'flex', alignItems: 'center', fontSize: '12px' }}>{openFile}</div>}
                            </div>
                            <div style={{ flex: 1 }}>
                                {openFile ? (
                                    <Editor
                                        height="100%"
                                        theme="vs-dark"
                                        path={openFile}
                                        value={fileContent}
                                        options={{
                                            readOnly: true,
                                            fontSize: 13,
                                            minimap: { enabled: false },
                                            scrollBeyondLastLine: false,
                                            automaticLayout: true
                                        }}
                                    />
                                ) : (
                                    <div className='editor-empty' style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
                                        <h3>No file selected</h3>
                                        <p style={{ fontSize: '13px' }}>Select a file from the sidebar to view its contents.</p>
                                    </div>
                                )}
                            </div>
                        </main>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='settings' style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', background: 'var(--bg)', minHeight: '100vh', color: 'var(--fg)' }}>
            <div className='projects-header' style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '40px' }}>
                <button 
                    className='back-btn' 
                    onClick={onBack} 
                    title="Back" 
                    style={{ 
                        background: 'var(--bg2)', 
                        border: '1px solid var(--border)', 
                        padding: '10px', 
                        cursor: 'pointer', 
                        borderRadius: '50%', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        width: '44px',
                        height: '44px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg)'; e.currentTarget.style.borderColor = 'var(--fg3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg2)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                </button>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>System Settings</h1>
            </div>

            <div className='dashboard-tabs' style={{ display: 'flex', gap: '24px', marginBottom: '32px', borderBottom: '1px solid var(--border)' }}>
                {['workspaces', 'danger terminal', 'network', 'advanced'].map(t => (
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                    <TeslaDashboard />
                    
                    <div className='inspector-list' style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h3 className='section-label' style={{ marginBottom: '8px' }}>Active Projects & Agents</h3>
                        {projects.map(p => (
                            <div 
                                key={p.id} 
                                className='inspector-item' 
                                onClick={() => navigate('/dashboard/project/' + p.id)}
                                style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', background: 'var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'transform 0.1s' }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--fg3)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                            >
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0' }}>{p.name}</h4>
                                    <code style={{ fontSize: '11px', color: 'var(--fg3)' }}>{p.path || p.workingDir || 'Remote'}</code>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ fontSize: '12px', color: p.status === 'running' ? 'var(--success)' : 'var(--fg3)' }}>● {p.status || 'idle'}</div>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ opacity: 0.5 }}><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {dashboardTab === 'danger terminal' && (
                <div className='modules-settings' style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <section style={{ background: 'var(--bg2)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div onClick={() => toggleSection('automation-tool')} style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'var(--bg2)' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--fg2)' }}>Primary Automation Tool</h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedSections['automation-tool'] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M18 15l-6-6-6 6"/></svg>
                        </div>
                        {!collapsedSections['automation-tool'] && (
                            <div style={{ padding: '0 24px 24px 24px' }}>
                                <p style={{ margin: '0 0 20px 0', color: 'var(--fg3)', fontSize: '14px' }}>
                                    Select the engine that drives your agents. These tools must be installed on your system.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {systemTools.map(tool => {
                                        const isEnabled = (settings.modules || []).find(m => m.enabled)?.command === tool.command;
                                        return (
                                        <div key={tool.id} onClick={() => tool.installed && saveSettings({ modules: systemTools.map(t => ({ id: t.id, name: t.name, command: t.command, enabled: t.command === tool.command })) })} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: isEnabled ? 'var(--bg)' : 'transparent', padding: '16px', borderRadius: '8px', border: '1px solid ' + (isEnabled ? 'var(--accent)' : 'var(--border)'), opacity: tool.installed ? 1 : 0.5, cursor: tool.installed ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {tool.name}
                                                    {!tool.installed && <span style={{ fontSize: '10px', background: 'var(--bg)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>Not Installed</span>}
                                                </h4>
                                                <code style={{ fontSize: '11px', color: 'var(--fg3)' }}>{tool.path || `Command: ${tool.command}`}</code>
                                            </div>
                                            <input
                                                type='radio'
                                                name='enabled-module'
                                                checked={isEnabled}
                                                readOnly
                                                style={{ cursor: tool.installed ? 'pointer' : 'not-allowed' }}
                                            />
                                        </div>
                                    )})}
                                </div>
                            </div>
                        )}
                    </section>

                    <section style={{ background: 'var(--bg2)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div onClick={() => toggleSection('danger-model')} style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'var(--bg2)' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--fg2)' }}>Danger Mode</h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedSections['danger-model'] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M18 15l-6-6-6 6"/></svg>
                        </div>
                        {!collapsedSections['danger-model'] && (
                            <div style={{ padding: '0 24px 24px 24px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {[
                                        { val: 0, label: '🛡️ Zero Danger (Strict Remote)', desc: 'Remote access requires a Passkey.' },
                                        { val: 1, label: '⚡ Normal Danger', desc: 'Standard security rules.' },
                                        { val: 2, label: '☠️ Dangermaxxing', desc: 'Full autonomy mode.' }
                                    ].map(opt => (
                                        <label key={opt.val} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '16px', borderRadius: '8px', background: settings.riskTolerance === opt.val ? 'var(--bg)' : 'transparent', border: '1px solid ' + (settings.riskTolerance === opt.val ? 'var(--accent)' : 'var(--border)'), transition: 'all 0.2s' }}>
                                            <input 
                                                type='radio' 
                                                name='riskTolerance' 
                                                checked={settings.riskTolerance === opt.val} 
                                                onChange={() => saveSettings({ riskTolerance: opt.val })}
                                                style={{ marginTop: '4px' }}
                                            />
                                            <div>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{opt.label}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--fg3)' }}>{opt.desc}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    <section style={{ background: 'var(--bg2)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div onClick={() => toggleSection('ai-provider')} style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'var(--bg2)' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--fg2)' }}>AI Provider</h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedSections['ai-provider'] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M18 15l-6-6-6 6"/></svg>
                        </div>
                        {!collapsedSections['ai-provider'] && (
                            <div style={{ padding: '0 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <select value={settings.provider} onChange={e => saveSettings({ provider: e.target.value })} style={{ width: '100%', padding: '12px', background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                    <option value='claude'>Anthropic Claude</option>
                                    <option value='gemini'>Google Gemini</option>
                                </select>
                                <input type='password' placeholder='API Key' value={settings.provider === 'claude' ? settings.claudeApiKey : settings.geminiApiKey} onChange={e => saveSettings({ [settings.provider === 'claude' ? 'claudeApiKey' : 'geminiApiKey']: e.target.value })} style={{ width: '100%', padding: '12px', background: 'var(--bg)', color: 'var(--fg)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                <p style={{ fontSize: '11px', color: 'var(--fg3)', marginTop: '4px' }}>Restart Zero for model changes to take effect.</p>
                            </div>
                        )}
                    </section>
                </div>
            )}

            {dashboardTab === 'network' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ background: 'var(--bg2)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border)' }}>
                        <div style={{ marginBottom: '20px' }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>Active Previews</h3>
                            <p style={{ margin: 0, color: 'var(--fg3)', fontSize: '14px' }}>Zero automatically detects active dev servers and exposes them safely via http-proxy to allow cross-device preview testing.</p>
                        </div>
                        {previewPorts && previewPorts.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {previewPorts.map(p => (
                                    <div key={p.port} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ fontSize: '18px', display: 'flex', width: '32px', height: '32px', background: 'var(--bg3)', borderRadius: '6px', alignItems: 'center', justifyContent: 'center' }}>🌐</span>
                                            <div>
                                                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>Port {p.port}</div>
                                                <div style={{ fontSize: '11px', color: 'var(--fg3)', marginTop: '2px', wordBreak: 'break-all' }}>{p.path || 'Unknown Path'}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></span> Active Proxy
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className='primary-btn' style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--accent)', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={() => window.open(`/host/${p.port}`, '_blank')}>Open Tab</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--fg3)', background: 'var(--bg)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                                <div style={{ fontSize: '24px', marginBottom: '8px' }}>📡</div>
                                No active preview ports detected. Start a server (e.g., npm run dev) to see it here.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {dashboardTab === 'advanced' && (
                <div className='advanced-settings' style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <section style={{ background: 'var(--bg2)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div onClick={() => toggleSection('maintenance')} style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'var(--bg2)' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--fg2)' }}>System Maintenance</h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedSections['maintenance'] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M18 15l-6-6-6 6"/></svg>
                        </div>
                        {!collapsedSections['maintenance'] && (
                            <div style={{ padding: '0 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Rebuild & Restart</div>
                                        <div style={{ fontSize: '12px', color: 'var(--fg3)' }}>Compiles the frontend and reboots the Zero server.</div>
                                    </div>
                                    <button 
                                        className='primary-btn' 
                                        onClick={handleRebuildAndRestart}
                                        disabled={maintenanceStatus === 'building'}
                                        style={{ 
                                            padding: '8px 20px', 
                                            fontSize: '12px', 
                                            background: maintenanceStatus === 'building' ? 'var(--bg3)' : 'var(--accent)', 
                                            border: 'none', 
                                            color: '#fff', 
                                            borderRadius: '4px', 
                                            cursor: maintenanceStatus === 'building' ? 'not-allowed' : 'pointer' 
                                        }}
                                    >
                                        {maintenanceStatus === 'building' ? 'Building...' : 'Rebuild & Restart'}
                                    </button>
                                </div>
                                {maintenanceStatus === 'success' && <div style={{ fontSize: '12px', color: 'var(--success)' }}>✅ Build successful! Restarting server...</div>}
                                {maintenanceStatus === 'error' && (
                                    <div style={{ padding: '12px', background: 'rgba(255,0,0,0.1)', border: '1px solid var(--danger)', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--danger)', fontWeight: 'bold' }}>❌ Build Failed</div>
                                        <pre style={{ fontSize: '11px', color: 'var(--fg2)', whiteSpace: 'pre-wrap', margin: '4px 0 0 0', maxHeight: '200px', overflow: 'auto' }}>{maintenanceError}</pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    <section style={{ background: 'var(--bg2)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div onClick={() => toggleSection('mobile-dist')} style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'var(--bg2)' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--fg2)' }}>Mobile Distribution</h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedSections['mobile-dist'] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M18 15l-6-6-6 6"/></svg>
                        </div>
                        {!collapsedSections['mobile-dist'] && (
                            <div style={{ padding: '0 24px 24px 24px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Android Application (APK)</div>
                                        <div style={{ fontSize: '12px', color: 'var(--fg3)' }}>Latest build available for self-update.</div>
                                    </div>
                                    {androidUpdate ? (
                                        <button className='primary-btn' onClick={() => window.open(androidUpdate.url)} style={{ padding: '8px 20px', fontSize: '12px', background: 'var(--success)', border: 'none', color: '#fff', borderRadius: '4px', cursor: 'pointer' }}>Download v{androidUpdate.version}</button>
                                    ) : (
                                        <div style={{ fontSize: '12px', color: 'var(--fg3)' }}>Run `npm run android:build` to compile an APK.</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </section>

                    <section style={{ background: 'var(--bg2)', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div onClick={() => toggleSection('security')} style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'var(--bg2)' }}>
                            <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--fg2)' }}>Security & Remote Access</h3>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: collapsedSections['security'] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M18 15l-6-6-6 6"/></svg>
                        </div>
                        {!collapsedSections['security'] && (
                            <div style={{ padding: '0 24px 24px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Passkey Protection</div>
                                        <div style={{ fontSize: '12px', color: 'var(--fg3)' }}>{settings.passkey ? 'Device secured with Passkey.' : 'Secure remote access with a Passkey.'}</div>
                                    </div>
                                    <button onClick={async () => { /* passkey logic */ }} style={{ padding: '8px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--fg)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>{settings.passkey ? 'Change Passkey' : 'Setup Passkey'}</button>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Push Notifications</div>
                                        <div style={{ fontSize: '12px', color: 'var(--fg3)' }}>Get system alerts and status updates.</div>
                                    </div>
                                    <button onClick={() => { Notification.requestPermission(); }} style={{ padding: '8px 16px', background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--fg)', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Enable</button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {['enableTunnel', 'enableAntigravity', 'enableTelemetry'].map(key => (
                                        <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: 'var(--bg)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                            <span style={{ fontSize: '14px' }}>{key.replace('enable', '').replace(/([A-Z])/g, ' $1')}</span>
                                            <input type='checkbox' checked={settings[key]} onChange={e => saveSettings({ [key]: e.target.checked })} />
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            )}
        </div>
    );
}

export default Settings;
