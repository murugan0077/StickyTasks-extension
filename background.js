/* MV3 service worker. All credentials live in chrome.storage.local and are never logged. */
'use strict';
importScripts('sender.js');
const ALARM_NAME = 'stickytasks-daily-reminder';

function storageGet(keys) {
  return new Promise((resolve, reject) => chrome.storage.local.get(keys, data => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message)); else resolve(data);
  }));
}
function storageSet(data) {
  return new Promise((resolve, reject) => chrome.storage.local.set(data, () => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message)); else resolve();
  }));
}
const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function scheduledDateTime(time, base = new Date()) {
  const [hours, minutes] = /^\d{2}:\d{2}$/.test(time || '') ? time.split(':').map(Number) : [9, 0];
  const target = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0);
  if (target <= base) target.setDate(target.getDate() + 1);
  return target;
}
async function recreateAlarm() {
  const data = await storageGet('settings');
  const time = data.settings?.reminderTime || '09:00';
  await chrome.alarms.clear(ALARM_NAME);
  // One-shot alarms keep the chosen wall-clock time stable across daylight-saving changes.
  chrome.alarms.create(ALARM_NAME, { when: scheduledDateTime(time).getTime() });
}
async function catchUpIfDue() {
  const data = await storageGet('settings');
  const time = data.settings?.reminderTime || '09:00';
  const [hours, minutes] = /^\d{2}:\d{2}$/.test(time) ? time.split(':').map(Number) : [9, 0];
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes) await sendForToday();
}
async function sendForToday() {
  const [{ settings = {} }, { tasks = [] }, { reminderState = {} }] = await Promise.all([
    storageGet('settings'), storageGet('tasks'), storageGet('reminderState')
  ]);
  const today = dateKey();
  if (reminderState.lastSentDate === today || reminderState.lastAttemptDate === today || !tasks.some(task => !task.completed)) return { skipped: true };
  if (!settings.email || !settings.serviceId || !settings.templateId || !settings.publicKey) {
    await storageSet({ reminderState: { ...reminderState, lastError: 'Reminder settings are incomplete.' } });
    return { error: 'Reminder settings are incomplete.' };
  }
  const pending = tasks.filter(task => !task.completed);
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dateKey(yesterday);
  const completedYesterday = tasks.filter(task => task.completed && task.completedAt && dateKey(new Date(task.completedAt)) === yesterdayKey).length;
  try {
    // Claim the local day before the network request so a concurrent alarm/startup cannot send twice.
    await storageSet({ reminderState: { ...reminderState, lastAttemptDate: today, lastError: '' } });
    await StickySender.sendReminder(settings, pending, completedYesterday, today);
    await storageSet({ reminderState: { ...reminderState, lastSentDate: today, lastAttemptDate: today, lastError: '' } });
    if (settings.desktopNotifications) chrome.notifications.create(`stickytasks-${today}`, { type: 'basic', iconUrl: 'icons/icon128.png', title: 'StickyTasks reminder sent', message: `${pending.length} pending task${pending.length === 1 ? '' : 's'} emailed to you.` });
    return { sent: true };
  } catch (error) {
    await storageSet({ reminderState: { ...reminderState, lastAttemptDate: today, lastError: String(error?.message || 'Network error').slice(0, 250) } });
    return { error: 'Email could not be sent. Check your connection and EmailJS settings.' };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['settings', 'tasks'], data => {
    if (!data.settings) chrome.storage.local.set({ settings: { email: '', reminderTime: '09:00', serviceId: '', templateId: '', publicKey: '', desktopNotifications: false } });
    if (!Array.isArray(data.tasks)) chrome.storage.local.set({ tasks: [] });
  });
  recreateAlarm().catch(() => {});
  updateBadge();
});
chrome.runtime.onStartup.addListener(() => {
  recreateAlarm().then(catchUpIfDue).catch(() => {});
  updateBadge();
});
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM_NAME) sendForToday().finally(() => recreateAlarm().catch(() => {})); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.settings) recreateAlarm().catch(() => {});
  if (changes.tasks) updateBadge();
});
async function updateBadge() {
  try {
    const { tasks = [] } = await storageGet('tasks');
    const count = tasks.filter(task => !task.completed).length;
    chrome.action.setBadgeText({ text: count ? String(count > 99 ? '99+' : count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#496b57' });
  } catch { /* Badge is a convenience; task data remains intact. */ }
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SEND_TEST_EMAIL') {
    (async () => {
      const [{ settings = {} }, { tasks = [] }] = await Promise.all([storageGet('settings'), storageGet('tasks')]);
      const pending = tasks.filter(task => !task.completed);
      if (!pending.length) throw new Error('Add at least one pending task before sending a test email.');
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const completedYesterday = tasks.filter(task => task.completed && task.completedAt && dateKey(new Date(task.completedAt)) === dateKey(yesterday)).length;
      // Test send bypasses the daily de-duplication record.
      if (!settings.email || !settings.serviceId || !settings.templateId || !settings.publicKey) throw new Error('Complete the EmailJS settings first.');
      await StickySender.sendReminder(settings, pending, completedYesterday, dateKey());
      return { ok: true, message: 'Test email sent successfully.' };
    })().then(sendResponse).catch(error => sendResponse({ ok: false, message: error.message || 'Could not send test email. Check your connection.' }));
    return true;
  }
  if (message?.type === 'SEND_DAILY_REMINDER') {
    sendForToday().then(sendResponse).catch(() => sendResponse({ error: 'Could not send the reminder.' }));
    return true;
  }
});
