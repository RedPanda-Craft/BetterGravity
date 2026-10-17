<div align="center">

<img src="docs/images/logo.png" alt="SuperGravity Logo" width="130">

# SuperGravity 🚀

**面向 [Google Antigravity](https://antigravity.google) 的社区分支**  
*(源自 [BetterGravity](https://github.com/YashjitPal/BetterGravity) 的独立演进版本)*

[English](README.md) · [简体中文](README_zh.md)

[![Upstream: BetterGravity](https://img.shields.io/badge/Upstream-BetterGravity-blue.svg)](https://github.com/YashjitPal/BetterGravity)
[![Checks](https://github.com/YashjitPal/BetterGravity/actions/workflows/ci.yml/badge.svg)](https://github.com/YashjitPal/BetterGravity/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Antigravity 2.x](https://img.shields.io/badge/Antigravity-2.x-FFC799)](https://antigravity.google)
[![Platform: Windows | macOS | Linux](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-0078D4)](docs/installation.md)

[安装指南](docs/installation.md) · [制作主题](docs/themes.md) ·
[开发插件](docs/plugins.md) · [架构解析](docs/architecture.md) ·
[社区插件市场](community/catalog.json)

<br><br>

<img src="docs/images/home.png" alt="SuperGravity 界面展示" width="800">

</div>

---

> [!NOTE]
> **SuperGravity** 是源自 [@YashjitPal](https://github.com/YashjitPal) 优秀开源项目 [BetterGravity](https://github.com/YashjitPal/BetterGravity) 的**独立社区分支与演进版本**。  
> 本项目在 100% 遵照 MIT 协议保留上游核心架构与插件生态的基础上，探索独立的定制功能、输入防抖防护与开发辅助工具，并与官方主干保持同步。

> [!IMPORTANT]
> **兼容性声明**：SuperGravity 专为独立的 **Google Antigravity 2.0 桌面应用程序**（`Antigravity.exe` / `Antigravity.app`）设计。目前暂不适用于基于 VS Code 的独立 **Antigravity IDE**。

---

## SuperGravity 独立特性与探索

SuperGravity 继承了灵活的无侵入式注入平台，并在此基础上集成了部分独立定制能力：

### ⚡ 输入防抖守卫与零重排防御 (Typing Guard & Zero-Reflow)
专为高频编码与长对话打造：在用户键入时主动休眠 DOM MutationObserver 深度扫描与 Redux Store 订阅，彻底根除界面掉帧与卡顿；针对悬浮抽屉与浮层实施 GPU 硬件加速隔离（`transform: translateZ(0)`），告别风扇狂转。

### 🛡️ 确定性 Agent 哨兵脚手架 (Deterministic Agent Sentinel)
面向 AI 结对编程助手（Antigravity, Claude Code, Cursor）内置了低噪验证流水线（`pnpm agent:verify`）。自动拦截海量 CLI 冗余日志，提纯为毫秒级的结构化状态卡片，彻底避免模型上下文窗口（KV-Cache）被日志冲刷稀释。

### 🎨 全新 Willow 质感 Gemini 工作区
搭载精致的 Willow 设计系统，配备独立的左侧活动栏（聊天、工作区、技能、定时任务与桌宠管理），重构版面排版与极简对话视口。

### 🐾 互动式桌面像素桌宠 (Interactive Pets)
内置 17+ 款生动的桌面像素伴侣，支持使用 Gemini 生成定制化像素宠物，实时伴随 Agent 编码、庆祝或闲置陪伴。

<div align="center">
  <img src="docs/images/pets-manager.png" alt="桌宠管理器" width="760">
  <br><br>
  <img src="docs/images/pets.gif" alt="动画像素桌宠" width="380">
</div>

### 🌐 内置浏览器与自主计算机控制 (In-App Browser & Computer Use)
在 Antigravity 内部直接调试 Web 应用、审查 DOM 树，并允许 Agent 自主驱动鼠标键盘浏览网页与完成端到端自动化测试。

<div align="center">
  <img src="docs/images/browser-showcase.gif" alt="内置浏览器与自动化" width="760">
</div>

### 🔑 自带 Gemini API 密钥 (BYOK) 与 🎮 Discord 动态状态同步

<div align="center">

| 自带 Gemini 密钥 (BYOK) | Discord Rich Presence |
| :---: | :---: |
| <img src="docs/images/byok-settings.png" alt="自定义 API Key 设置" width="360"> | <img src="docs/images/discord-rpc.jpg" alt="Discord 状态展示" width="360"> |
| 使用自有 Gemini Key 突破限额，支持自定义 Base URL 与思考链（Thinking Token）透传。详见 [Gemini 密钥指南](docs/gemini-key.md)。 | 在 Discord 个人资料实时展示 Agent 工作状态与耗时，零项目隐私与代码泄露。详见 [Discord 指南](docs/presence.md)。 |

</div>

---

## 核心平台特性

| 特性 | 描述 |
| :--- | :--- |
| **即时主题换肤** | 支持单个 `.css` 文件、包含字体的样式包或在线链接。保存即生效，无需重新编译或重启，二十余个设计变量一键重染全应用。详见 [主题指南](docs/themes.md)。 |
| **轻量级原生插件** | 仅需一个清单和纯 JavaScript 脚本。自带持久化配置、隔离样式与专为高频重绘 DOM 设计的响应式助手。详见 [插件指南](docs/plugins.md)。 |
| **UI 注入能力** | 利用 Antigravity 原生组件添加 Toast 消息、主菜单项、工具栏按钮与独立设置页。详见 [接口文档](docs/interface.md)。 |
| **深度运行时反射** | 支持无损拦截宿主函数、读取 React Fiber 虚拟树，以及在语言服务器层拦截 RPC 流量。详见 [高级进阶](docs/advanced.md)。 |
| **原生设置集成** | 在设置侧边栏中拥有原生入口（设置、插件、主题），全自动随主题配色自适应。 |
| **应用更新免疫** | 宿主自动升级会重置程序目录，独立的守护进程（Update Guardian）会在下次关闭应用时自动恢复注入。 |
| **字节级无损卸载** | 安装前自动生成原始备份文件，卸载时字节级还原官方原貌，绝不触碰用户本地代码与凭据。 |

---

## 安装与使用

支持 **Windows、macOS 与 Linux**，适配 Antigravity 2.x。

从 [Releases 发行页](https://github.com/RedPanda-Craft/SuperGravity/releases) 下载最新安装器，运行并点击 **Install**。

### 开启功能与插件
1. 启动 Antigravity，点击左下角齿轮图标进入 **Settings**；
2. 侧边栏下滑至 **BetterGravity / SuperGravity** 分区；
3. 点击 **Plugins** 开启所需能力：
   - **Gemini App** — Willow 风格工作区。
   - **Pets** — 桌面宠物伴侣。
   - **In-App Browser** & **Computer Use** — 浏览器沙盒与计算机控制。
   - **Bring Your Own Gemini Key** — 自定义 API 密钥。
   - **Discord Rich Presence** — Discord 动态状态展示。
4. 点击 **Themes** 即可自由切换主题或拖拽安装自定义 `.css` 样式。

> 🛡️ **安全保障**：所有补丁安装前自动执行本地备份；卸载即还原，绝不上传任何个人数据。完整排查步骤见 [安装指南](docs/installation.md)。

---

## 本地开发与贡献

需要 Node.js 22+ 与 pnpm 10+：

```bash
pnpm install
pnpm agent:verify # 运行超快确定性降噪门禁 (Structure + Links + Catalog)
pnpm check        # 运行全量构建、类型检查与单测
pnpm dev          # 在浏览器中预览安装器 UI
```

---

## 许可证与致谢

- 本项目基于 [MIT 许可证](LICENSE) 开源；
- 特别鸣谢上游项目 [YashjitPal/BetterGravity](https://github.com/YashjitPal/BetterGravity) 的杰出贡献；
- SuperGravity 是由社区独立维护的非官方衍生项目，与 Google 官方无关。
