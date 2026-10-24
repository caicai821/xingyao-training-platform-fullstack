# 启澄 · 星耀童行 / 3D 场景生成服务交付与接口对接清单

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v0.1 |
| 更新日期 | 2026-10-24 |
| 我方系统 | 启澄 · 星耀童行 3D 场景辅助训练系统 |
| 对接模块 | 3D 场景生成 Provider（`scene` Provider） |
| 当前状态 | 我方后端任务编排、鉴权、持久化、签名图片链接与结果展示已就绪；等待 3D 服务实现并通过联调验收 |
| 适用环境 | staging / production |

> 本文档是 3D 场景生成服务的最小交付契约。所有示例中的域名、Token、任务 ID、文件 ID 均为占位值，不得直接用于生产。

---

## 0. 一页结论（先看这里）

你方需要实现 **2 个 HTTP 接口**，由我方后端主动调用：

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| `POST` | `{SCENE_PROVIDER_URL}/jobs` | 创建一次场景生成作业，尽快返回 `jobId` |
| `GET` | `{SCENE_PROVIDER_URL}/jobs/{jobId}` | 查询作业状态、进度与结果 |

必须满足的 8 条硬性要求：

1. 使用 `Authorization: Bearer <SCENE_PROVIDER_TOKEN>` 鉴权。
2. `POST /jobs` 必须在 **30 秒内**返回 `{ "jobId": "..." }`；实际生成可以异步进行。
3. 支持幂等：同一个 `Idempotency-Key` 重复提交必须返回同一个 `jobId`，不得重复生成。
4. 幂等键为 **`taskId:attempt`**（例如 `cmxxx:1`）。用户重试时 `attempt` 会增加，应创建新作业。
5. 成功结果必须至少包含 `sceneUrl` 或 `modelUrl` 之一，否则我方任务会被判定失败。
6. 强烈建议返回 `previewUrl`，用于任务结果页和场景资产库的预览图。
7. 我方后端默认每 **1 秒**查询一次作业状态；`GET` 必须快速、只读、可重复调用，正常状态一律返回 HTTP 200。
8. `imageUrls` 是我方签发的 **短期签名 URL**，无需 Cookie，你方服务应在有效期内直接 `GET` 下载。

---

## 1. 职责边界

| 范围 | 我方负责 | 你方负责 |
| --- | --- | --- |
| 业务数据 | 学员、画像、目标、脚本、任务、资产的数据库与 API | 不涉及 |
| 任务编排 | 创建任务、状态机、重试、重启恢复、轮询调度 | 接收作业、排队、生成、返回状态 |
| 鉴权 | 管理前端登录、服务端权限、调用你方时携带 Bearer Token | 校验 Bearer Token，保护你方接口 |
| 图片输入 | 上传、格式/大小校验、签名 URL 签发 | 在有效期内下载图片，做内容安全校验 |
| 3D 生成 | 不实现 | 场景构建、模型/场景文件、预览图、结果托管 |
| 结果存储 | 保存你方返回的 URL 引用，自动创建场景资产 | 保证结果 URL 可访问、生命周期足够长 |
| 前端展示 | 任务状态、预览图、场景/模型链接、资产库 | 保证预览图和场景地址可被浏览器访问 |
| 演示模式 | 内置 mock Provider，明确标注演示数据 | 不涉及 |

**本期不包含**：把 3D 引擎嵌入我方页面、页面内人物控制/场景编辑、实时协同编辑。如需要，另立接口与排期。

---

## 2. 调用链

```text
┌─────────┐     1. 提交任务      ┌────────────────────┐
│ 前端 UI │ ───────────────────> │ 我方后端 /api/v1    │
└─────────┘                      │ 任务持久化 + 队列    │
                                 └─────────┬──────────┘
                                           │ 2. POST /jobs
                                           │    Bearer Token
                                           │    Idempotency-Key: taskId:attempt
                                           ▼
                                 ┌────────────────────┐
                                 │ 3D 场景生成服务     │
                                 │ 你方实现            │
                                 └─────────┬──────────┘
                                           │ 3. 拉取 imageUrls（签名 URL，无 Cookie）
                                           │ 4. 异步生成
                                           ▼
     5. GET /jobs/{jobId} 每秒轮询   ┌────────────────────┐
我方后端  ─────────────────────────> │ 返回状态/进度/结果  │
     6. 成功：持久化 result + 创建资产 │                    │
     7. 前端轮询我方 API 展示结果     └────────────────────┘
```

关键点：

- 浏览器 **永远不会** 拿到 `SCENE_PROVIDER_TOKEN`。
- 浏览器只访问我方 API；场景/模型/预览链接由你方托管，浏览器直接访问。
- 我方不保存模型文件本体，只保存你方返回的 URL 引用。

---

## 3. 联调环境配置

### 3.1 我方后端环境变量

```env
# 切换为真实 Provider
SCENE_PROVIDER=real
SCENE_PROVIDER_URL=https://3d-provider.example.com/api/v1
SCENE_PROVIDER_TOKEN=replace-with-a-strong-token

# 调用你方的超时（毫秒）
PROVIDER_TIMEOUT_MS=30000

# 我方轮询间隔（毫秒）
TASK_POLL_INTERVAL_MS=1000

# 我方对外地址：用于拼接你方拉取的图片签名 URL
PUBLIC_BASE_URL=https://api.qicheng.example.com

# 生产环境必须显式设置并保持稳定，否则重启后未消费的图片签名链接会失效
UPLOAD_SIGNING_SECRET=replace-with-a-long-random-secret
UPLOAD_SIGNED_URL_TTL_MINUTES=60
```

我方会把 `SCENE_PROVIDER_URL` 末尾的 `/` 去掉后拼接路径，因此：

```text
POST {SCENE_PROVIDER_URL}/jobs
GET  {SCENE_PROVIDER_URL}/jobs/{encodeURIComponent(jobId)}
```

### 3.2 启动后的自检

```bash
curl -s https://api.qicheng.example.com/api/v1/health
```

期望看到（节选）：

```json
{
  "data": {
    "status": "ok",
    "database": "ok",
    "generation": {
      "scene": { "mode": "real", "configured": true }
    }
  }
}
```

若 `configured` 为 `false`，说明 URL 或 Token 缺失，提交场景任务会返回 `PROVIDER_NOT_CONFIGURED`。

### 3.3 网络连通性

联调前双方共同确认：

- [ ] 我方后端服务器可以访问你方 `SCENE_PROVIDER_URL`（HTTPS、DNS、防火墙、白名单）。
- [ ] 你方服务器可以访问我方 `PUBLIC_BASE_URL` 下的签名图片 URL。
- [ ] 生产环境双方均使用 HTTPS；不接受自签名证书（staging 如需自签名，请提前说明）。
- [ ] 本机 `localhost` 对第三方不可达；本地联调请使用 staging 地址或内网穿透，并确保 `PUBLIC_BASE_URL` 是你方可以访问的地址。
- [ ] Token 通过安全渠道传递，不写入聊天记录、代码仓库或前端。

---

## 4. 接口一：创建作业 `POST /jobs`

### 4.1 请求头

| Header | 值 | 说明 |
| --- | --- | --- |
| `Authorization` | `Bearer <SCENE_PROVIDER_TOKEN>` | 每个请求都会携带 |
| `Content-Type` | `application/json` | 固定 |
| `Idempotency-Key` | `<taskId>:<attempt>` | 例如 `cmvmi5i14000xvlosgnimh2iv:1` |

幂等语义：

- 第一次提交：`attempt = 1`，键为 `taskId:1`。
- 用户点击“重新生成”：`attempt = 2`，键为 `taskId:2`。
- 我方后端重启后，如果任务仍处于 `PENDING`，会用 **同一个 attempt** 重新 `POST`；你方必须返回原 `jobId`，不得重复生成。
- **不能只用 `taskId` 去重**，否则重试会永远拿到旧作业。

### 4.2 请求体

```json
{
  "taskId": "cmvmi5i14000xvlosgnimh2iv",
  "attempt": 1,
  "sourceType": "script",
  "sceneName": "在课堂中主动请求帮助 · 小学课堂情境 · 3D 场景",
  "scenePurpose": "在课堂中主动请求帮助",
  "prompt": "根据训练脚本构建小学课堂场景……",
  "sceneConfig": {
    "theme": "在课堂中主动请求帮助",
    "sceneType": "小学课堂",
    "complexity": "适中",
    "visualStyle": ["自然柔和", "写实风格"],
    "sensoryPrefs": ["减少视觉干扰"],
    "keyElements": ["独立课桌", "黑板", "流程卡", "材料托盘"],
    "avoidElements": ["突发噪音", "拥挤的人群"],
    "characters": "保留脚本中的教师与学员角色，位置与环境保持自然、简洁。"
  },
  "imageUrls": [
    "https://api.qicheng.example.com/api/v1/uploads/cmvmi698d0015vlosb0sfc5g6/content?expires=1792857600000&signature=xxxxx"
  ],
  "learner": {
    "id": "cmvmi2og20003vlos1k7yikz6",
    "name": "浏览器联调学员",
    "nickname": "小联",
    "ageGroup": "6-8 岁",
    "traits": ["喜欢结构化任务"],
    "interests": ["绘本"],
    "communicationStyle": "短句表达",
    "promptPreference": "视觉提示卡",
    "environmentNotes": "安静环境"
  },
  "script": {
    "id": "cmvmi4uus000pvlosjq4rh728",
    "name": "在课堂中主动请求帮助 · 小学课堂情境",
    "objective": "在小学课堂情境中完成 4 个连续步骤的练习。",
    "scenarioSummary": "以课堂请求帮助为主题布置小学课堂……",
    "steps": [
      {
        "id": "step_xxx",
        "title": "进入情境",
        "trigger": "学员进入场景并安定下来后",
        "prompt": "“小联，我们今天在这个场景里练习……”",
        "expectedBehavior": "学员观察场景并保持停留",
        "completion": "完成当前步骤，并在 5 秒内回应提示",
        "observationPoints": ["参与度与停留时间", "进入场景的表现"]
      }
    ]
  }
}
```

### 4.3 字段说明

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `taskId` | string | 是 | 我方场景任务 ID；与幂等键相关 |
| `attempt` | number | 是 | 第几次提交；首次为 1，重试递增 |
| `sourceType` | string | 是 | `text` / `image` / `script` |
| `sceneName` | string | 是 | 场景名称 |
| `scenePurpose` | string | 否 | 场景用途，可能为空字符串 |
| `prompt` | string | 否 | 文字描述；`image` 场景可能为空 |
| `sceneConfig` | object | 是 | 见下表 |
| `imageUrls` | string[] | 否 | 最多 5 张；`image` 场景通常至少 1 张 |
| `learner` | object | 否 | 关联学员上下文 |
| `script` | object | 否 | 关联训练脚本；`script` 场景必定存在 |

`sceneConfig`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `theme` | string? | 训练主题；文字/图像场景可能缺省 |
| `sceneType` | string | 场景类型，如 `小学课堂`、`家庭客厅`、`安静休息区` |
| `complexity` | string | `简洁` / `适中` / `丰富` |
| `visualStyle` | string[] | 视觉风格偏好，可能为空 |
| `sensoryPrefs` | string[] | 感官与环境偏好，可能为空 |
| `keyElements` | string[] | 需要出现的关键元素，可能为空 |
| `avoidElements` | string[] | 需要避免的元素，可能为空 |
| `characters` | string | 角色需求，可能为空字符串 |

`learner` 字段：`id`、`name`、`nickname`、`ageGroup`、`traits[]`、`interests[]`、`communicationStyle`、`promptPreference`、`environmentNotes`。

`script.steps[]` 字段：`id`、`title`、`trigger`、`prompt`、`expectedBehavior`、`completion`、`observationPoints[]`。

> 约定：所有数组字段即使为空也会传 `[]`；字符串字段可能为空字符串，但不会为 `null`。请按可选内容处理，不要假设一定非空。

### 4.4 成功响应

HTTP `200` / `201` / `202` 均可，响应体：

```json
{ "jobId": "job_01J8Z3K9YQ7M2X" }
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `jobId` | string | 是 | 你方作业 ID；我方会原样放入 GET 路径并做 URL 编码 |

要求：

- 响应必须为 JSON，且包含 `jobId`；`204`、空响应或非 JSON 会被我方视为失败。
- `jobId` 建议不超过 128 字符，避免 `/`、空格、中文等不便编码的字符。
- `POST` 只负责“接收作业”，不要同步等待 3D 生成完成。
- 如果作业创建失败，返回非 2xx，并尽量提供：

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "sceneConfig.sceneType is not supported"
  }
}
```

我方会将该任务标记为失败（`PROVIDER_ERROR`），错误信息包含 HTTP 状态与上面的 `message`（如可解析）。

### 4.5 超时与重复提交

- 我方 `POST` 超时为 `PROVIDER_TIMEOUT_MS`（默认 30 秒）。
- 如果我方超时，但你的服务实际上已创建作业，我方会先将任务标记为失败；用户重试时会使用新的 `attempt` 创建新作业。请确保旧作业能被查询/清理，避免长期占用资源。
- 同一 `Idempotency-Key` 的重复 `POST` 必须无害，并返回同一个 `jobId`。

---

## 5. 接口二：查询作业 `GET /jobs/{jobId}`

### 5.1 请求

```http
GET {SCENE_PROVIDER_URL}/jobs/job_01J8Z3K9YQ7M2X
Authorization: Bearer <SCENE_PROVIDER_TOKEN>
```

`jobId` 会经过 `encodeURIComponent`。

### 5.2 响应

**必须返回 HTTP 200 + JSON**，用 `status` 表达业务状态（非 JSON 或空响应会导致我方任务失败）：

```json
{
  "status": "generating",
  "progress": 45
}
```

成功：

```json
{
  "status": "succeeded",
  "progress": 100,
  "result": {
    "sceneUrl": "https://cdn.3d-provider.example.com/scenes/job_01J8Z3K9YQ7M2X/index.html",
    "modelUrl": "https://cdn.3d-provider.example.com/scenes/job_01J8Z3K9YQ7M2X/scene.glb",
    "previewUrl": "https://cdn.3d-provider.example.com/scenes/job_01J8Z3K9YQ7M2X/preview.jpg",
    "sceneFileUrl": "https://cdn.3d-provider.example.com/scenes/job_01J8Z3K9YQ7M2X/scene.zip",
    "resolution": "2048 × 1280",
    "notes": "已按脚本生成 4 个训练区域",
    "previewSeed": "optional-stable-string"
  }
}
```

失败：

```json
{
  "status": "failed",
  "progress": 62,
  "error": {
    "code": "ASSET_FETCH_FAILED",
    "message": "无法下载参考图片（签名 URL 已过期）"
  }
}
```

### 5.3 状态与进度

| `status` | 我方任务状态 | 说明 |
| --- | --- | --- |
| `pending` | `queued` | 兼容值；建议直接使用 `queued` |
| `queued` | `queued` | 已接收，等待生成 |
| `generating` | `generating` | 生成中 |
| `succeeded` | `succeeded` | 完成；必须带有效结果 |
| `failed` | `failed` | 失败；建议带 `error` |

规则：

- `progress` 为 0–100 的数字，可选；我方在成功时强制显示 100，非终态最多显示 99。
- 状态只能向前推进：`queued → generating → succeeded/failed`。不要回退。
- 进入 `succeeded` 或 `failed` 后应保持不变；重复查询返回相同终态。
- 我方对 `GET` 的 **任何非 2xx**（包括 404、429、5xx）都会把任务标记为失败。因此：
  - 正常查询请始终返回 200 + `status`；
  - 不要在轮询路径上做限流；如果你方需要限流，请与我方约定更高的配额或改为返回 200 + `generating`。
  - `GET` 必须幂等、无副作用，响应时间建议 < 500ms。

### 5.4 结果字段

| 字段 | 类型 | 成功时 | 说明 |
| --- | --- | --- | --- |
| `sceneUrl` | string | 二选一必填 | 场景访问页/嵌入地址；浏览器可直接打开 |
| `modelUrl` | string | 二选一必填 | 模型文件地址（建议 GLB/GLTF）；浏览器可下载 |
| `previewUrl` | string | 强烈建议 | 结果预览图；我方任务页/资产库优先展示 |
| `sceneFileUrl` | string | 可选 | 场景打包文件或其他下载地址 |
| `resolution` | string | 可选 | 展示用分辨率；缺省为“未提供” |
| `notes` | string | 可选 | 展示给使用者的结果说明 |
| `previewSeed` | string | 可选 | 无 `previewUrl` 时的占位标识；真实结果建议忽略 |

硬性规则：

- `sceneUrl` 与 `modelUrl` 至少一个存在，且必须是 `http://` 或 `https://`，否则我方判定为 `PROVIDER_INVALID_RESPONSE`。
- 所有 URL 必须是 **浏览器可访问的长期地址**。我方只保存 URL，不做文件转存，也没有刷新临时链接的机制。
  - 如果使用 CDN 签名 URL，有效期必须覆盖资产保留周期（建议 ≥ 30 天），或提供一个稳定不变的公开/带鉴权页面。
  - URL 过期会导致历史资产无法预览。
- `previewUrl` 建议为 JPG/PNG/WebP，比例 16:10 或 16:9，宽度 ≥ 1280px。
- 如果预览图需要登录才能访问，请提供长期有效的签名或公开 CDN 地址；`<img>` 不会携带我方 Cookie。
- 不建议返回 `data:`、`javascript:`、`file:` 等非 HTTP(S) 地址；我方会拒绝。

---

## 6. 图片输入：签名 URL

### 6.1 访问方式

`imageUrls` 由我方任务运行器在提交作业时生成，格式：

```text
{PUBLIC_BASE_URL}/api/v1/uploads/{fileId}/content?expires={epochMs}&signature={hmac}
```

示例：

```bash
curl -L -o input.png \
  "https://api.qicheng.example.com/api/v1/uploads/cmvmi698d0015vlosb0sfc5g6/content?expires=1792857600000&signature=xxxxx"
```

- **无需 Cookie**，也无需我方账号。
- 默认有效期 60 分钟（可由我方调整）。
- 每个 URL 只授权对应文件，签名被篡改或过期会返回 401。
- 用户重试任务时，我方会重新提交作业并签发新的 URL。
- 请不要把签名 URL 写入公开日志、工单或前端页面。

### 6.2 图片约束

| 项目 | 约束 |
| --- | --- |
| 格式 | JPEG / PNG / WebP |
| 单张大小 | 默认 ≤ 2 MB |
| 数量 | 最多 5 张（当前 UI 通常上传 1 张） |
| 内容 | 我方已做文件头校验；你方仍应做解码与安全检查 |
| 保存 | 建议仅在作业期间临时保存，完成后按双方约定的保留策略清理 |

如果下载失败（超时、401、格式错误），请将作业置为 `failed`，并在 `error.message` 中说明原因，便于使用者理解。

---

## 7. 场景输入语义与生成要求

### 7.1 三种来源

| `sourceType` | 主要输入 | 生成建议 |
| --- | --- | --- |
| `text` | `prompt` + `sceneConfig` | 以文字描述为主，`sceneConfig` 约束空间与风格 |
| `image` | `imageUrls` + `sceneConfig` | 保留参考图的空间关系与关键对象；`prompt` 可能为空 |
| `script` | `script` + `sceneConfig` | 按脚本步骤组织场景区域，保证步骤可执行、可观察 |

### 7.2 安全与适用性

使用者主要是儿童训练指导人员，场景会用于辅助训练：

- 避免强闪光、频闪、突发巨响、拥挤推搡、危险物品等可能引发不适的元素。
- 尊重 `avoidElements`；如因技术原因无法满足，请在 `notes` 或 `error` 中说明。
- 不要生成可识别真实个人的人脸或真实身份信息。
- 不要生成医疗诊断、暴力、恐怖或不当内容。
- 场景中的文字、提示卡应尽量使用中文，清晰可读。

### 7.3 复杂程度

| 值 | 建议 |
| --- | --- |
| `简洁` | 元素少、动线清晰、低干扰 |
| `适中` | 包含必要角色与关键物件 |
| `丰富` | 更多环境细节，但不牺牲可读性与安全性 |

---

## 8. 状态机、重试与恢复

### 8.1 我方任务状态

```text
draft ──submit──> pending ──POST /jobs──> queued ──GET──> generating ──GET──> succeeded
                                                                   │
                                                                   └──> failed ──retry──> pending（attempt + 1）
```

- `pending`：已进入我方队列，尚未成功提交到你方。
- `queued`：你方已返回 `jobId`。
- `generating`：你方报告生成中。
- `succeeded`：结果已持久化，并自动创建场景资产。
- `failed`：保留错误码与错误信息，可重试。

### 8.2 重试

- 只有 `failed` 任务允许重试。
- 重试会：
  - `attempt + 1`；
  - 清空旧 `jobId`、旧结果和旧错误；
  - 重新 `POST /jobs`，使用新的 `Idempotency-Key: taskId:attempt`。
- 你方应创建新作业，不要复用失败作业。

### 8.3 我方后端重启

- `pending` 任务：会沿用同一 `attempt` 重新提交；你方应按幂等键返回原 `jobId`。
- `queued` / `generating` 任务：会使用已保存的 `jobId` 继续查询。
- 成功任务：不会重复生成；我方通过 `SceneAsset.taskId` 唯一约束保证只创建一个资产。
- 若我方运行中切换 mock/real 模式，未完成任务会被标记失败，用户可重试。

### 8.4 建议错误码

| `error.code` | 场景 |
| --- | --- |
| `INVALID_INPUT` | 请求字段缺失或不受支持 |
| `UNSUPPORTED_SCENE` | 场景类型/风格无法生成 |
| `ASSET_FETCH_FAILED` | 参考图片下载失败 |
| `GENERATION_FAILED` | 生成过程失败 |
| `TIMEOUT` | 生成超时 |
| `QUOTA_EXCEEDED` | 配额/并发不足 |
| `INTERNAL_ERROR` | 你方内部错误 |

我方会把你方 `error.code` / `error.message` 保存到任务记录并展示给使用者（建议 message 简洁、可读、中文）。

---

## 9. 安全、隐私与合规

- [ ] 全链路 HTTPS；禁止在 URL 中传递长期 Token。
- [ ] Bearer Token 可轮换；轮换前双方约定灰度窗口。
- [ ] 你方日志不要记录完整的签名图片 URL、学员姓名或其他个人信息。
- [ ] 参考图片仅用于本次生成；按约定周期清理。
- [ ] 结果 URL 应不可被随意枚举；如为公开 CDN，请使用不可猜测路径。
- [ ] 结果页如需嵌入我方页面，请提前说明 CSP / `X-Frame-Options` 要求。
- [ ] 如浏览器需要加载模型文件（GLB/GLTF）或纹理，请配置允许我方前端域名的 CORS。
- [ ] 不得主动回调我方业务 API；目前只允许你方读取签名图片 URL。
- [ ] 发现数据泄露、Token 泄露或异常调用时，立即通知我方并暂停服务。

---

## 10. 联调步骤（按顺序执行）

| # | 步骤 | 负责方 | 通过标准 |
| --- | --- | --- | --- |
| 1 | 提供 staging 地址、Token、联系人（安全渠道） | 你方 | 我方可以访问 |
| 2 | 实现 `POST /jobs` 与 `GET /jobs/{jobId}` | 你方 | 用 curl/Postman 自测通过 |
| 3 | 提供 3 个示例响应（排队、成功、失败） | 你方 | 字段符合本文档 |
| 4 | 配置我方 staging 环境并重启 | 我方 | `/health` 显示 `scene.configured=true` |
| 5 | 网络连通性与图片签名 URL 下载 | 双方 | 你方无 Cookie 下载成功 |
| 6 | 文本场景端到端 | 双方 | 任务成功、预览/链接可见、资产创建 |
| 7 | 脚本场景端到端 | 双方 | `attempt=1`、`Idempotency-Key` 正确 |
| 8 | 图像场景端到端 | 双方 | 你方成功下载签名图片并生成 |
| 9 | 失败注入 | 你方 | 返回 `failed`，我方任务显示错误 |
| 10 | 重试 | 双方 | 新 `attempt`、新幂等键、新作业 |
| 11 | 重启恢复 | 我方 | 重启后任务继续，不重复创建资产 |
| 12 | 轮询与并发压测 | 双方 | 1 秒轮询下响应稳定，无 429/5xx |
| 13 | 结果长期可访问性 | 你方 | 隔天/隔周再次打开链接仍可用 |
| 14 | 安全与隐私确认 | 双方 | 清单第 9 节全部勾选 |

### 10.1 我方测试入口

- Swagger：`https://api.qicheng.example.com/api/docs`
- 健康检查：`https://api.qicheng.example.com/api/v1/health`
- 场景任务列表：`GET /api/v1/scene-tasks`
- 任务详情：`GET /api/v1/scene-tasks/{id}`
- 任务结果：`GET /api/v1/scene-tasks/{id}/asset`

建议联调时保持我方后端日志可见，关键日志：

```text
scene task queued at provider   # 你方已接收作业
scene task failed               # 失败及错误码
scene task succeeded            # 成功并创建资产
```

### 10.2 最小联调桩（可选）

在真实 3D 服务就绪前，可先用一个假服务验证契约（伪代码）：

```text
jobs = {}
seen = {}   # idempotencyKey -> jobId

POST /jobs:
  key = header["Idempotency-Key"]
  if key in seen: return { jobId: seen[key] }
  jobId = "job_" + random()
  jobs[jobId] = { status: "queued", progress: 0, startedAt: now }
  seen[key] = jobId
  return { jobId }

GET /jobs/{jobId}:
  job = jobs[jobId] or return 404
  elapsed = now - job.startedAt
  if elapsed < 3s:  return { status: "queued", progress: 10 }
  if elapsed < 8s:  return { status: "generating", progress: 50 }
  return {
    status: "succeeded",
    progress: 100,
    result: {
      sceneUrl: "https://example.com/scenes/" + jobId,
      previewUrl: "https://example.com/scenes/" + jobId + "/preview.jpg",
      resolution: "2048 × 1280",
      notes: "stub result"
    }
  }
```

---

## 11. 验收清单

### 11.1 接口与数据

- [ ] `POST /jobs` 接收本文档全部字段，未知字段不崩溃。
- [ ] 成功返回 `{ jobId }`，HTTP 2xx，30 秒内响应。
- [ ] 同一 `Idempotency-Key` 重复提交返回同一 `jobId`，不重复生成。
- [ ] 新 `attempt` 创建新作业。
- [ ] `GET /jobs/{jobId}` 正常状态一律 HTTP 200。
- [ ] 状态字符串严格为 `pending|queued|generating|succeeded|failed`。
- [ ] 进度为 0–100 数字；终态不再变化。
- [ ] 成功结果至少包含 `sceneUrl` 或 `modelUrl`，均为 HTTP(S)。
- [ ] 建议返回 `previewUrl`，且浏览器可直接加载。
- [ ] 失败返回 `error.code` 与 `error.message`。
- [ ] 未知 `jobId` 返回 404（仅用于真正不存在的作业）。
- [ ] `GET` 幂等、无副作用，响应 < 500ms（建议）。

### 11.2 图片与网络

- [ ] 无 Cookie 可下载签名图片。
- [ ] 签名被篡改返回 401。
- [ ] 签名过期返回 401，并能在作业中给出清晰错误。
- [ ] 支持 JPEG/PNG/WebP，≤ 2 MB，最多 5 张。
- [ ] 你方服务可访问我方 `PUBLIC_BASE_URL`。
- [ ] 我方后端可访问你方 `SCENE_PROVIDER_URL`。

### 11.3 业务与安全

- [ ] 文本、图像、脚本三种来源均跑通。
- [ ] 失败任务可重试，重试使用新 attempt。
- [ ] 我方后端重启后任务可恢复，不重复创建资产。
- [ ] 真实结果在我方任务结果页/资产库正常展示。
- [ ] 预览图/场景链接长期可访问。
- [ ] Bearer Token 校验生效，错误 Token 返回 401。
- [ ] 日志不包含完整个人信息或完整签名 URL。
- [ ] 已确认数据保留/删除策略。
- [ ] 已提供 staging 与 production 两套地址和 Token。
- [ ] 已提供故障联系人与响应时限。

---

## 12. 当前交付物与联系人

### 12.1 我方已交付

| 交付物 | 位置/说明 |
| --- | --- |
| 后端与任务队列 | 本仓库 `server/` |
| 真实 Provider 适配器 | `server/src/providers/real.ts` |
| mock Provider | `server/src/providers/mock.ts`，默认演示 |
| 数据模型 | `server/prisma/schema.prisma` |
| OpenAPI 文档 | 部署地址 `/api/docs` |
| 自动化测试 | `server/tests/`，13 个集成测试 |
| 联调说明 | 本文档 |
| 图片签名访问 | `GET /api/v1/uploads/{id}/content?expires=...&signature=...` |

### 12.2 你方需交付

| 交付物 | 说明 |
| --- | --- |
| staging / production 服务地址 | HTTPS |
| Bearer Token | 安全渠道传递，可轮换 |
| 接口实现 | `POST /jobs`、`GET /jobs/{jobId}` |
| 结果托管 | `sceneUrl` / `modelUrl` / `previewUrl` 的长期可访问地址 |
| 错误码字典 | 与第 8.4 节对齐或给出映射 |
| 压测与稳定性说明 | 并发、平均/最大生成时长、配额 |
| 运维联系人 | 故障响应与升级路径 |
| 示例与测试证据 | 3 类请求的成功/失败响应、日志截图/测试报告 |

### 12.3 联系人

| 角色 | 姓名 | 联系方式 | 负责范围 |
| --- | --- | --- | --- |
| 我方项目负责人 | 待填写 | 待填写 | 排期、验收 |
| 我方后端对接 | 待填写 | 待填写 | API、任务、签名 URL |
| 我方前端对接 | 待填写 | 待填写 | 结果展示、链接 |
| 你方项目负责人 | 待填写 | 待填写 | 交付、排期 |
| 你方技术对接 | 待填写 | 待填写 | 接口、生成、运维 |

> 建议通过密码管理器或企业 IM 的密文消息传递 Token，不要在本文档中填写真实 Token。

---

## 13. 待双方确认的问题

| # | 问题 | 影响 | 建议 |
| --- | --- | --- | --- |
| 1 | 场景结果的最终格式：`sceneUrl` 页面、GLB/GLTF、USDZ、还是多种？ | 前端展示与模型加载 | 优先 `sceneUrl` + `previewUrl`；`modelUrl` 用 GLB/GLTF |
| 2 | 结果 URL 的生命周期与刷新机制 | 历史资产可用性 | 长期稳定 URL 或 ≥ 30 天签名；明确刷新方案 |
| 3 | 预览图尺寸、格式、生成方式 | 结果页/资产库展示 | 16:10 或 16:9，≥ 1280px，JPG/PNG/WebP |
| 4 | 最大生成时长与 SLA | 用户体验、超时设置 | 给出 P50/P95/最大值；我方据此调整超时 |
| 5 | 并发与配额 | 任务排队、429 风险 | 给出并发上限；轮询不得 429 |
| 6 | 是否需要 webhook 回调 | 目前为轮询 | 本期先用轮询；后续可加签名回调 |
| 7 | 结果文件是否允许我方转存 | 资产长期性、成本 | 本期只存 URL；如需转存另议 |
| 8 | 失败作业与孤儿作业的清理策略 | 存储成本 | 约定 TTL（如 7 天） |
| 9 | Token 轮换周期与灰度方式 | 安全与可用性 | 双 Token 过渡或维护窗口 |
| 10 | 数据保留、删除与合规要求 | 隐私合规 | 明确图片/结果保存时长与删除接口 |
| 11 | 是否需要更多学员/脚本字段 | 生成质量 | 先按本文档字段；不足再扩展 |
| 12 | 场景内容安全审核责任 | 合规 | 建议你方做生成后审核，我方做业务侧复核 |

---

## 14. 变更记录

| 版本 | 日期 | 变更 |
| --- | --- | --- |
| v0.1 | 2026-10-24 | 首版：两个接口、状态机、签名图片、结果要求、联调与验收清单 |

---

## 附：我方任务状态与 Provider 状态对照

| 我方 `SceneTaskStatus` | 含义 | 对应 Provider `status` |
| --- | --- | --- |
| `draft` | 草稿，未提交 | — |
| `pending` | 待提交到你方 | — |
| `queued` | 已获得 `jobId` | `pending` / `queued` |
| `generating` | 生成中 | `generating` |
| `succeeded` | 成功，资产已创建 | `succeeded` |
| `failed` | 失败，可重试 | `failed` |

## 附：我方任务结果字段（持久化后）

```json
{
  "previewSeed": "real:job_01J8Z3K9YQ7M2X",
  "resolution": "2048 × 1280",
  "previewUrl": "https://cdn.3d-provider.example.com/.../preview.jpg",
  "sceneFileUrl": "https://cdn.3d-provider.example.com/.../scene.zip",
  "modelUrl": "https://cdn.3d-provider.example.com/.../scene.glb",
  "sceneUrl": "https://cdn.3d-provider.example.com/.../index.html",
  "notes": "已按脚本生成 4 个训练区域",
  "isDemo": false
}
```

`isDemo: false` 表示真实 Provider 结果；mock Provider 结果为 `isDemo: true`，UI 会显示“演示数据”标识。
