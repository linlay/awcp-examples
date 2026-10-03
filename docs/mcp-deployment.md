# 小型 MCP Demo：运行与连接

## 本地使用

沿用已安装的 Go/前端依赖，没有新增身份服务、数据库容器或安装步骤。

```sh
pnpm run dev
```

打开 <http://127.0.0.1:2181/api/v1/mcp/connect>，输入 **demo / demo**，复制页面中的 Access Token。

也可从业务网站总 Header 的 **MCP 连接** 进入：查看并复制服务地址、选择 OAuth 或手动 Token 接入，展开 OAuth 发现地址。登录页在新标签页打开。地址使用会话返回的后端连接配置，不使用前端开发服务器端口；服务未启用或连接信息不可用时会显示对应提示。

- MCP URL：`http://127.0.0.1:2181/mcp`
- 认证：`Authorization: Bearer <Access Token>`
- Token 有效期：一小时，过期重新登录。
- 同一 demo 账号共享一个演示空间；网页登录会轮换浏览器 Cookie。
- 页面提供“撤销此账号的全部 MCP Token”。撤销同时清除未兑换授权码并断开空间；令牌只保存哈希，不写入浏览器存储。

Node/pnpm 只用于开发和构建。已有前端构建后可直接 `make dev-backend`；打包运行只需要 Go 可执行文件、前端静态文件和 SQLite 数据文件。Docker 是可选打包方式。

默认使用 48 条历史样本的小型数据集；设置 `AWCP_DATA_PROFILE=standard` 才为新空间生成 24,000 条压测样本。已有空间不会因修改默认值被覆盖。

## 配置

服务读取进程环境，不自动读取 `.env`。完整变量见根 `.env.example`。

| 变量 | 本地默认值 | 用途 |
| --- | --- | --- |
| AWCP_MCP_ENABLED | true | 开关 |
| AWCP_MCP_PUBLIC_URL | http://127.0.0.1:2181/mcp | 精确 MCP 地址，issuer 使用同一 origin |
| AWCP_MCP_USERNAME | demo | 演示账号 |
| AWCP_MCP_PASSWORD | demo | 演示密码 |
| AWCP_MCP_RESET_ENABLED | false | 是否开放重置工具 |
| AWCP_MCP_MAX_CONCURRENT | 8 | MCP 请求并发上限 |

公网使用 HTTPS、精确的 `AWCP_ALLOWED_ORIGINS` 及自定义密码（至少八位）。修改账号、密码、issuer 或资源地址后，旧令牌和授权码失效。原有部署 Compose 默认保持 MCP 关闭；启用时设置 `AWCP_MCP_ENABLED=true` 与自定义 `AWCP_MCP_PASSWORD`，仍只有 app 一个容器。无需重新安装任何镜像。

## 标准 OAuth 客户端

除手动粘贴 Token 外，也支持客户端浏览器登录授权：

1. 客户端访问 `/mcp`，401 的 `WWW-Authenticate` 指向资源发现文档。
2. `/.well-known/oauth-protected-resource/mcp`（同时提供根路径别名）声明资源、Scope 和 issuer。
3. `/.well-known/oauth-authorization-server` 提供 RFC 8414 元数据。
4. `/oauth/register` 支持公共客户端动态注册（`token_endpoint_auth_method: "none"`），最多八个精确 HTTPS 或回环 HTTP 回调地址；不允许通配符、用户信息或 fragment。
5. `/api/v1/mcp/oauth/authorize` 展示客户端名称、回调和权限；输入 demo 账号密码并确认授权。
6. `/oauth/token` 只支持 `authorization_code`，要求 S256 PKCE，授权码绑定客户端、回调、资源、Scope、配置凭据，五分钟有效且只用一次。
7. `/oauth/revoke` 接收 token 和 client_id，撤销该客户端令牌。

授权和兑换请求均携带 `resource=<精确 MCP URL>`。授权回调包含 `state` 和 `iss`。所有客户端使用公共客户端 + PKCE；不实现机密客户端、OIDC、CIMD、刷新令牌、密码 grant、企业 SSO 或多用户管理，也不在元数据中宣称支持它们。用户名密码表单是本应用的登录页面，不是 OAuth 密码 grant。

标准流程适用支持动态注册或已注册 client_id 的 MCP 客户端；仅支持其他注册机制的客户端可使用手动 Bearer Token。官方依据：[MCP Authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)。

## 可用工具

| 工具 | Scope | 行为 |
| --- | --- | --- |
| demo_context_get | context:read | 当前空间和 generation |
| demo_scenarios_list | context:read | 场景及后端接入状态 |
| demo_directory_query | directory:read | 分页查询虚构组织人员 |
| demo_analysis_query | reports:read | SQLite 历史样本查询 |
| demo_reset_preview | demo:reset | 重置预览及五分钟确认凭据 |
| demo_reset_execute | demo:reset | 校验确认凭据和幂等键后重置 |

默认四个读取工具。开启重置配置并显式授权后才出现两个重置工具。浏览器中的其他业务 Action 不通过反射或快照伪装成后端工具。本次 demo 不扩大到全量业务迁移。

SDK 使用官方 Go SDK v1.7.0，提供 stateless Streamable HTTP；测试覆盖 2026-07-28 和 2025-11-25。使用 `AWCP_MCP_PUBLIC_URL` 和 `AWCP_MCP_ACCESS_TOKEN` 环境变量运行 `node scripts/mcpSmoke.mjs` 可验证发现、工具列表及读取调用，脚本不打印 Token。

## 存储与维护

只有既有 SQLite：保存客户端、授权码与 Token 哈希、空间关联及演示数据。临时登录表单在内存中，重启后重新打开页面；有效 Token 与客户端注册保留。每小时清理过期凭据，注册总量上限 1024，登录和协议端点有限流。

数据库备份沿用原有 SQLite 方案。不要把 SQLite 放入静态目录。反向代理示例见 `deploy/mcp.nginx.conf.example`。本地服务启动后，`node scripts/mcpDemoSmoke.mjs` 使用本地 demo 账号验证真实登录、发现、注册、PKCE、MCP 读取、撤销与重放拒绝；它只连接回环地址，不打印令牌。运行检查结果见 [实施记录](mcp-progress.md)。
