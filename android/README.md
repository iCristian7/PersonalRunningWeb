# Running Sync (personal Android companion)

## Version 0.8.0: observed-time kilometres and configurable interval blocks

Long gaps now yield explicitly labeled observed-time splits if the remaining observed duration fits the native duration within 2%/10 seconds and reconstructed distance fits within 5%. Gaps are inferred pauses, not verified watch events. There is no scaling of time. Otherwise the reader retains the missing-data diagnosis.

For owner-private recalculation the app now uploads the exercise's relative timestamps, speeds and heart-rate observations into `sync_details.exercise_trace`. This supersedes the earlier versions' summary-only storage statements. No route, coordinates, password or additional credentials are stored in these samples. The existing owner RLS applies and the new privacy screen explains storage. No new SQL migration is required. Optional Health Connect reading also collects explicitly shared pauses even when no laps exist.

Samsung SDK 1.1.0 exports neither the running objective nor interval-block definitions. The web's **Configurar kilómetros o intervalos** editor lets the owner provide mixed distance/time blocks, preview their measured distance/pace/heart rate, choose elapsed time, verified active time or approximate observed time, and save the configuration for subsequent reports. The three-by-eight-minute template is a user-selected example, never automatically asserted as the watch's workout. Active time requires shared/provided pauses or explicit confirmation that there were none; inferred pauses are labeled and not guaranteed to align with the watch's interval alerts. Structures extending beyond the trace fail instead of inventing the remaining blocks. Resynchronization preserves `analysis_config`, sensations, shoes and manual notes.

Install `downloads/RunningSync-0.8.0.apk`, synchronize again, refresh the web, then configure the interval session and save. Authenticated live inspection was blocked by browser policy; no account credentials or real workout samples were committed to the repository. Synthetic tests cover long pause gaps, independent speed/heart streams, mixed blocks, verified pauses, incomplete structures and missing heart coverage.

## Version 0.7.0: bounded interior gaps and separate heart-rate samples

The SDK can deliver heart rate and speed as separate timestamped entries. Heart rate is now interpolated onto speed timestamps only when the surrounding heart-rate observations are at most 30 seconds apart. The existing 80% coverage check remains; long speed gaps do not count toward heart-rate coverage.

Interior speed gaps of up to 120 seconds are integrated using linear interpolation, capped at 120 seconds in total when the trace differs from active duration. Such results use explicitly disclosed elapsed time, including pauses, and retain the 5% original-distance validation. Larger gaps still fail instead of fabricating kilometre times. Install `downloads/RunningSync-0.7.0.apk` and sync again. The previous 0.6.0 gap-exclusion behavior above is superseded by this version.

## Version 0.6.0: session-edge regression fix

Versions 0.4/0.5 rejected a complete workout if the speed trace started or ended more than two seconds from the session boundary. The new reader estimates small edge offsets using the nearest observed speed, capped at 30 seconds per edge and 2% of original duration overall. It reports the estimated seconds explicitly, does not invent heart rate for these edges, and retains the 5% distance consistency check. Larger missing edges still fail with their exact lengths shown in the app and the web's separate sync diagnostics.

Continuous traces with a different active duration now produce explicitly labeled **elapsed-time** splits; time is not scaled to the original active duration. Unexplained interior gaps still fail. Each split retains its time-weighted heart rate when coverage is at least 80%. The ChatGPT report omits empty fields and diagnostics, while keeping the estimation and timing disclosures for available splits.

Install `downloads/RunningSync-0.6.0.apk` over the previous version and sync the same week again. No SQL change or new permission is needed. Diagnostic counts and edge lengths are stored in the existing `sync_details`; raw logs and routes are not uploaded. Regression tests cover offset edges, incomplete traces, elapsed timing and per-kilometre heart rate; real Samsung workout validation remains necessary.

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
