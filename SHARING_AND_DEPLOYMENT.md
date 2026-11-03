# BuildTrack Pro - Live Sharing & Cloud Deployment Guide

Here are the 4 ways you can share BuildTrack Pro so other team members, field technicians, executives, or clients can access it live.

---

## 1. 📡 Same Wi-Fi / Job Trailer Sharing (Active Right Now - No Setup Needed)

Because BuildTrack Pro binds to `0.0.0.0` on port `3000`, your server is already accessible across your entire local network.

- **Your Local IP Address**: `192.168.1.175`
- **Link to Share with Anyone on your Wi-Fi**:
  ```
  http://192.168.1.175:3000
  ```

### How to use it:
1. Double-click `start.cmd` on your computer.
2. Tell any colleague on the same Wi-Fi (or open your own iPad / iPhone connected to the same Wi-Fi router) to visit `http://192.168.1.175:3000`.
3. They will immediately see your live BuildTrack Pro dashboard, schedules, daily logs, and submittals in real time!
4. Any changes saved will update the shared `data/db.json` database.

---

## 2. ☁️ Permanent 24/7 Cloud Hosting (Accessible Anywhere in the World)

If you want a public link (e.g. `https://alc-projectmanager.onrender.com`) that stays online **24 hours a day, 7 days a week**, even when your personal laptop is closed or asleep:

You can deploy BuildTrack Pro to a free cloud host like **Render** or **Railway** in ~2 minutes:

### Deploying to Render.com (Free Tier):
1. Create a free account at [render.com](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository (or upload this project folder).
4. Fill in the settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install` (optional, can be blank)
   - **Start Command**: `node server.js`
   - **Plan**: `Free`
5. Click **Create Web Service**.
6. Within 60 seconds, Render will give you a permanent HTTPS URL like:
   ```
   https://alc-buildtrack.onrender.com
   ```
7. You can now text or email that link to anyone in the world! They can bookmark it, add it to their iPad home screen, and use it 24/7.

---

## 3. 🌐 Instant Public Tunnel (Share Anywhere from your Laptop via Cloudflare)

If you want to generate a public HTTPS link **right now** from your laptop without setting up cloud accounts:

1. Download the standalone `cloudflared.exe` from Cloudflare (free, no sign-up required):
   [https://github.com/cloudflare/cloudflared/releases/latest](https://github.com/cloudflare/cloudflared/releases/latest) (download `cloudflared-windows-amd64.exe`).
2. Run this command while `start.cmd` is running:
   ```powershell
   .\cloudflared.exe tunnel --url http://localhost:3000
   ```
3. Cloudflare will give you a public URL like:
   ```
   https://random-words.trycloudflare.com
   ```
4. Anyone on any network or cell phone can open that link and connect directly to your live machine!

---

## 4. 📁 Portable Offline Single-File Sharing (Zero Server Needed)

If you just need to share the project manager with an executive, GC, or colleague who doesn't have network access:

- Send them the standalone file:
  `BuildTrack_Pro.html`
- They can double-click it on Windows, Mac, iPad, or Android. It opens directly in their browser with all the Automated Logic branding, calendars, submittals, and theme choices embedded with 100% offline functionality.
