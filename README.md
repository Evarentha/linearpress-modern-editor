# Modern Editor

LinearPress 的 WordPress 风格可视化编辑器插件。

## 安装

将本目录复制到 LinearPress 的 `src/plugins/modern-editor`，或在后台使用 ZIP 安装。插件启用后重启进程，管理后台的 `/admin/posts/new` 和 `/admin/posts/:id/edit` 会切换为现代编辑器。

编辑区是直接在文章画布上编辑的 `contenteditable` 文档，不需要先填写字段再看预览。选中文本后会显示浮动格式栏，可设置文字颜色、背景颜色、粗体、斜体、下划线、波浪下划线和删除线。

表格使用 `cells` 保存，栏目使用 `columns` 保存子区块（最多三列，每一列都是一个区块，因此栏目可以递归嵌套），文本样式使用受限的 `contentHtml` 保存；阅读页会通过安全白名单恢复这些样式。
编辑器提交时会把每个区块包装为：

```text
LP-MODERN-BLOCK::<base64(JSON)>
```

并以 `custom-html` 区块保存。它不是 HTML，而是可读的纯文本标记。现代编辑器启用时，`post:beforeRender` 会识别标记并渲染为对应样式；插件移除后，LinearPress 仍会把标记作为普通文本输出，不会依赖主题支持私有 HTML 标签。

## 区块

段落、标题、列表、引用、代码、详细信息、数学、预格式文本、引文、表格、诗、折叠内容、音频、视频、图标、单个或多个按钮、栏目和空间隔。栏目参考 WordPress `InnerBlocks` 模型，区块类型不会常驻显示在正文画布中。

区块最终仍通过 LinearPress 的 Hook 和服务/区块注册体系参与渲染。其他插件可以继续使用 `post:beforeSave`、`post:beforeRender` 或编辑器端的 `window.LinearPressEditor` 扩展能力；现代编辑器不会替换 `TOKENS.posts`。

## 草稿与发布

保存按钮保存草稿并写入浏览器本地草稿；每 30 秒仅在有改动时更新本地副本。发布按钮先打开侧边检查栏，二次确认后提交为 `published`。云端草稿冲突提示依赖服务端返回的文章时间戳，当前版本保留本地草稿恢复提示；`publish_at` 字段已预留，定时发布需要站点的后台任务或发布服务继续接入。
