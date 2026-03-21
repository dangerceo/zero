import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Home from './components/Home';
import AgentDetail from './components/AgentDetail';
import Settings from './components/Settings';
import MemoryDetail from './components/MemoryDetail';
import NotificationContainer from './components/NotificationContainer';
import { useStore } from './store';
import ChatPage from './components/ChatPage';
import TerminalPage from './components/TerminalPage';
import OnboardingFlow from './components/OnboardingFlow';

function App() {
    const navigate = useNavigate();
    const { agents, agyProjects, connected, handleMessage, setConnected } = useStore();
    const [isExpanded, setIsExpanded] = useState(localStorage.getItem('zero-expanded') === 'true');

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
    }, [handleMessage, setConnected]);

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
            <NotificationContainer />
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
                <Route path='/onboard' element={<OnboardingFlow />} />
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
