/*
 * Author: MoyuZJ
 * Team: LinearTeam
 * Contact: linearteam@foxmail.com
 * Made by MoyuZJ in China with ♥
 */

(() => {
  const page = document.querySelector('[data-modern-editor]');
  if (!page) return;
  const doc = page.querySelector('[data-document]');
  const form = page.querySelector('#modern-editor-form');
  const output = page.querySelector('#modern-content-json');
  const title = page.querySelector('#post-title');
  const status = page.querySelector('[data-status]');
  const saveStatus = page.querySelector('[data-save-status]');
  const postId = page.querySelector('input[name="id"]')?.value || '';
  const isNew = !postId;
  const activeNewKey = 'linearpress:modern-editor:active-new';
  const pendingNewKey = 'linearpress:modern-editor:pending-new';
  const newDraftId = isNew ? getNewDraftId() : '';
  const storageKey = `linearpress:modern-editor:${postId || newDraftId}`;
  const definitions = {
    paragraph: ['段落', '正文', { contentHtml: '' }],
    heading: ['标题', '章节层级', { level: 2, contentHtml: '' }],
    list: ['列表', '有序或无序', { ordered: false, itemsHtml: ['第一项', '第二项'] }],
    quote: ['引用', '突出一段话', { contentHtml: '', cite: '' }],
    blockquote: ['引用', '兼容旧引用区块', { contentHtml: '', cite: '' }],
    code: ['代码', '等宽代码块', { language: 'text', content: '' }],
    details: ['详细信息', '可展开信息', { summaryHtml: '更多信息', contentHtml: '', open: false }],
    math: ['数学', '公式文本', { content: 'E = mc²' }],
    pre: ['预格式文本', '保留空格和换行', { content: '' }],
    citation: ['引文', '来源明确的引用', { contentHtml: '', source: '' }],
    table: ['表格', '直接编辑单元格', { cells: [['表头 1', '表头 2'], ['内容 1', '内容 2']] }],
    poem: ['诗', '保留诗行', { contentHtml: '', source: '' }],
    collapse: ['折叠内容', '默认收起', { summaryHtml: '点击展开', contentHtml: '', open: false }],
    audio: ['音频', '粘贴音频地址', { src: '' }],
    video: ['视频', '粘贴视频地址', { src: '' }],
    icon: ['图标', '符号或 Emoji', { icon: '✦', label: '装饰图标' }],
    button: ['按钮', '支持多个按钮', { buttonsHtml: ['了解更多'], href: '#' }],
    columns: ['栏目', '一行并列一至三个区块', { columns: [{ type: 'paragraph', contentHtml: '' }, { type: 'paragraph', contentHtml: '' }] }],
    spacer: ['空间隔', '自定义留白高度', { size: 48 }],
    image: ['图片', '封面或插图', { src: '', alt: '' }],
    'custom-html': ['兼容内容', '保留原有 HTML 区块', { content: '' }]
  };
  const order = Object.keys(definitions);
  let blocks = normalizeInitial(window.MODERN_EDITOR_INITIAL || []);
  let dirty = false;
  let savedSelection = null;
  let savedEditor = null;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function getNewDraftId() {
    try {
      let value = sessionStorage.getItem(activeNewKey);
      if (!value) { value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; sessionStorage.setItem(activeNewKey, value); }
      return value;
    } catch { return `new-${Date.now()}`; }
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
  function htmlValue(value) {
    const text = String(value ?? '');
    if (!text) return '';
    return /<[a-z][^>]*>/i.test(text) ? text : escapeHtml(text).replace(/\r?\n/g, '<br>');
  }
  function markerBlock(value) {
    const block = clone(value || {});
    const raw = String(block.content ?? '');
    const prefix = 'LP-MODERN-BLOCK::';
    if (!raw.startsWith(prefix)) return block;
    try {
      const binary = atob(raw.slice(prefix.length));
      return JSON.parse(decodeURIComponent(Array.from(binary, (c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`).join('')));
    } catch { return block; }
  }
  function normalizeBlock(value) {
    let block = markerBlock(value);
    if (block.type === 'custom-html' && String(block.content ?? '').startsWith('LP-MODERN-BLOCK::')) block = markerBlock(block);
    if (block.type === 'custom-html') return block;
    if (block.type === 'blockquote') block.type = 'quote';
    if (['paragraph', 'heading', 'quote', 'citation', 'poem'].includes(block.type) && block.contentHtml === undefined) block.contentHtml = htmlValue(block.content);
    if (['details', 'collapse'].includes(block.type)) {
      if (block.summaryHtml === undefined) block.summaryHtml = htmlValue(block.summary);
      if (block.contentHtml === undefined) block.contentHtml = htmlValue(block.content);
    }
    if (block.type === 'list') {
      const items = Array.isArray(block.itemsHtml) ? block.itemsHtml : String(block.items ?? '').split('\n').filter(Boolean);
      block.itemsHtml = items.map(htmlValue);
    }
    if (block.type === 'table') {
      const cells = Array.isArray(block.cells) ? block.cells : String(block.rows ?? '').split('\n').filter(Boolean).map((row) => row.split('|'));
      block.cells = (cells.length ? cells : [['']]).map((row) => (Array.isArray(row) ? row : [row]).map(htmlValue));
      const width = Math.max(1, ...block.cells.map((row) => row.length));
      block.cells = block.cells.map((row) => [...row, ...Array.from({ length: width - row.length }, () => '')]);
    }
    if (block.type === 'button') {
      const buttons = Array.isArray(block.buttonsHtml) ? block.buttonsHtml : String(block.buttons ?? '按钮').split('\n').filter(Boolean);
      block.buttonsHtml = buttons.length ? buttons.map(htmlValue) : ['按钮'];
    }
    if (block.type === 'columns') {
      if (!Array.isArray(block.columns)) {
        block.columns = [
          { type: 'paragraph', contentHtml: htmlValue(block.leftHtml ?? block.left) },
          { type: 'paragraph', contentHtml: htmlValue(block.rightHtml ?? block.right) }
        ];
      }
      block.columns = block.columns.slice(0, 3).map(normalizeBlock);
      if (!block.columns.length) block.columns.push({ type: 'paragraph', contentHtml: '' });
    }
    return block;
  }
  function normalizeInitial(value) { return (Array.isArray(value) ? value : []).map(normalizeBlock); }
  function fingerprint() { return JSON.stringify({ title: title.value, blocks }); }
  function markDirty() { dirty = true; saveStatus.textContent = '有未保存修改'; sync(); }
  function sync() { output.value = JSON.stringify(blocks); }
  function addAction(icon, label, handler, className = 'modern-mini-action') { const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = icon; button.title = label; button.setAttribute('aria-label', label); button.addEventListener('click', handler); return button; }
  function tableAction(label, handler) { return addAction(label, label, handler, 'modern-table-action'); }
  function editable(tag, html, className, onInput) {
    const el = document.createElement(tag); el.className = `modern-rich-editable ${className || ''}`; el.contentEditable = 'true'; el.spellcheck = true; el.innerHTML = html || '';
    el.addEventListener('input', () => { onInput(el); markDirty(); });
    return el;
  }
  function field(label, value, onInput, type = 'text') { const wrap = document.createElement('label'); wrap.className = 'modern-meta-field'; wrap.append(document.createTextNode(label)); const input = document.createElement('input'); input.type = type; input.value = value ?? ''; input.addEventListener('input', () => { onInput(input.value); markDirty(); }); wrap.append(input); return wrap; }
  function contentFor(block) { return block.contentHtml ?? htmlValue(block.content); }
  function ensureColumns(block) { if (!Array.isArray(block.columns) || !block.columns.length) block.columns = [{ type: 'paragraph', contentHtml: '' }]; block.columns = block.columns.slice(0, 3).map(normalizeBlock); return block.columns; }
  function makeBody(block, nested = false) {
    const body = document.createElement('div'); body.className = `modern-block-body modern-block-body-${block.type}${nested ? ' modern-nested-block-body' : ''}`;
    if (['paragraph', 'heading', 'quote', 'citation', 'poem'].includes(block.type)) {
      const tag = block.type === 'heading' ? `h${block.level || 2}` : block.type === 'quote' ? 'blockquote' : 'div';
      const rich = editable(tag, contentFor(block), `modern-rich-${block.type}`, (el) => { block.contentHtml = el.innerHTML; }); rich.dataset.placeholder = block.type === 'heading' ? '章节标题' : '开始输入…'; body.append(rich);
      if (block.type === 'quote' || block.type === 'citation' || block.type === 'poem') body.append(field('来源', block.cite || block.source, (value) => { if (block.type === 'quote') block.cite = value; else block.source = value; }));
    } else if (block.type === 'list') {
      const list = document.createElement(block.ordered ? 'ol' : 'ul'); list.className = 'modern-rich-editable modern-edit-list'; list.contentEditable = 'true';
      (block.itemsHtml || ['']).forEach((item) => { const li = document.createElement('li'); li.contentEditable = 'true'; li.innerHTML = item; list.append(li); });
      list.addEventListener('input', () => { block.itemsHtml = Array.from(list.children).map((li) => li.innerHTML); markDirty(); }); body.append(list);
    } else if (block.type === 'table') {
      const table = document.createElement('table'); table.className = 'modern-edit-table modern-rich-editable'; table.contentEditable = 'true'; const cells = block.cells || [['']];
      cells.forEach((row, rowIndex) => { const tr = document.createElement('tr'); row.forEach((cell, colIndex) => { const td = document.createElement(rowIndex === 0 ? 'th' : 'td'); td.contentEditable = 'true'; td.innerHTML = cell || ''; td.addEventListener('input', () => { block.cells[rowIndex][colIndex] = td.innerHTML; markDirty(); }); tr.append(td); }); table.append(tr); });
      table.addEventListener('input', () => { block.cells = Array.from(table.rows).map((row) => Array.from(row.cells).map((cell) => cell.innerHTML)); markDirty(); });
      body.append(table);
      const controls = document.createElement('div'); controls.className = 'modern-table-controls';
      controls.append(tableAction('添加行', () => { const width = Math.max(1, ...block.cells.map((row) => row.length)); block.cells.push(Array.from({ length: width }, () => '')); render(); markDirty(); }), tableAction('添加列', () => { if (!block.cells.length) block.cells.push(['']); block.cells.forEach((row) => row.push('')); render(); markDirty(); })); body.append(controls);
    } else if (block.type === 'columns') {
      const columns = ensureColumns(block); const wrap = document.createElement('div'); wrap.className = 'modern-edit-columns'; wrap.style.setProperty('--column-count', String(columns.length));
      columns.forEach((child, index) => { const column = document.createElement('section'); column.className = 'modern-column'; const picker = select('', child.type, order.map((type) => [type, definitions[type][0]]), (value) => { columns[index] = create(value); render(); markDirty(); }); picker.classList.add('modern-column-switcher'); column.append(picker, makeBody(child, true)); wrap.append(column); });
      const controls = document.createElement('div'); controls.className = 'modern-columns-controls'; controls.append(tableAction(columns.length < 3 ? '添加列' : '最多三列', () => { if (columns.length < 3) { columns.push(create('paragraph')); render(); markDirty(); } }), tableAction(columns.length > 1 ? '删除末列' : '至少一列', () => { if (columns.length > 1) { columns.pop(); render(); markDirty(); } })); body.append(wrap, controls);
    } else if (block.type === 'details' || block.type === 'collapse') {
      body.append(editable('div', block.summaryHtml || '', 'modern-summary-edit', (el) => { block.summaryHtml = el.innerHTML; }), editable('div', contentFor(block), 'modern-rich-content', (el) => { block.contentHtml = el.innerHTML; }), check('默认展开', block, 'open'));
    } else if (block.type === 'button') {
      const buttons = document.createElement('div'); buttons.className = 'modern-edit-buttons'; (block.buttonsHtml || ['按钮']).forEach((item, index) => buttons.append(editable('span', item, 'modern-button-edit', (el) => { block.buttonsHtml[index] = el.innerHTML; }))); body.append(buttons, field('链接地址', block.href, (value) => { block.href = value; }));
    } else if (block.type === 'code' || block.type === 'math' || block.type === 'pre') {
      const code = editable('pre', escapeHtml(block.content || ''), 'modern-code-edit', (el) => { block.content = el.textContent || ''; }); code.spellcheck = false; body.append(code);
    } else if (block.type === 'spacer') {
      body.append(field('高度（像素）', block.size, (value) => { block.size = Number(value) || 48; }, 'number')); const spacer = document.createElement('div'); spacer.className = 'modern-spacer-edit'; spacer.style.height = `${Math.max(8, Number(block.size) || 48)}px`; body.append(spacer);
    } else if (block.type === 'icon') {
      body.append(editable('span', escapeHtml(block.icon || '✦'), 'modern-icon-edit', (el) => { block.icon = el.textContent || '✦'; }), field('无障碍标签', block.label, (value) => { block.label = value; }));
    } else if (block.type === 'image' || block.type === 'audio' || block.type === 'video') {
      body.append(field('地址', block.src, (value) => { block.src = value; render(); }), field('说明', block.alt, (value) => { block.alt = value; }));
      if (block.src) { const media = document.createElement(block.type === 'image' ? 'img' : block.type); media.src = block.src; if (block.type === 'image') media.alt = block.alt || ''; media.controls = block.type !== 'image'; media.className = 'modern-media-edit'; body.append(media); }
    } else if (block.type === 'custom-html') {
      body.append(editable('div', block.content || '', 'modern-custom-html-edit', (el) => { block.content = el.innerHTML; }));
    }
    if (block.type === 'heading') body.append(select('层级', block.level || 2, [['1', 'H1'], ['2', 'H2'], ['3', 'H3'], ['4', 'H4']], (value) => { block.level = Number(value); render(); }));
    if (block.type === 'list') body.append(select('样式', block.ordered ? 'true' : 'false', [['false', '无序'], ['true', '有序']], (value) => { block.ordered = value === 'true'; render(); }));
    return body;
  }
  function check(label, block, key) { const wrap = document.createElement('label'); wrap.className = 'modern-check'; const input = document.createElement('input'); input.type = 'checkbox'; input.checked = Boolean(block[key]); const mark = document.createElement('span'); mark.className = 'modern-checkmark'; mark.textContent = '✓'; input.addEventListener('change', () => { block[key] = input.checked; markDirty(); }); wrap.append(input, mark, document.createTextNode(label)); return wrap; }
  function select(label, value, options, onChange) { const wrap = document.createElement('label'); wrap.className = 'modern-meta-field'; wrap.append(document.createTextNode(label)); const input = document.createElement('select'); options.forEach(([v, text]) => input.add(new Option(text, v, false, String(value) === v))); input.addEventListener('change', () => { onChange(input.value); markDirty(); }); wrap.append(input); return wrap; }
  function create(type) { return normalizeBlock({ type, ...clone(definitions[type]?.[2] || definitions.paragraph[2]) }); }
  function render() {
    doc.innerHTML = '';
    blocks.forEach((block, index) => { const row = document.createElement('article'); row.className = `modern-block modern-block-${block.type}`; const rail = document.createElement('div'); rail.className = 'modern-block-rail'; rail.append(addAction('↑', '上移', () => { if (index) { [blocks[index - 1], blocks[index]] = [blocks[index], blocks[index - 1]]; render(); markDirty(); } }), addAction('↓', '下移', () => { if (index < blocks.length - 1) { [blocks[index + 1], blocks[index]] = [blocks[index], blocks[index + 1]]; render(); markDirty(); } }), addAction('×', '删除', () => { blocks.splice(index, 1); render(); markDirty(); })); row.append(rail, makeBody(block)); doc.append(row); }); sync();
  }
  function add(type) { blocks.push(create(type)); render(); markDirty(); setTimeout(() => doc.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0); }
  const toolbar = page.querySelector('[data-block-toolbar]'); order.forEach((type) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = definitions[type][0]; button.title = definitions[type][1]; button.addEventListener('click', () => add(type)); toolbar.append(button); });
  page.querySelector('[data-add-paragraph]').addEventListener('click', () => add('paragraph'));
  title.addEventListener('input', () => { page.querySelector('[data-summary-title]').textContent = title.value || '未命名文章'; markDirty(); });

  const formatBar = document.createElement('div'); formatBar.className = 'modern-format-bar'; formatBar.setAttribute('role', 'toolbar'); formatBar.innerHTML = '<button type="button" data-cmd="bold" title="加粗"><b>B</b></button><button type="button" data-cmd="italic" title="斜体"><i>I</i></button><button type="button" data-cmd="underline" title="下划线"><u>U</u></button><button type="button" data-cmd="underlineWave" title="波浪线">〰</button><button type="button" data-cmd="strikeThrough" title="删除线"><s>S</s></button><button type="button" data-cmd="fontSmaller" title="字体变小">A−</button><button type="button" data-cmd="fontLarger" title="字体变大">A+</button><label title="文字颜色">A<input type="color" data-color="foreColor" value="#17201c"></label><label title="背景颜色">▰<input type="color" data-color="backColor" value="#fff2a8"></label>';
  document.body.append(formatBar);
  function editableSelection() { const selection = window.getSelection(); return selection?.rangeCount && selection.anchorNode && page.contains(selection.anchorNode) ? selection : null; }
  function positionFormatBar() {
    if (!savedSelection) return;
    const rect = savedSelection.getBoundingClientRect();
    const width = formatBar.offsetWidth;
    const height = formatBar.offsetHeight;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + (rect.width / 2) - (width / 2)));
    let top = rect.top - height - 10;
    if (top < 8) top = rect.bottom + 10;
    if (top + height > window.innerHeight - 8) top = Math.max(8, window.innerHeight - height - 8);
    formatBar.style.left = `${left}px`;
    formatBar.style.top = `${top}px`;
  }
  document.addEventListener('selectionchange', () => {
    const selection = editableSelection();
    const parent = selection?.anchorNode?.parentElement?.closest('.modern-rich-editable');
    const toolbarFocused = formatBar.contains(document.activeElement);
    if (!selection || selection.isCollapsed || !parent) { if (!toolbarFocused) formatBar.classList.remove('is-visible'); return; }
    savedSelection = selection.getRangeAt(0).cloneRange();
    savedEditor = parent;
    formatBar.classList.add('is-visible');
    requestAnimationFrame(positionFormatBar);
  });
  window.addEventListener('resize', positionFormatBar);
  window.addEventListener('scroll', positionFormatBar, true);
  formatBar.addEventListener('mousedown', (event) => { if (event.target instanceof Element && event.target.closest('button')) event.preventDefault(); });
  function normalizeInlineMarkup(root) {
    const sizeMap = { '1': '10px', '2': '12px', '3': '14px', '4': '16px', '5': '18px', '6': '24px', '7': '32px' };
    root.querySelectorAll('font[color],font[size],font[style]').forEach((font) => {
      const span = document.createElement('span');
      if (font.getAttribute('color')) span.style.color = font.getAttribute('color');
      if (font.getAttribute('size')) span.style.fontSize = sizeMap[font.getAttribute('size')] || '16px';
      if (font.getAttribute('style')) span.setAttribute('style', font.getAttribute('style'));
      span.innerHTML = font.innerHTML;
      font.replaceWith(span);
    });
  }
  function applyWave() { if (!savedSelection) return; const span = document.createElement('span'); span.style.textDecorationLine = 'underline'; span.style.textDecorationStyle = 'wavy'; span.append(savedSelection.extractContents()); savedSelection.insertNode(span); }
  function applyRelativeFontSize(delta) {
    if (!savedSelection || !savedEditor) return;
    const start = savedSelection.startContainer.nodeType === Node.ELEMENT_NODE ? savedSelection.startContainer : savedSelection.startContainer.parentElement;
    const current = start ? parseFloat(getComputedStyle(start).fontSize) || 16 : 16;
    const next = Math.max(10, Math.min(48, current + delta));
    const startCell = savedSelection.startContainer.parentElement?.closest('td,th');
    const endCell = savedSelection.endContainer.parentElement?.closest('td,th');
    // A table selection can cross cell boundaries; let the browser split those text nodes.
    if (savedEditor.matches('table') && startCell && endCell && startCell !== endCell) {
      const sizes = [10, 12, 14, 16, 18, 24, 32];
      const targetIndex = sizes.findIndex((size) => size >= next);
      const commandIndex = targetIndex === -1 ? sizes.length : targetIndex + 1;
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(savedSelection);
      document.execCommand('fontSize', false, String(commandIndex));
      normalizeInlineMarkup(savedEditor);
      return;
    }
    const fragment = savedSelection.extractContents();
    fragment.querySelectorAll('[style]').forEach((element) => element.style.removeProperty('font-size'));
    fragment.querySelectorAll('font[size]').forEach((element) => element.removeAttribute('size'));
    const span = document.createElement('span');
    span.style.fontSize = `${next}px`;
    span.append(fragment);
    savedSelection.insertNode(span);
    const selection = window.getSelection();
    const nextRange = document.createRange();
    nextRange.selectNodeContents(span);
    selection.removeAllRanges(); selection.addRange(nextRange);
    savedSelection = nextRange.cloneRange();
  }
  function applyFormat(command, value) {
    if (!savedSelection || !savedEditor) return;
    const selection = window.getSelection();
    selection.removeAllRanges(); selection.addRange(savedSelection);
    if (command === 'fontSmaller') applyRelativeFontSize(-2);
    else if (command === 'fontLarger') applyRelativeFontSize(2);
    else if (command === 'underlineWave') applyWave();
    else if (command === 'backColor' && !document.execCommand(command, false, value)) document.execCommand('hiliteColor', false, value);
    else document.execCommand(command, false, value);
    normalizeInlineMarkup(savedEditor);
    savedEditor.dispatchEvent(new Event('input', { bubbles: true }));
    markDirty();
    formatBar.classList.add('is-visible');
    requestAnimationFrame(positionFormatBar);
  }
  formatBar.querySelectorAll('[data-cmd]').forEach((button) => button.addEventListener('click', () => applyFormat(button.dataset.cmd)));
  formatBar.querySelectorAll('[data-color]').forEach((input) => input.addEventListener('input', () => applyFormat(input.dataset.color, input.value)));

  function submit(nextStatus) {
    sync(); status.value = nextStatus; dirty = false;
    localStorage.setItem(storageKey, JSON.stringify({ at: Date.now(), fingerprint: fingerprint(), title: title.value, blocks }));
    if (isNew) { try { sessionStorage.setItem(pendingNewKey, storageKey); } catch {} }
    form.submit();
  }
  page.querySelector('[data-save-draft]').addEventListener('click', () => submit('draft'));
  const drawer = page.querySelector('[data-publish-drawer]'); const backdrop = page.querySelector('.modern-drawer-backdrop');
  function openDrawer() { page.querySelector('[data-summary-title]').textContent = title.value || '未命名文章'; const labels = { draft: '草稿', published: '已发布', archived: '已归档' }; page.querySelector('[data-summary-status]').textContent = labels[status.value] || status.value; drawer.classList.add('is-open'); backdrop.classList.add('is-open'); }
  function closeDrawer() { drawer.classList.remove('is-open'); backdrop.classList.remove('is-open'); }
  page.querySelector('[data-open-publish]').addEventListener('click', openDrawer); page.querySelectorAll('[data-close-publish]').forEach((el) => el.addEventListener('click', closeDrawer)); page.querySelector('[data-confirm-publish]').addEventListener('click', () => submit('published'));
  const scheduled = page.querySelector('[data-schedule-enabled]'); const scheduleTime = page.querySelector('[data-schedule-time]'); scheduled.addEventListener('change', () => { scheduleTime.disabled = !scheduled.checked; });

  const params = new URLSearchParams(window.location.search);
  if (!isNew && params.get('saved') === '1') {
    try { const pending = sessionStorage.getItem(pendingNewKey); if (pending) localStorage.removeItem(pending); sessionStorage.removeItem(pendingNewKey); sessionStorage.removeItem(activeNewKey); localStorage.removeItem(storageKey); } catch {}
  } else if (!isNew) {
    const local = localStorage.getItem(storageKey);
    if (local) { try { const saved = JSON.parse(local); if (saved.fingerprint === fingerprint()) localStorage.removeItem(storageKey); else if (saved.at > Number(page.dataset.cloudSavedAt || 0) && Array.isArray(saved.blocks) && confirm('发现一份更新的本地草稿，是否恢复？')) { blocks = saved.blocks.map(normalizeBlock); if (saved.title) title.value = saved.title; render(); } } catch {} }
  }
  setInterval(() => { if (dirty) { sync(); localStorage.setItem(storageKey, JSON.stringify({ at: Date.now(), fingerprint: fingerprint(), title: title.value, blocks })); saveStatus.textContent = '已保存到本地'; } }, 30000);
  window.addEventListener('beforeunload', (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  window.LinearPressModernEditor = { registerBlock(type, definition) { definitions[type] = [definition.label || type, definition.description || '扩展区块', definition.defaults || { contentHtml: '' }]; if (!order.includes(type)) order.push(type); const button = document.createElement('button'); button.type = 'button'; button.textContent = definitions[type][0]; button.addEventListener('click', () => add(type)); toolbar.append(button); render(); }, getBlocks: () => clone(blocks), setBlocks(next) { blocks = Array.isArray(next) ? next.map(normalizeBlock) : []; render(); markDirty(); } };
  render();
})();
