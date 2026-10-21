export type DomainErrorCode =
  | 'DUPLICATE_CARD'
  | 'INVALID_CARD'
  | 'INVALID_BOARD_LENGTH'
  | 'INVALID_ACTION'
  | 'ILLEGAL_ACTION'
  | 'ACTION_OUT_OF_ORDER'
  | 'RAISE_BELOW_MINIMUM'
  | 'INSUFFICIENT_STACK'
  | 'RFI_WITH_PRIOR_ACTION'
  | 'INCONSISTENT_STACK'
  | 'INCONSISTENT_POT'
  | 'INVALID_SIZING';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Record<string, unknown>;

  constructor(code: DomainErrorCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

export function domainError(
  code: DomainErrorCode,
  message: string,
  details?: Record<string, unknown>,
): DomainError {
  return new DomainError(code, message, details);
}
