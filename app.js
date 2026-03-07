const STORAGE_KEY = 'consor-todos';

let todos = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let filter = 'all';

const form = document.getElementById('addForm');
const input = document.getElementById('todoInput');
const list = document.getElementById('todoList');
const countEl = document.getElementById('count');
const clearDoneBtn = document.getElementById('clearDone');
const emptyState = document.getElementById('emptyState');

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  render();
}

function render() {
  const filtered = todos.filter((t) => {
    if (filter === 'active') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });

  list.innerHTML = '';
  filtered.forEach((todo) => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.done ? ' done' : '');
    li.dataset.id = todo.id;
    li.innerHTML = `
      <button type="button" class="todo-check" aria-label="${todo.done ? '未完了にする' : '完了にする'}"></button>
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <button type="button" class="todo-delete" aria-label="削除">×</button>
    `;
    li.querySelector('.todo-check').addEventListener('click', () => toggle(todo.id));
    li.querySelector('.todo-delete').addEventListener('click', () => remove(todo.id));
    list.appendChild(li);
  });

  const activeCount = todos.filter((t) => !t.done).length;
  countEl.textContent = `${activeCount} 件のタスク`;
  emptyState.classList.toggle('hidden', filtered.length > 0);

  document.querySelectorAll('.filter').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function add(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  todos.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2),
    text: trimmed,
    done: false,
  });
  save();
}

function toggle(id) {
  const t = todos.find((x) => x.id === id);
  if (t) t.done = !t.done;
  save();
}

function remove(id) {
  todos = todos.filter((t) => t.id !== id);
  save();
}

function clearDone() {
  todos = todos.filter((t) => !t.done);
  save();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  add(input.value);
  input.value = '';
  input.focus();
});

clearDoneBtn.addEventListener('click', clearDone);

document.querySelectorAll('.filter').forEach((btn) => {
  btn.addEventListener('click', () => {
    filter = btn.dataset.filter;
    render();
  });
});

render();
