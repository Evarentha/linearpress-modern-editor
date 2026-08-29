<!--
  Author: MoyuZJ
  Team: LinearTeam
  Contact: linearteam@foxmail.com
  Made by MoyuZJ in China with ♥
-->

# Modern Editor / 现代可视化编辑器

A **WordPress-style visual editor** for LinearPress: borderless block editing, floating format bar, publish double-confirmation and scheduled publishing (reserved) — replaces the article editing experience entirely.

LinearPress 的 **WordPress 风格可视化编辑器**：无边界区块编辑、浮动格式栏、发布二次确认与定时发布（预留），直接替换文章编辑页的输入体验。

> Independent plugin repository for LinearPress **modern-editor**. A plugin is a Cordis plugin function — install on demand, disable/uninstall cleanly.
> 本仓库是 LinearPress 插件 **modern-editor** 的独立仓库。

## Why Plugins? / 插件化的优势

- **Never replaces `ctx.posts`** —— the editor is a "view"; saving still goes through core post service & hooks, so `post:beforeSave` / `post:beforeRender` and the editor API remain fully extensible.
  **不替换 `ctx.posts`**——编辑器只是「视图」，保存仍走核心服务与 Hook，其它插件扩展不受影响。
- **Reversible markers** —— blocks are stored as `LP-MODERN-BLOCK::<base64(JSON)>` text markers in `custom-html`; after disabling the plugin, articles still output plain text — no private-tag dependency.
  **标记可回退**——区块以纯文本标记保存；插件停用后文章仍以普通文本输出。
- **Plays well with others** —— media library buttons, advanced-posts-list category panel, comments etc. all cooperate through public hooks.
  **协调共存**——媒体库、分类二次确认、评论区等插件均可协作。

## Features / 功能

- **Direct editing / 直接编辑**：edit the `contenteditable` document on the canvas; floating format bar（color, bg, bold, italic, underline, wavy underline, strikethrough）.
- **Rich blocks / 区块丰富**：paragraph, heading, list, quote, code, details, math, preformatted, citation, table, poem, collapsed content, audio, video, icon, buttons, columns（up to 3, recursively nested）, divider.
- **Draft & publish / 草稿与发布**：draft autosave to browser local copy（30s throttle）；publish shows a sidebar re-confirm；`publish_at` reserved for scheduled publishing.
- **Safe rendering / 安全渲染**：post-processed through whitelist on `post:beforeRender`; no private HTML tags leak into themes.

## Install / 安装

```bash
# Option 1 — workspace sync（工作区同步）
cd base && sh scripts/sync-plugins.sh modern-editor

# Option 2 — clone into runtime dir（目录名必须等于插件 id）
git clone https://github.com/Averithen/linearpress-modern-editor src/plugins/modern-editor
```

After enabling and restarting，`/admin/posts/new` & `/admin/posts/:id/edit` switch to the modern editor; disabling returns to the basic editor.

## Local Development / 本地开发：怎么拉 / 怎么改 / 怎么跑

```bash
git clone https://github.com/Averithen/linearpress-modern-editor LinearPress/Plugins/modern-editor
cd LinearPress/base
npm install && npm run db:init
sh scripts/sync-plugins.sh modern-editor
npm run dev                # → http://localhost:3000 — admin → Posts → New/Edit
```

## Directory / 目录结构

```text
modern-editor/
├── plugin.json            # Manifest
├── index.ts               # entry：editor view override, block marker codec, renderer, scheduling effect
├── views/admin/post-edit.ejs   # overrides the post edit page
└── public/                # editor CSS（+ overrides）and JS
```

## Contribute & Release / 贡献与发布

- conventional commits；`cd base && npm run typecheck` before commit
- Version：`git tag v1.0.0 && git push --tags`
- License：MIT（LICENSE）