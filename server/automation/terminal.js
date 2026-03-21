import { spawn } from 'child_process';

export const terminalActions = {
    async run({ command }) {
        console.log(`Running: ${command}`);
        return new Promise((resolve) => {
            let stdout = '';
            let stderr = '';

            const child = spawn('sh', ['-c', command], {
                cwd: process.env.HOME
            });

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                resolve({
                    success: code === 0,
                    stdout: stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode: code
                });
            });

            // Timeout after 5 minutes
            setTimeout(() => {
                child.kill();
                resolve({ success: false, error: 'Timeout after 5 minutes' });
            }, 300000);
        });
    },

    async gemini({ prompt, workingDir }) {
        console.log(`Gemini executing: ${prompt.slice(0, 100)}...`);

        const cwd = workingDir || process.env.HOME;

        return new Promise((resolve) => {
            let output = '';

            // Run gemini in YOLO mode (auto-approve all actions)
            // With JSON output for structured results
            const child = spawn('gemini', [
                '--yolo',
                '--output-format', 'json',
                prompt
            ], {
                cwd,
                env: { ...process.env }
            });

            child.stdin.end();

            child.stdout.on('data', (data) => {
                const text = data.toString();
                output += text;
                console.log(text); // Stream to server console
            });

            child.stderr.on('data', (data) => {
                const text = data.toString();
                output += text;
                console.error(text);
            });

            child.on('close', (code) => {
                console.log(`Gemini finished with code ${code}`);
                resolve({
                    success: code === 0,
                    stdout: output.trim(),
                    exitCode: code
                });
            });

            child.on('error', (err) => {
                resolve({
                    success: false,
                    error: `Failed to start gemini: ${err.message}`
                });
            });

            // Timeout after 10 minutes for complex tasks
            setTimeout(() => {
                child.kill();
                resolve({
                    success: false,
                    stdout: output,
                    error: 'Task timed out after 10 minutes'
                });
            }, 600000);
        });
    }
};
