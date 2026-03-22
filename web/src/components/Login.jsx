import React, { useState } from 'react';

const Login = () => {
    const [error, setError] = useState('');

    const handleLogin = async () => {
        try {
            const { startAuthentication } = await import('@simplewebauthn/browser');

            const options = await fetch('/api/auth/login-options').then(res => res.json());
            if (options.error) throw new Error(options.error);
            const assertion = await startAuthentication(options);
            const verification = await fetch('/api/auth/login-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(assertion)
            }).then(res => res.json());
            if (verification.error) throw new Error(verification.error);
            if (verification.verified) {
                window.location.href = '/';
            } else {
                setError('Login failed. Please try again.');
            }
        } catch (e) {
            console.error(e);
            setError('Error: ' + e.message);
        }
    };

    return (
        <div style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#050505',
            color: '#fff',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <div style={{ textAlign: 'center', maxWidth: '400px', width: '90%' }}>
                <h1 style={{ fontSize: '32px', fontWeight: '300', marginBottom: '16px' }}>Zero</h1>
                <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '40px' }}>
                    Unlock using your passkey.
                </p>
                {error && <p style={{ color: '#ff4444', marginBottom: '16px' }}>{error}</p>}
                <button
                    onClick={handleLogin}
                    style={{
                        background: '#fff',
                        color: '#000',
                        border: 'none',
                        padding: '16px 32px',
                        borderRadius: '30px',
                        fontSize: '16px',
                        cursor: 'pointer'
                    }}
                >
                    Unlock
                </button>
            </div>
        </div>
    );
};

export default Login;
