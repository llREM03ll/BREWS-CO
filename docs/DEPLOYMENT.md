# Deployment Guide

This is a static site — deployment is "copy the files somewhere that serves static HTML over HTTPS." No build step.

## Every time you ship a change

1. **Bump the service-worker cache version.** Open `service-worker.js` and increment:
   ```js
   const CACHE_NAME = "brews-inventory-v12";  // bump this, e.g. → v13
   ```
   This is still a manual step (automating it would need a build step this project intentionally doesn't have) — but unlike before, forgetting it no longer means users silently run stale code forever: `js/ui/sw-register.js` will still detect *some* update once the browser eventually re-checks the worker file, but bumping the version on every deploy is what makes that check happen promptly. **Make this the first line of your deploy checklist.**

2. Deploy the static files (whatever host you use — Firebase Hosting, Netlify, a plain web server, etc.).

3. If this deploy changed anything in `js/settings.js`'s defaults, or added/removed a `localStorage` key, check `docs/ARCHITECTURE.md`'s key inventory and update it.

4. If this deploy touched `firestore.rules`, redeploy it separately — static hosting deploys and Firestore rules deploys are independent:
   ```bash
   firebase deploy --only firestore:rules
   ```

## First-time deployment / new shop setup

1. Follow `docs/FIREBASE_SETUP.md` in full (Anonymous Auth + rules deploy) before pointing a second shop or a new device at this app.
2. Deploy the static files.
3. Open the app on one device, confirm it installs (Add to Home Screen / install prompt) and that Settings → Push/Pull works.
4. Open on a second device and confirm it can Pull what the first device pushed.

## Rolling back

Because there's no build artifact, rolling back is redeploying the previous version's files. If the previous version's `CACHE_NAME` is lower than what's currently cached on devices, bump it *above* the current highest version anyway (e.g. if you shipped `v13` and need to roll back, deploy the old code as `v14`) — otherwise devices that already have `v13` cached won't pick up the "new" (rolled-back) version, since the service worker only checks for updates via a change to the worker file's byte content, and `CACHE_NAME` moving backward doesn't guarantee the file differs enough to be noticed promptly.

## Where things are hardcoded (things to know before you deploy to a *different* shop)

- The Firebase project config (`js/sync.js`, `FIREBASE_CONFIG`) and the Firestore document path (`SHOP_DOC = "shops/brews-co-main"`) are hardcoded for this one shop. Deploying this codebase for a second shop today means changing that document path and redeploying — there's no per-shop configuration yet. See `docs/ARCHITECTURE.md`'s "Data model — deferred restructuring" section for the longer-term fix.
