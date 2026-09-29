# 项目协作约定

- 修改依赖只编辑精确版本清单，不自动运行 install、add、update、dlx、npx 等可能安装依赖的命令。等待用户安装并明确要求继续后再做安装后的验证。
- 当前应用使用虚构演示数据。后续开发按同级 `awcp-examples-plan/README.md` 的步骤与用户指定范围推进，不自动扩展场景。
- AWCP 浏览器协议运行时位于 `package/awcp`，业务源码通过 `@app/awcp` 导入；当前使用的筛选、表格与树组件位于 `package/ui`。维护 protocolVersion 1、manual、invoke、cancel 和 Action 合同。
- 采用 React/TypeScript 严格模式；UI、Hooks、service、common 分层，样式使用 CSS Modules。未来业务 HTTP 接入集中在有类型的 API/service 层。
- 页面 Action 按活动页面注册；业务状态、幂等、版本与角色检查留在 service。只使用虚构演示数据。
- 修改前记录工作区状态，完成后检查差异并清理本次临时文件，保留用户既有变更。实施与验证结果分别记录，不把未执行的验证标记通过。
