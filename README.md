# AWCP 证券办公示例项目

与 `../cdk` 同级的独立 React/TypeScript 演示应用。O01～O16、S01～S05 使用虚构数据展示事项列表、独立发起表单与事项详情；P01～P10 保留协议实验。模型根据用户任务操作页面，不自动执行固定流程。S01 是优先讲解案例。

已配置 React 18、TypeScript strict、Webpack + SWC、CSS Modules 支持、ESLint、Prettier和 Vitest。React 根节点按场景挂载本地 `AwcpProvider`；当前页面可浏览 31 个场景入口。O01～O16、S01～S05 页面注册业务 Action，P01～P10 注册隔离的协议实验 Action。

场景路由和当前页 Action 作用域见 [说明](docs/scenario-routing.md)。各业务规则与数据仍沿用原有 service 和虚构种子；协议实验 P01～P10 保留。既有分场景设计资料位于 `docs/`，其中历史验收记录按当时版本理解。

## 本地 AWCP 与 UI 入口

协议运行时位于 `package/awcp/`，入口别名为 `@app/awcp`；项目实际使用的 ComboCondition、DataTable、DataTree 适配位于 `package/ui/`，入口别名为 `@app/ui`。来源、范围和后续验证见 [抽离记录](docs/awcp-local-source.md)。

## 安装与运行

依赖由用户准备，本项目没有自动安装脚本或安装时执行的代码生成流程。项目已加入父级 `pnpm-workspace.yaml`，父级锁文件已有 importer；本地依赖抽离后的重新安装与独立构建待用户安装后验证。

安装前需要注意：本次开始前，父级 `check:workspace` 就有 **34 条既有版本不匹配**，涉及 admin-react 和部分 CDK 包。父级 `postinstall` 会运行此检查，部分旧 `workspace:` 引用也可能在解析时失败。详情见 [当前交付与验证记录](docs/scaffold-status.md)。这些既有依赖未在本次修改；应按工作区维护流程处理，不能将其当作新项目的安装成功结果。

在父级工作区复核时运行：

```bash
pnpm --filter awcp-examples run check:protocol
pnpm --filter awcp-examples run check:plans
pnpm --filter awcp-examples run quality
pnpm --filter awcp-examples run dev
```

开发地址：`http://127.0.0.1:2180`。该地址只绑定本机；首页显示场景目录，`/scenes/O01` 显示工作台待办，`/scenes/O02` 显示人员与组织，`/scenes/O03` 显示公告与通知，`/scenes/O04` 显示邮件与内部消息，`/scenes/O05` 显示日程与会议，`/scenes/O06` 显示文档与知识库，`/scenes/O07` 显示表格与数据处理，`/scenes/O08` 显示通用审批，`/scenes/O09` 显示差旅报销与 B06 草稿演示，`/scenes/O10` 显示人事与考勤，`/scenes/O11` 显示采购与供应商，`/scenes/O12` 显示合同与用印，`/scenes/O13` 显示资产与行政，`/scenes/O14` 显示项目与任务协作，`/scenes/O15` 显示 IT 服务与权限，`/scenes/O16` 显示统计报表与档案，`/scenes/S01` 显示客户资料与适当性流程，`/scenes/S02` 显示研报编制、审阅与模拟发布，`/scenes/S03` 显示投行立项与尽调协作，`/scenes/S04` 显示风险预警调查与处置，`/scenes/S05` 显示机构客户服务与路演协同，`/scenes/P01` 显示两层发现实验，`/scenes/P02` 显示 Schema 错误实验，`/scenes/P03` 显示动态校验实验，`/scenes/P04` 显示 revision 实验，`/scenes/P05` 显示生命周期实验，`/scenes/P06` 显示异步取消实验，`/scenes/P07` 显示业务幂等实验，`/scenes/P08` 显示错误归一实验，`/scenes/P09` 显示动态合同实验，`/scenes/P10` 显示容量隔离实验。部署输出目录为 `dist/`；部署环境需要把深层 URL 回退到 `index.html`。

可在开发者工具验证：

```javascript
window.awcp.protocolVersion; // 预期为 1
window.awcp.manual(); // 首页为置空 sections；O09 基础演示包含组件与草稿 Action
```

演示改造只做相关页面验证、现有 lint、类型检查与构建，不增加模型工程门禁。`format:check` 单独检查格式。

## 目录

```text
src/
├── main.tsx                 # React 入口
├── app/                     # 根组件与按场景作用域的 AWCP Provider
├── pc/
│   ├── pages/               # 场景目录、事项列表、独立发起表单与详情
│   ├── components/          # 布局、筛选表格、草稿编辑
│   ├── hooks/               # 空目录
│   ├── routes/              # 原生 History 路由与页面作用域
│   └── service/             # 草稿、工作流、差旅报销、客户、研报、投行项目、待办、目录、通知、通信、会议、文档、表格与审批服务，尚未接入 HTTP
└── common/
    ├── awcp/                # site 与 Action 合同模板
    ├── types/               # CSS Modules 类型
    ├── fixtures/            # 虚构数据类型、固定种子与模拟时钟
    ├── scenarios/           # 31 个场景的 ID、名称与 URL
    └── store/               # 内存 repository 与受限持久化
plans/                       # 可执行任务拆分和机器可读清单
docs/                        # 当前接入与验收记录
package/                     # 本地 AWCP 协议运行时与三种 UI 适配
tests/                       # 协议桥接、场景作用域、业务数据与定向页面测试
```

业务逻辑进入 service，页面只组装视图。首期业务使用内存数据；实际接入 HTTP 时通过有类型的 API/service 层统一处理超时、错误和拦截器，不在组件中直接请求。

## 后续任务

按 [计划索引](plans/README.md) 继续收尾 Q02～Q03 质量任务。`plans/backlog.json` 保存任务状态、依赖、产物和验收条件。完整目标保持为 16 类办公场景的 48 个任务、5 条证券业务流程和 10 类协议实验；现有 O01～O16、S01～S05 页面提供业务演示流程，P01～P10 提供协议实验。

本次没有执行 Git 初始化、提交或远端配置。父目录的 `.gitignore` 默认忽略子项目，本目录以文件形式保留，后续可按团队流程纳入独立仓库。
