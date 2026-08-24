/*
 * Author: MoyuZJ
 * Team: LinearTeam
 * Contact: linearteam@foxmail.com
 * Made by MoyuZJ in China with ♥
 */

import type { RequestHandler } from 'express';
import { Context } from 'cordis';
import { checkPermission, requireAuth } from '../../services/permission.service.js';
import { renderBlocks } from '../../core/block-registry.js';
import type { Block, Post, PostStatus } from '../../types/index.js';


const MARKER = 'LP-MODERN-BLOCK::';
const editPermission: RequestHandler = requireAuth;
const canEdit: RequestHandler = checkPermission('post:edit');

function param(value: string | string[]): string { return Array.isArray(value) ? value[0] ?? '' : value; }
function message(error: unknown): string { return error instanceof Error ? error.message : '操作失败'; }
function escape(value: unknown): string { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]!)); }
function marker(block: Record<string, unknown>): string { return `${MARKER}${Buffer.from(JSON.stringify(block), 'utf8').toString('base64')}`; }
function readMarker(value: unknown): Record<string, unknown> | undefined {
  const raw = String(value ?? '');
  if (!raw.startsWith(MARKER)) return undefined;
  try { return JSON.parse(Buffer.from(raw.slice(MARKER.length), 'base64').toString('utf8')) as Record<string, unknown>; } catch { return undefined; }
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
    return style ? `<${outputTag} style="${escape(style)}">` : `<${outputTag}>`;
  });
}
function blockText(block: Record<string, unknown>): string { return rich(block.contentHtml ?? block.content); }
function renderStored(block: Record<string, unknown>): string {
  if (String(block.type ?? '') === 'custom-html') {
    const decoded = readMarker(block.content);
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
  if (type === 'audio') return `<audio controls src="${escape(block.src)}"></audio>`;
  if (type === 'video') return `<video controls src="${escape(block.src)}"></video>`;
  if (type === 'icon') return `<span class="lp-modern-icon" aria-label="${escape(block.label)}">${safeText(block.icon || '✦')}</span>`;
  if (type === 'button') return `<p class="lp-modern-buttons">${(Array.isArray(block.buttonsHtml) ? block.buttonsHtml : String(block.buttons ?? '按钮').split('\n')).map((item) => `<a href="${escape(block.href || '#')}">${rich(item)}</a>`).join('')}</p>`;
  if (type === 'columns') {
    const columns = Array.isArray(block.columns) ? block.columns.slice(0, 3) : [
      { type: 'paragraph', contentHtml: block.leftHtml ?? block.left ?? '' },
      { type: 'paragraph', contentHtml: block.rightHtml ?? block.right ?? '' }
    ];
    return `<div class="lp-modern-columns lp-modern-columns-${Math.max(1, columns.length)}">${columns.map((child) => `<div class="lp-modern-column">${renderStored((child || { type: 'paragraph' }) as Record<string, unknown>)}</div>`).join('')}</div>`;
  }
  if (type === 'spacer') return `<div class="lp-modern-spacer" style="height:${Math.max(8, Math.min(400, Number(block.size) || 48))}px"></div>`;
  if (type === 'image') return `<figure><img src="${escape(block.src)}" alt="${escape(block.alt)}"></figure>`;
  return undefined;
}
function renderModernContent(blocks: Block[]): string { return blocks.map((block) => renderStored(block as unknown as Record<string, unknown>)).join('\n'); }
function modernHtml(post: Post): string { return renderModernContent(post.content_json); }

export default async function modernEditor(context: Context) {
  const { web } = context.linearpress;
  const db = context.databaseService;
  const posts = context.posts;

  await db.exec('CREATE TABLE IF NOT EXISTS modern_editor_schedule (post_id INTEGER PRIMARY KEY, publish_at TEXT NOT NULL)');
  const publishDue = async () => {
    const due = await db.all<{ post_id: number; publish_at: string }>('SELECT post_id, publish_at FROM modern_editor_schedule');
    for (const item of due) if (Date.parse(item.publish_at) <= Date.now()) { await db.run("UPDATE posts SET status='published', updated_at=CURRENT_TIMESTAMP WHERE id=?", item.post_id); await db.run('DELETE FROM modern_editor_schedule WHERE post_id=?', item.post_id); }
  };
  context.effect(() => {
    const timer = setInterval(() => { void publishDue().catch((error) => context.logger.error(`scheduled publish failed: ${message(error)}`)); }, 30000);
    timer.unref?.();
    return () => clearInterval(timer);
  });
  context.linearpress.hooks.on('post:beforeRender', (payload) => ({ ...payload, html: modernHtml(payload.post) }), { priority: 5 });
  web.register('get', '/admin/posts/new', editPermission, canEdit, (_req, res) => res.render('admin/post-edit', { title: '新建文章', post: null, schedule: null, modernEditor: true }));
  web.register('get', '/admin/posts/:id/edit', editPermission, canEdit, async (req, res) => {
    const post = await posts.findById(Number(param(req.params.id)));
    if (!post) return void res.status(404).render('error', { title: '文章不存在', message: '找不到这篇文章。' });
    const schedule = await db.get<{ publish_at: string }>('SELECT publish_at FROM modern_editor_schedule WHERE post_id=?', post.id);
    res.render('admin/post-edit', { title: '编辑文章', post, schedule, modernEditor: true });
  });
  web.register('post', '/admin/posts/save', editPermission, canEdit, async (req, res) => {
    try {
      const raw = JSON.parse(String(req.body.content_json ?? '[]')) as Array<Record<string, unknown>>;
      const blocks = raw.map((block) => ({ type: 'custom-html', content: marker(block) })) as Block[];
      const scheduled = String(req.body.schedule_enabled ?? '') === 'on' && String(req.body.publish_at ?? '').trim();
      const saved = await posts.save({ id: Number(req.body.id) || undefined, title: String(req.body.title ?? ''), slug: String(req.body.slug ?? ''), blocks, status: scheduled ? 'draft' : String(req.body.status ?? 'draft') as PostStatus, authorId: req.session.userId! });
      if (scheduled) await db.run('INSERT INTO modern_editor_schedule(post_id,publish_at) VALUES(?,?) ON CONFLICT(post_id) DO UPDATE SET publish_at=excluded.publish_at', saved.id, String(req.body.publish_at));
      else await db.run('DELETE FROM modern_editor_schedule WHERE post_id=?', saved.id);
      res.redirect(`/admin/posts/${saved.id}/edit?saved=1`);
    } catch (error) { res.status(400).render('error', { title: '文章保存失败', message: message(error) }); }
  });
  context.logger.info('activated');
}
export { MARKER, readMarker, renderModernContent };
