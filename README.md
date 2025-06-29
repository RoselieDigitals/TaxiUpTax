# 🚀 Custom LMS + CRM App — Setup Guide

Welcome! This guide helps you install and configure your white-label LMS + CRM system using your own Firebase account.

---

## ✅ Requirements

- A Firebase project (https://console.firebase.google.com)
- Hosting account (Netlify, Vercel, Firebase Hosting, cPanel, etc.)
- Your LMS+CRM zip package from [Taxi Up Tax Services & More]

---

## 📦 Files Included

- `index.html` (entry page)
- `home.html` (main dashboard)
- `config-setup.html` (initial Firebase configuration)
- `style.css` (design system)
- `firebase-init.js` (dynamic Firebase integration)
- `main.js` or `script.js` (core logic)
- All other app files

---

## 🛠 Setup Steps

### 1. Upload to Your Server

Host the files on your own domain:

You can use:
- Netlify (recommended for non-tech users)
- Firebase Hosting
- Vercel
- cPanel or shared hosting

---

### 2. Go to Setup Page

Open:

Fill in the Firebase config fields from your Firebase console:
- apiKey
- authDomain
- projectId
- databaseURL
- storageBucket
- messagingSenderId
- appId

Click **Save Config & Launch App**.

✅ It will redirect you to the main app automatically.

🛡 This setup is auto-locked once saved, so students can’t access it.

---

### 3. Share App with Students

Once configured, students can access the app at:

They will go straight to the login/signup screen and start using the LMS.

---

### 🔁 Resetting Firebase Config

To update or replace your Firebase project:
1. Re-open `config-setup.html`
2. Click **Reset Config**
3. Re-enter the new Firebase project details

---

## 🧠 Support & Customization

Need help customizing your:
- App name or logo
- Accent colors
- Domain setup

Contact [Virginia Hall / taxiuptax@gmail.com / www.taxiuptaxinfo.com].

---
