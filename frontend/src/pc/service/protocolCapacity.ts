import { AWCP_LIMITS, createAwcpRegistry } from '@app/awcp';
import type { AwcpActionRegistration, AwcpManualIndex } from '@app/awcp';

export interface CapacityProbeResult {
  actionCount: number;
  actionError: string;
  actionAtomic: boolean;
  indexCount: number;
  indexError: string;
  indexAtomic: boolean;
  sectionError: string;
  sectionAtomic: boolean;
}

const site = { name: 'P10 私有容量探针', description: '仅验证真实 Core 的容量与原子拒绝。' };
const smallSchema = { type: 'object', additionalProperties: false, properties: {} };

function registration(action: string, title = '容量探针'): AwcpActionRegistration {
  return {
    action,
    title,
    description: '私有容量探针。',
    inputSchema: smallSchema,
    examples: [{}],
    invoke: () => ({ status: 'completed' })
  };
}

function index(registry: ReturnType<typeof createAwcpRegistry>): AwcpManualIndex {
  const value = registry.manual();
  if (!('sections' in value)) throw new Error('Expected Core manual index.');
  return value;
}

export function runCapacityProbes(): CapacityProbeResult {
  const countRegistry = createAwcpRegistry(site);
  let actionCount = 0;
  let actionError = '';
  let actionAtomic = false;
  try {
    for (let i = 0; i < AWCP_LIMITS.maxActions; i += 1) countRegistry.register(registration(`p.count${i}`));
    const before = index(countRegistry);
    actionCount = before.sections.length;
    try {
      countRegistry.register(registration('p.overflow'));
    } catch (error) {
      actionError = error instanceof Error ? error.message : String(error);
    }
    const after = index(countRegistry);
    actionAtomic = after.revision === before.revision && after.sections.length === before.sections.length;
  } finally {
    countRegistry.dispose();
  }

  const indexRegistry = createAwcpRegistry({ name: 'P10 大目录探针', description: '中'.repeat(5000) });
  let indexCount = 0;
  let indexError = '';
  let indexAtomic = false;
  try {
    for (let i = 0; i < AWCP_LIMITS.maxActions; i += 1) {
      const before = index(indexRegistry);
      try {
        indexRegistry.register(registration(`p.${'a'.repeat(110)}.${i}`, '中'.repeat(AWCP_LIMITS.maxTitleLength)));
      } catch (error) {
        indexError = error instanceof Error ? error.message : String(error);
        const after = index(indexRegistry);
        indexCount = after.sections.length;
        indexAtomic = after.revision === before.revision && after.sections.length === before.sections.length;
        break;
      }
    }
  } finally {
    indexRegistry.dispose();
  }

  const sectionRegistry = createAwcpRegistry(site);
  let sectionError = '';
  let sectionAtomic = false;
  try {
    const before = index(sectionRegistry);
    try {
      sectionRegistry.register({
        action: 'p.large-section',
        title: '大章节探针',
        description: '真实 Core 章节容量实验。',
        inputSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['payload'],
          properties: { payload: { type: 'string' } }
        },
        examples: Array.from({ length: AWCP_LIMITS.maxExamples }, () => ({ payload: 'a'.repeat(8192) })),
        invoke: () => ({ status: 'completed' })
      });
    } catch (error) {
      sectionError = error instanceof Error ? error.message : String(error);
    }
    const after = index(sectionRegistry);
    sectionAtomic = after.revision === before.revision && after.sections.length === before.sections.length;
  } finally {
    sectionRegistry.dispose();
  }

  return { actionCount, actionError, actionAtomic, indexCount, indexError, indexAtomic, sectionError, sectionAtomic };
}
