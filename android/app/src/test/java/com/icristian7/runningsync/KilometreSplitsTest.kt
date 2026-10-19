package com.icristian7.runningsync

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class KilometreSplitsTest {
    private val start = Instant.parse("2026-01-01T08:00:00Z")
    private fun p(seconds: Long, speed: Double?) = SpeedPoint(start.plusSeconds(seconds), speed)
    private fun constant(end: Int, speed: Double = 2.0) = (0..end step 5).map { p(it.toLong(), speed) }
    private fun calculate(end: Int, distance: Double, points: List<SpeedPoint>, active: Double = end.toDouble()) =
        KilometreSplits.calculate(start, start.plusSeconds(end.toLong()), active, distance, points)

    @Test fun constantSpeedProducesOneKilometre() {
        val result = calculate(500, 1000.0, constant(500))
        assertEquals("calculated", result.status)
        assertEquals(1, result.splits.size)
        assertEquals(500.0, result.splits.single().seconds, 1e-6)
        assertFalse(result.splits.single().partial)
    }
    @Test fun retainsDifferentPacesInsteadOfRepeatingMeanPace() {
        val points = constant(500) + (505..750 step 5).map { p(it.toLong(), 4.0) }
        // The 2→4 m/s transition is integrated, so the original total here is 1995 m.
        val result = calculate(750, 1995.0, points)
        assertEquals("calculated", result.status)
        assertEquals(500.0, result.splits[0].seconds, 1e-6)
        assertEquals(250.0, result.splits[1].seconds, 1e-6)
        assertEquals(995.0, result.splits[1].distanceMeters, 1e-6)
    }
    @Test fun interpolatesCrossingInsideAnAcceleratingInterval() {
        val points = (0..490 step 10).map { p(it.toLong(), 2.0) } + p(500, 4.0)
        val result = calculate(500, 1010.0, points)
        assertEquals("calculated", result.status)
        assertEquals(497.320508, result.splits[0].seconds, 1e-5)
        assertEquals(10.0, result.splits[1].distanceMeters, 1e-6)
        assertTrue(result.splits[1].partial)
    }
    @Test fun includesShortRunAsFinalPartial() {
        val result = calculate(375, 750.0, constant(375))
        assertTrue(result.splits.single().partial)
        assertEquals(750.0, result.splits.single().distanceMeters, 1e-6)
        assertEquals(375.0, result.splits.single().seconds, 1e-6)
    }
    @Test fun longGapRequiresAgreementWithOriginalActiveTime() {
        val points = constant(500) + (620..1120 step 5).map { p(it.toLong(), 2.0) }
        val accepted = calculate(1120, 2000.0, points, active = 1000.0)
        assertEquals("calculated", accepted.status)
        assertEquals(120.0, accepted.gapSeconds, 1e-6)
        assertEquals(listOf(500.0, 500.0), accepted.splits.map { it.seconds })
        assertEquals("duration_mismatch", calculate(1120, 2000.0, points).status)
    }
    @Test fun rejectsDistanceMismatchRatherThanManufacturingSplits() {
        assertEquals("distance_mismatch", calculate(500, 1200.0, constant(500)).status)
    }
    @Test fun reportsSmallDistanceAdjustmentAndConservesTotals() {
        val result = calculate(500, 1010.0, constant(500))
        assertEquals(1.01, result.distanceScale!!, 1e-6)
        assertEquals(1010.0, result.splits.sumOf { it.distanceMeters }, 1e-6)
        assertEquals(500.0, result.splits.sumOf { it.seconds }, 1e-6)
    }
    @Test fun refusesMissingTraceAndMissingEdges() {
        assertEquals("no_speed_samples", calculate(500, 1000.0, emptyList()).status)
        assertEquals("incomplete_edges", calculate(500, 1000.0, constant(500).drop(2)).status)
    }
    @Test fun refusesConflictingOrInvalidSpeeds() {
        assertEquals("conflicting_samples", calculate(500, 1000.0, constant(500) + p(10, 3.0)).status)
        assertEquals("invalid_speed", calculate(500, 1000.0, constant(500) + p(10, Double.NaN)).status)
    }
    @Test fun identicalDuplicateSamplesDoNotDuplicateDistance() {
        val result = calculate(500, 1000.0, constant(500) + p(10, 2.0))
        assertEquals(1000.0, result.integratedMeters!!, 1e-6)
    }
}
