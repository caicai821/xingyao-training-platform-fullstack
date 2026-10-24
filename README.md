# 星耀童行 · 3D 场景辅助训练系统

面向训练指导人员与教育工作者的辅助训练平台。围绕「学员档案 → 能力画像 → 训练目标 → 训练脚本 → 3D 场景生成 → 场景资产」构建完整工作流。

本仓库现在包含：

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS，保留完整的演示模式。
- **后端**：Node.js + TypeScript + Fastify + PostgreSQL + Prisma + Zod，位于 `server/`。
- **真实持久化**：学员、能力记录、能力画像、训练目标、训练脚本、场景任务、场景资产、上传文件均写入 PostgreSQL。
- **身份认证**：HttpOnly Cookie 会话、scrypt 密码哈希、管理员 / 普通用户角色、服务端权限校验。
- **文件上传**：服务端保存文件并返回受控引用，校验格式、大小与文件内容签名。
- **场景任务队列**：任务由后端驱动并持久化，支持进度查询、失败重试与重启恢复。
- **生成服务隔离**：mock / real Provider 通过统一接口隔离；真实服务未配置时返回 `PROVIDER_NOT_CONFIGURED`，不会伪造成功。

真实 AI 分析、脚本生成与 3D 场景生成服务尚未接入，默认使用 **明确标注为演示数据的 mock Provider**。

---

## 1. 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite 8、Tailwind CSS 4、React Router 7 |
| 后端 | Node.js 20+、TypeScript、Fastify 5、Zod 4、fastify-type-provider-zod |
| 数据库 | PostgreSQL 16+（本地验证使用 PostgreSQL 18.4） |
| ORM | Prisma 6 |
| 认证 | scrypt 密码哈希 + 数据库会话 + HttpOnly Cookie |
| 文件 | 本地磁盘存储（封装为可替换的存储服务） |
| 文档 | OpenAPI 3 / Swagger UI |
| 测试 | Vitest + Fastify `inject` 集成测试 |
| 部署 | Docker Compose（PostgreSQL）；可选 embedded-postgres（无 Docker 环境） |

---

## 2. 目录结构

```text
.
├─ src/                       现有前端
│  ├─ services/
│  │  ├─ contracts.ts         服务契约（页面只依赖这里）
│  │  ├─ mock/                演示模式实现（localStorage）
│  │  ├─ api/                 真实 API 实现
│  │  ├─ http.ts              统一请求 / 超时 / 错误 / 401 处理
│  │  ├─ auth.ts              登录接口
│  │  └─ settingsStore.ts     数据模式与服务地址配置
│  ├─ context/
│  │  ├─ AuthContext.tsx      登录状态与权限
│  │  └─ AppDataContext.tsx   工作区数据加载与任务轮询
│  └─ pages/                  业务页面（未重新设计）
├─ server/
│  ├─ src/
│  │  ├─ app.ts               Fastify 应用装配
│  │  ├─ server.ts            启动与优雅退出
│  │  ├─ config/env.ts        环境变量校验
│  │  ├─ middleware/auth.ts   会话认证与角色校验
│  │  ├─ providers/           mock / real 生成服务
│  │  ├─ routes/              /api/v1 路由
│  │  ├─ services/            业务逻辑与场景任务运行器
│  │  ├─ schemas/             Zod 请求校验
│  │  └─ utils/               错误、密码、序列化、分页
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  └─ migrations/
│  ├─ tests/                  自动化集成测试
│  ├─ scripts/
│  │  ├─ create-admin.ts      初始化管理员
│  │  ├─ local-db.mjs         无 Docker 时的本地 PostgreSQL
│  │  └─ prisma.mjs           Prisma CLI（复用本地引擎二进制）
│  └─ .env.example
├─ docker-compose.yml         PostgreSQL 服务
├─ docs/
│  └─ 3d-scene-provider-handoff.md  3D 场景生成服务交付与联调清单
└─ .env.example               前端环境变量
```

---

## 3. 快速开始

### 3.1 安装依赖

```bash
# 前端
npm install

# 后端
cd server
npm install
```

> 两个包分别安装、分别启动。请使用 Node.js 20.19+。

### 3.2 启动数据库

**方式 A：Docker（推荐）**

```bash
docker compose up -d db
```

默认连接：`postgresql://qicheng:qicheng_local_dev@localhost:5432/qicheng?schema=public`
如需修改密码，设置 `POSTGRES_PASSWORD` 环境变量，并同步修改后端 `DATABASE_URL`。

**方式 B：无 Docker 环境（Windows / macOS / Linux）**

```bash
cd server
npm run db:start
```

该命令使用 `embedded-postgres` 下载并运行本地 PostgreSQL（默认端口 `55432`，数据库 `qicheng`），数据保存在 `server/.devdb/`。

- Windows 上如果当前终端是管理员权限，脚本会通过 `runas /trustlevel:0x20000` 以受限令牌启动数据库（PostgreSQL 禁止以管理员令牌运行）。
- 默认连接：`postgresql://postgres:postgres@127.0.0.1:55432/qicheng?schema=public`
- 停止：`npm run db:stop`；状态：`npm run db:status`

### 3.3 配置后端

```bash
cd server
cp .env.example .env
```

按实际数据库修改 `DATABASE_URL`。使用 embedded-postgres 时：

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/qicheng?schema=public
```

确认 `CORS_ORIGINS` 包含前端实际地址（默认 `http://localhost:5173`）。如果 Vite 因端口占用切换到 `5174`、`5175`，需要同步加入该来源。

### 3.4 执行数据库迁移

```bash
cd server
npm run migrate:dev      # 首次开发：创建并应用迁移
# 或
npm run migrate:deploy   # 应用已有迁移（CI / 生产）
```

### 3.5 创建首个管理员

不要把正式密码写进仓库。使用环境变量或参数：

```bash
cd server
ADMIN_USERNAME=admin ADMIN_PASSWORD='请替换为至少8位的本地密码' npm run create-admin
```

也可以把 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 写入本机 `server/.env`（该文件已被忽略）后执行 `npm run create-admin`。脚本会创建或重置管理员密码。

### 3.6 初始化演示数据

仓库提供了一份已脱敏的演示数据：4 位学员、4 份能力评估与画像、4 个训练目标、4 个训练脚本、8 个场景任务、8 个场景资产和 44 条动态，并附带 4 张示例图片。建议在创建管理员后执行：

```bash
cd server
npm run db:seed
```

- 数据位于 `server/prisma/demo-data.json`，图片位于 `server/prisma/demo-files/`，会按 `UPLOAD_DIR` 复制到上传目录。
- 已脱敏：不含账号密码、会话记录或真实姓名；记录创建人留空，可在登录后按需归属。
- 写入在单个事务内完成，按记录 id 跳过已存在项；重复执行不会覆盖手工修改的数据。
- 如需在空库中重新体验完整演示，重建数据库后依次执行迁移、创建管理员和本命令。

### 3.7 启动后端

```bash
cd server
npm run dev
```

- API：`http://localhost:4000/api/v1`
- 健康检查：`http://localhost:4000/api/v1/health`
- Swagger UI：`http://localhost:4000/api/docs`
- OpenAPI JSON：`http://localhost:4000/api/docs/json`

### 3.8 启动前端

```bash
# 仓库根目录
npm run dev
```

默认地址：`http://localhost:5173`（端口被占用时以终端输出为准）。

**连接真实后端：**

方式一：直接以 live 模式启动：

```bash
VITE_API_MODE=live npm run dev
```

方式二：进入「系统设置 → 服务模式」选择「真实 API 模式」，保存后使用管理员账号登录。

默认的 `.env` 配置仍为 `VITE_API_MODE=mock`，因此不启动后端也能保持原有演示流程。

---

## 4. 数据模式与生成模式

这是两个互相独立的维度：

| 维度 | 配置位置 | 可选值 | 说明 |
| --- | --- | --- | --- |
| 数据模式 | 前端「系统设置」或 `VITE_API_MODE` | `mock` / `live` | `mock` 使用浏览器 localStorage 演示数据；`live` 通过真实 API 读写 PostgreSQL |
| 生成服务模式 | 后端环境变量 | `mock` / `real` | 分别控制能力画像、训练脚本、3D 场景三个 Provider |

例如：可以使用真实数据库与登录，同时使用 mock Provider 演示场景生成。此时所有 mock 结果都会带有 `isDemo: true`、`generatedBy: 'mock'` 和「演示数据」标识。

### 真实 Provider 配置

```env
PROFILE_PROVIDER=real
PROFILE_PROVIDER_URL=https://your-analysis-service.example/api
PROFILE_PROVIDER_TOKEN=replace-with-token

SCRIPT_PROVIDER=real
SCRIPT_PROVIDER_URL=https://your-script-service.example/api
SCRIPT_PROVIDER_TOKEN=replace-with-token

SCENE_PROVIDER=real
SCENE_PROVIDER_URL=https://your-scene-service.example/api
SCENE_PROVIDER_TOKEN=replace-with-token

PROVIDER_TIMEOUT_MS=30000
```

只要 `mode=real` 且 URL / Token 任一缺失，调用生成接口时返回：

```json
{
  "error": {
    "code": "PROVIDER_NOT_CONFIGURED",
    "message": "3D 场景生成服务尚未配置真实服务地址或鉴权信息，请联系管理员完成配置后再试"
  },
  "requestId": "..."
}
```

真实场景服务的协议约定：

```text
POST {SCENE_PROVIDER_URL}/jobs
Authorization: Bearer <SCENE_PROVIDER_TOKEN>
Idempotency-Key: <taskId>:<attempt>
Body: { taskId, attempt, sourceType, sceneName, scenePurpose, prompt, sceneConfig, imageUrls, learner?, script? }
# imageUrls 为短期签名 URL，可直接 GET，无需 Cookie
Response: { "jobId": "..." }

GET {SCENE_PROVIDER_URL}/jobs/{jobId}
Response: {
  "status": "pending | queued | generating | succeeded | failed",
  "progress": 0-100,
  "result": { "sceneUrl"?, "modelUrl"?, "previewUrl"?, "previewSeed"?, "resolution"?, "notes"? },
  "error": { "code", "message" }
}
```

成功响应必须至少包含 `sceneUrl` 或 `modelUrl`，否则任务会被标记为失败（`PROVIDER_INVALID_RESPONSE`），不会伪装成成功。

> 面向上游 3D 场景生成团队的完整交付、字段字典、联调步骤与验收清单见 [docs/3d-scene-provider-handoff.md](docs/3d-scene-provider-handoff.md)。

脚本 / 画像服务分别接收业务输入并返回结构化内容，详见 `server/src/providers/real.ts` 中的 Zod 校验结构。

---

## 5. 身份认证与权限

- 登录：`POST /api/v1/auth/login`，成功后设置 `qicheng_session` HttpOnly Cookie。
- 会话：数据库存储 SHA-256 哈希后的随机令牌，默认 7 天有效，可撤销（退出登录即删除会话）。
- 密码：Node.js `scrypt`（N=16384, r=8, p=1）+ 随机盐，不保存明文。
- 登录防护：IP 维度限流 + 同账号/IP 连续失败锁定（默认 5 次 / 15 分钟）。
- 请求防护：校验 `Origin` 白名单；Cookie 配置 `HttpOnly`、`SameSite=Lax`、生产环境 `Secure`。
- 角色：
  - `ADMIN`：全部业务权限，创建用户、归档学员。
  - `USER`：业务数据读写；不能创建用户或归档学员。
- 所有业务接口默认要求登录；健康检查、登录、Swagger 文档公开。
- 管理员可通过 `POST /api/v1/users`（管理员）创建普通用户；未开放自助注册。

生产环境注意事项：

- 必须使用 HTTPS，并设置 `COOKIE_SECURE=true`。
- 如果前后端跨站部署（非同一站点），需要按实际域调整 Cookie `SameSite` 策略与 `CORS_ORIGINS`，并确保受控的 CSRF 防护。
- 不要提交 `.env`、数据库密码或 Provider Token。

---

## 6. 数据库模型

```text
User ─┬─ Session
      └─ 业务操作者 / 确认者

Learner
  ├─ AbilityAssessment
  ├─ AbilityProfile ── AbilityProfileRevision
  │     └─ TrainingGoal
  │           └─ TrainingScript ── ScriptVersion
  │                 └─ SceneTask ── SceneTaskFile ── UploadFile
  │                       └─ SceneAsset
  └─────────────────────────┘
```

关键约束：

- `SceneAsset.taskId` 唯一：同一任务无论被轮询/重启多少次，只会创建一个资产。
- 场景任务引用的图片必须是数据库中的 `UploadFile`，客户端伪造的 ID 会被拒绝。
- 只有已确认的训练脚本才能创建关联场景任务（服务端再次校验，前端禁用按钮不算数）。
- 训练目标可关联最近一次已确认的能力画像；手动关联时校验画像归属与确认状态。
- 学员删除接口为受控归档，不物理删除；历史记录保留。
- 修改已确认的能力画像会恢复为待确认；修改已确认的训练脚本会恢复为待确认并要求重新确认。

---

## 7. API 概览

统一前缀 `/api/v1`。成功响应：

```json
{ "data": { }, "meta": { "page": 1, "pageSize": 200, "total": 1, "totalPages": 1 } }
```

错误响应：

```json
{
  "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] },
  "requestId": "..."
}
```

| 模块 | 主要接口 |
| --- | --- |
| 基础 | `GET /health` |
| 认证 | `POST /auth/login`、`POST /auth/logout`、`GET /auth/me`、`GET /auth/permissions` |
| 用户 | `GET /users`、`POST /users`（管理员） |
| 学员 | `GET/POST /learners`、`GET/PATCH/DELETE /learners/:id`（删除=归档，管理员） |
| 能力信息 | `GET /assessments`、`GET/POST /learners/:id/assessments` |
| 能力画像 | `GET /profiles`、`GET/POST /learners/:id/profiles`、`GET/PATCH /profiles/:id`、`POST /profiles/:id/confirm`、`GET /profiles/:id/history` |
| 训练目标 | `GET/POST /training-goals`、`GET/PATCH /training-goals/:id`、`POST /training-goals/:id/status`、`POST /training-goals/:id/archive` |
| 训练脚本 | `GET/POST /training-scripts`、`POST /training-scripts/generate`、`GET/PATCH /training-scripts/:id`、`POST /training-scripts/:id/confirm`、`POST /training-scripts/:id/regenerate`、`POST /training-scripts/:id/duplicate`、`GET /training-scripts/:id/versions` |
| 场景任务 | `GET/POST /scene-tasks`、`GET /scene-tasks/:id`、`POST /scene-tasks/:id/submit`、`POST /scene-tasks/:id/retry`、`GET /scene-tasks/:id/asset` |
| 场景资产 | `GET /scene-assets`、`GET/PATCH /scene-assets/:id`、`POST /scene-assets/:id/archive` |
| 文件 | `POST /uploads`、`GET /uploads/:id`、`GET /uploads/:id/content` |
| 动态 | `GET /activities` |

兼容别名：`/ability-profiles`、`/learners/:id/ability-profiles`、`/learners/:id/ability-profile/generate` 保留给旧客户端。

列表接口支持 `page`、`pageSize`（最大 200）、关键词与状态筛选。场景任务状态转换：

```text
draft → pending → queued → generating → succeeded
                        └────────────→ failed → pending（retry）
```

不允许回退或重复完成；资产创建使用原子条件更新 + `taskId` 唯一约束保证幂等。

---

## 8. 文件上传

- 仅支持 JPG / PNG / WebP，默认最大 2 MB（`MAX_UPLOAD_BYTES`）。
- 服务端使用随机 UUID 文件名和日期目录，禁止使用用户文件名拼接路径。
- 保存后校验文件头签名，声明类型与实际内容不一致时拒绝（415）。
- 上传文件元数据写入 `UploadFile`，场景任务通过文件 ID 建立 `SceneTaskFile` 关联。
- 文件内容通过 `GET /uploads/:id/content` 受控访问：登录用户可直接读取；外部生成服务使用后端签发的短期签名 URL（`?expires=...&signature=...`），无需 Cookie。返回 `Content-Disposition: inline` 或 `?download=1`。
- 签名 URL 默认 60 分钟有效（`UPLOAD_SIGNED_URL_TTL_MINUTES`）。生产环境必须设置稳定的 `UPLOAD_SIGNING_SECRET`；未设置时后端会生成临时密钥，重启后旧签名链接失效。
- 当前使用本地磁盘（`UPLOAD_DIR`），存储逻辑封装在 `services/uploads.ts`，可替换为对象存储。

---

## 9. 测试与验证

### 9.1 运行测试

测试必须使用独立于开发库的数据库：

```env
TEST_DATABASE_URL=postgresql://qicheng:qicheng_local_dev@localhost:5432/qicheng_test?schema=public
```

```bash
cd server
# 注意：迁移命令使用 DATABASE_URL；请显式指向测试库
DATABASE_URL='postgresql://.../qicheng_test?schema=public' npm run migrate:deploy
TEST_DATABASE_URL='postgresql://.../qicheng_test?schema=public' npm test
```

也可以把 `TEST_DATABASE_URL` 写入本机 `server/.env` 后直接运行 `npm test`（测试会清空测试库中的业务表）。

覆盖内容（13 个集成测试）：

- 健康检查、数据库连接、未授权拒绝、登录/退出、Cookie 属性、角色权限、登录锁定。
- 学员创建/查询/搜索/分页、归档权限。
- 能力信息保存、画像生成（mock）、修改、确认、历史记录。
- 训练目标创建、画像自动关联、状态更新。
- 训练脚本生成、版本递增、确认、未确认脚本阻止场景任务。
- 场景任务持久化、后端任务运行器、成功资产、重复资产防护、失败与重试、后端重启恢复。
- 图片上传、内容访问、签名 URL（无 Cookie）访问、签名篡改/过期拒绝、伪造图片拒绝、不支持格式拒绝、图像任务引用。
- 真实 Provider 未配置返回 `PROVIDER_NOT_CONFIGURED`，不创建虚假任务或成功结果。
- 参数校验错误与统一错误结构。

### 9.2 本次实际验证结果

已在当前环境实际执行：

- `server: npx tsc --noEmit` → 通过
- `server: npm test` → 3 个测试文件、13 个测试全部通过
- 前端：`npm run build`（`tsc -b && vite build`）→ 通过
- 真实 PostgreSQL 18.4：迁移成功
- 浏览器端到端：管理员登录 → 新建学员 → 录入 8 个维度 → 生成并确认画像 → 创建目标 → 生成并确认脚本 → 从脚本提交场景任务 → 后端任务成功 → 资产创建 → 图片上传并创建图像任务 → 刷新页面数据保留 → 重启后端后数据与会话仍有效 → 切回演示模式后原有模拟任务流程正常

> 当前环境未安装 Docker / 系统 PostgreSQL，因此 `docker compose up` 未在此机器执行；本地验证使用了 `server/scripts/local-db.mjs`（embedded-postgres）启动的真实 PostgreSQL 18.4。真实外部生成服务未配置，因此真实 Provider 的网络调用未被验证。

### 9.3 工程检查

```bash
# 前端
npm run build

# 后端
cd server
npm run typecheck
npm run build
npm test
```

---

## 10. 环境变量

### 10.1 前端（根目录 `.env`）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_API_MODE` | `mock` | `mock` / `live` |
| `VITE_API_BASE_URL` | `http://localhost:4000/api/v1` | 后端 API 地址 |
| `VITE_UPLOAD_URL` | `http://localhost:4000/api/v1/uploads` | 上传地址 |
| `VITE_REQUEST_TIMEOUT` | `30000` | 请求超时（毫秒） |

### 10.2 后端（`server/.env`）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` / `HOST` | `4000` / `0.0.0.0` | 监听地址 |
| `DATABASE_URL` | 必填 | PostgreSQL 连接串 |
| `CORS_ORIGINS` | `http://localhost:5173,...` | 允许的前端来源 |
| `PUBLIC_BASE_URL` | `http://localhost:4000` | 生成上传文件访问地址 |
| `SESSION_COOKIE_NAME` | `qicheng_session` | 会话 Cookie 名 |
| `SESSION_TTL_HOURS` | `168` | 会话有效期 |
| `COOKIE_SECURE` | 生产默认 `true` | HTTPS 环境必须为 `true` |
| `LOGIN_MAX_ATTEMPTS` | `5` | 连续失败锁定阈值 |
| `LOGIN_LOCK_MINUTES` | `15` | 锁定时长 |
| `LOGIN_RATE_LIMIT_MAX` | `10` | 登录接口限流（15 分钟窗口） |
| `UPLOAD_DIR` | `./uploads` | 上传目录 |
| `MAX_UPLOAD_BYTES` | `2097152` | 单文件上限 |
| `UPLOAD_SIGNING_SECRET` | 随机临时值 | 图片签名密钥；生产环境必须显式设置并保持稳定 |
| `UPLOAD_SIGNED_URL_TTL_MINUTES` | `60` | 外部服务图片签名链接有效期 |
| `PROFILE_PROVIDER` | `mock` | `mock` / `real` |
| `SCRIPT_PROVIDER` | `mock` | `mock` / `real` |
| `SCENE_PROVIDER` | `mock` | `mock` / `real` |
| `*_PROVIDER_URL` / `*_PROVIDER_TOKEN` | 空 | real 模式必填 |
| `PROVIDER_TIMEOUT_MS` | `30000` | 外部服务超时 |
| `MOCK_SCENE_QUEUE_MS` | `1500` | 模拟排队时长 |
| `MOCK_SCENE_GENERATE_MS` | `5000` | 模拟生成时长 |
| `TASK_POLL_INTERVAL_MS` | `1000` | 后端任务轮询间隔 |
| `ENABLE_TASK_RUNNER` | `true` | 是否启动内置任务运行器 |
| `DOCS_ENABLED` | `true` | 是否暴露 Swagger |
| `TEST_DATABASE_URL` | 空 | 仅测试使用，须与开发库分离 |

---

## 11. 当前边界与未完成项

- 未接入真实 AI 能力分析、脚本生成或 3D 场景生成服务；默认 mock Provider 的结果全部标记为演示数据。
- 场景结果仍为演示预览，不包含 3D 引擎、场景内部交互、人物动作控制或模型训练。
- 未实现对象存储；上传文件保存在本地磁盘。
- 未实现自助注册、找回密码、多因素认证、会话管理页面。
- 登录失败锁定与限流状态保存在单进程内存中；多实例部署需替换为 Redis 等共享存储。
- 内置任务运行器为单进程后台轮询；多实例部署需要引入分布式锁或独立队列（如 BullMQ）。
- 若运行中切换后端生成服务模式（mock ↔ real），已排队/生成中的任务会被标记为失败并提示重新提交。
- 归档记录可在数据库中保留，但前端暂未提供“恢复归档”入口。
- Docker 镜像仅包含 PostgreSQL 服务；后端与前端按本文档使用 npm 启动。当前环境未执行 Docker 验证。
- Fastify 默认关闭反向代理信任（`server/src/app.ts:88` 的 `trustProxy: false`）。部署在 Nginx / 负载均衡之后时，需要按实际网络配置开启，否则限流与登录锁定会按代理 IP 统计。
- 仓库为公开仓库；提交的演示数据（`server/prisma/demo-data.json` 与示例图片）已脱敏，不包含账号密码、会话令牌或真实姓名。

---

## 12. 主要页面

| 模块 | 页面 |
| --- | --- |
| 入口 | 登录（演示 / 真实账号） |
| 概览 | 工作台 |
| 学员 | 学员列表、新增/编辑、档案详情、能力信息录入 |
| 能力画像 | 画像总览、画像分析与确认 |
| 训练 | 训练目标列表/创建、训练脚本列表、四步生成向导、脚本详情与编辑 |
| 3D 场景 | 场景生成中心、文本创建、图像上传、基于脚本创建、任务列表/详情/结果预览 |
| 资产与记录 | 场景资产库、资产详情、方案与任务记录、系统设置 |

---

## 13. 生产部署

### 13.1 构建与启动

前端是纯静态资源，后端是 Node 服务，两者分别部署：

```bash
# 前端（仓库根目录）：API 地址在构建期写入产物
VITE_API_MODE=live \
VITE_API_BASE_URL=https://api.example.com/api/v1 \
VITE_UPLOAD_URL=https://api.example.com/api/v1/uploads \
npm ci && npm run build
# 将 dist/ 交给 Nginx 等静态服务器托管，并为 SPA 配置回退到 index.html

# 后端
cd server
npm ci
npm run migrate:deploy
npm run build
npm start
```

`VITE_API_MODE`、`VITE_API_BASE_URL`、`VITE_UPLOAD_URL` 都是构建期变量，修改后必须重新构建前端。后端可用 systemd、pm2 或容器托管，工作目录需为 `server/`，否则 `UPLOAD_DIR=./uploads` 会解析到意外位置。

需要演示数据时，再执行一次 `npm run db:seed`（见 3.6）。

### 13.2 必须调整的配置

| 变量 | 生产建议 |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | 指向独立 PostgreSQL，不要使用 embedded-postgres |
| `COOKIE_SECURE` | `true`，站点通过 HTTPS 访问 |
| `CORS_ORIGINS` | 只填写真实前端来源，多个用逗号分隔 |
| `PUBLIC_BASE_URL` | 后端对外地址，用于生成上传文件链接 |
| `UPLOAD_SIGNING_SECRET` | 固定随机值，例如 `openssl rand -hex 32`；变更后旧链接立即失效 |
| `UPLOAD_DIR` | 绝对路径，挂载独立持久卷并纳入备份 |
| `DOCS_ENABLED` | `false`，关闭 Swagger |
| `ADMIN_*` | 仅通过环境变量提供给 `npm run create-admin`，不要写入仓库 |

### 13.3 数据库与备份

- 演示或小型部署可用 `docker-compose.yml` 启动 PostgreSQL 16。`server/.devdb` 是 embedded-postgres 18 的物理数据目录，只用于本地开发，不可复制到其他机器或作为生产库。
- 迁移统一使用 `npm run migrate:deploy`。跨大版本（如 16 → 18）迁移需使用目标版本的 `pg_dump` / `pg_restore`，不能物理拷贝数据目录。
- 定期备份数据库与上传目录：用 `pg_dump -Fc` 导出数据库，同时同步 `UPLOAD_DIR`。
- 登录限流与后台任务运行器目前是单进程内存态，生产请保持后端单实例，或按第 11 节替换为共享存储与独立队列。

### 13.4 反向代理注意事项

- 部署在 Nginx / 负载均衡之后时，需要开启 Fastify 的 `trustProxy` 并只信任真实代理（当前版本在 `server/src/app.ts:88` 固定为 `false`，需按部署环境调整），否则限流与登录锁定会按代理 IP 统计。
- Nginx 需为前端配置 SPA 回退（`try_files $uri /index.html`），并将请求体大小限制调整到不低于 `MAX_UPLOAD_BYTES`。
