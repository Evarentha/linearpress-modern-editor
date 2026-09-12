# Modern Editor

[![LinearPress](https://img.shields.io/badge/LinearPress-plugin-7C3AED.svg)](https://www.npmjs.com/package/@evarentha/linearpress) [![npm](https://img.shields.io/npm/v/@evarentha/linearpress-modern-editor.svg)](https://www.npmjs.com/package/@evarentha/linearpress-modern-editor) [![Node.js](https://img.shields.io/badge/node-%3E%3D22-green.svg)](https://nodejs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)](https://www.typescriptlang.org) [![License: GPL-3.0-or-later](https://img.shields.io/badge/License-GPL--3.0--or--later-blue.svg)](LICENSE)

**English** | [简体中文](README.zh-CN.md)

A visual block editor that takes over post editing in LinearPress. You edit directly on the canvas, format from a floating bar, drafts survive crashes and stray tabs, and publishing can happen now or on a schedule. The plugin is its own switch: enabled, it replaces the base editor screens; disabled, the base editor returns and existing posts stay readable.

Writers need `post:create` for new posts and `post:edit` for existing ones, granted per group in the admin console.

## Install

```bash
git clone https://github.com/Evarentha/linearpress-modern-editor.git src/plugins/modern-editor
```

The directory name must equal the plugin id. Restart afterwards, or sync from the `base` checkout (`sh scripts/sync-plugins.sh modern-editor`), or upload the ZIP / npm name from the admin Plugins page. There is no settings page; everything is chosen on the canvas.

## Editing

21 block types: paragraph, heading (H1 to H4), ordered or unordered lists, quote (with a legacy `blockquote` alias for older content), code with a language field, math, preformatted text, citation, poem, table, details, collapse, audio, video, icon, buttons with links, columns, spacer, image, and custom-html. The legacy `blockquote` alias and the separate `details` and `collapse` types are what bring the count to 21.

Tables have directly editable cells with add/delete controls for rows and columns. Columns hold one to three nested blocks, recursively, and each column carries a type switcher that asks before clearing its content. Selecting text brings up the floating bar: bold, italic, underline, wavy underline, strikethrough, relative font size up and down, text color, background color, with legacy `<font>` tags normalized to styled spans.

Unknown or custom block types, the ones other plugins register, render as an editable JSON textarea so the data is never invisible.

## Drafts and schedules

Draft safety is layered. The editor autosaves a local copy to localStorage every 30 seconds. Returning to the post offers a restore prompt that compares the local copy against the server's `updated_at` before touching anything. A crash-safe snapshot is written right before submit, and an unsaved new post carries over as a pending draft instead of evaporating.

The publish drawer accepts an optional schedule. A server-side effect checks every 30 seconds and flips due drafts to published; pending schedules sit in the `modern_editor_schedule` table (`post_id`, `publish_at`) until they fire.

## Storage and integration

Blocks persist in `posts.content_json`, with editor-native blocks stored as `LP-MODERN-BLOCK::<base64>` URI markers inside `custom-html` blocks. While the plugin is active, its `post:beforeRender` hook decodes and re-renders the markers server-side through an allowlist sanitizer, so themes receive clean HTML whatever the editor produced; no theme ever has to understand the markers. If the plugin is disabled, previously saved posts show the raw marker text until they are re-saved, so keep it enabled or re-save the affected posts before removing it.

Saving goes through `ctx.posts.save`, so every base hook, including `post:beforeSave`, still fires for other plugins. The routes it takes over, `GET /admin/posts/new`, `GET /admin/posts/:id/edit`, and `POST /admin/posts/save`, are overridden only while the plugin is enabled, so post-related plugins keep working alongside it.

Other plugins can extend the editor through `window.LinearPressModernEditor = { registerBlock, getBlocks, setBlocks }`: register new block types, read the document, or rewrite it. media-library uses exactly this to append media blocks from its picker. A custom block takes a label, an optional description, and the default data for new blocks:

```js
// any plugin's browser script
window.LinearPressModernEditor.registerBlock('callout', {
  label: 'Callout',
  description: 'Highlighted note',
  defaults: { contentHtml: 'Write the note here' }
});
```

The block then appears on the toolbar; an unknown type saved by another plugin renders as the editable JSON textarea described above, so data is never lost. How a custom type renders on the public site is up to the registering plugin: the base `registerBlock()` server-side block registry is the documented hook for that.

## License

GPL-3.0-or-later, Copyright (C) 2026 Evarentha. See LICENSE.
