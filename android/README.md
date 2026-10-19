# Running Sync (personal Android companion)

## Version 0.4.0: estimated kilometre splits

Install `downloads/RunningSync-0.4.0.apk` over the previous version, sync the week again, then refresh the web. No new SQL migration is needed. The report and workout details now show estimated 1 km splits and the final partial kilometre, calculated from Samsung's timestamped speed samples. These are not Samsung's original automatic laps and may differ from its UI.

The calculation integrates linearly interpolated speed, adjusts integrated distance proportionally to the original total (only within 5%), and interpolates each kilometre crossing. It does not distribute the overall average pace. Samples must cover the session edges within two seconds; intervals over 30 seconds are excluded only when the remaining covered time agrees with original duration within 0.5% or five seconds. Such gaps are explicitly labeled inferred pauses, not confirmed pauses. Invalid, contradictory, incomplete or inconsistent traces produce an explanation instead of splits. Raw speed traces and GPS routes are not uploaded or stored; only calculated summaries and validation metadata are sent.

## Version 0.3.0: direct Samsung Health reader

The default sync now uses the official Samsung Health Data SDK 1.1.0 provided by the project owner. It requests only EXERCISE read access and uses each running session's original duration, distance, mean speed, mean/max heart rate, mean cadence, altitude gain, calories and comment. It skips unfinished recordings. Missing fields remain unknown. Pace is converted from Samsung's mean speed when available, otherwise explicitly calculated from Samsung duration/distance. Rounding may differ from the Samsung UI; validate on a physical device before claiming an exact match.

No new SQL migration beyond `202610190001_workout_details.sql` is needed. Provenance and mean speed are stored in `sync_details`.

Before upload, the app searches the signed-in owner's stored summaries. It reuses a canonical source ID when the Samsung ID or an unambiguous start/end pair (within two seconds) matches. Ambiguity aborts before writes. It preserves user notes, sensations and shoes, and omits missing lap columns on upsert to preserve previously imported laps. Exact identity matching is intentional; workouts whose timestamps were edited significantly may need manual reconciliation. This path still needs an authenticated physical-device/database test.

### Personal development access

This APK is a private development build for the owner developing/testing this app. Samsung requires a registered partner package/signature for normal distribution, or read-only developer mode during development. Follow the official developer-only instructions at https://developer.samsung.com/health/data/guide/developer-mode.html. In Samsung Health settings, open About Samsung Health, tap the version area ten times, open Developer mode (Samsung Health Data SDK), review its notice and enable **Developer Mode for Data Read**. Then use **Conectar Samsung Health** in Running Sync and grant exercise read access. This is separate from Health Connect permissions. Do not enable data write access. For distribution, use Samsung's partnership registration; developer mode is not a substitute for production authorization.

### Running laps

SDK 1.1.0 does not expose original running laps. Health Connect is optional and only supplements laps when a unique session timestamp match exists. Lap origin and calculated pace are labeled. Version 0.4.0 separately estimates kilometre splits from speed samples as described above. No GPS is saved or sent. Without new shared laps, existing imported laps remain stored.

### Rebuild from source

The proprietary `.aar` is intentionally excluded from Git. Download it from Samsung after signing in and accepting the SDK agreement, and copy `samsung-health-data-api-1.1.0.aar` into `android/app/libs/`. This local build includes the SDK's open-source notices in app assets. Gson, parcelize and data binding are configured. Install `downloads/RunningSync-0.3.0.apk` over the older APK, using the same debug signing certificate.

## Version 0.2.0: details and timing

Before installing the updated APK, run `supabase/migrations/202610190001_workout_details.sql` in Supabase SQL Editor. This adds source notes, elapsed duration and per-session provenance, preserving existing data and RLS. Then install `downloads/RunningSync-0.2.0.apk` over the previous app and synchronize the same week again.

This version imports `ExerciseSessionRecord.notes` into `source_notes`, without overwriting manual `notes`. It discounts explicitly shared PAUSE segments, including overlapping and lap-clipped intervals. Without PAUSE segments, the Health Connect duration remains labeled unverified: absence of exported pauses does not prove uninterrupted running. It reads all cadence sample pages if an aggregate is unavailable, labels that sample mean as calculated, and checks elevation records without inventing an altitude gain from the difference between maximum and minimum altitude. Laps are listed individually with their time, distance and calculated pace; missing laps are not fabricated.

This does not yet use Samsung Health Data SDK. Its official download at https://developer.samsung.com/health/data/overview.html requires Samsung account login and acceptance of the SDK agreement. The current API documents original `duration`, `meanSpeed`, `meanCadence`, `altitudeGain`, heart-rate statistics and `comment` on ExerciseSession. It does not document running lap data. To integrate original metrics, obtain the official SDK first and validate its access on the phone. Do not promise that Health Connect reproduces all values visible in Samsung Health.


Reads original Samsung Health running/treadmill sessions through Samsung Health Data SDK and sends weekly summaries to the owner's Supabase account. Health Connect is an optional source of running laps. Intended for the owner's Android 15 phone; Android 14 or newer is required.

## Install and use

1. Install the generated `app/build/outputs/apk/debug/app-debug.apk` on the phone (transfer the file by USB or another method you control).
2. On the web, open Samsung Health, create an account and confirm its email. This is an application user, separate from the Supabase dashboard account.
3. In Running Sync, authorize Samsung Health exercise read access (development access as described above) and sign in with the same application account. Health Connect lap permission is optional.
4. Select the week and press **Sincronizar semana**. Keep the app open until it reports completion.
5. On the web, select the same week and press **Actualizar**, complete sensations/shoes/notes and copy the report.

The first APK is a debug-signed personal test build, not a Play Store release. Keep the same signing key for future updates. It has not been validated against a real Samsung Health session until the user completes the phone test.

## Privacy and data correctness

- No GPS routes, background reads, Samsung write permissions, secrets, service-role keys, or stored passwords.
- Credentials are sent only to the configured Supabase project via HTTPS. Session tokens remain in memory.
- Only running sessions from Samsung Health are imported; optional Health Connect laps are filtered to Samsung's origin.
- Optional metrics remain null when unavailable or not authorized. Pace uses Samsung's original mean speed when available, with an explicitly labeled duration/distance fallback. Display rounding may differ from Samsung.
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
