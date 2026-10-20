(() => {
  'use strict';
  const TASKS_KEY = 'tasks';
  const SETTINGS_KEY = 'settings';
  const DEFAULT_SETTINGS = Object.freeze({ email: '', reminderTime: '09:00', serviceId: '', templateId: '', publicKey: '', desktopNotifications: false });

  function apiGet(keys) {
    return new Promise((resolve, reject) => chrome.storage.local.get(keys, value => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message)); else resolve(value);
    }));
  }
  function apiSet(value) {
    return new Promise((resolve, reject) => chrome.storage.local.set(value, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message)); else resolve();
    }));
  }
  function apiRemove(key) {
    return new Promise((resolve, reject) => chrome.storage.local.remove(key, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message)); else resolve();
    }));
  }
  async function getTasks() {
    const data = await apiGet(TASKS_KEY);
    return Array.isArray(data[TASKS_KEY]) ? data[TASKS_KEY] : [];
  }
  async function saveTasks(tasks) { await apiSet({ [TASKS_KEY]: tasks }); }
  async function getSettings() {
    const data = await apiGet(SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(data[SETTINGS_KEY] || {}) };
  }
  async function saveSettings(settings) { await apiSet({ [SETTINGS_KEY]: { ...DEFAULT_SETTINGS, ...settings } }); }
  const localDateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  function pendingTasks(tasks) { return tasks.filter(task => !task.completed); }
  function completedYesterdayCount(tasks, now = new Date()) {
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const key = localDateKey(yesterday);
    return tasks.filter(task => task.completed && task.completedAt && localDateKey(new Date(task.completedAt)) === key).length;
  }
  async function nextOrder() {
    const tasks = await getTasks();
    return tasks.reduce((max, task) => Math.max(max, Number(task.order) || 0), -1) + 1;
  }
  window.StickyStorage = { TASKS_KEY, SETTINGS_KEY, DEFAULT_SETTINGS, apiGet, apiSet, apiRemove, getTasks, saveTasks, getSettings, saveSettings, localDateKey, pendingTasks, completedYesterdayCount, nextOrder };
})();
