import {
  canTransition,
  isEditable,
  nextStatuses,
  validateTransition,
  type LifecycleStatus,
} from './lifecycle.js';

describe('strategy lifecycle state machine', () => {
  it('allows the happy path DRAFT -> REVIEW -> PUBLISHED -> DEPRECATED', () => {
    expect(canTransition('DRAFT', 'REVIEW')).toBe(true);
    expect(canTransition('REVIEW', 'PUBLISHED')).toBe(true);
    expect(canTransition('PUBLISHED', 'DEPRECATED')).toBe(true);
  });

  it('rejects skipping steps and resurrecting deprecated content', () => {
    expect(canTransition('DRAFT', 'PUBLISHED')).toBe(false);
    expect(canTransition('DRAFT', 'DEPRECATED')).toBe(false);
    expect(canTransition('DEPRECATED', 'PUBLISHED')).toBe(false);
    expect(canTransition('DEPRECATED', 'DRAFT')).toBe(false);
  });

  it('reports an illegal transition with from/to context', () => {
    expect(validateTransition({ from: 'DRAFT', to: 'PUBLISHED' })).toEqual({
      code: 'ILLEGAL_TRANSITION',
      from: 'DRAFT',
      to: 'PUBLISHED',
    });
  });

  it('requires a justification to deprecate or block', () => {
    expect(validateTransition({ from: 'PUBLISHED', to: 'DEPRECATED' })).toEqual({
      code: 'MISSING_JUSTIFICATION',
      to: 'DEPRECATED',
    });
    expect(
      validateTransition({ from: 'PUBLISHED', to: 'DEPRECATED', justification: 'replaced by v2' }),
    ).toBeNull();
    expect(validateTransition({ from: 'REVIEW', to: 'BLOCKED_RIGHTS', justification: '  ' })).toEqual({
      code: 'MISSING_JUSTIFICATION',
      to: 'BLOCKED_RIGHTS',
    });
  });

  it('lists the next legal statuses for each state', () => {
    expect(nextStatuses('DRAFT').sort()).toEqual(['BLOCKED_RIGHTS', 'REVIEW', 'UNAVAILABLE']);
    expect(nextStatuses('PUBLISHED')).toEqual(['DEPRECATED']);
    expect(nextStatuses('DEPRECATED')).toEqual([]);
  });

  it('only allows in-place edits before publication', () => {
    const editable: LifecycleStatus[] = ['DRAFT', 'REVIEW', 'EXPERIMENTAL'];
    const locked: LifecycleStatus[] = [
      'PUBLISHED',
      'DEPRECATED',
      'BLOCKED_RIGHTS',
      'UNAVAILABLE',
    ];
    for (const status of editable) expect(isEditable(status)).toBe(true);
    for (const status of locked) expect(isEditable(status)).toBe(false);
  });
});
