package com.icristian7.runningsync

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class KilometreSplitsTest {
    @Test fun heartRateIsAveragedSeparatelyForEachKilometre() {
        val points = (0..1000 step 5).map {
            SpeedPoint(start.plusSeconds(it.toLong()), 2.0, 100.0 + it / 10.0)
        }
        val result = calculate(1000, 2000.0, points)
        assertEquals(125.0, result.splits[0].heartRate!!, 1e-6)
        assertEquals(175.0, result.splits[1].heartRate!!, 1e-6)
        assertNull(calculate(500, 1000.0, constant(500)).splits.single().heartRate)
        val sparse = points.mapIndexed { i, point -> if (i % 10 != 0) point.copy(heartRate = null) else point }
        assertTrue(calculate(1000, 2000.0, sparse).splits.all { it.heartRate == null })
    }
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
    @Test fun boundedGapUsesElapsedTimeAndSeparateHeartSamples() {
        val speeds = constant(500) + (560..1060 step 5).map { p(it.toLong(), 2.0) }
        val hearts = (0..1060 step 5).map { SpeedPoint(start.plusSeconds(it.toLong()), null, 150.0) }
        val result = calculate(1060, 2120.0, speeds + hearts, active = 1000.0)
        assertEquals("calculated", result.status)
        assertEquals("elapsed_time", result.timeBasis)
        assertEquals(1060.0, result.splits.sumOf { it.seconds }, 1e-6)
        assertEquals(150.0, result.splits.first().heartRate!!, 1e-6)
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
        assertEquals("incomplete_edges", calculate(500, 1000.0, constant(500).drop(8)).status)
        assertEquals("incomplete_edges", calculate(100, 200.0, constant(100).drop(1)).status)
    }
    @Test fun reconstructsKilometresWithSmallMissingEdgesAndReportsEstimate() {
        // Regression: SDK trace starts 5s after start and ends 5s before end.
        // v0.5.0 discarded the entire workout before integrating any of its samples.
        val points = (5..995 step 5).map { SpeedPoint(start.plusSeconds(it.toLong()), 2.0, 150.0) }
        val result = calculate(1000, 2000.0, points)
        assertEquals("calculated", result.status)
        assertEquals(10.0, result.edgeEstimatedSeconds, 1e-6)
        assertEquals(2, result.splits.size)
        result.splits.forEach {
            assertEquals(1000.0, it.distanceMeters, 1e-6)
            assertEquals(500.0, it.seconds, 1e-6)
            assertEquals(150.0, it.heartRate!!, 1e-6)
        }
    }
    @Test fun continuousTraceWithPausesReturnsElapsedSplitsWithoutScalingTime() {
        val result = calculate(1000, 2000.0, constant(1000), active = 950.0)
        assertEquals("calculated", result.status)
        assertEquals("elapsed_time", result.timeBasis)
        assertEquals(1000.0, result.splits.sumOf { it.seconds }, 1e-6)
    }
    @Test fun smallEdgesDoNotOverrideDistanceValidation() {
        assertEquals("distance_mismatch", calculate(1000, 2500.0, constant(1000).drop(1).dropLast(1)).status)
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
