package com.icristian7.runningsync

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

class HealthReader(private val client: HealthConnectClient) {
    companion object {
        val requiredPermission = HealthPermission.getReadPermission(ExerciseSessionRecord::class)
        val permissions = setOf(
            requiredPermission,
            HealthPermission.getReadPermission(DistanceRecord::class),
            HealthPermission.getReadPermission(HeartRateRecord::class),
            HealthPermission.getReadPermission(StepsCadenceRecord::class),
            HealthPermission.getReadPermission(ElevationGainedRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class)
        )
    }

    private val origins = setOf(DataOrigin("com.sec.android.app.shealth"))

    suspend fun readWeek(monday: LocalDate, userId: String): List<JSONObject> {
        val granted = client.permissionController.getGrantedPermissions()
        check(requiredPermission in granted) { "Concede el permiso de ejercicios en Health Connect." }
        val zone = ZoneId.systemDefault()
        val from = monday.atStartOfDay(zone).toInstant()
        val until = monday.plusDays(7).atStartOfDay(zone).toInstant()
        val sessions = mutableListOf<ExerciseSessionRecord>()
        var pageToken: String? = null
        do {
            val page = client.readRecords(ReadRecordsRequest(
                recordType = ExerciseSessionRecord::class,
                timeRangeFilter = TimeRangeFilter.between(from.minusSeconds(86400), until.plusSeconds(86400)),
                dataOriginFilter = origins,
                pageToken = pageToken
            ))
            sessions.addAll(page.records.filter {
                val local = it.startTime.atZone(it.startZoneOffset ?: zone).toLocalDate()
                !local.isBefore(monday) && local.isBefore(monday.plusDays(7)) &&
                    it.exerciseType in setOf(ExerciseSessionRecord.EXERCISE_TYPE_RUNNING, ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL)
            })
            pageToken = page.pageToken
        } while (pageToken != null)

        return sessions.map { session ->
            val metrics = mutableSetOf<AggregateMetric<*>>(ExerciseSessionRecord.EXERCISE_DURATION_TOTAL)
            if (HealthPermission.getReadPermission(DistanceRecord::class) in granted) metrics.add(DistanceRecord.DISTANCE_TOTAL)
            if (HealthPermission.getReadPermission(HeartRateRecord::class) in granted) {
                metrics.add(HeartRateRecord.BPM_AVG); metrics.add(HeartRateRecord.BPM_MAX)
            }
            if (HealthPermission.getReadPermission(StepsCadenceRecord::class) in granted) metrics.add(StepsCadenceRecord.RATE_AVG)
            if (HealthPermission.getReadPermission(ElevationGainedRecord::class) in granted) metrics.add(ElevationGainedRecord.ELEVATION_GAINED_TOTAL)
            if (HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class) in granted) metrics.add(TotalCaloriesBurnedRecord.ENERGY_TOTAL)
            val data = client.aggregate(AggregateRequest(
                metrics = metrics,
                timeRangeFilter = TimeRangeFilter.between(session.startTime, session.endTime),
                dataOriginFilter = origins
            ))
            JSONObject().apply {
                put("user_id", userId)
                put("source", "samsung_health")
                put("source_id", session.metadata.id)
                put("title", session.title ?: if (session.exerciseType == ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL) "Carrera en cinta" else "Running")
                put("started_at", session.startTime.toString())
                put("ended_at", session.endTime.toString())
                put("timezone", session.startZoneOffset?.id?.let { if (it == "Z") "UTC" else it } ?: zone.id)
                put("distance_m", data[DistanceRecord.DISTANCE_TOTAL]?.inMeters ?: JSONObject.NULL)
                put("active_duration_s", data[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.let { it.toMillis() / 1000.0 } ?: JSONObject.NULL)
                put("hr_avg", data[HeartRateRecord.BPM_AVG] ?: JSONObject.NULL)
                put("hr_max", data[HeartRateRecord.BPM_MAX] ?: JSONObject.NULL)
                put("cadence_avg", data[StepsCadenceRecord.RATE_AVG] ?: JSONObject.NULL)
                put("elevation_gain_m", data[ElevationGainedRecord.ELEVATION_GAINED_TOTAL]?.inMeters ?: JSONObject.NULL)
                put("calories_kcal", data[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories ?: JSONObject.NULL)
                put("laps", if (session.laps.isEmpty()) JSONObject.NULL else JSONArray(session.laps.map { lap ->
                    JSONObject().put("distance_m", lap.length?.inMeters ?: JSONObject.NULL)
                        .put("duration_s", java.time.Duration.between(lap.startTime, lap.endTime).toMillis() / 1000.0)
                }))
            }
        }
    }
}
