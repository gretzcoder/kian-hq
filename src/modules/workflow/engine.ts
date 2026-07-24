/**
 * Workflow State Machine Engine
 * "Everything is a Workflow."
 *
 * Defines valid transitions for each entity type and validates them.
 * All state changes MUST go through validateTransition() to enforce the machine.
 */

export type EntityType =
  | 'brief'
  | 'project'
  | 'workspace'
  | 'task'
  | 'task_assignment';

// ---------------------------------------------------------------------------
// State transition maps — defines what transitions are allowed per entity
// ---------------------------------------------------------------------------

const BRIEF_TRANSITIONS: Record<string, string[]> = {
  DRAFT:           ['SUBMITTED'],
  SUBMITTED:       ['WAITING_REVIEW'],          // auto-transition on submit
  WAITING_REVIEW:  ['APPROVED', 'DRAFT'],        // DRAFT = request_changes (unlock)
  APPROVED:        ['LOCKED', 'DRAFT'],          // LOCKED = auto; DRAFT = coordinator unlocks
  LOCKED:          ['PROJECT_CREATED', 'DRAFT'], // DRAFT = coordinator unlocks
  PROJECT_CREATED: ['ARCHIVED'],
  ARCHIVED:        [],
};

const PROJECT_TRANSITIONS: Record<string, string[]> = {
  DRAFT:            ['BRIEF_IN_REVIEW', 'PLANNING'],
  BRIEF_IN_REVIEW:  ['PLANNING'],
  PLANNING:         ['IN_PROGRESS'],
  IN_PROGRESS:      ['IN_REVIEW'],
  IN_REVIEW:        ['PUBLISHED', 'IN_PROGRESS'], // back to IN_PROGRESS if not ready
  PUBLISHED:        ['ARCHIVED'],
  ARCHIVED:         [],
};

const WORKSPACE_TRANSITIONS: Record<string, string[]> = {
  ACTIVE:    ['COMPLETED', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED:  [],
};

// Unified task and assignment state machine
const TASK_TRANSITIONS: Record<string, string[]> = {
  DRAFT:              ['SUBMITTED', 'WAITING_REVIEW'],
  SUBMITTED:          ['WAITING_REVIEW'],
  WAITING_REVIEW:     ['APPROVED', 'REVISION_REQUESTED', 'DECLINED'],
  REVISION_REQUESTED: ['RESUBMITTED', 'WAITING_REVIEW'],
  RESUBMITTED:        ['WAITING_REVIEW'],
  APPROVED:           ['LOCKED'],
  LOCKED:             ['PUBLISHED'],
  PUBLISHED:          ['ARCHIVED'],
  DECLINED:           ['DRAFT'], // "Create Again" / reset to Draft
  ARCHIVED:           [],
};

const TASK_ASSIGNMENT_TRANSITIONS: Record<string, string[]> = {
  DRAFT:              ['SUBMITTED', 'WAITING_REVIEW'],
  SUBMITTED:          ['WAITING_REVIEW'],
  WAITING_REVIEW:     ['APPROVED', 'REVISION_REQUESTED', 'DECLINED'],
  REVISION_REQUESTED: ['RESUBMITTED', 'WAITING_REVIEW'],
  RESUBMITTED:        ['WAITING_REVIEW'],
  APPROVED:           ['LOCKED'],
  LOCKED:             ['PUBLISHED'],
  PUBLISHED:          ['ARCHIVED'],
  DECLINED:           ['DRAFT'],
  ARCHIVED:           [],
};

const TRANSITION_MAPS: Record<EntityType, Record<string, string[]>> = {
  brief:           BRIEF_TRANSITIONS,
  project:         PROJECT_TRANSITIONS,
  workspace:       WORKSPACE_TRANSITIONS,
  task:            TASK_TRANSITIONS,
  task_assignment: TASK_ASSIGNMENT_TRANSITIONS,
};

// ---------------------------------------------------------------------------
// Core validator
// ---------------------------------------------------------------------------

/**
 * Validates whether a state transition is allowed for a given entity.
 * Throws an error if the transition is invalid.
 */
export function validateTransition(
  entity: EntityType,
  fromStatus: string,
  toStatus: string,
): void {
  const map = TRANSITION_MAPS[entity];
  if (!map) {
    throw new Error(`Unknown entity type: ${entity}`);
  }

  const allowed = map[fromStatus];
  if (!allowed) {
    throw new Error(
      `Invalid state: ${entity} has no known status "${fromStatus}"`,
    );
  }

  if (!allowed.includes(toStatus)) {
    throw new Error(
      `Invalid transition for ${entity}: "${fromStatus}" → "${toStatus}". ` +
      `Allowed: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}`,
    );
  }
}

/**
 * Returns the allowed next states for an entity in a given status.
 * Useful for rendering action buttons in the UI.
 */
export function getAllowedTransitions(
  entity: EntityType,
  fromStatus: string,
): string[] {
  return TRANSITION_MAPS[entity]?.[fromStatus] ?? [];
}
