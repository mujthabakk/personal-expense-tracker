# Folio

Private personal expense tracker for the web. Records stay in this browser first. Firebase is optional and only syncs after you sign in.

## Run

```bash
npm install
npm run dev
```

Open the local URL Vite prints. The app works with no account.

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
