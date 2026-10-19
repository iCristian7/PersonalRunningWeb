package com.icristian7.runningsync

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant

class WorkoutTimingTest {
    private val start = Instant.parse("2026-01-01T08:00:00Z")

    @Test fun subtractsSharedPauseFromTenKilometreExample() {
        // Synthetic regression: 1:05:00 elapsed minus 5:00 paused = 1:00:00.
        val end = start.plusSeconds(3900)
        val pauses = listOf(TimeWindow(start.plusSeconds(2000), start.plusSeconds(2300)))
        assertEquals(3600.0, WorkoutTiming.activeSeconds(start, end, pauses), 0.001)
    }

    @Test fun overlappingPausesAreNotCountedTwice() {
        val pauses = listOf(TimeWindow(start.plusSeconds(10), start.plusSeconds(30)), TimeWindow(start.plusSeconds(20), start.plusSeconds(40)))
        assertEquals(70.0, WorkoutTiming.activeSeconds(start, start.plusSeconds(100), pauses), 0.001)
    }

    @Test fun pausesAreClippedToLapBoundaries() {
        val pauses = listOf(TimeWindow(start.minusSeconds(5), start.plusSeconds(5)), TimeWindow(start.plusSeconds(95), start.plusSeconds(110)))
        assertEquals(90.0, WorkoutTiming.activeSeconds(start, start.plusSeconds(100), pauses), 0.001)
    }

    @Test fun emptyOrInvalidPausesCannotCreateNegativeTimes() {
        assertEquals(100.0, WorkoutTiming.activeSeconds(start, start.plusSeconds(100), emptyList()), 0.001)
        assertEquals(0.0, WorkoutTiming.activeSeconds(start, start.plusSeconds(100), listOf(TimeWindow(start.minusSeconds(10), start.plusSeconds(200)))), 0.001)
    }
}
