import { create } from 'zustand';

export const useStore = create((set) => ({
    agents: [],
    agyProjects: [],
    previewPorts: [],
    notifications: [],

    connected: false,
    sysData: null,
    teslaData: null,
    setConnected: (connected) => set({ connected }),
    setAgents: (agents) => set({ agents }),
    setAgyProjects: (agyProjects) => set({ agyProjects }),
    setSysData: (sysData) => set({ sysData }),
    setTeslaData: (teslaData) => set({ teslaData }),
    addNotification: (notification) => set(state => ({ notifications: [...state.notifications, notification] })),
    dismissNotification: (id) => set(state => ({ notifications: state.notifications.filter(n => n.id !== id) })),
    handleMessage: (msg) => {
        const { type, ...data } = msg;
        switch (type) {
            case 'init':
                set({ 
                    agents: data.agents || [], 
                    agyProjects: data.projects || [],
                    previewPorts: data.previewPorts || [],
                    notifications: data.notifications || [],

                    sysData: data.sysmonData || null,
                    teslaData: data.teslaData || null
                });
                break;
            case 'sysmon:update':
                set({ sysData: data.data });
                break;
            case 'tesla:update':
                set({ teslaData: data.data });
                break;
            case 'agy:projects':
                set({ agyProjects: data.projects || [] });
                break;
            case 'preview:ports':
                set({ previewPorts: data.ports || [] });
                break;

            case 'agent:created':
                set(state => ({ agents: [data.agent, ...state.agents] }));
                break;
            case 'agent:updated':
                set(state => ({
                    agents: state.agents.map(a =>
                        a.id === data.agent.id ? data.agent : a
                    )
                }));
                break;
            case 'agent:deleted':
                set(state => ({ agents: state.agents.filter(a => a.id !== data.id) }));
                break;
            case 'agent:log':
                set(state => ({
                    agents: state.agents.map(a => {
                        if (a.id === data.agentId) {
                            return { ...a, logs: [...(a.logs || []), data.log] };
                        }
                        return a;
                    })
                }));
                break;
            case 'ticket:created':
                set(state => ({
                    agents: state.agents.map(a => {
                        if (a.id === data.agentId) {
                            return { ...a, tickets: [...(a.tickets || []), data.ticket] };
                        }
                        return a;
                    })
                }));
                break;
            case 'ticket:updated':
            case 'ticket:completed':
                set(state => ({
                    agents: state.agents.map(a => {
                        if (a.id === data.agentId) {
                            const tickets = (a.tickets || []).map(t =>
                                t.id === data.ticket.id ? data.ticket : t
                            );
                            return { ...a, tickets };
                        }
                        return a;
                    })
                }));
                break;
            case 'notification:new':
                set(state => ({ notifications: [...state.notifications, { id: Date.now(), ...data }] }));
                break;
            default:
                break;
        }
    }
}));
