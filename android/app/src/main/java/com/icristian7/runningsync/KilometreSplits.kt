package com.icristian7.runningsync

import java.time.Duration
import java.time.Instant
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt

data class SpeedPoint(val time: Instant, val metersPerSecond: Double?)
data class KilometreSplit(val distanceMeters: Double, val seconds: Double, val partial: Boolean)
data class SplitCalculation(
    val status: String, val splits: List<KilometreSplit> = emptyList(),
    val integratedMeters: Double? = null, val distanceScale: Double? = null,
    val coveredSeconds: Double? = null, val gapSeconds: Double = 0.0,
    val trailingSeconds: Double = 0.0
)

object KilometreSplits {
    private const val MAX_INTERVAL_SECONDS = 30.0
    private const val MAX_EDGE_SECONDS = 2.0
    private const val MAX_DISTANCE_ERROR = 0.05

    /** Approximation from the speed trace, not an import of Samsung's original laps.
     * No mean-pace fallback: gaps are excluded only if both original active duration and
     * distance agree with the observed trace. Distance adjustment is explicit in the result.
     */
    fun calculate(start: Instant, end: Instant, activeSeconds: Double, distanceMeters: Double?, input: List<SpeedPoint>): SplitCalculation {
        if (distanceMeters == null || !distanceMeters.isFinite() || distanceMeters <= 0 ||
            !activeSeconds.isFinite() || activeSeconds <= 0 || end <= start) return SplitCalculation("missing_totals")
        val points = input.filter { it.time >= start && it.time <= end && it.metersPerSecond != null }.sortedBy { it.time }
        if (points.size < 2) return SplitCalculation("no_speed_samples")
        if (points.any { !it.metersPerSecond!!.isFinite() || it.metersPerSecond < 0 || it.metersPerSecond > 20 })
            return SplitCalculation("invalid_speed")
        val groups = points.groupBy { it.time }
        if (groups.values.any { group -> group.map { it.metersPerSecond }.distinct().size > 1 }) return SplitCalculation("conflicting_samples")
        val unique = groups.values.map { it.first() }
        if (unique.size < 2) return SplitCalculation("no_speed_samples")
        fun seconds(a: Instant, b: Instant) = Duration.between(a, b).toMillis() / 1000.0
        if (seconds(start, unique.first().time) > MAX_EDGE_SECONDS || seconds(unique.last().time, end) > MAX_EDGE_SECONDS)
            return SplitCalculation("incomplete_edges")

        data class Interval(val seconds: Double, val startSpeed: Double, val endSpeed: Double, val meters: Double)
        val intervals = mutableListOf<Interval>()
        var gap = 0.0
        for ((a, b) in unique.zipWithNext()) {
            val dt = seconds(a.time, b.time)
            if (dt > MAX_INTERVAL_SECONDS) { gap += dt; continue }
            val v0 = a.metersPerSecond!!; val v1 = b.metersPerSecond!!
            intervals.add(Interval(dt, v0, v1, (v0 + v1) * dt / 2.0))
        }
        val covered = intervals.sumOf { it.seconds }
        val integrated = intervals.sumOf { it.meters }
        if (abs(covered - activeSeconds) > max(5.0, activeSeconds * 0.005))
            return SplitCalculation("duration_mismatch", integratedMeters = integrated, coveredSeconds = covered, gapSeconds = gap)
        if (integrated <= 0 || abs(integrated - distanceMeters) / distanceMeters > MAX_DISTANCE_ERROR)
            return SplitCalculation("distance_mismatch", integratedMeters = integrated, coveredSeconds = covered, gapSeconds = gap)
        val scale = distanceMeters / integrated
        val splits = mutableListOf<KilometreSplit>()
        var totalMeters = 0.0; var totalSeconds = 0.0
        var lastBoundaryMeters = 0.0; var lastBoundarySeconds = 0.0
        var nextBoundary = 1000.0
        for (interval in intervals) {
            val adjustedMeters = interval.meters * scale
            while (interval.meters > 0 && nextBoundary <= distanceMeters + 1e-6 && nextBoundary <= totalMeters + adjustedMeters + 1e-6) {
                val needed = ((nextBoundary - totalMeters) / scale).coerceIn(0.0, interval.meters)
                val acceleration = (interval.endSpeed - interval.startSpeed) / interval.seconds
                val root = sqrt(max(0.0, interval.startSpeed * interval.startSpeed + 2 * acceleration * needed))
                val at = if (needed <= 1e-9) 0.0 else (2 * needed / (interval.startSpeed + root)).coerceIn(0.0, interval.seconds)
                val boundarySeconds = totalSeconds + at
                splits.add(KilometreSplit(nextBoundary - lastBoundaryMeters, boundarySeconds - lastBoundarySeconds, false))
                lastBoundaryMeters = nextBoundary; lastBoundarySeconds = boundarySeconds
                nextBoundary += 1000.0
            }
            totalMeters += adjustedMeters; totalSeconds += interval.seconds
        }
        if (distanceMeters - lastBoundaryMeters > 1e-6) {
            splits.add(KilometreSplit(distanceMeters - lastBoundaryMeters, totalSeconds - lastBoundarySeconds, true))
            lastBoundarySeconds = totalSeconds
        }
        return SplitCalculation("calculated", splits, integrated, scale, covered, gap, max(0.0, totalSeconds - lastBoundarySeconds))
    }
}
