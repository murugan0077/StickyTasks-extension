(() => {
  'use strict';
  const S = window.StickyStorage;
  const COLORS = ['yellow', 'pink', 'green', 'blue', 'orange'];
  const PRIORITIES = ['low', 'medium', 'high'];
  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function orderTasks(tasks) { return [...tasks].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0)); }
  function completionLabel(task) {
    if (!task.completedAt) return '';
    const date = new Date(task.completedAt);
    return Number.isNaN(date.getTime()) ? '' : `Pinned ${date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
  }
  function toast(message, kind = 'info') {
    const region = byId('status-message');
    if (region) { region.textContent = message; region.dataset.kind = kind; }
  }
  function taskCard(task, index, compact = false) {
    const escaped = escapeHtml(task.text);
    const done = Boolean(task.completed);
    const due = task.dueDate ? `<div class="note-meta">Due <time datetime="${escapeHtml(task.dueDate)}">${escapeHtml(task.dueDate)}</time>${!done && task.dueDate < S.localDateKey() ? ' <span class="overdue-tag">Overdue</span>' : ''}</div>` : '';
    const rotation = Number.isFinite(Number(task.rotation)) ? Number(task.rotation) : 0;
    return `<article class="note ${escapeHtml(task.color || 'yellow')}${done ? ' completed' : ''}" data-id="${escapeHtml(task.id)}" draggable="true" style="--rotation:${rotation}deg" aria-label="${done ? 'Completed task' : 'Task'}, ${escaped}">
      <div class="note-toolbar">
        <label class="complete-control" title="${done ? 'Mark pending' : 'Mark complete'}"><input class="complete-checkbox" type="checkbox" ${done ? 'checked' : ''} aria-label="${done ? 'Mark task pending' : 'Mark task complete'}: ${escaped}"><span aria-hidden="true">${done ? '✓' : ''}</span></label>
        <select class="note-color" aria-label="Note colour for ${escaped}" title="Change note colour">${COLORS.map(color => `<option value="${color}" ${task.color === color ? 'selected' : ''}>${color[0].toUpperCase() + color.slice(1)}</option>`).join('')}</select>
        <button class="icon-button delete-task" type="button" aria-label="Delete task: ${escaped}" title="Delete task">×</button>
      </div>
      <div class="note-content" contenteditable="true" role="textbox" aria-label="Edit task" aria-multiline="true" spellcheck="true">${escaped}</div>
      ${due}
      <div class="note-fields"><label>Priority <select class="note-priority" aria-label="Priority for ${escaped}">${PRIORITIES.map(value => `<option value="${value}" ${task.priority === value ? 'selected' : ''}>${value[0].toUpperCase() + value.slice(1)}</option>`).join('')}</select></label><label class="due-label">Due <input class="note-due" type="date" value="${escapeHtml(task.dueDate || '')}" aria-label="Due date for ${escaped}"></label></div>
      ${done ? `<div class="completed-stamp"><span aria-hidden="true">📌</span> ${escapeHtml(completionLabel(task))}</div>` : ''}
      ${compact ? '' : `<div class="note-order"><button type="button" class="move-task" data-direction="-1" aria-label="Move task up" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" class="move-task" data-direction="1" aria-label="Move task down">↓</button><span class="drag-hint" aria-hidden="true">⠿</span></div>`}
    </article>`;
  }
  async function saveOne(id, updates) {
    const tasks = await S.getTasks();
    const index = tasks.findIndex(task => task.id === id);
    if (index < 0) return;
    tasks[index] = { ...tasks[index], ...updates };
    await S.saveTasks(tasks);
  }
  function mountTaskBoard({ compact = false } = {}) {
    const container = byId('task-list');
    if (!container) return;
    let activeFilter = 'pending';
    let dragId = null;
    async function render() {
      const tasks = orderTasks(await S.getTasks());
      const visible = tasks.filter(task => activeFilter === 'all' || (activeFilter === 'pending' ? !task.completed : task.completed));
      container.innerHTML = visible.map(task => taskCard(task, tasks.findIndex(item => item.id === task.id), compact)).join('');
      const pendingCount = S.pendingTasks(tasks).length;
      const count = byId('pending-count');
      if (count) count.textContent = String(pendingCount);
      const empty = byId('empty-state');
      if (empty) { empty.hidden = visible.length > 0; empty.textContent = activeFilter === 'completed' ? 'No completed notes yet.' : 'No tasks here. Add one above to get started.'; }
      container.querySelectorAll('.note').forEach(card => {
        const id = card.dataset.id;
        const edit = card.querySelector('.note-content');
        edit.addEventListener('blur', async () => {
          const text = edit.innerText.trim();
          if (!text) { toast('A task needs some text.', 'error'); await render(); return; }
          if (text !== (await S.getTasks()).find(task => task.id === id)?.text) await saveOne(id, { text });
        });
        edit.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); edit.blur(); } });
        card.querySelector('.complete-checkbox').addEventListener('change', async event => {
          const completed = event.target.checked;
          await saveOne(id, { completed, completedAt: completed ? new Date().toISOString() : null });
          toast(completed ? 'Task pinned as complete.' : 'Task moved back to pending.', 'success'); await render();
        });
        card.querySelector('.delete-task').addEventListener('click', async () => {
          await S.saveTasks((await S.getTasks()).filter(task => task.id !== id)); toast('Task deleted.', 'success'); await render();
        });
        card.querySelector('.note-color').addEventListener('change', event => saveOne(id, { color: event.target.value }).then(render));
        card.querySelector('.note-priority').addEventListener('change', event => saveOne(id, { priority: event.target.value }));
        card.querySelector('.note-due').addEventListener('change', event => saveOne(id, { dueDate: event.target.value }));
        card.querySelectorAll('.move-task').forEach(button => button.addEventListener('click', async () => {
          const current = orderTasks(await S.getTasks()); const from = current.findIndex(task => task.id === id); const to = from + Number(button.dataset.direction);
          if (to < 0 || to >= current.length) return;
          [current[from], current[to]] = [current[to], current[from]]; current.forEach((task, i) => task.order = i); await S.saveTasks(current); await render();
        }));
        card.addEventListener('dragstart', event => { dragId = id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); card.classList.add('dragging'); });
        card.addEventListener('dragend', () => { dragId = null; card.classList.remove('dragging'); });
        card.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; });
        card.addEventListener('drop', async event => {
          event.preventDefault(); const fromId = event.dataTransfer.getData('text/plain') || dragId; if (!fromId || fromId === id) return;
          const current = orderTasks(await S.getTasks()); const from = current.findIndex(task => task.id === fromId); const to = current.findIndex(task => task.id === id);
          const [moved] = current.splice(from, 1); current.splice(to, 0, moved); current.forEach((task, i) => task.order = i); await S.saveTasks(current); await render();
        });
      });
    }
    const form = byId('add-task-form');
    if (form) form.addEventListener('submit', async event => {
      event.preventDefault(); const input = byId('new-task'); const text = input.value.trim(); if (!text) return;
      const tasks = await S.getTasks(); const color = byId('new-color')?.value || 'yellow';
      tasks.push({ id: crypto.randomUUID(), text, color, priority: 'medium', dueDate: '', completed: false, createdAt: new Date().toISOString(), completedAt: null, order: tasks.reduce((max, item) => Math.max(max, Number(item.order) || 0), -1) + 1, rotation: Math.round((Math.random() * 5 - 2.5) * 10) / 10 });
      await S.saveTasks(tasks); input.value = ''; await render(); input.focus();
    });
    document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
      activeFilter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); }); render();
    }));
    const clear = byId('clear-completed');
    if (clear) clear.addEventListener('click', async () => {
      const tasks = await S.getTasks(); const completed = tasks.filter(task => task.completed);
      if (!completed.length) { toast('There are no completed tasks to clear.'); return; }
      if (!confirm(`Permanently delete ${completed.length} completed ${completed.length === 1 ? 'task' : 'tasks'}?`)) return;
      await S.saveTasks(tasks.filter(task => !task.completed)); toast('Completed tasks cleared.', 'success'); await render();
    });
    chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.tasks) render(); });
    render();
    return render;
  }
  window.StickyUI = { mountTaskBoard, toast, byId, escapeHtml };
})();
