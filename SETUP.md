# YouTube Digest — Setup Guide

## 1. Install dependencies

```
cd C:\Apps\youtube-digest
npm install
```

---

## 2. YouTube Data API (Google Cloud)

### 2a. Create a Google Cloud project

1. Go to https://console.cloud.google.com
2. Click **Select a project → New Project**, name it `youtube-digest`, click **Create**
3. Make sure the new project is selected in the top dropdown

### 2b. Enable the YouTube Data API

1. In the left sidebar → **APIs & Services → Library**
2. Search for **YouTube Data API v3**
3. Click it → **Enable**

### 2c. Create OAuth 2.0 credentials

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
2. If prompted to configure the consent screen first:
   - Choose **External**, click **Create**
   - App name: `YouTube Digest`, User support email: your Gmail
   - Developer contact: your Gmail → **Save and Continue** through all steps
   - On the **Test users** screen, click **+ Add Users** and add your Gmail address
   - Back on the OAuth consent screen, leave it in **Testing** mode (you don't need to publish it)
3. Back at **Create OAuth client ID**:
   - Application type: **Web application**
   - Name: `YouTube Digest`
   - Under **Authorized redirect URIs**, click **+ Add URI** and enter:
     ```
     http://localhost:8080/oauth/callback
     ```
   - Click **Create**
4. Copy the **Client ID** and **Client Secret** shown in the dialog

---

## 3. Anthropic API key

1. Go to https://console.anthropic.com
2. **API Keys → Create Key** — copy it

---

## 4. Resend (email delivery)

Resend sends email via a simple API key — no SMTP config needed.

1. Sign up at https://resend.com (free tier: 3,000 emails/month)
2. **API Keys → Create API Key** — copy it
3. **Domains → Add Domain** — add and verify a domain you own
   - Follow the DNS record instructions (usually adding a few TXT/MX records)
   - Once verified, you can send FROM `anything@yourdomain.com`
   - **Don't have a domain handy?** During development you can use `onboarding@resend.dev`
     as your FROM address to send to a single verified recipient (your own email)

---

## 5. Create your .env file

```
cd C:\Apps\youtube-digest
copy .env.example .env
```

Open `.env` and fill in the values:

```env
GOOGLE_CLIENT_ID=<from step 2c>
GOOGLE_CLIENT_SECRET=<from step 2c>
ANTHROPIC_API_KEY=<from step 3>
RESEND_API_KEY=<from step 4>
RESEND_FROM_EMAIL=digest@yourdomain.com
DIGEST_TO_EMAIL=brucewinter@gmail.com
```

---

## 6. Authorize YouTube access (one-time)

```
npm run setup
```

This opens a browser tab asking you to sign in with your Google account and grant read access to your YouTube subscriptions. After approving, the token is saved locally to `.token.json`.

---

## 7. Run the digest manually

```
npm run digest
```

You should receive an email at `brucewinter@gmail.com` within a few seconds.

---

## 8. Schedule it daily (Windows Task Scheduler)

1. Open **Task Scheduler** (search in Start menu)
2. **Action → Create Basic Task...**
   - Name: `YouTube Digest`
   - Trigger: **Daily** at whatever time you want (e.g. 7:00 AM)
   - Action: **Start a program**
     - Program: `C:\Apps\youtube-digest\run-digest.bat`
3. Click **Finish**

To verify it ran, check the log:
```
type C:\Apps\youtube-digest\logs\digest.log
```

---

## Notes

- **Quota**: Uses ~120 YouTube API quota units per run for 100 subscriptions. The free daily limit is 10,000 units — plenty of headroom.
- **Transcripts**: Auto-fetched where available; falls back to the video description if not.
- **No new videos**: If no subscriptions posted in the last 24 hours, no email is sent.
- **Token refresh**: The OAuth token is refreshed automatically on each run — you won't need to re-authorize.
