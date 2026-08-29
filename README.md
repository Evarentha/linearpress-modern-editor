<!--
  Author: MoyuZJ
  Team: LinearTeam
  Contact: linearteam@foxmail.com
  Made by MoyuZJ in China with ♥
-->

# Modern Editor（modern-editor）

LinearPress 的 **WordPress 风格可视化编辑器**：无边界区块编辑、浮动格式栏、发布二次确认与定时发布，
直接替换文章编辑页的输入体验。

> 本仓库是 LinearPress 插件 **modern-editor** 的独立开发仓库。插件即 Cordis 插件函数，即插即用、可停用可卸载。

## 插件化的优势

- **不替换 `ctx.posts`**：编辑器只是「视图」，保存仍走核心文章服务与 Hook——`post:beforeSave` / `post:beforeRender` / 编辑器端 `window.LinearPressEditor` 扩展全部可用，其它插件不受影响。
- **标记可回退**：区块以 `LP-MODERN-BLOCK::<base64(JSON)>` 纯文本标记存为 `custom-html`；插件停用后文章仍以普通文本输出，不会依赖主题支持私有标签。
- **协调共存**：评论区、媒体库、说说、高级文章列表等插件均可与它协作（如媒体库注入按钮、高级文章列表注入分类二次确认面板）。

## 功能

- **直接编辑**：在文章画布上直接编辑 `contenteditable` 文档，无需字段与预览切换；选中文本弹出浮动格式栏（文字颜色、背景色、粗体、斜体、下划线、波浪线、删除线）。
- **区块丰富**：段落、标题、列表、引用、代码、详细信息、数学、预格式文本、引文、表格、诗、折叠内容、音频、视频、图标、按钮、栏目（最多三列、可递归嵌套）与分隔。
- **草稿与发布**：保存草稿并写浏览器本地副本（30 秒节流）；发布先开侧边检查栏二次确认；`publish_at` 预留定时发布能力。
- **Markdown 兼容**：编辑时不粘贴 HTML 也能获得所见即所得排版（README 之外的用法以代码为准）。

## 安装

```bash
# 方式一：工作区同步
cd base && sh scripts/sync-plugins.sh modern-editor

# 方式二：克隆到运行目录（目录名必须等于插件 id）
git clone <本仓库地址> src/plugins/modern-editor
```

插件启用并重启后，`/admin/posts/new` 与 `/admin/posts/:id/edit` 自动切换为现代编辑器；停用即回到基础编辑器。

## 本地开发：怎么拉 / 怎么改 / 怎么跑

```bash
git clone <本仓库地址> LinearPress/Plugins/modern-editor
cd LinearPress/base
npm install && npm run db:init
sh scripts/sync-plugins.sh modern-editor
npm run dev                # http://localhost:3000 —— 登录后台 → 文章 → 新建/编辑
```

## 目录结构

```text
modern-editor/
├── plugin.json            # Manifest
├── index.ts               # 入口：编辑页视图覆盖、区块标记编解码、渲染器、定时发布 Effect
├── views/admin/post-edit.ejs   # 覆盖文章编辑页
└── public/                # 编辑器 CSS（含 overrides）与 JS
```

## 贡献与发布

- conventional commits；提交前 `cd base && npm run typecheck`
- 版本：`git tag v1.0.0 && git push --tags`
- License：MIT（见仓库 LICENSE）