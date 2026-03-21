import { spawn } from 'child_process';
import chalk from 'chalk';
import qrcode from 'qrcode';
import boxen from 'boxen';

export function startTunnel(port, token) {
  if (!token) {
    console.log(chalk.yellow('No Zero token found. Running in offline mode.'));
  }

  console.log(chalk.blue('Establishing secure link to 0.computer...'));

  const tunnel = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let tunnelUrl = '';

  tunnel.stderr.on('data', async (data) => {
    const output = data.toString();

    // Extract trycloudflare.com URL
    const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (match && !tunnelUrl) {
      tunnelUrl = match[0];

      try {
        const qr = await qrcode.toString(tunnelUrl, { type: 'terminal', small: true });

        const message = [
          chalk.green.bold('✨ Zero is Live!'),
          '',
          chalk.white('Access your Mac from anywhere:'),
          chalk.cyan.underline(tunnelUrl),
          '',
          qr,
          '',
          chalk.gray('Scan to connect your phone')
        ].join('\n');

        console.log(boxen(message, {
          padding: 1,
          margin: 1,
          borderStyle: 'double',
          borderColor: 'green',
          textAlign: 'center'
        }));
      } catch (err) {
        console.error('Failed to generate QR code:', err);
      }
    }
  });

  return tunnel;
}
