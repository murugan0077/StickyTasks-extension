(() => {
  'use strict';
  const S = window.StickyStorage;
  const $ = id => document.getElementById(id);
  const status = (message, kind = 'info') => { const el = $('status-message'); el.textContent = message; el.dataset.kind = kind; };
  async function load() {
    const [settings, data] = await Promise.all([S.getSettings(), S.apiGet('reminderState')]);
    $('email').value = settings.email || '';
    $('reminder-time').value = settings.reminderTime || '09:00';
    $('service-id').value = settings.serviceId || '';
    $('template-id').value = settings.templateId || '';
    $('public-key').value = settings.publicKey || '';
    $('desktop-notifications').checked = Boolean(settings.desktopNotifications);
    const state = data.reminderState || {};
    if (state.lastError) status(`Last reminder issue: ${state.lastError}`, 'error');
    else if (state.lastSentDate) status(`Last reminder sent ${state.lastSentDate}.`, 'success');
  }
  document.addEventListener('DOMContentLoaded', () => {
    load().catch(() => status('Could not load settings. Reload the extension and try again.', 'error'));
    $('settings-form').addEventListener('submit', async event => {
      event.preventDefault();
      const settings = { email: $('email').value.trim(), reminderTime: $('reminder-time').value || '09:00', serviceId: $('service-id').value.trim(), templateId: $('template-id').value.trim(), publicKey: $('public-key').value.trim(), desktopNotifications: $('desktop-notifications').checked };
      if (!settings.email || !settings.serviceId || !settings.templateId || !settings.publicKey) { status('Fill in your email address and all three EmailJS values.', 'error'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.email)) { status('Enter a valid email address.', 'error'); return; }
      if (!/^\d{2}:\d{2}$/.test(settings.reminderTime)) { status('Choose a valid reminder time.', 'error'); return; }
      try { await S.saveSettings(settings); status('Settings saved. Your daily alarm has been updated.', 'success'); }
      catch { status('Could not save settings. Check available browser storage and try again.', 'error'); }
    });
    $('show-key').addEventListener('change', event => { $('public-key').type = event.target.checked ? 'text' : 'password'; });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.reminderState) return;
      const state = changes.reminderState.newValue || {};
      if (state.lastError) status(`Last reminder issue: ${state.lastError}`, 'error');
      else if (state.lastSentDate) status(`Last reminder sent ${state.lastSentDate}.`, 'success');
    });
    $('test-email').addEventListener('click', async event => {
      const button = event.currentTarget; button.disabled = true; status('Sending test email…');
      try {
        const response = await chrome.runtime.sendMessage({ type: 'SEND_TEST_EMAIL' });
        status(response?.message || 'Could not send test email. Check your connection and settings.', response?.ok ? 'success' : 'error');
      } catch { status('Could not reach the extension service worker. Reload the extension and try again.', 'error'); }
      finally { button.disabled = false; }
    });
  });
})();
