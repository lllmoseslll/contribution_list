# 💍 Kwanjula (Introduction Ceremony) Contribution & Pledges Portal
### For Mr. Edwin Laston & Jamirah Nakayemba
**Ceremony Date:** Friday, 27th November 2026  
**Total Ceremony Budget:** UGX 31,090,000  

---

## 🌟 Overview

This is a modern, real-time web application built for the Introduction (Kwanjula) ceremony of **Mr. Edwin Laston & Jamirah Nakayemba**. It digitizes the official budget PDF, allowing friends, family, and in-laws to view itemized expenses, make pledges for specific items or sections, and watch remaining balances subtract in real-time.

Every time someone submits a pledge:
1. **Real-time Subtraction:** The item's remaining balance, section balance, and the grand total budget balance subtract immediately across all connected browsers without page refreshing (powered by WebSockets).
2. **Contributor Wall & Item Listing:** The contributor's name, pledged amount, and personal message are added under that specific item as well as on the Roll of Honor.
3. **Automated Email Notification:** An alert email is generated and dispatched to the groom/organizer (**Mr. Edwin Laston** at `edwinlaston@gmail.com`) with the contributor's contact details, pledged item, amount, and the updated remaining balance.
4. **Instant Receipt:** The pledger receives an on-screen acknowledgement slip and (if email was provided) a confirmation email.
5. **Mobile Money Instructions:** Official payment details for Airtel Money (`0703464261`) and MTN Mobile Money (`0774324968`) are prominently displayed with one-tap copy buttons and direct WhatsApp chat links.

---

## 📋 Budget Sections Included (from PDF)

- **Section A: IMPORTANT GIFTS** (Bride price, Parents appreciation, Cows, Goats, Chicken, Certificates, Welcoming greetings)
- **Section B: GIFTS (CLOTHES)** (Paternal aunt suitcase [covered], Dad suitcase [covered], Bride's suitcase [covered], Other mothers, Other dads, Brother-in-law suitcase, Uncles)
- **Section C: GIFTS & GROCERIES** (Bread, Blue band, Tea leaves, Royco, Tomatoes, Onions, Cooking oil, Pineapples, Sugar, Rice, Soap, Salt, Matooke, Soda, Mineral water, Envelopes)
- **Section E: OTHERS & OPERATIONS** (Bride's bouquet [covered], Basket for chicken, Gift bags, Envelopes [covered], MC hire, Fruit trees, Transport for gifts, Wrappers & ribbons, Photo & videography, Miscellaneous)

---

## 🚀 Quick Start Guide

### 1. Requirements
- Node.js (v18 or newer)
- Modern web browser

### 2. Run the Application
Open a terminal in this directory and execute:
```bash
npm start
```

Then visit in your web browser:
```
http://localhost:3000
```

---

## 🔔 Email Notification System

### Out of the Box (Zero Configuration Required)
The app comes with a built-in **Notification Outbox Center**. Every pledge immediately logs a formatted HTML alert into the system. The committee can view and preview these emails inside the **Committee Admin Portal**.

### Live SMTP Email Sending (Optional for Production)
To deliver real emails directly into Edwin's Gmail inbox and send receipts to contributors:
1. Open the website and click **"Committee Portal"** at the top right.
2. Enter the Admin PIN: `edwin2026` (can be customized).
3. Click the **"Notification & SMTP Settings"** tab.
4. Turn on **"Enable Live SMTP Dispatch"** and fill in:
   - **Service:** Google Gmail (or Custom SMTP)
   - **Email / User:** Your Gmail address (e.g. `edwinlaston@gmail.com`)
   - **App Password:** Your Google 16-letter App Password (generated in Google Account -> Security -> 2-Step Verification -> App Passwords)
5. Click **"Send Test Email to Verify"** to confirm instant delivery!
6. Click **"Save Settings"**.

*(Alternatively, you can set `SMTP_USER` and `SMTP_PASS` directly in the `.env` file).*

---

## 🛡️ Committee Admin Portal Features
- **Admin Passcode:** `edwin2026` (changeable in settings)
- **Pledge Verification:** Mark pledges as *"Paid / Received"* once Mobile Money has been confirmed.
- **Offline / Phone Pledges:** Record pledges made over direct phone calls.
- **Delete / Void:** Remove invalid or duplicate pledges to automatically restore the budget balance.
- **Export to CSV:** Download all pledges as an Excel-ready CSV spreadsheet with one click.
- **Email Outbox:** Inspect all notifications and preview the full formatted emails.

---

## 📞 Official Contacts
- **Mr. Edwin Laston (Groom):** `0703464261` (Airtel) / `0774324968` (MTN)
- **Mr. KMP Emitu Ezielkel:** `0783987907` (MTN)
- **Mr. Tinkasimire Emmanuel:** `0706171109` (Airtel)
# contribution_list
