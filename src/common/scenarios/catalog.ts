export type ScenarioGroup = 'office' | 'securities' | 'protocol';

export interface ScenarioDefinition {
  readonly id: string;
  readonly title: string;
  readonly group: ScenarioGroup;
  readonly path: string;
}

export const SCENARIO_GROUPS: ReadonlyArray<{ id: ScenarioGroup; title: string }> = [
  { id: 'office', title: '通用办公' },
  { id: 'securities', title: '证券业务' },
  { id: 'protocol', title: '协议实验' }
];

const definitions: ReadonlyArray<Omit<ScenarioDefinition, 'path'>> = [
  { id: 'O01', title: '工作台与待办', group: 'office' },
  { id: 'O02', title: '人员与组织', group: 'office' },
  { id: 'O03', title: '公告与通知', group: 'office' },
  { id: 'O04', title: '邮件与内部消息', group: 'office' },
  { id: 'O05', title: '日程与会议', group: 'office' },
  { id: 'O06', title: '文档与知识库', group: 'office' },
  { id: 'O07', title: '表格与数据处理', group: 'office' },
  { id: 'O08', title: '通用审批', group: 'office' },
  { id: 'O09', title: '差旅与费用', group: 'office' },
  { id: 'O10', title: '人事与考勤', group: 'office' },
  { id: 'O11', title: '采购与供应商', group: 'office' },
  { id: 'O12', title: '合同与用印', group: 'office' },
  { id: 'O13', title: '资产与行政', group: 'office' },
  { id: 'O14', title: '项目与任务协作', group: 'office' },
  { id: 'O15', title: 'IT 服务与权限', group: 'office' },
  { id: 'O16', title: '统计报表与档案', group: 'office' },
  { id: 'S01', title: '客户资料审核与适当性匹配', group: 'securities' },
  { id: 'S02', title: '研报编制、审阅与发布', group: 'securities' },
  { id: 'S03', title: '投行立项与尽调协作', group: 'securities' },
  { id: 'S04', title: '风险预警调查与处置', group: 'securities' },
  { id: 'S05', title: '机构客户服务与路演协同', group: 'securities' },
  { id: 'P01', title: '两层发现与标准调用', group: 'protocol' },
  { id: 'P02', title: 'Schema 与字段错误', group: 'protocol' },
  { id: 'P03', title: '只读动态校验', group: 'protocol' },
  { id: 'P04', title: 'revision 与合同更新', group: 'protocol' },
  { id: 'P05', title: '生命周期与多实例', group: 'protocol' },
  { id: 'P06', title: '异步取消与迟到结果', group: 'protocol' },
  { id: 'P07', title: '重复请求与业务幂等', group: 'protocol' },
  { id: 'P08', title: '受控错误与异常归一', group: 'protocol' },
  { id: 'P09', title: '动态合同与最新状态', group: 'protocol' },
  { id: 'P10', title: '容量与隔离', group: 'protocol' }
];

export const SCENARIOS: ReadonlyArray<ScenarioDefinition> = definitions.map((definition) => ({
  ...definition,
  path: `/scenes/${definition.id}`
}));

const scenariosById = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function findScenario(id: string): ScenarioDefinition | undefined {
  return scenariosById.get(id);
}
