# Zero Android (MVP)

## Setup

1. Install Android Studio + SDK (API 34).
2. Add required Meta Wearables DAT credentials in `android/local.properties`:

```
# Android SDK location (if not already present)
sdk.dir=/path/to/Android/sdk

# GitHub Packages token (classic PAT with read:packages)
github_token=YOUR_GITHUB_TOKEN

# Meta Wearables application id
# (from Meta Wearables Developer Center)
dat_application_id=YOUR_MWDAT_APP_ID

# Meta Wearables client token
dat_client_token=YOUR_MWDAT_CLIENT_TOKEN
```

3. Sync Gradle and run the `app` configuration.

## Notes
- The app uses cleartext HTTP for local LAN connections to the Zero server.
- Background monitoring runs as a foreground service with per-project notifications.
- Meta Wearables DAT is scaffolded only; streaming is out of scope for MVP.
