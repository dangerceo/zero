import React from 'react';

function Header({ connected, onProjectsClick, onSettingsClick }) {
    return (
        <header className="header">
            <h1 className="logo">Zero</h1>
            <div className="header-right">
                <button className="header-btn" onClick={onProjectsClick}>Projects</button>
                <button className="header-btn" onClick={onSettingsClick}>⚙</button>
                <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
                    <span className="status-dot"></span>
                </div>
            </div>
        </header>
    );
}

export default Header;
