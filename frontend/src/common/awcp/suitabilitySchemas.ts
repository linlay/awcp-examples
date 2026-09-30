const READ_PROPERTIES = {
  clientId: { type: 'string', pattern: '^CLI-[0-9]{3}$' },
  actorId: { type: 'string', pattern: '^EMP-[0-9]{3}$' }
};

const MUTATION_PROPERTIES = {
  ...READ_PROPERTIES,
  expectedVersion: { type: 'integer', minimum: 1 },
  idempotencyKey: { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' }
};

export const CLIENT_READ_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['clientId', 'actorId'],
  properties: READ_PROPERTIES
};

export const CLIENT_MUTATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['clientId', 'actorId', 'expectedVersion', 'idempotencyKey'],
  properties: MUTATION_PROPERTIES
};

export const CLIENT_PATCH_SCHEMA = {
  ...CLIENT_MUTATION_SCHEMA,
  required: [...CLIENT_MUTATION_SCHEMA.required, 'identityDocumentNo', 'contactPhone', 'questionnaire'],
  properties: {
    ...MUTATION_PROPERTIES,
    identityDocumentNo: { type: 'string', pattern: '^DEMO-[A-Z0-9-]{3,40}$' },
    contactPhone: { type: 'string', pattern: '^1[0-9]{10}$' },
    questionnaire: {
      type: 'object',
      additionalProperties: false,
      required: ['riskTolerance', 'lossCapacity', 'answeredAt'],
      properties: {
        riskTolerance: { type: 'integer', minimum: 1, maximum: 5 },
        lossCapacity: { type: 'integer', minimum: 1, maximum: 5 },
        answeredAt: { type: 'string', minLength: 1 }
      }
    }
  }
};

export const CLIENT_MATCH_SCHEMA = {
  ...CLIENT_MUTATION_SCHEMA,
  required: [...CLIENT_MUTATION_SCHEMA.required, 'productId'],
  properties: {
    ...MUTATION_PROPERTIES,
    productId: { type: 'string', pattern: '^PRD-[0-9]{3}$' }
  }
};

export const CLIENT_DECISION_SCHEMA = {
  ...CLIENT_MUTATION_SCHEMA,
  required: [...CLIENT_MUTATION_SCHEMA.required, 'decision', 'reason'],
  properties: {
    ...MUTATION_PROPERTIES,
    decision: { type: 'string', enum: ['approve', 'return'] },
    reason: { type: 'string', maxLength: 200 }
  }
};
