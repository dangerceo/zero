/**
 * Heuristic logic to detect if a terminal process is blocking for input.
 */

/**
 * Patterns that indicate a terminal is waiting for user input.
 * @type {Array<RegExp>}
 */
const PROMPT_PATTERNS = [
  /[:?>$]\s*$/,           // Standard prompts like "Name:", "> ", "Continue? "
  /\(y\/n\)\s*$/i,        // Yes/No prompts
  /password:\s*$/i        // Password prompts
];

/**
 * Pattern to identify a potential numbered choice list.
 * @type {RegExp}
 */
const CHOICE_LIST_PATTERN = /\d+\)\s+.+[\r\n]+/; // Matches at least one numbered option followed by newline

/**
 * Detects if the provided terminal output indicates a blocked state.
 * @param {string} output The raw terminal output.
 * @param {number} lastActivityTime Timestamp of the last data received.
 * @returns {Object|null} An intervention object if a block is detected, else null.
 */
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

/**
 * Strips ANSI escape codes from a string.
 * @param {string} str The string to clean.
 * @returns {string} The cleaned string.
 */
function stripAnsi(str) {
  return str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-m]/g, '');
}

/**
 * Extracts numbered choices from terminal output.
 * @param {string} output The cleaned terminal output.
 * @returns {Array<Object>} List of {label, value} objects.
 */
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
