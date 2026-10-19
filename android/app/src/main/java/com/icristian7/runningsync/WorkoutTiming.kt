package com.icristian7.runningsync

import java.time.Duration
import java.time.Instant

data class TimeWindow(val start: Instant, val end: Instant)

object WorkoutTiming {
    /** Clip and merge paused intervals so overlaps cannot subtract the same pause twice. */
    fun activeSeconds(start: Instant, end: Instant, pauses: List<TimeWindow>): Double {
        val clipped = pauses.map { TimeWindow(maxOf(start, it.start), minOf(end, it.end)) }
            .filter { it.end > it.start }.sortedBy { it.start }
        var pausedMillis = 0L
        var merged: TimeWindow? = null
        for (window in clipped) {
            val previous = merged
            if (previous == null) merged = window
            else if (window.start <= previous.end) merged = TimeWindow(previous.start, maxOf(previous.end, window.end))
            else { pausedMillis += Duration.between(previous.start, previous.end).toMillis(); merged = window }
        }
        merged?.let { pausedMillis += Duration.between(it.start, it.end).toMillis() }
        return maxOf(0L, Duration.between(start, end).toMillis() - pausedMillis) / 1000.0
    }
}
