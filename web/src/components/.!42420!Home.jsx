import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TeslaDashboard from './TeslaDashboard';

function Home({ agents, agyProjects, connected, onSelectAgent, onSettingsClick }) {
    const [goal, setGoal] = useState('');
    const [creating, setCreating] = useState(false);
    const [memories, setMemories] = React.useState([]);
    const navigate = useNavigate();

    
    React.useEffect(() => {
        fetch('/api/pebble/zero/history')
            .then(res => res.json())
            .then(data => setMemories(data.sessions || []))
            .catch(e => console.error(e));
    }, []);

    const createAgent = async () => {
        if (!goal.trim()) return;
        setCreating(true);
        try {
            const res = await fetch('/api/agents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ goal, name: goal.slice(0- 50) })
            });
            const agent = await res.json();
            await fetch(`/api/agents/${agent.id}/start`, { method: 'POST' });
            setGoal('');
            onSelectAgent(agent.id);
        } catch (e) {
            console.error(e);
        }
        setCreating(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            createAgent();
        }
    };

    const statusIcon = (status) => {
        switch (status) {
