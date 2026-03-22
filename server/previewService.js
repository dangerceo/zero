import { exec } from 'child_process';
import { promisify } from 'util';
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const execAsync = promisify(exec);

class PreviewService {
    constructor() {
        this.runningPorts = new Set();
        this.proxies = new Map();
        this.interval = null;
        this.broadcast = null;
        this.affinity = {};
    }

    start(broadcast) {
        this.broadcast = broadcast;
        this.scan(); // Initial scan
        this.interval = setInterval(() => this.scan(), 5000); // Scan every 5 seconds
    }

    async scan() {
        try {
            // Find listening ports on macOS
            const { stdout } = await execAsync('lsof -i -P -n | grep LISTEN');
            const lines = stdout.split('\n');
            const discoveries = [];
            
            for (const line of lines) {
                // Example line: node 73390 dalnk 15u IPv4 0x1d5531ac65985aa6 0t0 TCP *:3001 (LISTEN)
                if (!line.includes('LISTEN')) continue;
                
                const portMatch = line.match(/:(\d+)\s+\(LISTEN\)/);
                const pidMatch = line.match(/^\S+\s+(\d+)/);
                
                if (portMatch && pidMatch) {
                    const port = parseInt(portMatch[1]);
                    const pid = parseInt(pidMatch[1]);
                    // Don't include the Zero server itself (usually 3847)
                    if (port !== 3847 && port < 60000) {
                        discoveries.push({ port, pid });
                    }
                }
            }

            // Deduplicate ports (keep the first occurrence)
            const uniquePorts = new Map();
            for (const d of discoveries) {
                if (!uniquePorts.has(d.port)) uniquePorts.set(d.port, d);
            }
            
            const newlyDiscovered = Array.from(uniquePorts.values());

            // Get cwd for each PID
            const portsDetails = [];
            for (const item of newlyDiscovered) {
                let path = '';
                try {
                    // Get cwd using lsof
                    const { stdout: lsofOut } = await execAsync(`lsof -a -p ${item.pid} -d cwd -Fn`);
                    const nLine = lsofOut.split('\n').find(l => l.startsWith('n'));
                    if (nLine) path = nLine.substring(1);
                } catch (e) { }

                portsDetails.push({ ...item, path });
            }

            const serialized = JSON.stringify(portsDetails);
            if (serialized !== this.lastSerializedPorts) {
                this.lastSerializedPorts = serialized;
                this.runningPorts = portsDetails;
                if (this.broadcast) {
                    this.broadcast({ type: 'preview:ports', ports: this.runningPorts });
                }
            }
        } catch (error) {
            // Silence lsof error if no ports are listening
        }
    }

    setDiff(a, b) {
        if (a.size !== b.size) return true;
        for (const val of a) if (!b.has(val)) return true;
        return false;
    }

    getMiddleware() {
        return (req, res, next) => {
            let port = null;

            // Direct path match
            const match = req.path.match(/^\/host\/(\d+)(\/.*)?/);
            if (match) {
                port = parseInt(match[1]);
            } else {
                // Forward stray asset requests based on referer
                const referer = req.headers.referer;
                if (referer) {
                    try {
                        const refUrl = new URL(referer);
                        const refPath = refUrl.pathname;
                        
                        const refMatch = refPath.match(/^\/host\/(\d+)/);
                        if (refMatch) {
                            port = parseInt(refMatch[1]);
                        } else {
                            // Resolves nested deep imports (like SvelteKit /_app/ importing other /_app/)
                            const refSegment = '/' + refPath.split('/')[1];
                            if (this.affinity[refSegment]) {
                                port = this.affinity[refSegment];
                            }
                        }
                    } catch (e) {}
                }
            }

            if (!port) return next();

            // Record topological affinity for future chained requests
            const reqSegment = '/' + req.path.split('/')[1];
            // Exclude Zero's core routes from being hijacked as proxy affinity roots
            if (!['/api', '/assets', '/host', '/dashboard', '', '/chat', '/pty'].includes(reqSegment)) {
                this.affinity[reqSegment] = port;
            }

            const proxy = this.getProxy(port);
            return proxy(req, res, next);
        };
    }

    getProxy(port) {
        if (!this.proxies.has(port)) {
            const proxy = createProxyMiddleware({
                target: `http://localhost:${port}`,
                changeOrigin: true,
                ws: true,
                pathRewrite: {
                    [`^/host/${port}`]: '',
                },
                logLevel: 'silent',
                onError: (err, req, res) => {
                    if (res.status) res.status(502).send(`Proxy error for port ${port}: ${err.message}`);
                }
            });
            this.proxies.set(port, proxy);
        }
        return this.proxies.get(port);
    }

    getPorts() {
        return Array.from(this.runningPorts);
    }
}

export const previewService = new PreviewService();
