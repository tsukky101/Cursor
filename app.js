const STORAGE_KEY = 'consor-todos';
const LEGACY_STORAGE_KEY = 'todo-app-data';
const THEME_KEY = 'todo-app-theme';
const GIST_TOKEN_KEY = 'todo-app-gist-token';
const GIST_ID_KEY = 'todo-app-gist-id';
const GIST_FILE_NAME = 'todo.json';

const form = document.getElementById('addForm');
const input = document.getElementById('todoInput');
const prioritySelect = document.getElementById('prioritySelect');
const dueDateInput = document.getElementById('dueDateInput');
const assigneeInput = document.getElementById('assigneeInput');
const list = document.getElementById('todoList');
const countEl = document.getElementById('count');
const clearBtn = document.getElementById('clearCompleted');
const themeToggle = document.getElementById('themeToggle');
const exportBtn = document.getElementById('exportBtn');
const importInput = document.getElementById('importInput');
const toastEl = document.getElementById('toast');
const githubTokenEl = document.getElementById('githubToken');
const githubSaveTokenEl = document.getElementById('githubSaveToken');
const githubGistIdEl = document.getElementById('githubGistId');
const githubSaveBtn = document.getElementById('githubSaveBtn');
const githubLoadBtn = document.getElementById('githubLoadBtn');
const githubGistLinkEl = document.getElementById('githubGistLink');

let todos = loadTodos();
let toastTimer = null;
let currentFilter = 'all';
initTheme();
initGitHubSync();
render();

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const priority = prioritySelect.value || 'medium';
  const dueDate = dueDateInput.value || null;
  const assignee = assigneeInput.value.trim() || null;
  todos.push({
    id: Date.now(),
    text,
    done: false,
    priority,
    dueDate,
    assignee,
  });
  input.value = '';
  dueDateInput.value = '';
  assigneeInput.value = '';
  saveAndRender();
  showToast('保存しました');
});

clearBtn.addEventListener('click', () => {
  todos = todos.filter((t) => !t.done);
  saveAndRender();
  showToast('保存しました');
});

themeToggle.addEventListener('click', () => {
  const html = document.documentElement;
  const isLight = html.getAttribute('data-theme') === 'light';
  html.setAttribute('data-theme', isLight ? 'dark' : 'light');
  localStorage.setItem(THEME_KEY, isLight ? 'dark' : 'light');
});

document.querySelectorAll('.filter-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    currentFilter = tab.dataset.filter;
    document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    render();
  });
});

exportBtn.addEventListener('click', () => {
  const data = JSON.stringify(todos, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `todo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('エクスポートしました');
});

importInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const loaded = JSON.parse(reader.result);
      if (!Array.isArray(loaded)) throw new Error('Invalid format');
      todos = normalizeLoadedTodos(loaded);
      saveAndRender();
      showToast(`${todos.length} 件を読み込みました`);
    } catch {
      showToast('読み込みに失敗しました');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

function initGitHubSync() {
  const savedToken = localStorage.getItem(GIST_TOKEN_KEY);
  const savedGistId = localStorage.getItem(GIST_ID_KEY);
  if (savedToken) {
    githubTokenEl.value = savedToken;
    githubSaveTokenEl.checked = true;
  }
  if (savedGistId) {
    githubGistIdEl.value = savedGistId;
    updateGistLink(savedGistId);
  }
}

function updateGistLink(gistId) {
  if (!gistId) {
    githubGistLinkEl.innerHTML = '';
    return;
  }
  githubGistLinkEl.innerHTML = `共有用Gist: <a href="https://gist.github.com/${gistId}" target="_blank" rel="noopener">${gistId}</a>（別の端末でこのIDを入力）`;
}

function getGitHubToken() {
  const token = (githubTokenEl?.value || '').trim();
  return token || localStorage.getItem(GIST_TOKEN_KEY);
}

async function saveToGitHub() {
  const token = getGitHubToken();
  if (!token) {
    showToast('トークンを入力してください');
    return;
  }
  githubSaveBtn.disabled = true;
  githubLoadBtn.disabled = true;
  try {
    const content = JSON.stringify(todos, null, 2);
    const gistId = (githubGistIdEl?.value || '').trim() || localStorage.getItem(GIST_ID_KEY);
    const url = gistId ? `https://api.github.com/gists/${gistId}` : 'https://api.github.com/gists';
    const body = gistId
      ? { files: { [GIST_FILE_NAME]: { content } } }
      : { files: { [GIST_FILE_NAME]: { content } }, description: 'Todo App Data', public: false };
    const res = await fetch(url, {
      method: gistId ? 'PATCH' : 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const newId = data.id;
    localStorage.setItem(GIST_ID_KEY, newId);
    if (githubGistIdEl) githubGistIdEl.value = newId;
    if (githubSaveTokenEl?.checked) localStorage.setItem(GIST_TOKEN_KEY, token);
    else localStorage.removeItem(GIST_TOKEN_KEY);
    updateGistLink(newId);
    showToast('GitHubに保存しました');
  } catch (e) {
    showToast(e.message || '保存に失敗しました');
  }
  githubSaveBtn.disabled = false;
  githubLoadBtn.disabled = false;
}

async function loadFromGitHub() {
  const token = getGitHubToken();
  const gistId = (githubGistIdEl?.value || '').trim() || localStorage.getItem(GIST_ID_KEY);
  if (!token) {
    showToast('トークンを入力してください');
    return;
  }
  if (!gistId) {
    showToast('Gist IDを入力するか、先に「GitHubに保存」でGistを作成してください');
    return;
  }
  githubSaveBtn.disabled = true;
  githubLoadBtn.disabled = true;
  try {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const file = data.files?.[GIST_FILE_NAME];
    if (!file?.content) throw new Error('todo.json が見つかりません');
    const loaded = JSON.parse(file.content);
    if (!Array.isArray(loaded)) throw new Error('形式が正しくありません');
    todos = normalizeLoadedTodos(loaded);
    saveAndRender();
    if (githubSaveTokenEl?.checked) localStorage.setItem(GIST_TOKEN_KEY, token);
    localStorage.setItem(GIST_ID_KEY, gistId);
    updateGistLink(gistId);
    showToast(`GitHubから ${todos.length} 件読み込みました`);
  } catch (e) {
    showToast(e.message || '読み込みに失敗しました');
  }
  githubSaveBtn.disabled = false;
  githubLoadBtn.disabled = false;
}

function normalizeLoadedTodos(loaded) {
  return loaded.map((t) => ({
    id: t.id ?? Date.now() + Math.random(),
    text: String(t.text ?? ''),
    done: !!t.done,
    priority: t.priority || 'medium',
    dueDate: t.dueDate || null,
    assignee: t.assignee || null,
  }));
}

githubSaveBtn.addEventListener('click', saveToGitHub);
githubLoadBtn.addEventListener('click', loadFromGitHub);

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
}

function loadTodos() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const loaded = data ? JSON.parse(data) : legacy ? JSON.parse(legacy) : [];
    return loaded.map((t) => ({
      id: t.id,
      text: t.text,
      done: !!t.done,
      priority: t.priority || 'medium',
      dueDate: t.dueDate || null,
      assignee: t.assignee || null,
    }));
  } catch {
    return [];
  }
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function saveAndRender() {
  saveTodos();
  render();
}

function showToast(message) {
  if (toastTimer) clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add('visible');
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('visible');
    toastTimer = null;
  }, 2000);
}

function getFilteredTodos() {
  if (currentFilter === 'active') return todos.filter((t) => !t.done);
  if (currentFilter === 'completed') return todos.filter((t) => t.done);
  return [...todos];
}

function formatDueDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}/${m}/${day}`;
}

function isOverdue(iso) {
  if (!iso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(iso + 'T00:00:00');
  return !isNaN(due.getTime()) && due < today;
}

function moveTodo(id, direction) {
  const i = todos.findIndex((t) => t.id === id);
  if (i < 0) return;
  if (direction === 'up' && i > 0) {
    [todos[i - 1], todos[i]] = [todos[i], todos[i - 1]];
    saveAndRender();
    showToast('保存しました');
  }
  if (direction === 'down' && i < todos.length - 1) {
    [todos[i], todos[i + 1]] = [todos[i + 1], todos[i]];
    saveAndRender();
    showToast('保存しました');
  }
}

function startEdit(todo) {
  list.querySelectorAll('.todo-item').forEach((el) => el.classList.remove('editing'));
  const li = list.querySelector(`[data-id="${todo.id}"]`);
  if (!li) return;
  li.classList.add('editing');
  const textInput = li.querySelector('.todo-edit');
  const assigneeInputEl = li.querySelector('.todo-edit-assignee');
  if (textInput) {
    textInput.value = todo.text;
    textInput.focus();
    textInput.select();
  }
  if (assigneeInputEl) assigneeInputEl.value = todo.assignee || '';
}

function finishEdit(id, newText, newAssignee) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  const trimmed = newText.trim();
  if (trimmed) todo.text = trimmed;
  todo.assignee = (newAssignee && newAssignee.trim()) || null;
  list.querySelectorAll('.todo-item').forEach((el) => el.classList.remove('editing'));
  saveAndRender();
  showToast('保存しました');
}

function render() {
  const filtered = getFilteredTodos();
  list.innerHTML = '';

  if (filtered.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    const messages = {
      all: 'タスクがありません。上から追加してください。',
      active: '未完了のタスクはありません。',
      completed: '完了したタスクはありません。',
    };
    empty.textContent = messages[currentFilter];
    list.appendChild(empty);
  } else {
    filtered.forEach((todo) => {
      const li = document.createElement('li');
      li.className = 'todo-item' + (todo.done ? ' done' : '');
      li.dataset.id = todo.id;

      const check = document.createElement('button');
      check.type = 'button';
      check.className = 'todo-check';
      check.setAttribute('aria-label', todo.done ? '未完了にする' : '完了にする');
      check.addEventListener('click', () => {
        todo.done = !todo.done;
        saveAndRender();
      });

      const priorityDot = document.createElement('span');
      priorityDot.className = `priority-dot ${todo.priority}`;
      priorityDot.setAttribute('aria-hidden', 'true');

      const body = document.createElement('div');
      body.className = 'todo-body';

      const textSpan = document.createElement('span');
      textSpan.className = 'todo-text';
      textSpan.textContent = todo.text;
      textSpan.addEventListener('dblclick', () => startEdit(todo));

      const metaRow = document.createElement('div');
      metaRow.className = 'todo-meta';
      const assigneeSpan = document.createElement('span');
      assigneeSpan.className = 'todo-assignee';
      assigneeSpan.textContent = todo.assignee ? `担当: ${todo.assignee}` : '';
      const dueSpan = document.createElement('span');
      dueSpan.className = 'todo-due' + (isOverdue(todo.dueDate) && !todo.done ? ' overdue' : '');
      dueSpan.textContent = todo.dueDate ? (isOverdue(todo.dueDate) && !todo.done ? '⚠ ' : '') + '期限: ' + formatDueDate(todo.dueDate) : '';
      if (todo.assignee) metaRow.appendChild(assigneeSpan);
      if (todo.dueDate) {
        if (todo.assignee) metaRow.appendChild(document.createTextNode(' '));
        metaRow.appendChild(dueSpan);
      }

      const editWrap = document.createElement('div');
      editWrap.className = 'todo-edit-wrap';
      const editInput = document.createElement('input');
      editInput.type = 'text';
      editInput.className = 'todo-edit';
      editInput.value = todo.text;
      editInput.setAttribute('aria-label', 'タスク名を編集');
      editInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finishEdit(todo.id, editInput.value, assigneeEditInput.value);
        if (e.key === 'Escape') {
          editInput.value = todo.text;
          if (assigneeEditInput) assigneeEditInput.value = todo.assignee || '';
          list.querySelectorAll('.todo-item').forEach((el) => el.classList.remove('editing'));
          render();
        }
      });
      const assigneeEditInput = document.createElement('input');
      assigneeEditInput.type = 'text';
      assigneeEditInput.className = 'todo-edit-assignee';
      assigneeEditInput.placeholder = '担当者（任意）';
      assigneeEditInput.value = todo.assignee || '';
      assigneeEditInput.setAttribute('aria-label', '担当者を編集');
      assigneeEditInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') finishEdit(todo.id, editInput.value, assigneeEditInput.value);
      });
      editInput.addEventListener('blur', () => finishEdit(todo.id, editInput.value, assigneeEditInput.value));
      editWrap.appendChild(editInput);
      editWrap.appendChild(assigneeEditInput);

      body.append(textSpan, metaRow, editWrap);

      const actions = document.createElement('div');
      actions.className = 'todo-item-actions todo-actions-edit';

      const btnUp = document.createElement('button');
      btnUp.type = 'button';
      btnUp.className = 'btn-icon';
      btnUp.setAttribute('aria-label', '上へ');
      btnUp.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>';
      btnUp.addEventListener('click', () => moveTodo(todo.id, 'up'));

      const btnDown = document.createElement('button');
      btnDown.type = 'button';
      btnDown.className = 'btn-icon';
      btnDown.setAttribute('aria-label', '下へ');
      btnDown.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
      btnDown.addEventListener('click', () => moveTodo(todo.id, 'down'));

      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.className = 'btn-icon';
      btnEdit.setAttribute('aria-label', '編集');
      btnEdit.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
      btnEdit.addEventListener('click', () => startEdit(todo));

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'btn-icon btn-delete';
      del.setAttribute('aria-label', '削除');
      del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>';
      del.addEventListener('click', () => {
        todos = todos.filter((t) => t.id !== todo.id);
        saveAndRender();
        showToast('保存しました');
      });

      actions.append(btnUp, btnDown, btnEdit, del);
      li.append(check, priorityDot, body, actions);
      list.appendChild(li);
    });
  }

  const activeCount = todos.filter((t) => !t.done).length;
  countEl.textContent = `${activeCount} 件`;
}
