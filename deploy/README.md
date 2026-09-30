# singapore02 部署

站点：https://awcp-site.zenmind.cc 。应用版本：`4dcfdbf`。

- 服务器根目录：`/docker/awcp-site`
- 构建产物：`releases/4dcfdbf`；Docker 镜像：`awcp-site:4dcfdbf`
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
