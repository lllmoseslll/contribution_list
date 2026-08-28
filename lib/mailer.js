import nodemailer from 'nodemailer';
import { getSettings, addNotification, formatUGX } from './budget-service';

export function getTransporter(settings) {
  const smtp = settings?.smtp || {};

  if (smtp.enabled && smtp.user && smtp.pass) {
    if (smtp.service && smtp.service !== 'custom') {
      return nodemailer.createTransport({
        service: smtp.service,
        auth: {
          user: smtp.user,
          pass: smtp.pass
        }
      });
    }

    return nodemailer.createTransport({
      host: smtp.host || 'smtp.gmail.com',
      port: Number(smtp.port) || 587,
      secure: Boolean(smtp.secure),
      auth: {
        user: smtp.user,
        pass: smtp.pass
      }
    });
  }

  // Fallback to active environment variables if present
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }

  return null;
}

export async function sendPledgeNotifications(pledge, itemInfo, updatedStats, spilloverInfo = null) {
  const settings = await getSettings();

  // Where pledge alerts go. Can be an array of emails or comma-separated string.
  let notifyEmailsList = [];
  if (Array.isArray(settings.notifyEmails) && settings.notifyEmails.length > 0) {
    notifyEmailsList = settings.notifyEmails.map(e => (e || '').trim()).filter(e => e.includes('@'));
  } else if (settings.notifyEmail) {
    notifyEmailsList = settings.notifyEmail.split(',').map(e => (e || '').trim()).filter(e => e.includes('@'));
  } else if (settings.ownerEmail) {
    notifyEmailsList = [settings.ownerEmail.trim()];
  } else if (process.env.OWNER_EMAIL) {
    notifyEmailsList = [process.env.OWNER_EMAIL.trim()];
  }
  const notifyEmail = notifyEmailsList.join(', ') || null;
  const ownerName = settings.ownerName || 'Mr. Edwin Laston';

  const formattedAmount = formatUGX(pledge.amount);
  const itemName = itemInfo ? itemInfo.name : (pledge.itemName || 'General Contribution');
  const sectionName = itemInfo ? itemInfo.sectionTitle : (pledge.sectionTitle || 'Ceremony Budget');
  const itemRemaining = itemInfo ? formatUGX(itemInfo.remainingAmount) : 'N/A';
  const totalRemaining = formatUGX(updatedStats?.totalRemaining || 0);

  const timestampStr = new Date(pledge.date || Date.now()).toLocaleString('en-UG', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Africa/Kampala'
  });

  const ownerEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f7faf8; color: #1e293b; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background: linear-gradient(135deg, #065f46 0%, #047857 100%); color: #ffffff; padding: 24px 20px; text-align: center; }
        .header h1 { margin: 0 0 6px 0; font-size: 22px; }
        .header p { margin: 0; opacity: 0.9; font-size: 14px; }
        .badge { display: inline-block; background: #4ade80; color: #14532d; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 12px; margin-top: 10px; }
        .content { padding: 24px 20px; }
        .amount-box { background: #ecfdf5; border: 2px dashed #10b981; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 20px; }
        .amount-title { font-size: 13px; color: #065f46; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
        .amount-val { font-size: 28px; font-weight: 800; color: #065f46; }
        .celebration-box { background: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 12px 16px; border-radius: 8px; font-weight: 700; font-size: 14px; margin-bottom: 20px; text-align: center; }
        .details-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .details-table td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .details-table td.label { color: #64748b; font-weight: 600; width: 38%; }
        .details-table td.val { color: #0f172a; font-weight: 500; }
        .message-box { background: #f8fafc; border-left: 4px solid #047857; padding: 12px 16px; border-radius: 0 8px 8px 0; margin-bottom: 20px; font-style: italic; font-size: 14px; }
        .footer { background: #f8fafc; padding: 16px 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>💍 New Introduction Pledge Received!</h1>
          <p>Mr. Edwin Laston & Jamirah Nakayemba - 27th Nov 2026</p>
          <div class="badge">REAL-TIME BUDGET UPDATE</div>
        </div>
        <div class="content">
          ${spilloverInfo?.covered100 ? `
            <div class="celebration-box">
              🎉 100% COVERED: <strong>${spilloverInfo.itemName}</strong> is now completely funded!
              ${spilloverInfo.spilloverAmount > 0 ? `<br><span style="font-size:12px; font-weight:600; color:#b45309;">+ ${formatUGX(spilloverInfo.spilloverAmount)} excess automatically added to General Ceremony Fund.</span>` : ''}
            </div>
          ` : ''}

          <div class="amount-box">
            <div class="amount-title">Total Contributed Amount</div>
            <div class="amount-val">${formattedAmount}</div>
          </div>
          <table class="details-table">
            <tr>
              <td class="label">Contributor Name:</td>
              <td class="val"><strong>${pledge.name}</strong></td>
            </tr>
            <tr>
              <td class="label">Phone Number:</td>
              <td class="val"><a href="tel:${pledge.phone}">${pledge.phone || 'Not provided'}</a></td>
            </tr>
            <tr>
              <td class="label">Email:</td>
              <td class="val">${pledge.email || 'Not provided'}</td>
            </tr>
            <tr>
              <td class="label">Pledged For:</td>
              <td class="val"><strong>${itemName}</strong> (${sectionName})</td>
            </tr>
            ${spilloverInfo?.spilloverAmount > 0 ? `
              <tr>
                <td class="label">General Fund Excess:</td>
                <td class="val" style="color:#047857; font-weight:700;">+ ${formatUGX(spilloverInfo.spilloverAmount)} to General Ceremony Fund</td>
              </tr>
            ` : ''}
            <tr>
              <td class="label">Payment Mode:</td>
              <td class="val">${pledge.paymentMethod || 'Mobile Money / Cash'}</td>
            </tr>
            <tr>
              <td class="label">Item Balance Left:</td>
              <td class="val" style="color:#ea580c; font-weight:700;">${itemRemaining}</td>
            </tr>
            <tr>
              <td class="label">Total Ceremony Balance:</td>
              <td class="val" style="color:#ea580c; font-weight:700;">${totalRemaining}</td>
            </tr>
            <tr>
              <td class="label">Time:</td>
              <td class="val">${timestampStr}</td>
            </tr>
          </table>

          ${pledge.message ? `
            <div style="font-weight:600; font-size:13px; color:#475569; margin-bottom:6px;">Warm Blessing / Message:</div>
            <div class="message-box">"${pledge.message}"</div>
          ` : ''}
        </div>
        <div class="footer">
          This is an automated notification from your Kwanjula Contribution Portal.<br>
          Committee Contacts: Mr. Edwin Laston (0703464261 / 0774324968)
        </div>
      </div>
    </body>
    </html>
  `;

  // date is intentionally not set here — addNotification() stamps it from
  // Postgres when the entry is actually inserted, below.
  const notifEntry = {
    id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    type: 'pledge_alert',
    recipient: notifyEmail,
    recipientName: ownerName,
    pledgerName: pledge.name,
    pledgerPhone: pledge.phone,
    amount: pledge.amount,
    item: itemName,
    status: 'recorded',
    htmlPreview: ownerEmailHtml
  };

  const transporter = getTransporter(settings);

  if (transporter && settings.emailNotificationsEnabled && notifyEmail) {
    try {
      const fromAddress = settings.smtp.from || `Edwin & Jamirah Kwanjula <${settings.smtp.user}>`;
      await transporter.sendMail({
        from: fromAddress,
        to: notifyEmail,
        subject: `🎉 New Pledge: ${pledge.name} pledged ${formattedAmount} for ${itemName}`,
        html: ownerEmailHtml
      });
      notifEntry.status = 'sent_smtp';
      console.log(`[Email] Sent pledge alert to ${notifyEmail}`);

      // If contributor provided email, send them a confirmation receipt
      if (pledge.email && pledge.email.includes('@')) {
        const contributorHtml = `
          <!DOCTYPE html>
          <html>
          <body style="font-family:sans-serif; color:#1e293b; padding:20px;">
            <div style="max-width:550px; margin:auto; border:1px solid #cbd5e1; border-radius:10px; padding:24px;">
              <h2 style="color:#047857; margin-top:0;">Thank You for Your Blessing & Support! 🙏</h2>
              <p>Dear <strong>${pledge.name}</strong>,</p>
              <p>We gratefully acknowledge your generous pledge of <strong>${formattedAmount}</strong> towards <strong>${itemName}</strong> for our Introduction Ceremony on <strong>27th November 2026</strong>.</p>
              <div style="background:#ecfdf5; border:1px solid #10b981; border-radius:8px; padding:12px; margin:16px 0;">
                <p style="margin:4px 0;"><strong>Pledged Item:</strong> ${itemName}</p>
                <p style="margin:4px 0;"><strong>Amount:</strong> ${formattedAmount}</p>
                <p style="margin:4px 0;"><strong>Fulfillment:</strong> ${pledge.paymentMethod || 'Mobile Money / Cash'}</p>
              </div>
              <p><strong>Mobile Money Payment Details:</strong></p>
              <ul>
                <li><strong>Airtel Money:</strong> 0703464261 (Edwin Laston)</li>
                <li><strong>MTN Mobile Money:</strong> 0774324968 (Edwin Laston)</li>
                <li><strong>Reference:</strong> ${pledge.name} - ${itemName}</li>
              </ul>
              <p>May the Almighty God richly bless you!</p>
              <p>Warm regards,<br><strong>Mr. Edwin Laston & Jamirah Nakayemba</strong></p>
            </div>
          </body>
          </html>
        `;

        await transporter.sendMail({
          from: fromAddress,
          to: pledge.email,
          subject: `Thank you for your pledge to Edwin & Jamirah's Introduction`,
          html: contributorHtml
        });
      }
    } catch (mailErr) {
      console.error('[Email] Failed via SMTP:', mailErr.message);
      notifEntry.status = 'smtp_error';
      notifEntry.error = mailErr.message;
    }
  } else if (transporter && settings.emailNotificationsEnabled && !notifyEmail) {
    notifEntry.status = 'no_recipient';
  } else {
    notifEntry.status = 'saved_inbox';
  }

  return addNotification(notifEntry);
}
