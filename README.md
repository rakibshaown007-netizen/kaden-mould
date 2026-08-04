Kadena Mould Tracker Pro — Plain HTML/CSS/JS Build
A zero-build, installable offline web app (PWA) for tracking Snap Button, Logo, TPR, Rubber Patch and other moulds on your floor at Kadena Sportswear Limited. No React, no npm, no build step — just open index.html. All data stays private on your own device/browser only (stored in localStorage); nobody else can see or access it, and no internet connection is needed after the first load.
📁 What's in this folder
index.html      the entire page shell
css/style.css   small custom CSS (design mostly via Tailwind CDN utility classes)
js/app.js       the whole application (state, rendering, all features)
manifest.json   PWA manifest (app name, icon, colors)
sw.js           offline service worker (caches the app after first visit)
icons/          app icons for the home-screen/install icon
Features: Dashboard with alerts & recent activity, Mould List with search/filter/sort, Add / Edit / Delete any mould, favorite, archive, full history timeline, Transfer (Send/Receive), Pending tracker, Profile with company info + CSV export + JSON backup/restore, light/dark mode.
🚀 Host it for free on GitHub Pages
Step 1 — Create the repository
Go to github.com → New repository
Name it anything, e.g. kadena-mould-tracker
Set it to Public (required for free GitHub Pages) → Create repository
Step 2 — Upload the files
On the new repo page, click "Add file" → "Upload files"
Drag in everything from this folder — index.html, the css/, js/, icons/ folders, manifest.json, and sw.js — keeping the same folder structure
Scroll down, click "Commit changes"
(Tip: on a phone, GitHub's web uploader lets you pick multiple files from your file manager — just make sure the folders keep their names css, js, icons when uploading.)
Step 3 — Turn on GitHub Pages
In your repo, go to Settings → Pages (left sidebar)
Under "Build and deployment" → Source, choose Deploy from a branch
Branch: main (or master), folder: / (root) → Save
Wait about 1 minute, then refresh — GitHub will show your live URL, something like:
https://your-username.github.io/kadena-mould-tracker/
That link is now live and free forever, with automatic HTTPS. Share it with anyone — each person who opens it gets their own private, independent copy of the data on their own device.
📲 Install it like a real app on any phone
Once the GitHub Pages link is live, anyone can install it to their home screen:
Android (Chrome):
Open the link in Chrome
Tap the ⋮ menu → "Add to Home screen" / "Install app"
It now opens full-screen like a native app, works offline, and shows your app icon
iPhone (Safari):
Open the link in Safari
Tap the Share icon → "Add to Home Screen"
No app store, no approval process, no cost — just the link.
🔁 Updating the app later
Whenever you want to change something, edit the files and re-upload them to the same GitHub repo (or use git push if you're comfortable with Git) — GitHub Pages automatically republishes within a minute or two. Everyone's installed app will pick up the update the next time they open it with internet access (the service worker refreshes its cache in the background).
🖼 Custom app icon
Replace icons/icon-192.png and icons/icon-512.png with your own square logo (same file names, same sizes) before uploading, if you'd like your own branding on the install icon.
🏢 Company
Kadena Sportswear Limited Comilla EPZ, Cumilla Supervisor: Md. Jalal Hossain (Member) Phone: 01326953236
