# MCP Demo 实施范围

2026-10-03 用户明确收敛为小型安装与连接验证 demo。本次不推进企业身份体系或全量 O/S 业务迁移。

## 最终结构

一个 Go 进程提供静态前端、原 HTTP API、MCP、内置 OAuth；复用一个 SQLite 文件。保留已安装的官方 MCP SDK，不增加依赖或外部服务。

本地默认 demo/demo 登录后复制一小时 Access Token。标准客户端可走资源发现、授权服务发现、动态注册、Authorization Code + S256 PKCE、工具调用和撤销。仅公共客户端，不实现 OIDC、刷新或企业 SSO。

## 范围

- 内置授权、登录页、Token 校验与撤销。
- 已有 Go Service 的四个读取工具及可选两个重置工具。
- 默认小数据集，已有大数据集保留为显式测试选项。
- 测试真实内置授权、MCP 协议、Scope、空间隔离、重放与撤销。
- 移除未运行的外部授权服务配置、私有凭据及安装指令。

31 场景/128 Action 清单仅说明现状，不是本轮必须迁移的功能列表。原全栈规划保留历史用途；本次只落实用户明确的小型 demo 范围。

## 验收与记录

- [运行与连接](../../docs/mcp-deployment.md)
- [实施和验证记录](../../docs/mcp-progress.md)
- [Action 清单](../../contracts/mcp/action-mapping.json)
