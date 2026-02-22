import React, { useState, useEffect, useCallback } from 'react';
import Home from './components/Home';
import AgentDetail from './components/AgentDetail';
import Settings from './components/Settings';

function App() {
    const [agents, setAgents] = useState([]);
    const [connected, setConnected] = useState(false);
    const [view, setView] = useState('home');
    const [selectedAgentId, setSelectedAgentId] = useState(null);

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
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
                setAgents(msg.agents || []);
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
            default:
                break;
        }
    }, []);

    const openAgent = (id) => {
        setSelectedAgentId(id);
        setView('agent');
    };

    const selectedAgent = agents.find(a => a.id === selectedAgentId);

    if (view === 'settings') {
        return <Settings onBack={() => setView('home')} />;
    }

    if (view === 'agent' && selectedAgent) {
        return (
            <AgentDetail
                agent={selectedAgent}
                onBack={() => { setSelectedAgentId(null); setView('home'); }}
            />
        );
    }

    return (
        <Home
            agents={agents}
            connected={connected}
            onSelectAgent={openAgent}
            onSettingsClick={() => setView('settings')}
        />
    );
}

export default App;
