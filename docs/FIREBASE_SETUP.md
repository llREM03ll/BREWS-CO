# Firebase Setup

This app uses one Firebase project with **Firestore** as its only backend service (no Cloud Functions, Storage, Remote Config, App Check, Analytics, or Crashlytics — see the audit for why those aren't recommended as a first step for a single-shop app this size).

The steps below require access to the Firebase console for the `brews-co` project (or whichever project this is deployed under). They **cannot be completed by editing code** — flagging that clearly here rather than silently assuming they're done, since some of the reliability/security work in this codebase (`js/sync.js`'s `_ensureAuth`, `firestore.rules`) is written to degrade gracefully until these steps are taken, not to depend on them blindly.

## 1. Enable Anonymous Authentication

1. Firebase console → your project → **Build → Authentication → Sign-in method**.
2. Enable **Anonymous**.
3. That's it — no further configuration. `js/sync.js` already calls `firebase.auth().signInAnonymously()` on every sync attempt (feature-detected; if this step hasn't been done yet, it fails silently and sync continues working exactly as it did before).

Why anonymous and not email/password or a login screen: staff shouldn't need to type credentials to use a shared shop tablet. Anonymous auth gives every *device* a stable identity that Firestore rules can check (`request.auth != null`), without adding a login flow to the UI.

## 2. Deploy `firestore.rules`

This repo now includes a `firestore.rules` file at the project root. Deploy it with the [Firebase CLI](https://firebase.google.com/docs/cli):

```bash
npm install -g firebase-tools   # one-time, if not already installed
firebase login
firebase use --add                # select the brews-co project
firebase deploy --only firestore:rules
```

Alternatively, paste the contents of `firestore.rules` directly into **Firestore → Rules** in the console and click **Publish** — no CLI required.

**Before this step**, the project may have no rules file at all (this was the single highest-priority finding in the audit) — meaning anyone with the app's public config could read or overwrite the shop's data directly. **After this step**, at minimum an authenticated request is required.

## 3. What these rules do — and don't — protect

Read this before assuming "manager mode" is now secure:

- ✅ Stops **unauthenticated** direct access to Firestore (e.g., someone who extracted the config and tried to query the database directly, bypassing the app entirely).
- ⏸ Does **not** yet stop an authenticated worker device from writing data a manager should own (like settings), because that split currently only exists in the app's own UI logic (`js/sync.js`), not as a server-enforced rule. Enforcing that split server-side needs a real identity per employee (a custom claim or a small Cloud Function issuing one), which is a larger, deliberately deferred change — see `CHANGELOG.md` for why it wasn't done in this pass.

## 4. Firestore document structure (unchanged in this pass)

Everything currently lives in a single document: `shops/brews-co-main`. The audit recommended eventually normalizing this into sub-collections (`shops/{id}/orders/{orderId}`, etc.) once the shop needs more than one location — that's flagged as a Phase 3/4, breaking-change item and was **not** done here, to avoid a "big-bang" rewrite of a system in daily production use. The nearer-term mitigations that *were* implemented instead (cloud-side pruning by retention window, per-order merge instead of per-day) buy time before that restructuring becomes necessary — see `docs/ARCHITECTURE.md`.

## 5. Verifying it worked

After steps 1–2:
1. Open the app on a device, go to Settings, and trigger a Push or Pull.
2. In the Firebase console → Authentication → Users, you should see a new anonymous user appear the first time a device syncs.
3. In Firestore → Rules → Playground, simulate a read with `request.auth == null` against `/shops/brews-co-main` — it should now be **denied**, where previously (with no rules file) it may have been allowed.
