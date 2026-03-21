import React, { useState, useEffect, useRef } from 'react';
import { WebContainer } from '@webcontainer/api';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

function WebContainerPreview({ workingDir }) {
    const [status, setStatus] = useState('idle');
    const [previewUrl, setPreviewUrl] = useState(null);
    const [showTerminal, setShowTerminal] = useState(true);
    const [runCommand, setRunCommand] = useState('npm run dev');
    const [shellProcess, setShellProcess] = useState(null);
    const [screenshot, setScreenshot] = useState(null);
    const terminalRef = useRef(null);
    const terminalDivRef = useRef(null);
    const wcInstanceRef = useRef(null);
    const fitAddonRef = useRef(null);

    useEffect(() => {
        if (terminalDivRef.current && !terminalRef.current) {
            const term = new Terminal({
                theme: { background: '#1e1e1e' },
                fontFamily: 'var(--mono)',
                fontSize: 12,
                convertEol: true,
                cursorBlink: true
            });
            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(terminalDivRef.current);
            fitAddon.fit();
            terminalRef.current = term;
            fitAddonRef.current = fitAddon;

            term.onData(data => {
                if (shellProcess?.input) {
                    const writer = shellProcess.input.getWriter();
                    writer.write(data);
                    writer.releaseLock();
                }
            });
        }
    }, [shellProcess]);

    const boot = async () => {
        if (status !== 'idle' && status !== 'error') return;
        setStatus('booting');
        terminalRef.current?.write('\x1b[36m🚀 Booting WebContainer...\x1b[0m\r\n');
        try {
            if (!wcInstanceRef.current) wcInstanceRef.current = await WebContainer.boot();
            wcInstanceRef.current.on('server-ready', (port, url) => {
                setPreviewUrl(url);
                setStatus('ready');
                setShowTerminal(false);
            });
            setStatus('mounting');
            terminalRef.current?.write('\x1b[36m📦 Fetching files from Mac...\x1b[0m\r\n');
            const res = await fetch('/api/files/export-tree?path=' + encodeURIComponent(workingDir));
            const tree = await res.json();
            function decodeTree(node) {
                for (const key in node) {
                    if (node[key].directory) decodeTree(node[key].directory);
                    else if (node[key].file && node[key].file.isBinary) {
                        const binaryString = atob(node[key].file.contents);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
                        node[key].file.contents = bytes;
                    }
                }
            }
            decodeTree(tree);
            await wcInstanceRef.current.mount(tree);
            setStatus('ready');
            terminalRef.current?.write('\x1b[32m✅ Ready.\x1b[0m\r\n');
            startShell();
        } catch (e) {
            setStatus('error');
            terminalRef.current?.write('\x1b[31m❌ Error: ' + e.message + '\x1b[0m\r\n');
        }
    };

    const startShell = async () => {
        if (!wcInstanceRef.current) return;
        const shell = await wcInstanceRef.current.spawn('jsh', {
            terminal: { cols: terminalRef.current.cols, rows: terminalRef.current.rows }
        });
        shell.output.pipeTo(new WritableStream({ write(data) { terminalRef.current?.write(data); } }));
        setShellProcess(shell);
    };

    const executeCommand = async (e) => {
        e?.preventDefault();
        if (!wcInstanceRef.current || !runCommand.trim()) return;
        setStatus('running');
        terminalRef.current?.write('\r\n\x1b[33m▶ Executing: ' + runCommand + '\x1b[0m\r\n');
        const args = runCommand.split(' ');
        const cmd = args.shift();
        const process = await wcInstanceRef.current.spawn(cmd, args);
        process.output.pipeTo(new WritableStream({ write(data) { terminalRef.current?.write(data); } }));
        const exitCode = await process.exit;
        setStatus(exitCode === 0 ? 'ready' : 'error');
    };

    const captureScreenshot = async () => {
        if (!previewUrl) return;
        try {
            const res = await fetch('/api/screenshot?url=' + encodeURIComponent(previewUrl));
            const blob = await res.blob();
            setScreenshot(URL.createObjectURL(blob));
        } catch (e) { console.error('Screenshot failed:', e); }
    };

    return (
        <div className='wc-preview' style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className='preview-toolbar' style={{ background: '#333', padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#aaa', textTransform: 'uppercase', fontWeight: 'bold' }}>{status}</span>
                    <form onSubmit={executeCommand} style={{ display: 'flex', gap: '4px' }}>
                        <input value={runCommand} onChange={e => setRunCommand(e.target.value)} placeholder='npm run dev' style={{ background: '#1e1e1e', border: '1px solid #555', color: '#fff', fontSize: '12px', padding: '4px 8px', borderRadius: '4px', width: '180px' }} />
                        <button type='submit' className='mini-btn' style={{ background: 'var(--accent)', color: '#000', border: 'none' }}>Run</button>
                    </form>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className='mini-btn' onClick={captureScreenshot} disabled={!previewUrl}>📸 Capture</button>
                    <button className='mini-btn' onClick={() => { setShowTerminal(!showTerminal); setTimeout(() => fitAddonRef.current?.fit(), 50); }}>{showTerminal ? 'Hide Console' : 'Console'}</button>
                    {status === 'idle' && <button className='primary-btn' style={{ minHeight: '32px', padding: '0 16px' }} onClick={boot}>Initialize</button>}
                    {previewUrl && <button className='mini-btn' onClick={() => window.open(previewUrl, '_blank')}>↗ External</button>}
                </div>
            </div>

            <div className='preview-canvas' style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
                {previewUrl && !showTerminal && !screenshot && (
                    <iframe src={previewUrl} style={{ flex: 1, border: 'none', background: '#fff' }} title='WC Preview' />
                )}
                {screenshot && !showTerminal && (
                    <div style={{ flex: 1, position: 'relative', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={screenshot} alt='Screenshot' style={{ maxWidth: '100%', maxHeight: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} />
                        <button className='mini-btn' onClick={() => setScreenshot(null)} style={{ position: 'absolute', top: '16px', right: '16px' }}>✕ Close Capture</button>
                    </div>
                )}
                <div style={{ flex: 1, display: showTerminal ? 'block' : 'none', padding: '8px' }}>
                    <div ref={terminalDivRef} style={{ width: '100%', height: '100%' }} />
                </div>
                {status === 'idle' && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', color: '#fff', flexDirection: 'column', gap: '16px' }}>
                        <h3>Virtual Dev Environment</h3>
                        <button className='primary-btn' onClick={boot}>Initialize Project</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default WebContainerPreview;
