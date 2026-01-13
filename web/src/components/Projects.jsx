import React, { useState, useEffect } from 'react';

function Projects({ onBack }) {
    const [projects, setProjects] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/projects')
            .then(r => r.json())
            .then(setProjects)
            .finally(() => setLoading(false));
    }, []);

    if (selected) {
        return <ProjectDetail project={selected} onBack={() => setSelected(null)} />;
    }

    return (
        <div className="projects">
            <div className="projects-header">
                <button className="back-btn" onClick={onBack}>←</button>
                <h2>Projects</h2>
            </div>

            {loading ? (
                <div className="loading">Loading...</div>
            ) : projects.length === 0 ? (
                <div className="empty-state">No projects yet</div>
            ) : (
                <div className="project-list">
                    {projects.map(p => (
                        <div key={p.id} className="project-card" onClick={() => setSelected(p)}>
                            <div className="project-name">{p.name}</div>
                            <div className="project-status">{p.status}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ProjectDetail({ project, onBack }) {
    const [details, setDetails] = useState(null);

    useEffect(() => {
        fetch(`/api/projects/${project.id}`)
            .then(r => r.json())
            .then(setDetails);
    }, [project.id]);

    return (
        <div className="project-detail">
            <div className="projects-header">
                <button className="back-btn" onClick={onBack}>←</button>
                <h2>{project.name}</h2>
            </div>

            {!details ? (
                <div className="loading">Loading...</div>
            ) : (
                <div className="project-files">
                    {details.files.map(f => (
                        <div key={f.name} className="project-file">
                            <div className="file-name">{f.name}</div>
                            <pre className="file-content">{f.content}</pre>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Projects;
