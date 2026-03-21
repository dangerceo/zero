import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import AgentDetail from './components/AgentDetail';
import Settings from './components/Settings';
import MemoryDetail from './components/MemoryDetail';
import ChatPage from './components/ChatPage';
import TerminalPage from './components/TerminalPage';

function App() {
    const [agents, setAgents] = useState([]);
    const [agyProjects, setAgyProjects] = useState([]);
    const [connected, setConnected] = useState(false);
    const [isExpanded, setIsExpanded] = useState(localStorage.getItem('zero-expanded') === 'true');
    const navigate = useNavigate();

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = protocol + '//' + window.location.host;
        let ws;
        let reconnectTimeout;

        function connect() {
            ws = new WebSocket(wsUrl);
            ws.onopen = () => setConnected(true);
            ws.onmessage = (event) => {
                const msg = JSON.parse(event.data);
                handleMessage(msg);
            };
            ws.onclose = () => {
                setConnected(false);
                reconnectTimeout = setTimeout(connect, 2000);
            };
            ws.onerror = () => { };
        }

        connect();
        return () => {
            clearTimeout(reconnectTimeout);
            ws?.close();
        };
    }, []);

    const handleMessage = useCallback((msg) => {
        switch (msg.type) {
            case 'init':
                if (msg.agents) setAgents(msg.agents);
                if (msg.projects) setAgyProjects(msg.projects);
                break;
            case 'agy:projects':
                setAgyProjects(msg.projects || []);
                break;
            case 'agent:created':
                setAgents(prev => [msg.agent, ...prev]);
                break;
            case 'agent:updated':
                setAgents(prev => prev.map(a =>
                    a.id === msg.agent.id ? msg.agent : a
                ));
                break;
            case 'agent:deleted':
                setAgents(prev => prev.filter(a => a.id !== msg.id));
                break;
            case 'agent:log':
                setAgents(prev => prev.map(a => {
                    if (a.id === msg.agentId) {
                        return { ...a, logs: [...(a.logs || []), msg.log] };
                    }
                    return a;
                }));
                break;
            case 'ticket:created':
                setAgents(prev => prev.map(a => {
                    if (a.id === msg.agentId) {
                        return { ...a, tickets: [...(a.tickets || []), msg.ticket] };
                    }
                    return a;
                }));
                break;
            case 'ticket:updated':
            case 'ticket:completed':
                setAgents(prev => prev.map(a => {
                    if (a.id === msg.agentId) {
                        const tickets = (a.tickets || []).map(t =>
                            t.id === msg.ticket.id ? msg.ticket : t
                        );
                        return { ...a, tickets };
                    }
                    return a;
                }));
                break;
            default:
                break;
        }
    }, []);

    const toggleExpand = () => {
        const newVal = !isExpanded;
        setIsExpanded(newVal);
        localStorage.setItem('zero-expanded', newVal);
    };

    const openAgent = (id) => {
        navigate('/agent/' + id);
    };

    return (
        <div className={isExpanded ? 'expanded-container' : ''}>
            <Routes>
                <Route path='/' element={
                    <Home
                        agents={agents}
                        agyProjects={agyProjects}
                        connected={connected}
                        onSelectAgent={openAgent}
                        onSettingsClick={() => navigate('/dashboard')}
                        isExpanded={isExpanded}
                        toggleExpand={toggleExpand}
                    />
                } />
                <Route path='/dashboard' element={
                    <Settings
                        agents={agents}
                        agyProjects={agyProjects}
                        onBack={() => navigate('/')}
                    />
                } />
                <Route path='/dashboard/project/:id' element={
                    <Settings
                        agents={agents}
                        agyProjects={agyProjects}
                        onBack={() => navigate('/dashboard')}
                    />
                } />

                <Route path='/memory/:id' element={
                    <MemoryDetailWrapper onBack={() => navigate('/')} />
                } />
                <Route path='/agent/:id' element={
                    <AgentDetailWrapper agents={agents} agyProjects={agyProjects} onBack={() => navigate('/')} />
                } />
                <Route path='/chat' element={<ChatPage />} />
                <Route path='/terminal' element={<TerminalPage />} />
            </Routes>
        </div>
    );
}

import { useParams } from 'react-router-dom';
function AgentDetailWrapper({ agents, agyProjects, onBack }) {
    const { id } = useParams();
    let selectedAgent = agents.find(a => a.id === id);
    if (!selectedAgent) {
        const agy = agyProjects.find(p => p.id === id);
        if (agy) {
            selectedAgent = {
                ...agy,
                threads: agy.threads || [],
                logs: agy.logs || [],
                pendingQuestions: [],
                todos: [],
                checkpoints: []
            };
        }
    }

    if (!selectedAgent) return <div style={{ padding: '32px' }}>Agent not found</div>;

    return <AgentDetail agent={selectedAgent} onBack={onBack} />;
}

function MemoryDetailWrapper({ onBack }) {
    const { id } = useParams();
    return <MemoryDetail memoryId={id} onBack={onBack} />;
}

export default App;
