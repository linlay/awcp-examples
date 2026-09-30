const text = (maxLength: number) => ({ type: 'string', maxLength });
const date = { type: 'string', pattern: '^(|[0-9]{4}-[0-9]{2}-[0-9]{2})$' };
export const RISK_DOSSIER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'periodStart',
    'periodEnd',
    'riskLevel',
    'methods',
    'contactRequired',
    'contactOn',
    'contactMethod',
    'contactSummary',
    'checks',
    'measures'
  ],
  properties: {
    periodStart: date,
    periodEnd: date,
    riskLevel: { enum: ['', 'low', 'medium', 'high'] },
    methods: { type: 'array', uniqueItems: true, maxItems: 3, items: { enum: ['system', 'documents', 'contact'] } },
    contactRequired: { type: 'boolean' },
    contactOn: date,
    contactMethod: { enum: ['', 'phone', 'email', 'meeting'] },
    contactSummary: text(500),
    checks: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'accountRef',
          'market',
          'instrument',
          'tradeDate',
          'direction',
          'amountCents',
          'finding',
          'note'
        ],
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 64 },
          accountRef: text(40),
          market: { enum: ['', 'SH', 'SZ', 'OTC'] },
          instrument: text(40),
          tradeDate: date,
          direction: { enum: ['', 'buy', 'sell', 'transfer'] },
          amountCents: { type: 'integer', minimum: 0, maximum: 100000000000 },
          finding: { enum: ['', 'normal', 'abnormal', 'unconfirmed'] },
          note: text(300)
        }
      }
    },
    measures: {
      type: 'array',
      maxItems: 20,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'kind', 'ownerId', 'dueDate', 'description'],
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 64 },
          kind: { enum: ['', 'monitor', 'request-material', 'escalate'] },
          ownerId: text(20),
          dueDate: date,
          description: text(300)
        }
      }
    }
  }
};
export const RISK_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['analysis', 'conclusion', 'proposedDisposition', 'evidenceIds', 'dossier'],
  properties: {
    analysis: text(500),
    conclusion: { enum: ['', 'false-positive', 'confirmed'] },
    proposedDisposition: { enum: ['', 'close', 'escalate'] },
    evidenceIds: {
      type: 'array',
      uniqueItems: true,
      maxItems: 100,
      items: { type: 'string', pattern: '^REVD-[0-9]{3}$' }
    },
    dossier: RISK_DOSSIER_SCHEMA
  }
};
export const RISK_SAVE_DRAFT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['actorId', 'alertId', 'expectedVersion', 'idempotencyKey', 'draft'],
  properties: {
    actorId: { type: 'string', pattern: '^EMP-[0-9]{3}$' },
    alertId: { type: 'string', pattern: '^RALT-[0-9]{3}$' },
    expectedVersion: { type: 'integer', minimum: 1 },
    idempotencyKey: { type: 'string', pattern: '^[A-Za-z0-9_.:-]{1,128}$' },
    draft: RISK_DRAFT_SCHEMA
  }
};
