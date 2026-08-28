const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Data paths
const DATA_DIR = path.join(__dirname, 'data');
const BUDGET_FILE = path.join(DATA_DIR, 'budget.json');
const PLEDGES_FILE = path.join(DATA_DIR, 'pledges.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper functions for reading/writing data
function readJSON(file, defaultVal = {}) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultVal, null, 2));
      return defaultVal;
    }
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return defaultVal;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

function formatUGX(num) {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    maximumFractionDigits: 0
  }).format(num || 0);
}

// Compute dynamic budget calculations with pledges
function calculateBudgetState() {
  const budget = readJSON(BUDGET_FILE, {});
  const pledges = readJSON(PLEDGES_FILE, []);

  // Filter valid pledges (ignore cancelled)
  const activePledges = pledges.filter(p => p.status !== 'cancelled');

  let totalBudget = 0;
  let totalCoveredAndPledged = 0;
  let uniquePledgers = new Set();

  const sections = (budget.sections || []).map(sec => {
    let secTotalCost = 0;
    let secPledged = 0;

    const items = sec.items.map(item => {
      secTotalCost += item.totalCost || 0;

      // Find pledges for this item
      const itemPledges = activePledges.filter(p => p.itemId === item.id);
      const userPledgedForItem = itemPledges.reduce((sum, p) => sum + Number(p.amount || 0), 0);

      itemPledges.forEach(p => uniquePledgers.add((p.name || '').trim().toLowerCase()));

      let pledgedAmount = 0;
      let remainingAmount = 0;

      if (item.covered) {
        // Pre-covered in the budget
        pledgedAmount = item.totalCost;
        remainingAmount = 0;
      } else {
        pledgedAmount = userPledgedForItem;
        remainingAmount = Math.max(0, item.totalCost - pledgedAmount);
      }

      secPledged += pledgedAmount;

      const percentage = item.totalCost > 0 
        ? Math.min(100, Math.round((pledgedAmount / item.totalCost) * 100))
        : 100;

      return {
        ...item,
        pledgedAmount,
        remainingAmount,
        percentage,
        isFullyFunded: item.covered || remainingAmount === 0,
        pledgesCount: itemPledges.length,
        recentPledges: itemPledges.map(p => ({
          id: p.id,
          name: p.isAnonymous ? 'Generous Well-wisher' : p.name,
          amount: p.hideAmount ? null : p.amount,
          message: p.message || '',
          date: p.date,
          status: p.status || 'pledged'
        }))
      };
    });

    const secPercentage = secTotalCost > 0
      ? Math.min(100, Math.round((secPledged / secTotalCost) * 100))
      : 100;

    totalBudget += secTotalCost;
    totalCoveredAndPledged += secPledged;

    return {
      ...sec,
      totalCost: secTotalCost,
      pledgedAmount: secPledged,
      remainingAmount: Math.max(0, secTotalCost - secPledged),
      percentage: secPercentage,
      items
    };
  });

  // Handle general pledges not assigned to specific items
  const generalPledges = activePledges.filter(p => !p.itemId || p.itemId === 'general');
  const generalPledgedAmount = generalPledges.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  generalPledges.forEach(p => uniquePledgers.add((p.name || '').trim().toLowerCase()));
  
  totalCoveredAndPledged += generalPledgedAmount;

  const totalRemaining = Math.max(0, totalBudget - totalCoveredAndPledged);
  const totalPercentage = totalBudget > 0 
    ? Math.min(100, Math.round((totalCoveredAndPledged / totalBudget) * 100))
    : 100;

  return {
    ...budget,
    sections,
    stats: {
      totalBudget,
      totalCoveredAndPledged,
      totalRemaining,
      generalPledgedAmount,
      totalPercentage,
      pledgersCount: uniquePledgers.size,
      totalPledgesCount: activePledges.length,
      lastUpdated: new Date().toISOString()
    }
  };
}

// WebSocket broadcast
function broadcastUpdate(eventType, payload) {
  const message = JSON.stringify({ type: eventType, payload });
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  // Send current state on connect
  const state = calculateBudgetState();
  ws.send(JSON.stringify({ type: 'INITIAL_STATE', payload: state }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
      }
    } catch (e) {
      // ignore
    }
  });
});

// Mailer configuration helper
function getTransporter(settings) {
  const smtp = settings.smtp || {};
  if (!smtp.enabled || !smtp.user || !smtp.pass) {
    return null;
  }

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

// Send email notifications
async function sendPledgeNotifications(pledge, itemInfo, updatedStats) {
  const settings = readJSON(SETTINGS_FILE, {});
  const notifications = readJSON(NOTIFICATIONS_FILE, []);

  const ownerEmail = settings.ownerEmail || process.env.OWNER_EMAIL || 'edwinlaston@gmail.com';
  const ownerName = settings.ownerName || 'Mr. Edwin Laston';

  const formattedAmount = formatUGX(pledge.amount);
  const itemName = itemInfo ? itemInfo.name : 'General Contribution';
  const sectionName = itemInfo ? itemInfo.sectionTitle : 'Ceremony Budget';
  const itemRemaining = itemInfo ? formatUGX(itemInfo.remainingAmount) : 'N/A';
  const totalRemaining = formatUGX(updatedStats.totalRemaining);

  const timestampStr = new Date(pledge.date).toLocaleString('en-UG', {
    dateStyle: 'full',
    timeStyle: 'medium',
    timeZone: 'Africa/Kampala'
  });

  // HTML content for Edwin (Owner)
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
        .badge { display: inline-block; background: #fbbf24; color: #78350f; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 12px; margin-top: 10px; }
        .content { padding: 24px 20px; }
        .amount-box { background: #ecfdf5; border: 2px dashed #10b981; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 20px; }
        .amount-title { font-size: 13px; color: #065f46; font-weight: 600; text-transform: uppercase; margin-bottom: 4px; }
        .amount-val { font-size: 28px; font-weight: 800; color: #065f46; }
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
          <div class="amount-box">
            <div class="amount-title">Pledged Amount</div>
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
            <tr>
              <td class="label">Payment Mode:</td>
              <td class="val">${pledge.paymentMethod || 'Mobile Money / Cash'}</td>
            </tr>
            <tr>
              <td class="label">Item Balance Left:</td>
              <td class="val" style="color:#d97706; font-weight:700;">${itemRemaining}</td>
            </tr>
            <tr>
              <td class="label">Total Ceremony Balance:</td>
              <td class="val" style="color:#2563eb; font-weight:700;">${totalRemaining}</td>
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

  // Notification log entry
  const notifEntry = {
    id: 'notif-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    type: 'pledge_alert',
    recipient: ownerEmail,
    recipientName: ownerName,
    pledgerName: pledge.name,
    pledgerPhone: pledge.phone,
    amount: pledge.amount,
    item: itemName,
    date: new Date().toISOString(),
    status: 'recorded',
    htmlPreview: ownerEmailHtml
  };

  const transporter = getTransporter(settings);

  if (transporter && settings.emailNotificationsEnabled) {
    try {
      const fromAddress = settings.smtp.from || `Edwin & Jamirah Kwanjula <${settings.smtp.user}>`;
      await transporter.sendMail({
        from: fromAddress,
        to: ownerEmail,
        subject: `🎉 New Pledge: ${pledge.name} pledged ${formattedAmount} for ${itemName}`,
        html: ownerEmailHtml
      });
      notifEntry.status = 'sent_smtp';
      console.log(`[Email] Successfully sent pledge notification to ${ownerEmail}`);

      // If contributor provided email, send them a confirmation receipt too
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
              <p>May the Almighty God richly bless you for standing with us!</p>
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
      console.error('[Email] Failed to send via SMTP:', mailErr.message);
      notifEntry.status = 'smtp_error';
      notifEntry.error = mailErr.message;
    }
  } else {
    // Logged in Notification Center
    notifEntry.status = 'saved_inbox';
    console.log(`[Email] Notification logged for ${ownerEmail} (SMTP not configured or simulated).`);
  }

  notifications.unshift(notifEntry);
  // Keep last 100 notifications
  writeJSON(NOTIFICATIONS_FILE, notifications.slice(0, 100));

  return notifEntry;
}

// ----------------- API ROUTES -----------------

// 1. GET /api/budget - Get full budget with real-time calculated balances
app.get('/api/budget', (req, res) => {
  const budgetState = calculateBudgetState();
  const settings = readJSON(SETTINGS_FILE, {});
  res.json({
    ...budgetState,
    paymentInfo: settings.paymentInfo || {}
  });
});

// 2. POST /api/pledge - Submit a new pledge
app.post('/api/pledge', async (req, res) => {
  try {
    const { name, phone, email, amount, itemId, message, paymentMethod, isAnonymous, hideAmount } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Contributor name is required.' });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'Please enter a valid pledge amount greater than 0.' });
    }

    const budget = readJSON(BUDGET_FILE, {});
    let selectedItem = null;
    let selectedSection = null;

    if (itemId && itemId !== 'general') {
      for (const sec of budget.sections || []) {
        const itm = sec.items.find(i => i.id === itemId);
        if (itm) {
          selectedItem = itm;
          selectedSection = sec;
          break;
        }
      }
      if (!selectedItem) {
        return res.status(400).json({ error: 'Selected budget item not found.' });
      }
    }

    const newPledge = {
      id: 'pledge-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      name: name.trim(),
      phone: (phone || '').trim(),
      email: (email || '').trim(),
      amount: numAmount,
      itemId: itemId || 'general',
      itemName: selectedItem ? selectedItem.name : 'General Contribution',
      sectionId: selectedSection ? selectedSection.id : null,
      sectionCode: selectedSection ? selectedSection.code : 'General',
      sectionTitle: selectedSection ? selectedSection.title : 'General',
      message: (message || '').trim(),
      paymentMethod: paymentMethod || 'Mobile Money',
      isAnonymous: Boolean(isAnonymous),
      hideAmount: Boolean(hideAmount),
      status: 'pledged', // pledged, received_paid, cancelled
      date: new Date().toISOString()
    };

    const pledges = readJSON(PLEDGES_FILE, []);
    pledges.unshift(newPledge);
    writeJSON(PLEDGES_FILE, pledges);

    // Compute updated state immediately
    const updatedState = calculateBudgetState();

    // Get updated info for the specific item
    let itemInfo = null;
    if (selectedItem) {
      for (const sec of updatedState.sections) {
        const itm = sec.items.find(i => i.id === selectedItem.id);
        if (itm) {
          itemInfo = {
            name: itm.name,
            sectionTitle: sec.title,
            remainingAmount: itm.remainingAmount,
            pledgedAmount: itm.pledgedAmount,
            percentage: itm.percentage
          };
          break;
        }
      }
    }

    // Trigger email notification asynchronously
    sendPledgeNotifications(newPledge, itemInfo, updatedState.stats).catch(err => {
      console.error('Error sending notification:', err);
    });

    // Broadcast real-time update to all connected WebSocket clients
    broadcastUpdate('PLEDGE_ADDED', {
      pledge: {
        id: newPledge.id,
        name: newPledge.isAnonymous ? 'Generous Well-wisher' : newPledge.name,
        amount: newPledge.hideAmount ? null : newPledge.amount,
        itemName: newPledge.itemName,
        itemId: newPledge.itemId,
        message: newPledge.message,
        date: newPledge.date
      },
      state: updatedState
    });

    res.status(201).json({
      success: true,
      message: 'Pledge recorded successfully! Thank you for your contribution.',
      pledge: newPledge,
      stats: updatedState.stats
    });
  } catch (err) {
    console.error('Pledge submission error:', err);
    res.status(500).json({ error: 'Internal server error while saving pledge.' });
  }
});

// 3. GET /api/pledges - List pledges (sanitized for public, detailed for admin with PIN)
app.get('/api/pledges', (req, res) => {
  const pin = req.headers['x-admin-pin'] || req.query.pin;
  const settings = readJSON(SETTINGS_FILE, {});
  const isAdmin = pin && pin === (settings.adminPin || 'edwin2026');

  const pledges = readJSON(PLEDGES_FILE, []);

  if (isAdmin) {
    return res.json(pledges);
  }

  // Public view: hide private amounts and contacts
  const sanitized = pledges.map(p => ({
    id: p.id,
    name: p.isAnonymous ? 'Generous Well-wisher' : p.name,
    amount: p.hideAmount ? null : p.amount,
    itemName: p.itemName,
    itemId: p.itemId,
    message: p.message,
    status: p.status,
    date: p.date
  }));

  res.json(sanitized);
});

// 4. GET /api/settings - Public settings
app.get('/api/settings', (req, res) => {
  const settings = readJSON(SETTINGS_FILE, {});
  res.json({
    ownerName: settings.ownerName,
    ownerPhone: settings.ownerPhone,
    ownerEmail: settings.ownerEmail,
    paymentInfo: settings.paymentInfo,
    smtpConfigured: Boolean(settings.smtp && settings.smtp.enabled && settings.smtp.user)
  });
});

// 5. POST /api/admin/verify - Verify admin pin
app.post('/api/admin/verify', (req, res) => {
  const { pin } = req.body;
  const settings = readJSON(SETTINGS_FILE, {});
  const expectedPin = settings.adminPin || process.env.ADMIN_PIN || 'edwin2026';

  if (pin === expectedPin) {
    res.json({ success: true, token: 'admin-ok' });
  } else {
    res.status(401).json({ success: false, error: 'Invalid admin passcode.' });
  }
});

// 6. GET /api/admin/notifications - Get email notification log
app.get('/api/admin/notifications', (req, res) => {
  const pin = req.headers['x-admin-pin'] || req.query.pin;
  const settings = readJSON(SETTINGS_FILE, {});
  if (pin !== (settings.adminPin || 'edwin2026')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const notifications = readJSON(NOTIFICATIONS_FILE, []);
  res.json(notifications);
});

// 7. POST /api/admin/settings - Update settings & SMTP
app.post('/api/admin/settings', (req, res) => {
  const pin = req.headers['x-admin-pin'];
  const settings = readJSON(SETTINGS_FILE, {});
  if (pin !== (settings.adminPin || 'edwin2026')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { ownerName, ownerEmail, ownerPhone, adminPin, emailNotificationsEnabled, smtp, paymentInfo } = req.body;

  if (ownerName) settings.ownerName = ownerName;
  if (ownerEmail) settings.ownerEmail = ownerEmail;
  if (ownerPhone) settings.ownerPhone = ownerPhone;
  if (adminPin) settings.adminPin = adminPin;
  if (emailNotificationsEnabled !== undefined) settings.emailNotificationsEnabled = Boolean(emailNotificationsEnabled);

  if (smtp) {
    settings.smtp = {
      ...settings.smtp,
      ...smtp
    };
  }

  if (paymentInfo) {
    settings.paymentInfo = {
      ...settings.paymentInfo,
      ...paymentInfo
    };
  }

  writeJSON(SETTINGS_FILE, settings);
  res.json({ success: true, message: 'Settings saved successfully.' });
});

// 8. POST /api/admin/test-email - Test SMTP configuration
app.post('/api/admin/test-email', async (req, res) => {
  const pin = req.headers['x-admin-pin'];
  const settings = readJSON(SETTINGS_FILE, {});
  if (pin !== (settings.adminPin || 'edwin2026')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { recipientEmail } = req.body;
  const targetEmail = recipientEmail || settings.ownerEmail || 'edwinlaston@gmail.com';

  const transporter = getTransporter(settings);
  if (!transporter) {
    return res.status(400).json({
      error: 'SMTP is not enabled or credentials (user/password) are empty in settings.'
    });
  }

  try {
    const info = await transporter.sendMail({
      from: settings.smtp.from || `Edwin & Jamirah Kwanjula <${settings.smtp.user}>`,
      to: targetEmail,
      subject: '✅ Test Notification: Kwanjula Budget Portal',
      html: `
        <div style="font-family:sans-serif; padding:20px; background:#f0fdf4; border:1px solid #86efac; border-radius:8px;">
          <h2 style="color:#166534; margin-top:0;">Test Email Successful!</h2>
          <p>This is a test notification from the Kwanjula Contribution Portal for Mr. Edwin Laston & Jamirah Nakayemba.</p>
          <p>Your SMTP configuration is active and working properly.</p>
          <hr style="border:none; border-top:1px solid #bbf7d0; margin:15px 0;">
          <small style="color:#64748b;">Sent at: ${new Date().toLocaleString()}</small>
        </div>
      `
    });

    res.json({ success: true, message: `Test email sent to ${targetEmail}! Message ID: ${info.messageId}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send test email: ' + err.message });
  }
});

// 9. POST /api/admin/pledges/:id/status - Update pledge status (e.g. received_paid)
app.post('/api/admin/pledges/:id/status', (req, res) => {
  const pin = req.headers['x-admin-pin'];
  const settings = readJSON(SETTINGS_FILE, {});
  if (pin !== (settings.adminPin || 'edwin2026')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { id } = req.params;
  const { status } = req.body; // 'pledged', 'received_paid', 'cancelled'

  const pledges = readJSON(PLEDGES_FILE, []);
  const pledge = pledges.find(p => p.id === id);

  if (!pledge) {
    return res.status(404).json({ error: 'Pledge not found.' });
  }

  pledge.status = status || pledge.status;
  writeJSON(PLEDGES_FILE, pledges);

  const updatedState = calculateBudgetState();
  broadcastUpdate('BUDGET_UPDATED', { state: updatedState });

  res.json({ success: true, pledge, stats: updatedState.stats });
});

// 10. DELETE /api/admin/pledges/:id - Delete a pledge
app.delete('/api/admin/pledges/:id', (req, res) => {
  const pin = req.headers['x-admin-pin'];
  const settings = readJSON(SETTINGS_FILE, {});
  if (pin !== (settings.adminPin || 'edwin2026')) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { id } = req.params;
  let pledges = readJSON(PLEDGES_FILE, []);
  const initialLength = pledges.length;
  pledges = pledges.filter(p => p.id !== id);

  if (pledges.length === initialLength) {
    return res.status(404).json({ error: 'Pledge not found.' });
  }

  writeJSON(PLEDGES_FILE, pledges);

  const updatedState = calculateBudgetState();
  broadcastUpdate('BUDGET_UPDATED', { state: updatedState });

  res.json({ success: true, message: 'Pledge deleted.', stats: updatedState.stats });
});

// 11. GET /api/admin/export.csv - Export pledges as CSV
app.get('/api/admin/export.csv', (req, res) => {
  const pin = req.query.pin;
  const settings = readJSON(SETTINGS_FILE, {});
  if (pin !== (settings.adminPin || 'edwin2026')) {
    return res.status(401).send('Unauthorized. Valid admin PIN required.');
  }

  const pledges = readJSON(PLEDGES_FILE, []);
  
  const headers = ['Pledge ID', 'Date', 'Contributor Name', 'Phone', 'Email', 'Item Name', 'Section', 'Amount (UGX)', 'Payment Method', 'Status', 'Message'];
  
  const rows = pledges.map(p => [
    `"${p.id}"`,
    `"${p.date}"`,
    `"${(p.name || '').replace(/"/g, '""')}"`,
    `"${(p.phone || '').replace(/"/g, '""')}"`,
    `"${(p.email || '').replace(/"/g, '""')}"`,
    `"${(p.itemName || '').replace(/"/g, '""')}"`,
    `"${(p.sectionTitle || '').replace(/"/g, '""')}"`,
    p.amount,
    `"${(p.paymentMethod || '').replace(/"/g, '""')}"`,
    `"${p.status || 'pledged'}"`,
    `"${(p.message || '').replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="kwanjula-pledges-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(csv);
});

// Serve frontend SPA for all other routes
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start HTTP + WebSocket server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Wedding / Kwanjula Contribution Platform Running!`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(` WebSockets active on ws://localhost:${PORT}`);
  console.log(`====================================================`);
});
