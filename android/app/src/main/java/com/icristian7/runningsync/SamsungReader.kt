package com.icristian7.runningsync

import android.app.Activity
import android.content.Context
import com.samsung.android.sdk.health.data.HealthDataService
import com.samsung.android.sdk.health.data.permission.AccessType
import com.samsung.android.sdk.health.data.permission.Permission
import com.samsung.android.sdk.health.data.request.DataTypes
import com.samsung.android.sdk.health.data.request.DataType
import com.samsung.android.sdk.health.data.request.InstantTimeFilter
import org.json.JSONObject
import java.time.Duration
import java.time.LocalDate
import java.time.ZoneId

class SamsungReader(context: Context) {
    private val store = HealthDataService.getStore(context)
    private val permissions = setOf(Permission.of(DataTypes.EXERCISE, AccessType.READ))

    suspend fun requestPermission(activity: Activity): Boolean = store.requestPermissions(permissions, activity).containsAll(permissions)

    suspend fun readWeek(monday: LocalDate, userId: String): List<JSONObject> {
        check(store.getGrantedPermissions(permissions).containsAll(permissions)) { "Pulsa Conectar Samsung Health y concede permiso de lectura de ejercicios." }
        val zone = ZoneId.systemDefault()
        val from = monday.atStartOfDay(zone).toInstant().minusSeconds(86400)
        val until = monday.plusDays(7).atStartOfDay(zone).toInstant().plusSeconds(86400)
        val rows = mutableListOf<JSONObject>()
        var token: String? = null
        do {
            val builder = DataTypes.EXERCISE.readDataRequestBuilder
                .setInstantTimeFilter(InstantTimeFilter.of(from, until))
                .setPageSize(100)
            token?.let { builder.setPageToken(it) }
            val page = store.readData(builder.build())
            for (point in page.dataList) {
                val sessions = point.getValue(DataType.ExerciseType.SESSIONS).orEmpty()
                for (session in sessions) {
                    if (session.exerciseType !in setOf(DataType.ExerciseType.PredefinedExerciseType.RUNNING,
                            DataType.ExerciseType.PredefinedExerciseType.TRACK_RUNNING,
                            DataType.ExerciseType.PredefinedExerciseType.TREADMILL)) continue
                    if (session.endTime <= session.startTime) continue // An unfinished recording is not a completed run.
                    val offset = point.zoneOffset ?: zone.rules.getOffset(session.startTime)
                    val local = session.startTime.atOffset(offset).toLocalDate()
                    if (local.isBefore(monday) || !local.isBefore(monday.plusDays(7))) continue
                    val id = "samsung:${point.uid}:${session.startTime}"
                    val pace = SamsungMetrics.secondsPerKm(session.meanSpeed?.toDouble())
                    val details = JSONObject()
                        .put("reader_version", "0.3.0").put("provider", "samsung_sdk")
                        .put("samsung_id", id).put("duration_basis", "samsung_session_duration")
                        .put("samsung_mean_speed_mps", session.meanSpeed ?: JSONObject.NULL)
                        .put("pace_avg_s_per_km", pace ?: JSONObject.NULL)
                        .put("cadence_status", if (session.meanCadence != null) "samsung_session" else "not_exposed_by_sdk")
                        .put("elevation_status", if (session.altitudeGain != null) "samsung_session" else "not_exposed_by_sdk")
                        .put("notes_status", if (!session.comment.isNullOrBlank()) "samsung_comment" else "not_exposed_by_sdk")
                        .put("lap_source", "not_exposed_by_sdk")
                    rows.add(JSONObject()
                        .put("user_id", userId).put("source", "samsung_health").put("source_id", id)
                        .put("title", session.customTitle ?: point.getValue(DataType.ExerciseType.CUSTOM_TITLE) ?: "Running")
                        .put("started_at", session.startTime.toString()).put("ended_at", session.endTime.toString())
                        .put("timezone", if (offset.id == "Z") "UTC" else offset.id)
                        .put("distance_m", session.distance ?: JSONObject.NULL)
                        .put("active_duration_s", session.duration.toMillis() / 1000.0)
                        .put("elapsed_duration_s", Duration.between(session.startTime, session.endTime).toMillis() / 1000.0)
                        .put("hr_avg", session.meanHeartRate ?: JSONObject.NULL)
                        .put("hr_max", session.maxHeartRate ?: JSONObject.NULL)
                        .put("cadence_avg", session.meanCadence ?: JSONObject.NULL)
                        .put("elevation_gain_m", session.altitudeGain ?: JSONObject.NULL)
                        .put("calories_kcal", session.calories)
                        .put("source_notes", session.comment ?: JSONObject.NULL)
                        .put("sync_details", details)
                    )
                }
            }
            token = page.pageToken
        } while (!token.isNullOrEmpty())
        return rows
    }
}
