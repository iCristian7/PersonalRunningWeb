# Running Sync (personal Android companion)

Reads Samsung Health running/treadmill sessions through Health Connect and sends weekly summaries to the owner's Supabase account. Intended for Cristian's Android 15 phone; Android 14 or newer is required.

## Install and use

1. Install the generated `app/build/outputs/apk/debug/app-debug.apk` on the phone (transfer the file by USB or another method you control).
2. On the web, open Samsung Health, create an account and confirm its email. This is an application user, separate from the Supabase dashboard account.
3. In Running Sync, grant Health Connect read permissions and sign in with the same application account.
4. Select the week and press **Sincronizar semana**. Keep the app open until it reports completion.
5. On the web, select the same week and press **Actualizar**, complete sensations/shoes/notes and copy the report.

The first APK is a debug-signed personal test build, not a Play Store release. Keep the same signing key for future updates. It has not been validated against a real Samsung Health session until the user completes the phone test.

## Privacy and data correctness

- No GPS routes, background reads, Samsung write permissions, secrets, service-role keys, or stored passwords.
- Credentials are sent only to the configured Supabase project via HTTPS. Session tokens remain in memory.
- Only Samsung Health-origin running sessions are imported; other Health Connect sources are filtered out.
- Optional metrics remain null when unavailable or not authorized. Pace is calculated in the web from active duration/distance and may differ from Samsung's displayed pace.
- Laps are preserved as laps, not automatically classified as interval series.
- Import uploads omit manual sensations, shoes and notes. The owner/source/source-ID unique key prevents repeat imports from duplicating the same Health Connect record.
- Automatic detection of duplicate historical JSON workouts is not attempted; cloud sessions appear in their own private tab. Existing JSON statistics remain separate.
- No extended history permission in v0.1.0: Health Connect normally restricts access before the 30 days preceding initial authorization. Samsung must also have shared the data. A successful connection does not guarantee every Samsung metric is available.
- A revoked permission is rechecked on every sync. Repeated uploads can safely retry after a partially failed batch.

## Build

Open this directory in Android Studio and build the debug APK. Requires JDK 17+ and Android SDK platform 36. `compileSdk=36` is required by stable Health Connect 1.1.0; `minSdk=34` and `targetSdk=35` allow installation on the user's Android 15 device.

Using the included Gradle wrapper: `./gradlew :app:assembleDebug :app:lintDebug` (Windows: `gradlew.bat`).

## First real-device verification

Compare one known run with Samsung Health: date, distance, active duration, heart rate, cadence, elevation and laps. Import twice and verify the row count stays unchanged. Edit a note/shoe in the web, sync again, and verify it is preserved. Test revoked optional and exercise permissions. Do not treat missing cadence/laps as zero or claim they are supported until checked on the phone.
