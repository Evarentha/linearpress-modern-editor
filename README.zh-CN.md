# 现代编辑器（modern-editor）

[![LinearPress](https://img.shields.io/badge/LinearPress-plugin-7C3AED.svg)](https://www.npmjs.com/package/@evarentha/linearpress) [![npm](https://img.shields.io/npm/v/@evarentha/linearpress-modern-editor.svg)](https://www.npmjs.com/package/@evarentha/linearpress-modern-editor) [![Node.js](https://img.shields.io/badge/node-%3E%3D22-green.svg)](https://nodejs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org) [![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg)](LICENSE)

[English](README.md) | **简体中文**

接管 LinearPress 文章编辑的可视化块编辑器。内容直接在画布上编辑，选中文本即弹出浮动格式栏，草稿具有多层保障，发布支持立即与定时两种方式。启用插件即替换基础编辑页，停用后基础编辑器恢复，已写文章照常可读。

写作需要 `post:create`（新建）与 `post:edit`（编辑）权限，在后台按权限组授予。

## 安装

```bash
git clone https://github.com/Evarentha/linearpress-modern-editor.git src/plugins/modern-editor
```

目录名必须与插件 id 一致，安装后需重启 LinearPress。也可以在 `base` 检出中执行 `sh scripts/sync-plugins.sh modern-editor`，或在后台插件页上传 ZIP、填写 npm 包名。本插件无设置页，全部选项在画布上直接选择。

## 编辑

支持 21 种块：段落、标题（H1 至 H4）、有序 / 无序列表、引用（为旧内容保留 `blockquote` 别名）、带语言字段的代码、数学、预格式文本、引文、诗、表格、折叠详情（`details` 与 `collapse` 各为一种）、音频、视频、图标、带链接的按钮、栏目、空间隔、图片、custom-html；`blockquote` 别名与 `details`、`collapse` 两种折叠类型正是 21 这一计数的来源。

表格单元格可直接编辑，行与列均可增删。栏目容纳一至三个嵌套块并支持递归，每栏的类型切换器在清空内容前先行确认。选中文本弹出浮动栏：加粗、斜体、下划线、波浪线、删除线、字号相对增减、文字颜色、背景色；旧的 `<font>` 标签将转换为带样式的 span。

其他插件注册的未知或自定义块类型将渲染为可编辑的 JSON 文本域，数据始终可见。

## 草稿与定时发布

草稿保障分为多层：每 30 秒向 localStorage 保存一份本地副本；回到文章时，恢复提示先以本地副本与服务器的 `updated_at` 比对，确认更新方才应用；提交前一刻写入一份防崩溃快照；未保存的新文章作为待定草稿保留，不会丢失。

发布抽屉接受可选的定时计划。服务端每 30 秒检查一次，将到达发布时间的草稿转为已发布；待发布的排期存储于 `modern_editor_schedule` 表（`post_id`、`publish_at`），直至触发。

## 存储与集成

块存储于 `posts.content_json`，编辑器原生块以 `LP-MODERN-BLOCK::<base64>` URI 标记封装于 custom-html 块中。插件启用期间，`post:beforeRender` Hook 在服务端解码并以白名单净化器重新渲染这些标记，主题获得的始终是净化后的 HTML，不会接触到标记本身。若停用插件，已保存的文章将显示原始标记文本，直至重新保存；因此请保持插件启用，或在移除前重新保存受影响的文章。

保存经由 `ctx.posts.save` 执行，包括 `post:beforeSave` 在内的全部基础 Hook 照常触发，其他插件不受影响。本插件接管的 `GET /admin/posts/new`、`GET /admin/posts/:id/edit`、`POST /admin/posts/save` 仅在启用期间生效，围绕文章的其他插件可与之并存。

其他插件可通过 `window.LinearPressModernEditor = { registerBlock, getBlocks, setBlocks }` 扩展编辑器：注册新块类型、读取文档、改写文档。media-library 的选择器正是通过该接口追加媒体块。自定义块接收 label、可选的 description，以及新块的默认数据：

```js
// 任意插件的浏览器脚本
window.LinearPressModernEditor.registerBlock('callout', {
  label: '提示块',
  description: '强调内容',
  defaults: { contentHtml: '在此填写内容' }
});
```

注册后该块即出现在工具栏；其他插件保存的未知类型则渲染为前述可编辑的 JSON 文本域，数据不会丢失。自定义类型在公开站点如何渲染由注册方插件负责：基础的 `registerBlock()` 服务端区块注册表即为此提供的官方接口。

## 许可证

本项目以 GPL-3.0-or-later 许可发布，Copyright (C) 2026 Evarentha，完整文本见 [LICENSE](LICENSE)。
