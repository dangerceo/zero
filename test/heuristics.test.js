import pty from 'node-pty-prebuilt-multiarch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { detectBlock } from '../server/dangerHeuristics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCKS_DIR = join(__dirname, 'mocks');

async function runTest(scriptName, expectedType) {
  return new Promise((resolve, reject) => {
    const scriptPath = join(MOCKS_DIR, scriptName);
    const ptyProcess = pty.spawn('node', [scriptPath], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: process.cwd(),
      env: process.env
    });

    let fullOutput = '';
    let lastActivity = Date.now();
    let detected = null;

    const checkInterval = setInterval(() => {
      detected = detectBlock(fullOutput, lastActivity);
      if (detected) {
        clearInterval(checkInterval);
        ptyProcess.kill();
        resolve(detected);
      }
    }, 500);

    ptyProcess.on('data', (data) => {
      fullOutput += data;
      lastActivity = Date.now();
    });

    ptyProcess.on('exit', () => {
      clearInterval(checkInterval);
      resolve(null);
    });

    // Timeout if no detection and process doesn't exit
    setTimeout(() => {
      clearInterval(checkInterval);
      ptyProcess.kill();
      resolve(null);
    }, 5000);
  });
}

async function main() {
  console.log('🧪 Running Heuristic Detection Tests...');

  const tests = [
    { name: 'password_prompt.js', expected: 'input' },
    { name: 'standard_prompt.js', expected: 'input' },
    { name: 'choice_list.js', expected: 'choice' },
    { name: 'long_build.js', expected: null }
  ];

  let passed = 0;
  for (const test of tests) {
    process.stdout.write(`Testing ${test.name}... `);
    const result = await runTest(test.name, test.expected);
    
    if ((result?.type || null) === test.expected) {
      console.log('✅ PASS');
      passed++;
    } else {
      console.log(`❌ FAIL (Expected ${test.expected}, got ${result?.type || null})`);
    }
  }

  console.log(`\nSummary: ${passed}/${tests.length} tests passed.`);
  process.exit(passed === tests.length ? 0 : 1);
}

main().catch(console.error);
