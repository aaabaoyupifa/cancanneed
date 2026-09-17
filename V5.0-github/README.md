# 命运之书 (Book of Fate)

AI 驱动的互动小说游戏。输入一个题材，AI 为你生成完整的世界观、人物、伏笔与剧情，你在分支选项中书写自己的命运。

![Python](https://img.shields.io/badge/python-3.8+-blue) ![Flask](https://img.shields.io/badge/flask-2.x-green) ![License](https://img.shields.io/badge/license-MIT-lightgrey)

## ✨ 特性

- **AI 世界生成** — 输入题材，自动生成世界观、主角、配角、能力体系
- **剧情推进** — 每次选择推动故事，AI 实时渲染剧情与分支选项
- **AI 助手操控台** — 14 种操作（改人物 / 加道具 / 创剧情 / 回档…）用自然语言操控游戏
- **道具与状态系统** — 背包、状态、关系、功法全链路 UI 同步
- **伏笔系统** — 四状态伏笔管理（埋设 → 活跃 → 回收 → 过期），自动注入 AI 提示词
- **文风记忆** — 口述风格 / 从故事学 / 贴范文 三种方式自定义 AI 文笔
- **AI 动漫画像** — 根据人物设定自动生成动漫画像（免费生图 API）
- **注释引擎** — 金色术语 tooltip，世界观词条即点即显
- **开场动画 / 打字机效果** — 沉浸式演出
- **存档系统** — 5 槽位存档，永久修剪策略杜绝超大存档
- **跨平台** — Windows / macOS 双平台，可打包为桌面应用

## 🏗 架构

```
launcher.py  →  Flask(:8765)  →  pywebview 原生窗口
                     ↓
              ai_server.py（AI 代理 / 存档 / 画像生成）
                     ↓
              interactive-fiction.html + js/（26 个模块）
                     ↓
              DeepSeek API（剧情生成）
```

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install flask webview requests
```

### 2. 配置 API Key

```bash
cp config.example.json config.json
```

编辑 `config.json`，填入你的 DeepSeek API Key：

```json
{
  "api_key": "sk-你的DeepSeek密钥",
  "api_url": "https://api.deepseek.com/v1/chat/completions",
  "api_model": "deepseek-chat"
}
```

> 密钥在 [DeepSeek 开放平台](https://platform.deepseek.com/) 申请。

### 3. 启动

```bash
python launcher.py
```

### 4.（可选）打包桌面应用

```bash
pip install pyinstaller
python -m PyInstaller 命运之书.spec --clean --noconfirm
# 产物在 dist/命运之书/
```

## 📁 目录结构

```
├── launcher.py              # 启动器（Flask + pywebview）
├── ai_server.py             # 服务端（AI 代理/存档/画像生成）
├── interactive-fiction.html # 主界面
├── world-builder.html       # 世界观编辑器
├── config.example.json      # 配置模板（复制为 config.json）
├── 命运之书.spec            # PyInstaller 打包配置
└── js/                      # 26 个前端模块
    ├── game-engine.js       # 游戏主引擎
    ├── ai-bridge.js         # AI 通信
    ├── story-assistant.js   # AI 助手操控台
    ├── inventory-system.js  # 道具系统
    ├── foreshadowing.js     # 伏笔系统
    └── ...
```

## ⚠️ 隐私说明

- `config.json` 含 API Key，已在 `.gitignore` 中排除，**请勿提交到公开仓库**
- 存档保存在本地 `saves/` 目录，不经过任何第三方
- API Key 只用于你本机直连 DeepSeek，无中间服务器

## 📄 License

MIT
