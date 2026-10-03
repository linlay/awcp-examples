# singapore02 部署

站点：https://awcp-site.zenmind.cc 。当前发布：`1e76cf2`（SSE 实时同步，源码已提交并推送到 origin/main）。

当前公网 MCP 已启用：`https://awcp-site.zenmind.cc/mcp`，支持 OAuth + PKCE 和手动 Bearer Token；默认仅开放四个读取工具，重置工具关闭。登录入口为 `https://awcp-site.zenmind.cc/api/v1/mcp/connect`。

当前为公开演示登录模式：用户名 **demo**、密码 **demo**，连接页与 OAuth 授权登录页直接展示这组演示凭据。

- 服务器根目录：`/docker/awcp-site`
- 构建产物：`releases/1e76cf2`；Docker 镜像：`awcp-site:1e76cf2`
- Compose：`/docker/awcp-site/compose.yaml`；`.env` 指定 `AWCP_RELEASE`
- 容器：`awcp-site-app-1`，自动重启；仅映射 `127.0.0.1:11983:2181`
- SQLite：`/docker/awcp-site/data/awcp.sqlite`，目录归 UID/GID 65532 所有，独立于镜像持久化
- Nginx：`/etc/nginx/sites-available/awcp-site.zenmind.cc.conf`，由 sites-enabled 同名链接启用
- TLS：`/etc/letsencrypt/live/awcp-site.zenmind.cc`；webroot 为 `/var/www/awcp-site`
- Certbot 自动续期计时器已启用；`/etc/letsencrypt/renewal-hooks/deploy/awcp-site-reload-nginx` 在续期后检查并重载 Nginx

## 更新

依赖必须已按项目约定安装。运行 `pnpm --dir frontend run build` 与 `make build-linux TARGET_ARCH=amd64`，将 Dockerfile、build/awcp-server-linux、frontend/dist 和 deploy/runtime 打包到新版本 release 目录。远端执行 `docker build -t awcp-site:<版本> releases/<版本>`，更新 `.env` 中的 `AWCP_RELEASE` 后执行 `docker compose up -d`。不得覆盖 data 目录。

更新前备份 SQLite：优先使用 SQLite 在线 backup API；如采用文件复制，须先停止此应用容器，再复制整个 data 目录（含存在的 WAL/SHM 文件），完成后启动容器。不要只复制运行中的主数据库文件。当前未配置自动备份。

回滚时选择已保留且兼容当前数据库的旧镜像版本，修改 `AWCP_RELEASE` 后重新执行 `docker compose up -d`。首部署没有旧版应用可回滚；数据库结构变更前必须独立备份。

## 检查

```sh
ssh singapore02 'cd /docker/awcp-site && docker compose ps && docker compose logs --tail=50'
curl -fsS https://awcp-site.zenmind.cc/healthz
```

2026-09-30 实测：Linux/amd64 构建、镜像构建、容器运行、HTTPS 证书校验、HTTP 301 跳转、安全 Cookie、24,000 条样本查询、独立测试会话重置及 SPA 深层地址通过。浏览器已加载线上分析页及四种图表。未执行证书续期 dry-run、备份恢复演练或全部场景的远程验收。

本次部署的是当前演示版本；未接入 Go 的业务仍使用浏览器 repository，部署并不表示全部业务已经迁移到 SQLite。

## 2026-10-03 更新

已将应用从 `4dcfdbf` 更新到 `11fe473`，包含工作台信息密度优化及 MCP 连接入口。线上沿用 standard 数据规模和现有 Nginx/TLS 配置，显式设置 `AWCP_MCP_ENABLED=false`；公网 MCP 启用操作被自动审批拒绝，尚未生成凭据或开放 MCP。线上 Compose 保留原有配置，仅更新镜像版本并禁用 MCP，与仓库的部署模板不同。

部署前通过 SQLite 在线 backup API 创建 `/docker/awcp-site/backups/20261003T033707Z-before-11fe473/awcp.sqlite`，完整性检查通过，同目录保留原 `.env` 与 Compose。旧镜像保留。

验证：前端生产构建、Linux/amd64 后端构建及后端测试通过；仍有前端包体积提示。容器运行 `awcp-site:11fe473`，HTTPS 健康接口、会话接口及四个 SPA 路径通过，线上主 JS 的 SHA-256 与本地构建一致。本次未重新执行前端全量测试、浏览器视觉验收、MCP 公网验收或备份恢复演练。

## 2026-10-03 公网 MCP 启用

用户明确授权后，已在现有 `11fe473` 镜像上启用 MCP，不重新构建镜像或安装依赖。Compose 从 `.env` 读取开关、用户名与必填密码，公网地址固定为 `https://awcp-site.zenmind.cc/mcp`，`AWCP_MCP_RESET_ENABLED=false`。独立随机密码保存在服务器 `/docker/awcp-site/.env`（权限 0600），不写入仓库；凭据通过本次任务交付给用户。

实施前使用 SQLite 在线 backup API 备份数据库并通过完整性检查，目录为 `/docker/awcp-site/backups/20261003T041657Z-before-mcp-enable`，同时保留 Compose、`.env` 和 Nginx 配置。应用继续使用原数据卷和 standard 数据规模。仅重建 app 容器并重载 Nginx；MCP 路由禁用代理缓冲，OAuth 与登录路由关闭访问日志。Nginx 配置检查通过，其他既有站点仍有 TLS protocol options 重复配置告警。

已执行公网验证：健康接口 200、会话 `mcpAvailable=true`、连接地址正确、匿名 MCP 请求 401 与发现挑战、资源及授权服务器元数据、真实密码登录签发 Token、四个只读工具、历史样本查询，以及动态客户端注册、OAuth 同意、PKCE 兑换和授权 MCP 请求。测试令牌均已撤销，并验证撤销后返回 401；未执行重置工具或业务写操作。本次未执行备份恢复演练。

## 2026-10-03 公开演示凭据

实施：按用户要求把线上用户名和密码设为 `demo / demo`，启用 `AWCP_MCP_PUBLIC_DEMO_LOGIN=true`。新增显式模式允许固定的公开演示凭据，并在连接登录页及 OAuth 授权登录页显示。关闭该模式时仍保留公网自定义密码校验；开启时拒绝混用自定义凭据，避免展示其他密码。沿用四个读取工具及原数据卷。

部署：后端重新构建为 Linux/amd64，复用 `11fe473` 的前端资产，创建独立镜像 `awcp-site:11fe473-demo-login-20261003`。发布前备份配置和 SQLite 至 `/docker/awcp-site/backups/20261003T043531Z-before-public-demo-login`，数据库完整性检查通过。新二进制本地与远端 SHA-256 一致：`5f7360e90a1e45365e8bc1558b3235f874aa54f7fade4c9a3d9751b1331ec69b`。旧镜像和配置备份保留。

验证：全部后端测试及 Linux 构建通过；新增测试覆盖公开模式配置、私有密码不展示、两种登录页提示与两种登录流程。公网 HTTP 验证登录页提示、正确密码登录、错误密码拒绝、OAuth 发现、动态注册、PKCE 兑换、MCP 四个读取工具与历史查询通过；测试令牌已撤销并验证返回 401。密码变更会使旧 Token 失效。浏览器预览工具超时，本轮没有完成视觉验收；页面内容与登录功能已通过真实 HTTPS 验证。未修改前端源码，未重新运行前端测试。


## SSE 上线（2026-10-03）

已将提交 `1e76cf2` 的前端与 Linux/amd64 后端重新构建并部署。部署前在线备份 SQLite 及 `.env`、Compose、Nginx 至 `/docker/awcp-site/backups/20261003T073445Z-before-1e76cf2-sse`，数据库完整性检查通过；旧镜像继续保留。迁移 004 已应用，浏览器凭证与共享空间分离。回退此迁移必须恢复匹配的旧数据库备份，不能只切回旧镜像。

Nginx 在既有配置中新增 SSE 精确路由，禁用代理缓冲、缓存与 gzip，设置 65 秒读取超时并启用 HTTP/2。原 MCP/OAuth 路由、公开 demo/demo 登录和只读工具范围保持不变。配置校验通过，仍有同端口多个站点 protocol options 重定义告警。

验证：容器 `awcp-site:1e76cf2` 持续运行；公网 TLS 和 HTTP/2 健康接口 200；会话与 24,000 条历史样本查询正常；公网 SSE 的 ready、15 秒心跳和禁用压缩通过；OAuth 发现与登录入口正常；实际登录的两套浏览器凭证同时访问同一 MCP 空间及 SSE；四个只读 MCP 工具、上下文和分析调用通过。本次测试令牌已逐一撤销，没有执行空间重置或业务写操作。前端主包与 Linux 二进制本地／远端 SHA-256 一致：

- 后端：`bcb1ca91b600f514ab31f497a494c6d3de1e4cff98ed2e5e7578bbca62f78987`
- 前端 `main.8f01934d.js`：`0cd3a4d4518fc044318c302bdf395778ed3f152b7e51c1a61eac027581dfa491`

未执行线上空间重置、备份恢复演练、容量压测或完整 OAuth PKCE 重跑；相关实现和本地验证见 [SSE 实施记录](../docs/realtime-progress.md)。前端构建仍有主包体积告警。
