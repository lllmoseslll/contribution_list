import { NextResponse } from 'next/server';
import { getSettings, addNotification } from '@/lib/budget-service';
import { getTransporter } from '@/lib/mailer';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const settings = await getSettings();
  const { recipientEmail } = await req.json().catch(() => ({}));
  const targetEmail = recipientEmail || settings.notifyEmail || settings.ownerEmail || 'edwinlaston@gmail.com';

  if (!targetEmail) {
    return NextResponse.json({
      error: 'Please enter a recipient email address to send the test to.'
    }, { status: 400 });
  }

  const transporter = getTransporter(settings);
  if (!transporter) {
    return NextResponse.json({
      error: 'SMTP credentials are not active or configured.'
    }, { status: 400 });
  }

  const fromAddress = settings.smtp?.from || process.env.SMTP_FROM || `Edwin & Jamirah Kwanjula <${process.env.SMTP_USER || 'noreply@edwinlaston.org'}>`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f7faf8; color: #1e293b; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #065f46 0%, #047857 100%); color: #ffffff; padding: 24px 20px; text-align: center; }
        .badge { display: inline-block; background: #4ade80; color: #14532d; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 12px; margin-top: 10px; }
        .content { padding: 24px 20px; }
        .success-box { background: #ecfdf5; border: 2px dashed #10b981; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 20px; }
        .footer { background: #f8fafc; padding: 16px 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin:0 0 6px 0; font-size:22px;">⚡ Live Email Notification Test</h1>
          <p style="margin:0; opacity:0.9; font-size:14px;">Mr. Edwin Laston & Jamirah Nakayemba • 27 Nov 2026</p>
          <div class="badge">SYSTEM VERIFICATION OK</div>
        </div>
        <div class="content">
          <div class="success-box">
            <h3 style="color:#065f46; margin:0 0 8px 0; font-size:18px;">✅ Live Email Alerts Are Working!</h3>
            <p style="color:#047857; margin:0; font-size:14px;">
              This test confirms that your Kwanjula portal can instantly send email notifications to <strong>${targetEmail}</strong> whenever someone makes a pledge.
            </p>
          </div>
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="padding:8px 0; color:#64748b; font-size:13px;">Target Inbox:</td>
              <td style="padding:8px 0; font-weight:700; color:#0f172a; font-size:13px;">${targetEmail}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:#64748b; font-size:13px;">Dispatched At:</td>
              <td style="padding:8px 0; font-weight:700; color:#0f172a; font-size:13px;">${new Date().toLocaleString('en-UG', { timeZone: 'Africa/Kampala' })}</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:#64748b; font-size:13px;">Database Status:</td>
              <td style="padding:8px 0; font-weight:700; color:#16a34a; font-size:13px;">🟢 Active & Live Synced</td>
            </tr>
          </table>
        </div>
        <div class="footer">
          Kwanjula Contribution Portal • Edwin & Jamirah Wedding Committee
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from: fromAddress,
      to: targetEmail,
      subject: `⚡ Test Notification: Kwanjula Email Alerts Active`,
      html: htmlBody
    });

    // Record notification in database
    await addNotification({
      type: 'test_alert',
      recipient: targetEmail,
      recipientName: settings.ownerName || 'Committee Admin',
      pledgerName: 'Admin System Test',
      amount: null,
      item: 'Live Email Alert Test',
      status: 'sent',
      error: null,
      htmlPreview: htmlBody
    }).catch(err => console.warn('Could not record test notif:', err.message));

    return NextResponse.json({
      success: true,
      message: `Test email successfully dispatched to ${targetEmail}! Check your inbox.`,
      messageId: info.messageId,
      recipient: targetEmail
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to send test email: ' + err.message }, { status: 500 });
  }
}
