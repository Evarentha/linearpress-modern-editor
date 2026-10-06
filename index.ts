/*
 * Modern Editor Plugin
 *
 * Block-based visual editor for LinearPress posts: server-side block sanitizing and rendering, immersive admin editing, and scheduled publishing.
 *
 * Authors:
 * MoyuZJ <moyuzj@moyuzj.cn> @LinearTeam - Made in China with ♥
 * worryzu <worryzu@gmail.com> @LinearTeam
 *
 * Copyright (C) 2026 Evarentha
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Sanitizes block content through a whitelist of inline tags and CSS
 * properties, renders blocks (including marker-encoded custom-HTML blocks)
 * to post HTML, and replaces the admin post edit pages with the immersive
 * editor view. Saves portable HTML blocks with lossless editor metadata and keeps a
 * modern_editor_schedule table, publishing due posts on a 30-second timer.
 * @since 1.4.0
 */

import type { RequestHandler } from 'express';
import { Context } from 'cordis';
import { checkPermission, requireAuth } from '../../services/permission.service.js';
import { renderBlocks } from '../../core/block-registry.js';
import type { Block, Post, PostStatus } from '../../types/index.js';
import type { DatabaseService } from '../../types/services.js';


const MARKER = 'LP-MODERN-BLOCK::';
const editPermission: RequestHandler = requireAuth;
const canEdit: RequestHandler = checkPermission('post:edit');

function param(value: string | string[]): string { return Array.isArray(value) ? value[0] ?? '' : value; }
const messageOf = (error: unknown): string => error instanceof Error ? error.message : '操作失败';
const esc = (value: unknown): string => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]!));
/** A portable HTML fallback and lossless editor data; never put markers in html_cache. */
function portableBlock(block: Record<string, unknown>): Block {
  const original = readMarker(block.content) ?? (block.modernBlock as Record<string, unknown> | undefined) ?? block;
  return { ...block, type: 'custom-html', content: renderStored(original), modernBlock: original } as unknown as Block;
}
export function parsePublishAt(value: unknown, now = Date.now()): string {
  const raw = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(raw)) throw new Error('发布时间必须是带 UTC 时区的 ISO 时间。');
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().replace('.000Z', 'Z') !== raw.replace('.000Z', 'Z') || parsed.getTime() <= now) throw new Error('请选择有效的未来发布时间。');
  return parsed.toISOString();
}
function readMarker(value: unknown): Record<string, unknown> | undefined {
  const raw = String(value ?? '');
  if (!raw.startsWith(MARKER)) return undefined;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(raw.slice(MARKER.length), 'base64').toString('utf8'));
    return decoded && typeof decoded === 'object' && !Array.isArray(decoded) ? decoded as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

const allowedTags = new Set(['STRONG', 'B', 'EM', 'I', 'U', 'S', 'DEL', 'SPAN', 'BR', 'CODE', 'MARK', 'FONT']);
const allowedStyles = new Set(['color', 'background-color', 'font-size', 'text-decoration-line', 'text-decoration-style', 'font-weight', 'font-style']);
function safeText(value: unknown): string {
  return String(value ?? '')
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#0?39|#x27|#\d+|#x[\da-f]+);)/gi, '&amp;')
    .replace(/[<>"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]!))
    .replace(/\r?\n/g, '<br>');
}
function rich(value: unknown): string {
  const raw = String(value ?? '');
  if (!/<[a-z][^>]*>/i.test(raw)) return safeText(raw);
  return raw.replace(/<!--([\s\S]*?)-->|<\/?([a-z][\w-]*)([^>]*)>/gi, (full, _comment: string, tag: string, attrs: string) => {
    if (!tag) return '';
    const upper = tag.toUpperCase();
    if (upper === 'BR') return '<br>';
    if (!allowedTags.has(upper)) return '';
    if (full.startsWith('</')) return `</${upper === 'FONT' ? 'span' : tag.toLowerCase()}>`;
    const styleRules: string[] = [];
    const styleMatch = attrs.match(/\sstyle\s*=\s*["']([^"']*)["']/i);
    if (styleMatch) styleRules.push(styleMatch[1]);
    if (upper === 'FONT') {
      const color = attrs.match(/\scolor\s*=\s*["']?([#\w(),.%+-]+)["']?/i)?.[1];
      if (color) styleRules.push(`color:${color}`);
    }
    const style = styleRules.join(';').split(';').map((rule) => rule.trim()).filter((rule) => {
      const [property, ...parts] = rule.split(':');
      const valuePart = parts.join(':').trim();
      return allowedStyles.has(property.trim().toLowerCase()) && /^[#\w (),.%+-]+$/.test(valuePart);
    }).join(';');
    const outputTag = upper === 'FONT' ? 'span' : tag.toLowerCase();
    return style ? `<${outputTag} style="${esc(style)}">` : `<${outputTag}>`;
  });
}
/** 链接地址协议白名单：http/https 及站内地址；其余降级为 '#'。 */
function safeHref(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '#') return '#';
  if (/^https?:\/\//i.test(raw)) return esc(raw);
  if (/^\/[^^]/.test(raw) || raw.startsWith('./')) return esc(raw);
  return '#';
}
function blockText(block: Record<string, unknown>): string { return rich(block.contentHtml ?? block.content); }
function renderStored(block: Record<string, unknown>): string {
  if (String(block.type ?? '') === 'custom-html') {
    const decoded = (block.modernBlock as Record<string, unknown> | undefined) ?? readMarker(block.content);
    if (decoded) return renderModern(decoded) ?? renderStored(decoded);
    return String(block.content ?? '');
  }
  return renderModern(block) ?? renderBlocks([block as unknown as Block]);
}
function renderModern(block: Record<string, unknown>): string | undefined {
  const type = String(block.type ?? 'paragraph');
  if (type === 'paragraph') return `<p>${blockText(block)}</p>`;
  if (type === 'heading') { const level = Math.min(6, Math.max(1, Number(block.level) || 2)); return `<h${level}>${blockText(block)}</h${level}>`; }
  if (type === 'list') {
    const tag = block.ordered ? 'ol' : 'ul';
    const items = Array.isArray(block.itemsHtml) ? block.itemsHtml.map((item) => `<li>${rich(item)}</li>`).join('') : String(block.items ?? '').split('\n').filter(Boolean).map((item) => `<li>${safeText(item)}</li>`).join('');
    return `<${tag}>${items}</${tag}>`;
  }
  if (type === 'quote' || type === 'blockquote') return `<blockquote><p>${blockText(block)}</p>${block.cite ? `<cite>${safeText(block.cite)}</cite>` : ''}</blockquote>`;
  if (type === 'code') return `<pre><code>${safeText(block.content)}</code></pre>`;
  if (type === 'details' || type === 'collapse') return `<details ${block.open ? 'open' : ''}><summary>${rich(block.summaryHtml ?? block.summary ?? '展开详情')}</summary><div>${blockText(block)}</div></details>`;
  if (type === 'math') return `<div class="lp-modern-math">${safeText(block.content)}</div>`;
  if (type === 'pre') return `<pre>${safeText(block.content)}</pre>`;
  if (type === 'citation' || type === 'poem') return `<figure class="lp-modern-${type}"><blockquote>${blockText(block).replace(/\n/g, '<br>')}</blockquote>${block.source ? `<figcaption>${safeText(block.source)}</figcaption>` : ''}</figure>`;
  if (type === 'table') {
    const cells = Array.isArray(block.cells) ? block.cells as unknown[][] : undefined;
    const rows = cells ? cells.map((row, rowIndex) => `<tr>${row.map((cell) => `<${rowIndex === 0 ? 'th' : 'td'}>${rich(cell)}</${rowIndex === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('') : String(block.rows ?? '').split('\n').filter(Boolean).map((row) => `<tr>${row.split('|').map((cell) => `<td>${safeText(cell.trim())}</td>`).join('')}</tr>`).join('');
    return `<table><tbody>${rows}</tbody></table>`;
  }
  if (type === 'audio') return `<audio controls src="${esc(block.src)}"></audio>`;
  if (type === 'video') return `<video controls src="${esc(block.src)}"></video>`;
  if (type === 'icon') return `<span class="lp-modern-icon" aria-label="${esc(block.label)}">${safeText(block.icon || '✦')}</span>`;
  if (type === 'button') return `<p class="lp-modern-buttons">${(Array.isArray(block.buttonsHtml) ? block.buttonsHtml : String(block.buttons ?? '按钮').split('\n')).map((item) => `<a href="${safeHref(block.href)}">${rich(item)}</a>`).join('')}</p>`;
  if (type === 'columns') {
    const columns = Array.isArray(block.columns) ? block.columns.slice(0, 3) : [
      { type: 'paragraph', contentHtml: block.leftHtml ?? block.left ?? '' },
      { type: 'paragraph', contentHtml: block.rightHtml ?? block.right ?? '' }
    ];
    return `<div class="lp-modern-columns lp-modern-columns-${Math.max(1, columns.length)}">${columns.map((child) => `<div class="lp-modern-column">${renderStored((child || { type: 'paragraph' }) as Record<string, unknown>)}</div>`).join('')}</div>`;
  }
  if (type === 'spacer') return `<div class="lp-modern-spacer" style="height:${Math.max(8, Math.min(400, Number(block.size) || 48))}px"></div>`;
  if (type === 'image') return `<figure><img src="${esc(block.src)}" alt="${esc(block.alt)}"></figure>`;
  return undefined;
}
function renderModernContent(blocks: Block[]): string { return blocks.map((block) => renderStored(block as unknown as Record<string, unknown>)).join('\n'); }
function modernHtml(post: Post): string { return renderModernContent(post.content_json); }

export default async function modernEditor(context: Context) {
  const { web } = context.linearpress;
  const db = context.databaseService as DatabaseService;
  const posts = context.posts;

  await db.exec('CREATE TABLE IF NOT EXISTS modern_editor_schedule (post_id INTEGER PRIMARY KEY, publish_at TEXT NOT NULL)');
  // Repair historical marker records while preserving their editable block data.
  const legacy = await db.all<{ id: number; content_json: string }>('SELECT id, content_json FROM posts');
  for (const row of legacy) {
    let blocks: Block[];
    try { blocks = JSON.parse(row.content_json); } catch { continue; }
    if (!Array.isArray(blocks) || !blocks.some((block) => readMarker((block as unknown as Record<string, unknown>).content))) continue;
    const portable = blocks.map((block) => readMarker((block as unknown as Record<string, unknown>).content) ? portableBlock(block as unknown as Record<string, unknown>) : block);
    await db.run('UPDATE posts SET content_json=?, html_cache=? WHERE id=?', JSON.stringify(portable), renderModernContent(portable), row.id);
  }
  const cancelSchedule = async (id: number) => { await db.run('DELETE FROM modern_editor_schedule WHERE post_id=?', id); };
  // Every save (including APL withdrawal/archival) invalidates the old task.
  context.linearpress.hooks.on('post:beforeSave', async (draft) => {
    if (draft.id) await cancelSchedule(draft.id);
    return { ...draft, content_json: draft.content_json.map((block: Record<string, unknown>) => readMarker(block.content) ? portableBlock(block as unknown as Record<string, unknown>) : block) };
  });
  context.linearpress.hooks.on('post:beforeDelete', async (payload) => { await cancelSchedule(payload.post.id); return payload; });
  const publishDue = async () => {
    const due = await db.all<{ post_id: number; publish_at: string }>('SELECT post_id, publish_at FROM modern_editor_schedule');
    for (const item of due) {
      if (!Number.isFinite(Date.parse(item.publish_at)) || Date.parse(item.publish_at) > Date.now()) continue;
      await db.transaction(async () => {
        // Conditional claim prevents stale snapshots, deleted tasks and non-drafts
        // from being published. The service save and hooks share this transaction.
        const claimed = await db.run("UPDATE posts SET status='published' WHERE id=? AND status='draft' AND EXISTS (SELECT 1 FROM modern_editor_schedule WHERE post_id=? AND publish_at=?)", item.post_id, item.post_id, item.publish_at);
        if (!Number(claimed.changes)) { await db.run('DELETE FROM modern_editor_schedule WHERE post_id=? AND publish_at=?', item.post_id, item.publish_at); return; }
        const post = await posts.findById(item.post_id);
        if (post) await posts.save({ id: post.id, title: post.title, slug: post.slug, blocks: post.content_json, status: 'published', authorId: post.author_id });
        await cancelSchedule(item.post_id);
      });
    }
  };
  context.effect(() => {
    const timer = setInterval(() => { void publishDue().catch((error) => context.logger.error(`scheduled publish failed: ${messageOf(error)}`)); }, 30000);
    timer.unref?.();
    return () => clearInterval(timer);
  });
  context.linearpress.hooks.on('post:beforeRender', (payload) => ({ ...payload, html: modernHtml(payload.post) }), { priority: 5 });
  web.register('get', '/admin/posts/new', editPermission, checkPermission('post:create'), (_req, res) => res.render('admin/post-edit', { title: '新建文章', post: null, schedule: null, modernEditor: true }));
  web.register('get', '/admin/posts/:id/edit', editPermission, canEdit, async (req, res) => {
    const post = await posts.findById(Number(param(req.params.id)));
    if (!post) return void res.status(404).render('error', { title: '文章不存在', message: '找不到这篇文章。' });
    const schedule = await db.get<{ publish_at: string }>('SELECT publish_at FROM modern_editor_schedule WHERE post_id=?', post.id);
    res.render('admin/post-edit', { title: '编辑文章', post, schedule, modernEditor: true });
  });
  web.register('post', '/admin/posts/save', editPermission, async (req, res) => {
    try {
      const idText = String(req.body.id ?? '').trim();
      const id = idText ? Number(idText) : undefined;
      if (idText && (!Number.isInteger(id) || Number(id) <= 0)) throw new Error('文章 ID 无效。');
      if (!await context.permissions.has(req.session.userId!, id ? 'post:edit' : 'post:create')) return void res.status(403).render('error', { title: '权限不足', message: '你没有执行此操作的权限。' });
      const existing = id ? await posts.findById(id) : undefined;
      if (id && !existing) return void res.status(404).render('error', { title: '文章不存在', message: '找不到这篇文章。' });
      const raw = JSON.parse(String(req.body.content_json ?? '[]')) as Array<Record<string, unknown>>;
      if (!Array.isArray(raw) || raw.some((block) => !block || typeof block !== 'object' || Array.isArray(block) || typeof block.type !== 'string')) throw new Error('文章区块格式无效。');
      const blocks = raw.map(portableBlock);
      const scheduled = String(req.body.schedule_enabled ?? '') === 'on';
      // Validate before ANY write so invalid scheduling cannot destroy the old post.
      const publishAt = scheduled ? parsePublishAt(req.body.publish_at) : undefined;
      const status = String(req.body.status ?? 'draft') as PostStatus;
      if (!['draft', 'published', 'archived'].includes(status)) throw new Error('文章状态无效。');
      const saved = await db.transaction(async () => {
        const post = await posts.save({ id, title: String(req.body.title ?? ''), slug: String(req.body.slug ?? ''), blocks, status: scheduled ? 'draft' : status, authorId: existing?.author_id ?? req.session.userId! });
        if (publishAt) await db.run('INSERT INTO modern_editor_schedule(post_id,publish_at) VALUES(?,?) ON CONFLICT(post_id) DO UPDATE SET publish_at=excluded.publish_at', post.id, publishAt);
        else await cancelSchedule(post.id);
        return post;
      });
      res.redirect(`/admin/posts/${saved.id}/edit?saved=1`);
    } catch (error) { res.status(400).render('error', { title: '文章保存失败', message: messageOf(error) }); }
  });
  context.logger.info('activated');
}
export { MARKER, readMarker, renderModernContent };
