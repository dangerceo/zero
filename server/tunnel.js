import { spawn } from 'child_process';
import chalk from 'chalk';

export function startTunnel(port, token) {
  if (!token) {
    console.log(chalk.yellow('No Zero token found. Running in offline mode.'));
    return;
  }

  console.log(chalk.blue('Establishing secure link to 0.computer...'));

  const tunnel = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  tunnel.stderr.on('data', (data) => {
    const output = data.toString();
    if (output.includes('trycloudflare.com')) {
      // In a real implementation, we'd register this URL with the 0.computer backend
      // associated with the user's session token.
      // For now, we assume the user has a static tunnel configured via config file.
    }
  });

  return tunnel;
}
