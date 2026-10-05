# Samsung Health sync database

## Initial setup

1. Open the Supabase project's SQL Editor and run `migrations/202610050001_workouts.sql` once.
2. In the project's Connect dialog, copy the project URL and publishable key.
3. Copy `.env.example` to `.env.local` and fill those two values. Add the same variables in Vercel when deploying the integration.

The publishable key is intended for client applications. No service-role key, secret API key or database password is required for the app integration. Access to workouts requires a signed-in Supabase user and is restricted by row-level security.

The web's Samsung Health tab and the Android companion use this table with authenticated user sessions. Existing JSON data remains unchanged. Configure both public variables in Vercel Production before deploying, then create an application account in the web tab and confirm the signup email. The Android app uses the same account. No secret key is needed.

The source ID must be a stable Health Connect record identifier. Repeated synchronization uses the owner/source/source-ID unique constraint to prevent duplicates. Imports must update only source metrics; sensations, shoes and notes belong to the user and must be preserved. Only Samsung Health-origin exercise records are eligible. Optional values must remain null when Samsung Health does not share them. Weekly grouping uses the workout's local timezone.

Before release, verify with two test users that each can access only their own rows and that anonymous access is rejected. Verify repeated imports and preservation of manual fields using a real phone session.
