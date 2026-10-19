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
import java.time.Instant
import java.time.Duration
import kotlin.reflect.KClass

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

    private suspend fun <T : Record> readRecords(type: KClass<T>, start: Instant, end: Instant): List<T> {
        val result = mutableListOf<T>()
        var token: String? = null
        do {
            val page = client.readRecords(ReadRecordsRequest(
                recordType = type, timeRangeFilter = TimeRangeFilter.between(start, end),
                dataOriginFilter = origins, pageToken = token
            ))
            result.addAll(page.records)
            token = page.pageToken
        } while (token != null)
        return result
    }

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
            if (HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class) in granted) metrics.add(TotalCaloriesBurnedRecord.ENERGY_TOTAL)
            val data = client.aggregate(AggregateRequest(
                metrics = metrics,
                timeRangeFilter = TimeRangeFilter.between(session.startTime, session.endTime),
                dataOriginFilter = origins
            ))
            val details = JSONObject().put("reader_version", "0.2.0").put("provider", "health_connect")
            val pauses = session.segments.filter { it.segmentType == ExerciseSegment.EXERCISE_SEGMENT_TYPE_PAUSE }
                .map { TimeWindow(it.startTime, it.endTime) }
            val elapsedSeconds = Duration.between(session.startTime, session.endTime).toMillis() / 1000.0
            val duration = if (pauses.isNotEmpty()) {
                details.put("duration_basis", "session_pause_segments")
                WorkoutTiming.activeSeconds(session.startTime, session.endTime, pauses)
            } else {
                details.put("duration_basis", "health_connect_aggregate_unverified")
                data[ExerciseSessionRecord.EXERCISE_DURATION_TOTAL]?.let { it.toMillis() / 1000.0 }
            }
            details.put("pause_segments", pauses.size)
            details.put("elapsed_duration_s", elapsedSeconds)
            details.put("samsung_displayed_pace_available", false)

            // Read actual samples as well: some platform versions do not aggregate cadence.
            var cadence: Double? = null
            if (HealthPermission.getReadPermission(StepsCadenceRecord::class) !in granted) {
                details.put("cadence_status", "permission_denied")
            } else {
                val records = readRecords(StepsCadenceRecord::class, session.startTime, session.endTime)
                val samples = records.flatMap { it.samples }.filter { it.time >= session.startTime && it.time < session.endTime }
                    .distinctBy { it.time }.map { it.rate }.filter { it.isFinite() && it >= 0 }
                details.put("cadence_samples", samples.size)
                val aggregate = try {
                    client.aggregate(AggregateRequest(setOf(StepsCadenceRecord.RATE_AVG),
                        TimeRangeFilter.between(session.startTime, session.endTime), origins))[StepsCadenceRecord.RATE_AVG]
                } catch (_: UnsupportedOperationException) { null }
                cadence = aggregate ?: samples.takeIf { it.isNotEmpty() }?.average()
                details.put("cadence_status", when {
                    aggregate != null -> "health_connect_aggregate"
                    cadence != null -> "sample_mean"
                    else -> "not_shared"
                })
            }

            var elevation: Double? = null
            if (HealthPermission.getReadPermission(ElevationGainedRecord::class) !in granted) {
                details.put("elevation_status", "permission_denied")
            } else {
                val records = readRecords(ElevationGainedRecord::class, session.startTime, session.endTime)
                val contained = records.filter { it.startTime >= session.startTime && it.endTime <= session.endTime }
                details.put("elevation_records", records.size)
                val aggregate = try {
                    client.aggregate(AggregateRequest(setOf(ElevationGainedRecord.ELEVATION_GAINED_TOTAL),
                        TimeRangeFilter.between(session.startTime, session.endTime), origins))[ElevationGainedRecord.ELEVATION_GAINED_TOTAL]?.inMeters
                } catch (_: UnsupportedOperationException) { null }
                // Do not prorate daily elevation records into a workout without evidence.
                elevation = aggregate ?: contained.takeIf { it.isNotEmpty() }?.sumOf { it.elevation.inMeters }
                details.put("elevation_status", when {
                    aggregate != null -> "health_connect_aggregate"
                    elevation != null -> "contained_records"
                    else -> "not_shared"
                })
            }
            details.put("notes_status", if (session.notes.isNullOrBlank()) "not_shared" else "session_notes")
            details.put("lap_count", session.laps.size)
            JSONObject().apply {
                put("user_id", userId)
                put("source", "samsung_health")
                put("source_id", session.metadata.id)
                put("title", session.title ?: if (session.exerciseType == ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL) "Carrera en cinta" else "Running")
                put("started_at", session.startTime.toString())
                put("ended_at", session.endTime.toString())
                put("timezone", session.startZoneOffset?.id?.let { if (it == "Z") "UTC" else it } ?: zone.id)
                put("distance_m", data[DistanceRecord.DISTANCE_TOTAL]?.inMeters ?: JSONObject.NULL)
                put("active_duration_s", duration ?: JSONObject.NULL)
                put("elapsed_duration_s", elapsedSeconds)
                put("source_notes", session.notes ?: JSONObject.NULL)
                put("sync_details", details)
                put("hr_avg", data[HeartRateRecord.BPM_AVG] ?: JSONObject.NULL)
                put("hr_max", data[HeartRateRecord.BPM_MAX] ?: JSONObject.NULL)
                put("cadence_avg", cadence ?: JSONObject.NULL)
                put("elevation_gain_m", elevation ?: JSONObject.NULL)
                put("calories_kcal", data[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories ?: JSONObject.NULL)
                put("laps", if (session.laps.isEmpty()) JSONObject.NULL else JSONArray(session.laps.map { lap ->
                    JSONObject().put("distance_m", lap.length?.inMeters ?: JSONObject.NULL)
                        .put("duration_s", java.time.Duration.between(lap.startTime, lap.endTime).toMillis() / 1000.0)
                        .put("active_duration_s", if (pauses.isNotEmpty()) WorkoutTiming.activeSeconds(lap.startTime, lap.endTime, pauses) else JSONObject.NULL)
                        .put("started_at", lap.startTime.toString())
                        .put("ended_at", lap.endTime.toString())
                }))
            }
        }
    }
}
