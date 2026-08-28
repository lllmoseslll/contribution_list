import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/budget-service';
import { getTransporter } from '@/lib/mailer';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const settings = getSettings();
  const { recipientEmail } = await req.json().catch(() => ({}));
  const targetEmail = recipientEmail || settings.ownerEmail;

  if (!targetEmail) {
    return NextResponse.json({
      error: 'No recipient address. Set one in Settings before sending a test.'
    }, { status: 400 });
  }

  const transporter = getTransporter(settings);
  if (!transporter) {
    return NextResponse.json({
      error: 'SMTP is not enabled or credentials (user/password) are empty in settings.'
    }, { status: 400 });
  }

  try {
    const info = await transporter.sendMail({
      from: settings.smtp.from || `Edwin & Jamirah Kwanjula <${settings.smtp.user}>`,
      to: targetEmail,
      subject: 'Test Notification: Kwanjula Budget Portal',
      html: `
        <div style="font-family:sans-serif; padding:20px; background:#f0fdf4; border:1px solid #86efac; border-radius:8px;">
          <h2 style="color:#166534; margin-top:0;">Test Email Successful!</h2>
          <p>This is a test notification from the Kwanjula Contribution Portal for Mr. Edwin Laston &amp; Jamirah Nakayemba.</p>
          <p>Your SMTP configuration is active and working properly.</p>
          <hr style="border:none; border-top:1px solid #bbf7d0; margin:15px 0;">
          <small style="color:#64748b;">Sent at: ${new Date().toLocaleString()}</small>
        </div>
      `
    });

    return NextResponse.json({ success: true, message: `Test email sent to ${targetEmail}! Message ID: ${info.messageId}` });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to send test email: ' + err.message }, { status: 500 });
  }
}
