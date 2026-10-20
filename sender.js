/* Email provider adapter: swap this module to add another provider later. */
(() => {
  'use strict';
  async function sendReminder(settings, tasks, completedYesterday, dateLabel) {
    const missing = [];
    if (!settings.email) missing.push('your email address');
    if (!settings.serviceId) missing.push('EmailJS service ID');
    if (!settings.templateId) missing.push('EmailJS template ID');
    if (!settings.publicKey) missing.push('EmailJS public key');
    if (missing.length) throw new Error(`Add ${missing.join(', ')} in Settings before sending.`);

    const ordered = [...tasks].sort((a, b) => {
      const priority = { high: 0, medium: 1, low: 2 };
      const byPriority = (priority[a.priority] ?? 1) - (priority[b.priority] ?? 1);
      if (byPriority) return byPriority;
      const overdueA = a.dueDate && a.dueDate < dateLabel ? 0 : 1;
      const overdueB = b.dueDate && b.dueDate < dateLabel ? 0 : 1;
      return overdueA - overdueB || (Number(a.order) || 0) - (Number(b.order) || 0);
    });
    const taskList = ordered.map(task => {
      const overdue = task.dueDate && task.dueDate < dateLabel;
      const due = task.dueDate ? ` · due ${task.dueDate}${overdue ? ' · OVERDUE' : ''}` : '';
      return `• [${String(task.priority || 'medium').toUpperCase()}] ${task.text}${due}`;
    }).join('\n');
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: settings.serviceId,
        template_id: settings.templateId,
        user_id: settings.publicKey,
        template_params: {
          to_email: settings.email,
          task_list: taskList,
          completed_yesterday: String(completedYesterday),
          date: dateLabel,
          pending_count: String(ordered.length)
        }
      })
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`EmailJS could not send the email (HTTP ${response.status}). ${body.slice(0, 180) || 'Check your service and template settings.'}`);
    }
  }
  globalThis.StickySender = { sendReminder };
})();
