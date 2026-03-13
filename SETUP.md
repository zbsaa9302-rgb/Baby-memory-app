# 🌸 Ayat's Memory Book — Setup Guide

## What You're Getting
A **Progressive Web App (PWA)** that:
- Installs on your iPhone home screen just like a native app
- Stores all data in **your own Google Drive**
- Works on any device (iPhone, Android, desktop)
- No App Store needed, no subscription fees

---

## Step 1: Get a Google OAuth Client ID (Free, ~5 mins)

1. Go to **https://console.cloud.google.com**
2. Create a new project (e.g. "Ayat Memory Book")
3. Go to **APIs & Services → OAuth consent screen**
   - Choose "External", fill in app name "Ayat's Memory Book"
   - Add your email as test user
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Add your hosting URL to "Authorized JavaScript origins" (e.g. `https://yourdomain.com`)
5. Copy the **Client ID** (looks like `XXXX.apps.googleusercontent.com`)
6. Enable the **Google Drive API** in APIs & Services → Library

---

## Step 2: Add Your Client ID

Open `js/auth.js` and replace line 3:
```js
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
```
with your actual Client ID.

---

## Step 3: Host the App (Free Options)

### Option A — GitHub Pages (Easiest, Free)
1. Create a free GitHub account at github.com
2. Create a new repository called `ayat-memories`
3. Upload all the files from this folder
4. Go to Settings → Pages → Source: main branch
5. Your app will be at: `https://yourusername.github.io/ayat-memories`

### Option B — Netlify (Also Free)
1. Go to netlify.com, create free account
2. Drag and drop the entire `ayat-memories` folder
3. Get a URL like `https://ayat-memories.netlify.app`

### Option C — Vercel (Also Free)
1. Go to vercel.com, create free account
2. Import or upload the folder
3. Deploy instantly

---

## Step 4: Install on iPhone 📱

1. Open **Safari** on your iPhone (must be Safari, not Chrome)
2. Go to your app's URL
3. Sign in with Google
4. Tap the **Share button** (box with arrow) at the bottom
5. Scroll down and tap **"Add to Home Screen"**
6. Tap **"Add"**

✅ Ayat's Memory Book icon will appear on your home screen!

---

## Step 5: Invite Family Members

1. Open the app → tap ⚙️ Settings
2. Scroll to "Share with Family"
3. Enter the email address of a family member
4. They'll get access to view (but not delete) all memories

---

## Features Summary

| Feature | Details |
|---------|---------|
| Login | Google Sign-In |
| Storage | Your Google Drive (AyatMemoryBook folder) |
| Owner | Full access — add, edit, delete |
| Viewers | View & share only |
| Children | Unlimited — tap + in child tabs |
| Themes | Warm, Rose, Sage, Navy, Onyx |
| Fonts | Playfair Display, Cormorant, DM Serif |
| Share | Copy link, iMessage, WhatsApp |
| Media | Photos, Videos, Audio, PDF, Documents |

---

## Folder Structure
```
ayat-memories/
├── index.html          ← Main app
├── manifest.json       ← PWA config
├── sw.js               ← Service worker (offline)
├── css/
│   └── style.css       ← All styles + themes
├── js/
│   ├── auth.js         ← Google Sign-In
│   ├── drive.js        ← Google Drive storage
│   ├── ui.js           ← All UI logic
│   └── app.js          ← App bootstrap
└── icons/
    ├── icon-192.png    ← App icon (add your own)
    └── icon-512.png    ← App icon (add your own)
```

---

## App Icons (Optional but Recommended)

Add custom app icons in the `icons/` folder:
- `icon-192.png` — 192×192 pixels
- `icon-512.png` — 512×512 pixels

Use a pink/warm background with a 🌸 or a photo of Ayat.
Free tool: **https://realfavicongenerator.net**

---

## Troubleshooting

**"Sign in failed"** → Make sure your hosting URL is added to the Google OAuth authorized origins.

**Photos not loading** → Google Drive thumbnails need to be accessed while signed in. Make sure you're logged in.

**App not installing on iPhone** → Must use Safari browser, not Chrome or Firefox.

**Changes not saving** → Check that Google Drive API is enabled in your Google Cloud project.

---

*Made with 💕 for Ayat*
