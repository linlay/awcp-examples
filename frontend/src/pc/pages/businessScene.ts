import type { DemoState } from '../../common/fixtures/types';

export interface BusinessSceneConfig {
  collection: keyof DemoState;
  relatedCollections?: ReadonlyArray<keyof DemoState>;
  idField?: string;
  labelField?: string;
  forms?: ReadonlyArray<{ type: string; label: string }>;
}

// Only real, persisted business objects appear here. A missing `forms` entry means
// the scene has no creation Action and starts from an existing item.
export const BUSINESS_SCENES: Record<string, BusinessSceneConfig> = {
  O01: { collection: 'todos', idField: 'id' },
  O02: { collection: 'officeTeams', relatedCollections: ['contactGroups'], labelField: 'name' },
  O03: { collection: 'notices', labelField: 'title', forms: [{ type: 'notice', label: '起草通知' }] },
  O04: { collection: 'mailMessages', relatedCollections: ['mailReplies', 'officeDiscussions'], labelField: 'subject', forms: [{ type: 'discussion', label: '创建讨论' }] },
  O05: { collection: 'meetings', labelField: 'title', forms: [{ type: 'meeting', label: '预约会议' }] },
  O06: { collection: 'officeDocuments' },
  O07: { collection: 'sheetRows', labelField: 'label' },
  O08: { collection: 'officeApprovalRequests', labelField: 'title', forms: [{ type: 'approval', label: '提交审批申请' }] },
  O09: { collection: 'forms', forms: [{ type: 'travel', label: '提交出差申请' }, { type: 'expense', label: '提交费用报销' }] },
  O10: { collection: 'leaveRequests', relatedCollections: ['attendanceCorrections'], forms: [{ type: 'leave', label: '提交休假申请' }, { type: 'attendance', label: '提交补卡申请' }] },
  O11: { collection: 'purchaseRequests', labelField: 'itemName', forms: [{ type: 'purchase', label: '创建请购单' }] },
  O12: { collection: 'officeContracts', relatedCollections: ['sealRequests'], labelField: 'counterpartyName', forms: [{ type: 'contract', label: '登记合同' }] },
  O13: { collection: 'adminAssets', relatedCollections: ['resourceReservations', 'repairTickets'], labelField: 'name', forms: [{ type: 'reservation', label: '预约资源' }] },
  O14: { collection: 'officeProjects', relatedCollections: ['projectTasks'], labelField: 'title', forms: [{ type: 'project', label: '创建项目' }] },
  O15: { collection: 'accessRequests', relatedCollections: ['itTickets'], forms: [{ type: 'access', label: '提交权限申请' }] },
  O16: { collection: 'officeReportJobs', relatedCollections: ['officeArchives'], forms: [{ type: 'report', label: '生成报表' }] },
  S01: { collection: 'clientCases', idField: 'clientId' },
  S02: { collection: 'researchReports', labelField: 'topicId', forms: [{ type: 'research', label: '创建研报课题' }] },
  S03: { collection: 'ibProjects', labelField: 'title', forms: [{ type: 'project', label: '创建投行项目' }] },
  S04: { collection: 'riskAlerts', labelField: 'title' },
  S05: { collection: 'institutionNeeds', labelField: 'title' }
};

export function businessRecords(state: DemoState, scenarioId: string): Array<Record<string, unknown>> {
  const config = BUSINESS_SCENES[scenarioId];
  if (!config) return [];
  return [config.collection, ...(config.relatedCollections ?? [])].flatMap((collection) => {
    const value: unknown = state[collection];
    return Array.isArray(value) ? (value as Array<Record<string, unknown>>) : [];
  });
}

export function recordId(record: Record<string, unknown>, config: BusinessSceneConfig): string {
  const value = record[config.idField ?? 'id'];
  return typeof value === 'string' ? value : '';
}

export function recordLabel(record: Record<string, unknown>, config: BusinessSceneConfig): string {
  const value = config.labelField ? record[config.labelField] : undefined;
  return typeof value === 'string' && value ? value : recordId(record, config);
}
