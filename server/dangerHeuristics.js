/**
 * Heuristic logic to detect if a terminal process is blocking for input.
 */

const PROMPT_PATTERNS = [
  /[:?>$]\s*$/,           // Standard prompts like "Name:", "> ", "Continue? "
  /\(y\/n\)\s*$/i,        // Yes/No prompts
  /password:\s*$/i        // Password prompts
];

const CHOICE_LIST_PATTERN = /\d+\)\s+.+[\r\n]+/; // Matches at least one numbered option followed by newline

export function detectBlock(output, lastActivityTime) {
  const now = Date.now();
  const idleTime = now - lastActivityTime;

  // Threshold for "quietness" (1.5 seconds)
  if (idleTime < 1500) return null;

  const cleanOutput = stripAnsi(output).trim();
  if (!cleanOutput) return null;

  const lines = cleanOutput.split(/\r?\n/);
  const lastLine = lines[lines.length - 1] || '';

  // Check for choice list
  const choices = extractChoices(cleanOutput);
  if (choices.length >= 2) {
    return {
      type: 'choice',
      message: lastLine || 'Select an option:',
      options: choices
    };
  }

  // Check for standard prompt
  for (const pattern of PROMPT_PATTERNS) {
    if (pattern.test(lastLine)) {
      return {
        type: 'input',
        message: lastLine.trim()
      };
    }
  }

  return null;
}

function stripAnsi(str) {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-m]/g, '');
}

function extractChoices(output) {
  const choices = [];
  const lines = output.split('\n');
  
  // Find lines starting with "1) ", "2) ", etc.
  const choiceRegex = /^(\d+)\)\s+(.+)$/;
  
  for (const line of lines) {
    const match = line.trim().match(choiceRegex);
    if (match) {
      choices.push({
        label: match[2].trim(),
        value: match[1]
      });
    }
  }
  
  return choices;
}
