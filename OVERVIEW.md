# Multica 工作台 / Multica Workbench

在 Paseo 里原生复刻 Multica 管理后台：需求、团队、聊天、自动化、接口调试与工作区设置，全部直接调用 Multica 后端 API。同时支持 `https://api.multica.ai` 官方云与任意自建 Multica 服务器。

## 安装

```bash
cd /path/to/multica-workbench
npm install
paseo plugin install /path/to/multica-workbench --id multica-workbench
```

开发模式改完代码执行 `paseo plugin reload multica-workbench` 即可生效。

## 配置连接

1. 打开侧边栏底部 `Multica`，或命令面板搜索「Multica 工作台」。
2. 首次进入会自动跳到「设置」，点击「添加」：
   - 服务器地址：官方云填 `https://api.multica.ai`；自建填自己的 API 根地址
   - API Key：在 Multica 后台「个人设置 → API Key」创建，形如 `mul_...`
   - 工作区：可留空，连接成功后自动选中第一个
3. 保存后「测试」按钮会实际请求 `/api/me` 与 `/api/workspaces`，失败会给出具体原因。

可以添加多个服务器随时切换，每个连接各自保存 Key、工作区与内部接口开关。

## 功能

| 页面 | 能力 |
| --- | --- |
| 概览 | 需求统计、最近更新、收件箱、在线运行时、智能体状态、用量与稳定性 |
| 工作 | 三栏看板（待规划/待办/进行中/审核中/已完成/已取消）与列表视图、搜索、按项目筛选；任务详情为「面包屑 + 正文 + 右侧属性面板」，支持状态/优先级/负责人/项目/标签变更、子任务创建、评论、重跑与删除 |
| 项目 | 项目列表、进度与负责人、新建/编辑/归档 |
| 收件箱 | 通知分类与已读/未读筛选、全部标为已读 |
| 工作流 | 状态与流转规则编排、新建/编辑/删除 |
| 标签 | 标签分组与颜色、新建/编辑/删除 |
| 团队 | 智能体 / 小队 / 运行时 / 技能四个标签页；新建智能体、新建小队，小队成员增删、编辑与删除，运行时详情（24h 活动、按日/按智能体用量）；智能体详情含技能绑定与启停、最近任务记录、环境变量、MCP 与标签 |
| 聊天 | 会话列表、按智能体发起新对话、消息流、发送消息 |
| 自动化 | 列表筛选、新建（执行方式 + 执行者 + Cron）、暂停/恢复、立即运行、运行记录 |
| 接口 | 内置 524 个公开接口（开启内部接口后 568 个），支持路径/查询/请求体编辑、实际调用并查看状态码、耗时与响应 JSON |
| 设置 | 连接 / 工作区 / 账户三个标签：多服务器管理、工作区切换、成员与邀请、个人资料、访问令牌（仅显示一次）、通知偏好、内部接口开关 |

界面按官方后台还原：最左图标栏（工作区、新建、搜索、各分区、刷新/设置/账户）、对应分区的二级侧栏（收件箱、视图计数、项目；团队与自动化的分类）、右侧主区域承载看板或详情。侧边栏与命令面板都可以直接跳到指定页面。

## 安全

- API Key 只保存在本机 Paseo 后台：`~/.paseo/multica-workbench/connections.json`（权限 `0600`）。
- Key 不会下发到客户端界面，设置页只显示 `mul_…abcd` 形式的掩码。
- 所有请求由 daemon 侧发起，客户端通过 RPC 间接调用，浏览器标签页里拿不到明文 Key。
- `/api/internal`、`/api/daemon` 默认隐藏，需在设置里显式开启。

## 结构

```
index.client.tsx      注册页面、设置页、侧边栏入口与命令面板项
index.server.ts       注册 RPC 处理器
client/workbench/     界面：Shell、通用组件、数据 hooks、各页面
server/               store（连接持久化）、multica（HTTP 客户端）、handlers（RPC）
shared/contracts.ts   RPC 契约（zod）
shared/routes.ts      接口清单（方法、路径、所属域、处理函数）
```

类型检查：`npm run typecheck`。
