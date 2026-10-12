---
name: eas-build-and-deep-links
description: Use when setting up Rota's Android development build with EAS Build, Expo notifications credentials, the rota:// deep link scheme, invite and magic link landing pages, notification tap routing, and the Android build download link for submission. Self-study topic: read current Expo docs before running commands.
---

# EAS development build and deep links

Expo changes quickly. Before running any command below, read the current Expo docs for **EAS Build**, **development builds**, **expo-notifications**, and **linking**. Treat the commands here as a map, not gospel.

## Why a development build

Recent Expo versions do not support remote push notifications inside Expo Go on Android. A development build is your own app binary with the Expo dev tools included. EAS Build makes it in the cloud, so you do not need Android Studio. iOS device builds need a paid Apple account, so Android only.

## One-time setup (do in milestone M0, not at the end)

1. Create a free Expo account. Install the CLI (`npm i -g eas-cli`) and `eas login`.
2. In `app/`: `eas init` (links the project, creates the project id). The project id is safe to expose as `EXPO_PUBLIC_EAS_PROJECT_ID`.
3. `eas build:configure` creates `eas.json`. Add a `development` profile:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } }
  }
}
```

4. Add to `app.json` (or `app.config.ts`): `"scheme": "rota"`, a unique `android.package` such as `com.yourname.rota`, and the plugins `expo-router`, `expo-notifications`, `expo-secure-store`.
5. **Android push credentials:** remote push on Android needs Firebase Cloud Messaging credentials. Follow the current Expo guide ("Set up FCM credentials" in the push notifications docs): create a Firebase project, add the Android app with your package name, and upload the FCM service account key to EAS using `eas credentials`. The `google-services.json` file is listed in `.gitignore`, so give it to the build as an EAS file environment variable or secret file (check the current Expo docs for the exact method) and never commit it. Do this early. It is the most common blocker.
6. Build: `eas build --profile development --platform android`. When it finishes, EAS gives a download link and a QR code. Install the APK on a real device.
7. Run the dev server for the dev client: `npx expo start --dev-client`.

For the submission, also make a `preview` build (internal APK) so a reviewer can install without a dev server, and put the link in the README. Note: development builds expect a Metro server. A preview or production-profile APK runs standalone. Say which one the link is.

Secrets for builds (Sentry auth token, etc.) go in EAS secrets (`eas secret:create`, check the current command name in docs), never in `eas.json` or the repo.

## Deep link scheme

`rota://` paths:

| URL | Opens |
|---|---|
| `rota://invite/<token>` | Invite acceptance screen |
| `rota://magic/<token>` | Magic link verification |
| `rota://shifts/<id>` | Shift detail |
| `rota://swaps/<id>` | Swap detail |
| `rota://billing` | Billing screen (owner) |

With Expo Router, a file `app/invite/[token].tsx` handles `rota://invite/<token>` automatically once the scheme is set.

## Why emails link to your server first

Many email apps do not open custom scheme links. So the email contains `https://<APP_BASE_URL>/i/<token>` (invites) or `/m/<token>` (magic link). The server returns a tiny HTML page that:

1. Tries to open `rota://invite/<token>` immediately (meta refresh or `window.location`).
2. Shows a button "Open in Rota" as a fallback and a note "Install the Rota build first".
3. Never prints the token into logs. Escape the token if you render it. The token must match `^[A-Za-z0-9_-]{20,}$` or the page returns 400.

(Android App Links over https are the production upgrade. Mention it in the README as "next step".)

## Invite landing in the app

`app/invite/[token].tsx`:
1. Read the token from params.
2. If signed out: keep the token in memory (Zustand, not persisted, not logged), go to login or register, then return.
3. Call `POST /v1/invites/accept { token }`.
4. On success: invalidate teams, navigate to that team's shifts. On failure: show a clear reason (expired, used, seats full).

## Notification tap routing

Covered in `push-notifications-pipeline`. Use the same allow list for deep links from any source.

## Test checklist (on a real device)

- Tap the invite link from an email app: lands in the right team with the right role.
- Cold start from a notification tap opens the exact screen.
- Warm app notification tap opens the exact screen.
- A tampered link (`rota://shifts/not-a-uuid`) is ignored.
- Logout then tap a notification: goes to login, then to the target after login (or ignore, decide and document).

## Explain-back questions for the human

1. Why does Expo Go fail for Android push now, and what does a development build change?
2. Why does the invite email link go to an https page first?
3. Which `EXPO_PUBLIC_` values exist and why is each safe?
