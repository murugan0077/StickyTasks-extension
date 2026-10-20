# StickyTasks

StickyTasks is a no-build Chrome and Brave Manifest V3 extension. It stores task notes and settings in `chrome.storage.local`, and uses EmailJS to send a daily reminder from the extension service worker.

## EmailJS setup

1. Create an account at [EmailJS](https://www.emailjs.com/) and verify the account.
2. In **Email Services**, add and connect an email service. Copy its **Service ID**.
3. In **Email Templates**, create a template. Set the **To Email** field to `{{to_email}}`. A useful subject is `Your StickyTasks reminder for {{date}}`.
4. Use this template body:

   ```text
   Here are your pending tasks for {{date}}:

   {{task_list}}

   Tasks completed yesterday: {{completed_yesterday}}
   Pending task count: {{pending_count}}
   ```

   Save the template and copy its **Template ID**. The task list marks overdue tasks with `OVERDUE`.
5. In EmailJS **Account** settings, find the **Public Key** (sometimes shown as the public key in the API keys section).
6. Open the StickyTasks extension's **Settings** page. Paste the recipient email, Service ID, Template ID, and Public Key into their matching fields, choose a local reminder time, and click **Save settings**. Use **Send test email** to confirm the template and service work.
7. In the EmailJS service/template security settings, configure a sending limit and restrict allowed origins when possible. The public key is intended for client-side use; do not put a private key in this extension.

## Install in Chrome

1. Download or clone this folder and keep its files together.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select this folder (the one containing `manifest.json`).
5. Pin StickyTasks from the extensions menu, then open its popup. Use **Open full board** for the larger board and the gear icon for settings.

## Install in Brave

1. Open `brave://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Pin and open StickyTasks. Its popup, board, and settings work the same way as in Chrome.

## Testing checklist

- Add a task from the popup and from the full board; try each note colour, inline editing, due date, and priority.
- Complete a task, check that it stays faded with a pin and completion timestamp, then uncheck it to undo completion. Try Pending, Completed, and All filters, drag/drop or the arrow buttons, and Clear completed confirmation.
- Save EmailJS settings and send a test email. Confirm the overdue marker, priority ordering, and yesterday's completion count in the message.
- To test an alarm in about one minute, open `background.js` from `chrome://extensions` or `brave://extensions` → StickyTasks → **Service worker / Inspect**. In the service worker DevTools console run:

  ```js
  chrome.alarms.create('stickytasks-daily-reminder', { when: Date.now() + 60_000 });
  ```

  Keep the browser open and confirm the reminder arrives. This is a temporary test alarm; saving settings or restarting the browser recreates the configured daily alarm. If the test task is the only pending task, the test alarm sends the daily email and marks today as sent, so it will not send a second reminder that day.
- Close and reopen the browser after the configured reminder time to check the startup catch-up behaviour. With at least one pending task, StickyTasks attempts that day's reminder at startup and records a successful send so it cannot send twice that day.

## Limitations and next steps

- Chrome/Brave alarms run only while the browser is running. If the browser is closed at reminder time, StickyTasks attempts the reminder the next time the browser starts. It skips days with no pending tasks and de-duplicates successful reminders by local calendar day.
- EmailJS free-plan quotas and limits can change; check the current plan and dashboard before relying on daily delivery. Delivery also depends on the configured email service, template, network, and provider policies.
- The EmailJS public key and IDs are stored in this browser profile's local extension storage. Anyone with access to the profile can inspect them. No secret/private EmailJS key is used.
- A future backend could keep provider secrets server-side, schedule messages independently of the browser, and expose authenticated task sync across devices. That requires a hosted API, account/authentication design, and server-side scheduler.
