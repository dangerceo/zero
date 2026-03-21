import { callLLM } from '../settings.js';
import { createTicket, TICKET_PRIORITY } from './ticket.js';

const EXPO_SYSTEM_PROMPT = `You are the Expo — the planning agent in a Kitchen-style development system.
Your ONLY job is to decompose a user's goal into discrete, atomic tickets.

Rules:
- You NEVER write code. You only plan.
- Each ticket must be small enough for one focused Gemini CLI session.
- Each ticket must have clear acceptance criteria (how to know it's done).
- Order tickets so dependencies come first.
- Estimate rough token budget per ticket (small=2000, medium=5000, large=10000).
- If a ticket depends on another, list the dependency by index (0-based).

Respond with ONLY a JSON array. No markdown, no explanation, just the array.
Each ticket object must have:
{
  "title": "short human-readable title",
  "description": "detailed spec of what to build/change",
  "acceptance": ["criterion 1", "criterion 2"],
  "priority": 1|2|3,
  "estimatedTokens": number,
  "dependsOnIndex": [] // indices of tickets this depends on
}

Priority: 1=urgent/foundational, 2=next, 3=nice-to-have

Example for "Build a todo app":
[
  {"title":"Create HTML structure","description":"Create index.html with a form input, add button, and ul for todo items","acceptance":["index.html exists","Has input field","Has submit button","Has empty ul#todo-list"],"priority":1,"estimatedTokens":2000,"dependsOnIndex":[]},
  {"title":"Add CSS styling","description":"Style the todo app with a clean, modern look","acceptance":["style.css exists","App is centered","Items have hover state"],"priority":2,"estimatedTokens":2000,"dependsOnIndex":[0]},
  {"title":"Implement JS logic","description":"Add/remove/toggle todos with localStorage persistence","acceptance":["Todos can be added","Todos can be deleted","State persists on reload"],"priority":1,"estimatedTokens":5000,"dependsOnIndex":[0]}
]`;

/**
 * The Expo: takes a raw user goal and existing project context,
 * returns an array of Tickets ready for the Line.
 */
export async function decompose(orderId, goal, context = {}) {
    const { existingFiles = [], checkpoints = [] } = context;

    let prompt = `Decompose this goal into tickets:\n\nGOAL: ${goal}\n`;

    if (existingFiles.length > 0) {
        prompt += `\nEXISTING FILES in the project:\n${existingFiles.join('\n')}\n`;
        prompt += `\nBuild on these files — don't start from scratch.\n`;
    }

    if (checkpoints.length > 0) {
        prompt += `\nALREADY COMPLETED:\n`;
        checkpoints.forEach((cp, i) => {
            prompt += `${i + 1}. ${cp.summary}\n`;
        });
        prompt += `\nContinue from where we left off.\n`;
    }

    console.log('[EXPO] Calling LLM for goal decomposition...');
    const raw = await callLLM(prompt, EXPO_SYSTEM_PROMPT);
    console.log(`[EXPO] LLM returned ${raw.length} chars`);

    // Parse the JSON response — strip markdown fences if the LLM wraps them
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
        console.log(`[EXPO] Parsed ${parsed.length} ticket(s) from LLM response`);
    } catch (e) {
        throw new Error(`Expo failed to parse LLM response as JSON: ${e.message}\nRaw: ${raw.slice(0, 500)}`);
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error(`Expo produced empty or non-array response`);
    }

    // Convert parsed objects to proper Tickets, resolving index-based dependencies
    const tickets = parsed.map((item, index) => createTicket({
        orderId,
        title: item.title,
        description: item.description,
        acceptance: item.acceptance || [],
        priority: item.priority || TICKET_PRIORITY.NEXT,
        estimatedTokens: item.estimatedTokens || null,
        dependencies: [] // filled in below
    }));

    // Resolve dependsOnIndex → actual ticket IDs
    parsed.forEach((item, index) => {
        if (item.dependsOnIndex && Array.isArray(item.dependsOnIndex)) {
            for (const depIndex of item.dependsOnIndex) {
                if (depIndex >= 0 && depIndex < tickets.length && depIndex !== index) {
                    tickets[index].dependencies.push(tickets[depIndex].id);
                }
            }
        }
    });

    return tickets;
}

/**
 * Re-plan: given existing tickets (some done, some queued) and a new user directive,
 * produce updated tickets for remaining work.
 */
export async function replan(orderId, originalGoal, existingTickets, newDirective, context = {}) {
    const doneTickets = existingTickets.filter(t => t.status === 'done');
    const remainingTickets = existingTickets.filter(t => t.status === 'queued' || t.status === 'prep');

    let prompt = `ORIGINAL GOAL: ${originalGoal}\n\n`;
    prompt += `COMPLETED TICKETS:\n`;
    doneTickets.forEach(t => {
        prompt += `- ✅ ${t.title}: ${t.outputSummary || 'done'}\n`;
    });
    prompt += `\nREMAINING PLANNED TICKETS:\n`;
    remainingTickets.forEach(t => {
        prompt += `- ⏳ ${t.title}: ${t.description}\n`;
    });
    prompt += `\nNEW USER DIRECTIVE: ${newDirective}\n`;
    prompt += `\nRe-plan the remaining work. Keep completed work, but adjust or replace queued tickets to incorporate the new directive. Output ONLY the new/updated tickets as JSON.\n`;

    const raw = await callLLM(prompt, EXPO_SYSTEM_PROMPT);

    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    let parsed;
    try {
        parsed = JSON.parse(cleaned);
    } catch (e) {
        throw new Error(`Expo replan failed to parse: ${e.message}`);
    }

    const newTickets = parsed.map(item => createTicket({
        orderId,
        title: item.title,
        description: item.description,
        acceptance: item.acceptance || [],
        priority: item.priority || TICKET_PRIORITY.NEXT,
        estimatedTokens: item.estimatedTokens || null,
        dependencies: []
    }));

    // Resolve internal dependencies
    parsed.forEach((item, index) => {
        if (item.dependsOnIndex && Array.isArray(item.dependsOnIndex)) {
            for (const depIndex of item.dependsOnIndex) {
                if (depIndex >= 0 && depIndex < newTickets.length && depIndex !== index) {
                    newTickets[index].dependencies.push(newTickets[depIndex].id);
                }
            }
        }
    });

    return newTickets;
}

/**
 * Suggest Next Steps: analyzes the result of an order and suggests
 * what the user might want to do next to improve or extend the project.
 */
export async function suggestNextSteps(goal, completedTickets) {
    const summary = completedTickets.map(t => `- ${t.title}: ${t.outputSummary || 'done'}`).join('\n');

    const prompt = `GOAL: ${goal}\n\nCOMPLETED WORK:\n${summary}\n\nThe order is complete. What are 2-3 logical NEXT STEPS to improve, polish, or extend this? Keep them short and professional. Format as a bulleted list.`;

    try {
        const response = await callLLM(prompt, "You are the Head Chef (Expo). Suggest logical follow-up work.");
        return response.trim();
    } catch (e) {
        return "Enjoy your meal! (Next steps unavailable)";
    }
}
