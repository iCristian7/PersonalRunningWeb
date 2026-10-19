package com.icristian7.runningsync

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class WorkoutIdentityTest {
    private val start = Instant.parse("2026-01-01T08:00:00Z")
    private fun row(id: String, shift: Long = 0, samsungId: String? = null) =
        WorkoutIdentity(id, start.plusSeconds(shift), start.plusSeconds(3600 + shift), samsungId)

    @Test fun matchesOldHealthConnectRowByTimes() {
        assertEquals("health-connect-id", WorkoutIdentityMatcher.find(row("new-sdk-id"), listOf(row("health-connect-id")))?.sourceId)
    }
    @Test fun samsungAliasKeepsCanonicalIdOnRepeatedSync() {
        assertEquals("health-connect-id", WorkoutIdentityMatcher.find(row("sdk-id", samsungId = "sdk-id"), listOf(row("health-connect-id", samsungId = "sdk-id")))?.sourceId)
    }
    @Test fun doesNotMergeDifferentRuns() {
        assertNull(WorkoutIdentityMatcher.find(row("new", shift = 60), listOf(row("old"))))
    }
    @Test(expected = IllegalStateException::class) fun ambiguousOldRowsAbortInsteadOfOverwriting() {
        WorkoutIdentityMatcher.find(row("sdk-id"), listOf(row("old-one"), row("old-two")))
    }
    @Test fun allowsTwoSecondTimestampRounding() {
        assertEquals("old", WorkoutIdentityMatcher.find(row("sdk-id", shift = 2), listOf(row("old")))?.sourceId)
    }
    @Test fun canonicalIdWinsOverAnotherNearbyRow() {
        assertEquals("same", WorkoutIdentityMatcher.find(row("same"), listOf(row("same"), row("other")))?.sourceId)
    }
    @Test fun usesSamsungSpeedWithoutReplacingItWithElapsedPace() {
        assertEquals(500.0, SamsungMetrics.secondsPerKm(2.0)!!, 0.0001)
        assertNull(SamsungMetrics.secondsPerKm(0.0))
        assertNull(SamsungMetrics.secondsPerKm(Double.NaN))
        assertNull(SamsungMetrics.secondsPerKm(null))
    }
}
