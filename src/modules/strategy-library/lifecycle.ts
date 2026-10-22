export const LIFECYCLE_STATUSES = [
  'DRAFT',
  'REVIEW',
  'PUBLISHED',
  'DEPRECATED',
  'BLOCKED_RIGHTS',
  'UNAVAILABLE',
  'EXPERIMENTAL',
] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

const TRANSITIONS: Record<LifecycleStatus, LifecycleStatus[]> = {
  DRAFT: ['REVIEW', 'BLOCKED_RIGHTS', 'UNAVAILABLE'],
  REVIEW: ['PUBLISHED', 'DRAFT', 'BLOCKED_RIGHTS', 'UNAVAILABLE'],
  PUBLISHED: ['DEPRECATED'],
  DEPRECATED: [],
  BLOCKED_RIGHTS: ['DRAFT'],
  UNAVAILABLE: ['DRAFT'],
  EXPERIMENTAL: ['DRAFT'],
};

export type TransitionError =
  | { code: 'ILLEGAL_TRANSITION'; from: LifecycleStatus; to: LifecycleStatus }
  | { code: 'MISSING_JUSTIFICATION'; to: LifecycleStatus };

export interface TransitionInput {
  from: LifecycleStatus;
  to: LifecycleStatus;
  justification?: string;
}

export function canTransition(from: LifecycleStatus, to: LifecycleStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: LifecycleStatus): LifecycleStatus[] {
  return [...TRANSITIONS[from]];
}

/** Pure validation of a lifecycle transition, independent of persistence. */
export function validateTransition(input: TransitionInput): TransitionError | null {
  if (!canTransition(input.from, input.to)) {
    return { code: 'ILLEGAL_TRANSITION', from: input.from, to: input.to };
  }
  if ((input.to === 'DEPRECATED' || input.to === 'BLOCKED_RIGHTS') && !input.justification?.trim()) {
    return { code: 'MISSING_JUSTIFICATION', to: input.to };
  }
  return null;
}

/** A version is editable in place until the moment it is published. */
export function isEditable(status: LifecycleStatus): boolean {
  return status === 'DRAFT' || status === 'REVIEW' || status === 'EXPERIMENTAL';
}
