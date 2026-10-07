# Folio

Private personal expense tracker for the web. Records stay in this browser first. Firebase is optional and only syncs after you sign in.

## Run

```bash
npm install
npm run dev
```

Open the local URL Vite prints. The app works with no account.

## GitHub Pages

Pushes to `main` publish the site to [https://mujthabakk.github.io/personal-expense-tracker/](https://mujthabakk.github.io/personal-expense-tracker/).

Add the Firebase web config as repository secrets named `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID`. In Firebase Authentication, add `mujthabakk.github.io` as an authorized domain.

## Firebase

1. Create a Firebase project with Authentication (Email/Password) and Cloud Firestore.
2. Copy `.env.example` to `.env.local` and fill in the web app config.
3. Deploy the included rules so one signed-in person cannot read another person's ledger:

```bash
npx firebase deploy --only firestore:rules
```

The web API key is visible in the client. Access control is the Firestore rules file, not a hidden key.

## Scripts

- `npm run dev` — local app
- `npm test` — money, sync, and encryption checks
- `npm run build` — typecheck and production build
