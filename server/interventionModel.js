/**
 * Agent Intervention Schema (ACP-compatible)
 * 
 * An intervention occurs when an agent is "blocked" and requires user input.
 */

export const InterventionType = {
  INPUT: 'input',        // Free-form text input
  CHOICE: 'choice',      // Selection from a list of options
  CONFIRMATION: 'confirm' // Yes/No confirmation
};

export class Intervention {
  constructor({ id, agentId, type, message, options = [], createdAt = new Date().toISOString() }) {
    this.id = id || Math.random().toString(36).substring(2, 11);
    this.agentId = agentId;
    this.type = type; // InterventionType
    this.message = message;
    this.options = options; // Array of { label, value } for CHOICE type
    this.createdAt = createdAt;
    this.resolved = false;
    this.response = null;
    this.resolvedAt = null;
  }

  resolve(response) {
    this.resolved = true;
    this.response = response;
    this.resolvedAt = new Date().toISOString();
  }
}
