# 项目计划索引

当前状态：**B00～B07、O01～O16、S01～S05、P01～P10 与 Q01 已验收；Q02～Q03 正在收尾**。O01 完成工作台待办查询、处理与日报，O02 完成跨部门目录、协作组与通讯分组，O03 完成公告发布与未读模拟提醒，O04 完成模拟邮件、回复发送和讨论待办，O05 完成预约、改期和纪要行动项，O06 完成制度检索、块修订、逐版本审阅与归档，O07 完成表格筛选分页、原子批量编辑、导入预检和导出，O08 完成通用申请、审批、退回、撤回与重提，O09 完成虚构差旅报销闭环，O10 完成人事与考勤，O11 完成请购比价、供应商审核与到货验收，O12 完成合同登记、用印审批执行与续签，O13 完成设备领还、资源预约与维修验收，O14 完成项目任务、依赖里程碑与周报，O15 完成权限申请与 IT 工单闭环，O16 完成异步报表、异常钻取和版本归档，S01 完成客户适当性流程，S02 完成研报编制、两级审阅与模拟发布，S03 完成投行立项、尽调、质控与内核审议，S04 完成预警调查、证据补充、独立复核和处置，S05 完成机构需求、路演、资料包、模拟邀请、纪要和回访，P01 完成两层发现实验，P02 完成 Schema 错误实验，P03 完成只读动态校验，P04 完成 revision 实验，P05 完成生命周期实验，P06 完成异步取消实验，P07 完成业务幂等实验，P08 完成错误归一实验，P09 完成动态合同实验，P10 完成容量隔离实验。

任务状态以 [backlog.json](backlog.json) 为准；修改任务状态时同步对应任务文档。任务状态采用 `planned`、`awaiting_user_install`、`implemented_pending_verification`、`in_progress`、`done`。用户已授权继续执行剩余计划任务。

## 范围与顺序

- 完整范围：[范围与验收约定](00-scope.md)。
- 已完成：用户准备依赖，B00～B07、O01～O16、S01～S05 与 P01～P10 已验收；见 [基线记录](../docs/baseline-verification.md)、[路由说明](../docs/scenario-routing.md)、[虚构数据说明](../docs/demo-data.md)、[Action 合同说明](../docs/action-contracts.md)、[调试面板](../docs/debug-panel.md)、[B06 依赖和组件接入](../docs/b06-dependencies.md)、[B07 工作流说明](../docs/workflow-foundation.md)、[O09-01 出差申请](../docs/o09-travel-application.md)、[O09-02 费用校验](../docs/o09-expense-check.md)、[O09-03 报销闭环](../docs/o09-expense-flow.md)、[S01 客户适当性流程](../docs/s01-client-suitability.md)、[S02 研报流程](../docs/s02-research-report.md)、[S03 投行尽调流程](../docs/s03-ib-diligence.md)、[S04 风险预警流程](../docs/s04-risk-alert.md)、[S05 机构路演流程](../docs/s05-institution-roadshow.md)、[P01 两层发现实验](../docs/p01-two-level-discovery.md)、[P02 Schema 错误实验](../docs/p02-schema-errors.md)、[P03 动态校验实验](../docs/p03-dynamic-validation.md)、[P04 revision 实验](../docs/p04-revision-updates.md)、[P05 生命周期实验](../docs/p05-lifecycle.md)、[P06 异步取消实验](../docs/p06-async-cancellation.md)、[P07 业务幂等实验](../docs/p07-request-idempotency.md)、[P08 错误归一实验](../docs/p08-error-normalization.md)、[P09 动态合同实验](../docs/p09-dynamic-contract.md)、[P10 容量隔离实验](../docs/p10-capacity-isolation.md)、[O01 工作台待办](../docs/o01-todo-workbench.md)、[O02 人员与组织](../docs/o02-directory.md)、[O03 公告与通知](../docs/o03-notices.md)、[O04 邮件与内部消息](../docs/o04-communications.md)、[O05 日程与会议](../docs/o05-meetings.md)、[O06 文档与知识库](../docs/o06-documents.md)、[O07 表格与数据处理](../docs/o07-sheets.md)、[O08 通用审批](../docs/o08-approvals.md)、[O10 人事与考勤](../docs/o10-hr.md)、[O11 采购与供应商](../docs/o11-procurement.md)、[O12 合同与用印](../docs/o12-contracts.md)、[O13 资产与行政](../docs/o13-assets-admin.md)、[O14 项目与任务协作](../docs/o14-project-collaboration.md)、[O15 IT 服务与权限](../docs/o15-it-service.md)及 [O16 统计报表与档案](../docs/o16-reports-archives.md)。
- 首个演示版本：B02～B07 → O09 三个任务 → S01、S02、S03。
- 完整版：O01～O16、S01～S05、P01～P10、Q01 已完成 → Q02～Q03。
- 初始估算仍为 2 名前端、半职测试、业务评审支持下约 8～10 周；安装等待和真实宿主集成另计，B01 后复估。

## 基础设施

| 任务                                                    | 状态 |
| ------------------------------------------------------- | ---- |
| [B00 无页面工程骨架与 Core 接入](foundation/B00.md)     | done |
| [B01 用户安装后的基线验收](foundation/B01.md)           | done |
| [B02 场景路由与页面作用域](foundation/B02.md)           | done |
| [B03 虚构数据、repository 与复位](foundation/B03.md)    | done |
| [B04 Action 合同与字段错误模板](foundation/B04.md)      | done |
| [B05 AWCP 调试与调用记录面板](foundation/B05.md)        | done |
| [B06 表单、表格、组织选择与附件适配](foundation/B06.md) | done |
| [B07 审批状态机、业务版本与审计](foundation/B07.md)     | done |

## 通用办公：16 类、48 个任务

| 场景                                | 任务               | 里程碑 |
| ----------------------------------- | ------------------ | ------ |
| [O01 工作台与待办](office/O01.md)   | O01-01 / -02 / -03 | M3     |
| [O02 人员与组织](office/O02.md)     | O02-01 / -02 / -03 | M3     |
| [O03 公告与通知](office/O03.md)     | O03-01 / -02 / -03 | M3     |
| [O04 邮件与内部消息](office/O04.md) | O04-01 / -02 / -03 | M3     |
| [O05 日程与会议](office/O05.md)     | O05-01 / -02 / -03 | M3     |
| [O06 文档与知识库](office/O06.md)   | O06-01 / -02 / -03 | M3     |
| [O07 表格与数据处理](office/O07.md) | O07-01 / -02 / -03 | M3     |
| [O08 通用审批](office/O08.md)       | O08-01 / -02 / -03 | M3     |
| [O09 差旅与费用](office/O09.md)     | O09-01 / -02 / -03 | M1     |
| [O10 人事与考勤](office/O10.md)     | O10-01 / -02 / -03 | M3     |
| [O11 采购与供应商](office/O11.md)   | O11-01 / -02 / -03 | M3     |
| [O12 合同与用印](office/O12.md)     | O12-01 / -02 / -03 | M3     |
| [O13 资产与行政](office/O13.md)     | O13-01 / -02 / -03 | M3     |
| [O14 项目与任务协作](office/O14.md) | O14-01 / -02 / -03 | M3     |
| [O15 IT 服务与权限](office/O15.md)  | O15-01 / -02 / -03 | M3     |
| [O16 统计报表与档案](office/O16.md) | O16-01 / -02 / -03 | M3     |

## 证券业务：5 条完整流程

| 任务                                              | 里程碑 |
| ------------------------------------------------- | ------ |
| [S01 客户资料审核与适当性匹配](securities/S01.md) | M2     |
| [S02 研报编制、审阅与发布](securities/S02.md)     | M2     |
| [S03 投行立项与尽调协作](securities/S03.md)       | M2     |
| [S04 风险预警调查与处置](securities/S04.md)       | M4     |
| [S05 机构客户服务与路演协同](securities/S05.md)   | M4     |

## 协议实验：10 类

| 任务                                       | 里程碑 |
| ------------------------------------------ | ------ |
| [P01 两层发现与标准调用](protocol/P01.md)  | M4     |
| [P02 Schema 与字段错误](protocol/P02.md)   | M4     |
| [P03 只读动态校验](protocol/P03.md)        | M4     |
| [P04 revision 与合同更新](protocol/P04.md) | M4     |
| [P05 生命周期与多实例](protocol/P05.md)    | M4     |
| [P06 异步取消与迟到结果](protocol/P06.md)  | M4     |
| [P07 重复请求与业务幂等](protocol/P07.md)  | M4     |
| [P08 受控错误与异常归一](protocol/P08.md)  | M4     |
| [P09 动态合同与最新状态](protocol/P09.md)  | M4     |
| [P10 容量与隔离](protocol/P10.md)          | M4     |

## 质量与交付

| 任务                                       | 里程碑 |
| ------------------------------------------ | ------ |
| [Q01 合同与场景覆盖门禁](quality/Q01.md)   | M5     |
| [Q02 浏览器与外部宿主验收](quality/Q02.md) | M5     |
| [Q03 产物模式、部署与交付](quality/Q03.md) | M5     |

## 任务实施要求

每个业务任务一起交付页面、service、AWCP 合同、固定数据、任务说明和测试。新依赖必须精确锁定并等待用户安装。业务操作通过 service 共用入口；Schema 校验和两层发现采用现行 Core 合同。

计划自检无需依赖安装：

```bash
node scripts/checkPlans.mjs
```

自检检查任务编号、文档路径、前置任务、循环依赖与数量；它不代表业务任务已经完成。
