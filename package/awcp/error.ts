import type { AwcpErrorCode, JsonValue } from './types';

export class AwcpActionError extends Error {
  readonly code: AwcpErrorCode;
  readonly details?: JsonValue;

  constructor(code: `action.${string}`, message: string, details?: JsonValue) {
    super(message);
    this.name = 'AwcpActionError';
    this.code = code;
    this.details = details;
  }
}
