import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

/* --- WEBGL SHADER --- */
const vertexShaderSrc = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragmentShaderSrc = `
precision highp float;
uniform vec2 resolution;
uniform float time;
uniform float energy;

float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123); }
float noise(vec2 st) {
    vec2 i = floor(st); vec2 f = fract(st);
    float a = random(i); float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 st) {
    float v = 0.0; float a = 0.5; vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
    for (int i = 0; i < 5; ++i) { v += a * noise(st); st = rot * st * 2.0 + shift; a *= 0.5; }
    return v;
}

void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec2 st = uv * 3.0;
    st.x *= resolution.x / resolution.y;
    vec2 center = vec2(1.5, 1.5);
    center.x *= resolution.x / resolution.y;
    center.y += 0.2;
    float dist = distance(st, center);
    float speed = time * (0.05 + energy * 0.15);

    vec2 q = vec2(fbm(st + speed), fbm(st + vec2(1.0)));
    vec2 r = vec2(fbm(st + q + vec2(1.7, 9.2) + speed * 1.5), fbm(st + q + vec2(8.3, 2.8) + speed * 1.26));
    float f = fbm(st + r);

    vec3 color = mix(vec3(0.6, 0.1, 0.0), vec3(1.0, 0.4, 0.0), clamp((f*f) * 4.0, 0.0, 1.0));
    color = mix(color, vec3(1.0, 0.6, 0.2), clamp(length(q), 0.0, 1.0));
    color = mix(color, vec3(0.9, 0.2, 0.1), clamp(length(r.x), 0.0, 1.0));

    float radius = 0.4 + 0.02 * sin(time * 3.0 + f * 4.0) + energy * 0.03 * sin(time * 10.0);
    float orbMask = smoothstep(radius + 0.08, radius - 0.08, dist);
    float glow = smoothstep(radius + 0.8, radius, dist) * 0.4;

    vec3 finalColor = color * orbMask + vec3(1.0, 0.3, 0.0) * glow * f;
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

function EtherBackground({ energy }) {
    const canvasRef = useRef(null);
    const energyRef = useRef(energy);
    energyRef.current = energy;

    useEffect(() => {
        const canvas = canvasRef.current;
        const gl = canvas.getContext('webgl');
        if (!gl) return;

        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vertexShaderSrc); gl.compileShader(vs);
        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fragmentShaderSrc); gl.compileShader(fs);
        const program = gl.createProgram();
        gl.attachShader(program, vs); gl.attachShader(program, fs);
        gl.linkProgram(program); gl.useProgram(program);

        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
        const pos = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(pos);
        gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

        const uTime = gl.getUniformLocation(program, 'time');
        const uRes = gl.getUniformLocation(program, 'resolution');
        const uEnergy = gl.getUniformLocation(program, 'energy');

        let t0 = Date.now(), af;
        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; gl.viewport(0, 0, canvas.width, canvas.height); };
        window.addEventListener('resize', resize); resize();

        const render = () => {
            gl.uniform1f(uTime, (Date.now() - t0) / 1000);
            gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.uniform1f(uEnergy, energyRef.current);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            af = requestAnimationFrame(render);
        };
        render();

        return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(af); };
    }, []);

    return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }} />;
}

/* ---------- CHOICE CARD ---------- */
function ChoiceCard({ icon, title, desc, selected, onClick, disabled }) {
    return (
        <div onClick={disabled ? undefined : onClick} style={{
            padding: '20px', borderRadius: '16px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            border: selected ? '1px solid rgba(255, 140, 0, 0.6)' : '1px solid rgba(255,255,255,0.08)',
            background: selected ? 'rgba(255, 140, 0, 0.12)' : 'transparent',
            opacity: disabled ? 0.3 : 1,
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '16px'
        }}>
            <span style={{ fontSize: '28px', flexShrink: 0 }}>{icon}</span>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>{title}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.4' }}>{desc}</div>
            </div>
            <div style={{
                width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                background: selected ? '#ff8c00' : '#222',
                border: selected ? 'none' : '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.2s'
            }} />
        </div>
    );
}

const StepIndicator = ({ advStep, totalSteps }) => (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '48px' }}>
        {Array.from({length: totalSteps}, (_, i) => i + 1).map(n => (
            <div key={n} style={{
                width: n === advStep ? '32px' : '8px', height: '8px', borderRadius: '4px',
                background: n === advStep ? '#ff8c00' : n < advStep ? 'rgba(255,140,0,0.5)' : 'rgba(255,255,255,0.15)',
                transition: 'all 0.3s'
            }} />
        ))}
    </div>
);

const PageShell = ({ children, advStep, totalSteps }) => (
    <div style={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: '480px', padding: '0 24px', boxSizing: 'border-box',
        animation: 'fadeIn 0.5s ease-out'
    }}>
        <StepIndicator advStep={advStep} totalSteps={totalSteps} />
        {children}
    </div>
);

/* ---------- MAIN COMPONENT ---------- */
export default function OnboardingFlow() {
    const navigate = useNavigate();
    const [step, setStep] = useState('talk'); // 'talk' | 'adv1' | 'adv2' | 'adv3' | 'adv4'

    // Chat
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // Advanced prefs
    const [purpose, setPurpose] = useState('code');                 // 'code' | 'inbox' | 'brain'
    const [computerAffinity, setComputerAffinity] = useState(2);   // 0-4
    const [riskTolerance, setRiskTolerance] = useState(1);         // 0-2
    const [systemTools, setSystemTools] = useState([]);
    const [selectedTool, setSelectedTool] = useState(null);

    useEffect(() => {
        setTimeout(() => {
            setMessages([{ role: 'ai', text: "Hi. I don't have a name yet." }]);
            setTimeout(() => {
                setMessages(prev => [...prev, { role: 'ai', text: "What should I call you?" }]);
            }, 2000);
        }, 1500);

        fetch('/api/system/tools')
            .then(r => r.json())
            .then(data => {
                setSystemTools(data);
                const installed = data.filter(t => t.installed);
                if (installed.length > 0) setSelectedTool(installed[0].command);
                else if (data.length > 0) setSelectedTool(data[0].command);
            }).catch(() => {});
    }, []);

    const handleChatSubmit = async (e) => {
        e.preventDefault();
        if (!chatInput.trim() || isTyping) return;
        const msg = chatInput.trim();
        setChatInput('');
        const newMessages = [...messages, { role: 'user', text: msg }];
        setMessages(newMessages);
        setIsTyping(true);
        try {
            const res = await fetch('/api/onboard/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: newMessages })
            });
            const data = await res.json();
            setMessages(prev => [...prev, { role: 'ai', text: data.reply || "..." }]);
        } catch {
            setMessages(prev => [...prev, { role: 'ai', text: "I'm here but I can't think right now." }]);
        }
        setIsTyping(false);
    };

    const quickStart = async () => {
        const installed = systemTools.filter(t => t.installed);
        const modules = systemTools.map(t => ({
            id: t.id, name: t.name, command: t.command,
            enabled: installed.length > 0 ? t.command === installed[0].command : false
        }));
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modules, purpose: 'code', computerAffinity: 2, riskTolerance: 0 })
        });
        navigate('/');
    };

    const advancedComplete = async () => {
        const modules = systemTools.map(t => ({
            id: t.id, name: t.name, command: t.command,
            enabled: t.command === selectedTool
        }));
        await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modules, purpose, computerAffinity, riskTolerance })
        });
        navigate('/');
    };

    const advStep = step.startsWith('adv') ? parseInt(step.slice(3)) : 0;
    const totalSteps = 4;

    return (
        <div style={{
            minHeight: '100vh', background: '#050505', color: '#fff',
            fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden'
        }}>
            <EtherBackground energy={isTyping ? 1.0 : 0.0} />

            {/* ── CONVERSATIONAL PHASE ── */}
            {step === 'talk' && (
                <div style={{
                    position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
                    width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '32px',
                    animation: 'fadeIn 2s ease-out'
                }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                        {messages.slice(-3).map((m, i) => {
                            const opacity = 1 - ((Math.min(messages.length, 3) - 1 - i) * 0.4);
                            return (
                                <div key={i} style={{
                                    textAlign: 'center',
                                    fontSize: m.role === 'ai' ? '28px' : '18px',
                                    color: m.role === 'ai' ? '#fff' : 'rgba(255,255,255,0.5)',
                                    fontWeight: m.role === 'ai' ? '300' : '400',
                                    letterSpacing: '0.5px', opacity,
                                    transform: `translateY(${(Math.min(messages.length, 3) - 1 - i) * -10}px)`,
                                    transition: 'all 0.5s'
                                }}>
                                    {m.text}
                                </div>
                            );
                        })}
                        {isTyping && (
                            <div style={{ textAlign: 'center', color: '#ff8c00', fontSize: '24px', opacity: 0.8, animation: 'pulse 1s infinite' }}>• • •</div>
                        )}
                    </div>

                    <form onSubmit={handleChatSubmit} style={{ textAlign: 'center' }}>
                        <input
                            type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} autoFocus
                            placeholder="Type to respond..."
                            style={{
                                background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.2)',
                                color: '#fff', fontSize: '18px', textAlign: 'center', outline: 'none',
                                padding: '12px', width: '70%', letterSpacing: '1px', transition: 'all 0.3s'
                            }}
                            onFocus={e => e.target.style.borderBottom = '1px solid rgba(255,140,0,0.8)'}
                            onBlur={e => e.target.style.borderBottom = '1px solid rgba(255,255,255,0.2)'}
                        />
                    </form>

                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
                        <button onClick={quickStart} style={btnStyle}>Get Started</button>
                        <button onClick={() => setStep('adv1')} style={subtleBtnStyle}>Advanced Setup</button>
                    </div>
                </div>
            )}

            {/* ── PAGE 1: PURPOSE ── */}
            {step === 'adv1' && (
                <PageShell advStep={advStep} totalSteps={totalSteps}>
                    <h2 style={{ fontSize: '32px', fontWeight: '300', textAlign: 'center', marginBottom: '16px' }}>
                        What are you primarily trying to do?
                    </h2>
                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '40px' }}>
                        This determines which capabilities I prioritize.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '48px' }}>
                        <ChoiceCard icon="⌨️" title="Write & Ship Code" desc="Autonomous coding agent. Reads your repo, writes code, runs tests." selected={purpose === 'code'} onClick={() => setPurpose('code')} />
                        <ChoiceCard icon="📬" title="Inbox Zero" desc="Triage emails, tickets, and notifications. Respond and organize." selected={purpose === 'inbox'} onClick={() => setPurpose('inbox')} disabled={riskTolerance === 0} />
                        <ChoiceCard icon="🧠" title="Second Brain" desc="A living memory that follows you. Research, notes, context." selected={purpose === 'brain'} onClick={() => setPurpose('brain')} disabled={riskTolerance === 0} />
                    </div>
                    {(purpose === 'inbox' || purpose === 'brain') && riskTolerance === 0 && (
                        <p style={{ textAlign: 'center', color: '#ff8c00', fontSize: '12px', marginBottom: '16px' }}>
                            ⚠ Inbox Zero and Second Brain require at least Normal Danger.
                        </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={() => setStep('talk')} style={subtleBtnStyle}>← Back</button>
                        <button onClick={() => setStep('adv2')} style={btnStyle}>Continue →</button>
                    </div>
                </PageShell>
            )}

            {/* ── PAGE 2: COMPUTER AFFINITY ── */}
            {step === 'adv2' && (
                <PageShell advStep={advStep} totalSteps={totalSteps}>
                    <h2 style={{ fontSize: '32px', fontWeight: '300', textAlign: 'center', marginBottom: '16px' }}>
                        How much do you like using a computer?
                    </h2>
                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '40px' }}>
                        This shapes how much I automate vs. ask you about.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '48px' }}>
                        <ChoiceCard icon="😩" title="Not at all" desc="Do everything for me. I don't want to touch this thing." selected={computerAffinity === 0} onClick={() => setComputerAffinity(0)} />
                        <ChoiceCard icon="🤷" title="It's fine" desc="I can click around a bit. Help me when it gets complicated." selected={computerAffinity === 1} onClick={() => setComputerAffinity(1)} />
                        <ChoiceCard icon="🙂" title="I like it" desc="I'm comfortable. Show me what's happening but help me go faster." selected={computerAffinity === 2} onClick={() => setComputerAffinity(2)} />
                        <ChoiceCard icon="🤓" title="Love it" desc="Give me all the knobs. I want to see logs, diffs, and raw output." selected={computerAffinity === 3} onClick={() => setComputerAffinity(3)} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={() => setStep('adv1')} style={subtleBtnStyle}>← Back</button>
                        <button onClick={() => setStep('adv3')} style={btnStyle}>Continue →</button>
                    </div>
                </PageShell>
            )}

            {/* ── PAGE 3: RISK TOLERANCE ── */}
            {step === 'adv3' && (
                <PageShell advStep={advStep} totalSteps={totalSteps}>
                    <h2 style={{ fontSize: '32px', fontWeight: '300', textAlign: 'center', marginBottom: '16px' }}>
                        How much danger are you comfortable with?
                    </h2>
                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '40px' }}>
                        Controls how aggressively I act without asking first.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '48px' }}>
                        <ChoiceCard icon="🛡️" title="Zero Danger" desc="Always ask permission. Never run anything destructive. Code assistance only." selected={riskTolerance === 0} onClick={() => { setRiskTolerance(0); if (purpose !== 'code') setPurpose('code'); }} />
                        <ChoiceCard icon="⚡" title="Normal Danger" desc="Run commands, edit files, make API calls. Confirm before anything irreversible." selected={riskTolerance === 1} onClick={() => setRiskTolerance(1)} />
                        <ChoiceCard icon="☠️" title="Dangermaxxing" desc="Full autonomy. Deploy, delete, restructure. You trust me completely." selected={riskTolerance === 2} onClick={() => setRiskTolerance(2)} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={() => setStep('adv2')} style={subtleBtnStyle}>← Back</button>
                        <button onClick={() => setStep('adv4')} style={btnStyle}>Continue →</button>
                    </div>
                </PageShell>
            )}

            {/* ── PAGE 4: ENGINE ── */}
            {step === 'adv4' && (
                <PageShell advStep={advStep} totalSteps={totalSteps}>
                    <h2 style={{ fontSize: '32px', fontWeight: '300', textAlign: 'center', marginBottom: '16px' }}>
                        Engine
                    </h2>
                    <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '40px' }}>
                        Select the AI core that drives automation on your machine.
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '48px' }}>
                        {systemTools.map(tool => (
                            <ChoiceCard
                                key={tool.id}
                                icon="🔧"
                                title={tool.name}
                                desc={tool.path || tool.command}
                                selected={selectedTool === tool.command}
                                onClick={() => setSelectedTool(tool.command)}
                                disabled={!tool.installed}
                            />
                        ))}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <button onClick={() => setStep('adv3')} style={subtleBtnStyle}>← Back</button>
                        <button onClick={advancedComplete} style={btnStyle}>Initialize</button>
                    </div>
                </PageShell>
            )}

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; filter: blur(5px); }
                    to { opacity: 1; filter: blur(0); }
                }
                @keyframes pulse {
                    0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; }
                }
            `}</style>
        </div>
    );
}

const subtleBtnStyle = {
    background: 'transparent', color: 'rgba(255,255,255,0.4)', border: 'none',
    fontSize: '12px', cursor: 'pointer', padding: '8px',
    letterSpacing: '1px', textTransform: 'uppercase'
};

const btnStyle = {
    background: 'rgba(255, 120, 0, 0.2)', border: '1px solid rgba(255, 140, 0, 0.6)',
    color: '#fff', padding: '16px 40px', borderRadius: '100px',
    fontSize: '16px', fontWeight: '300', cursor: 'pointer', letterSpacing: '2px',
    textTransform: 'uppercase', transition: 'all 0.3s'
};

