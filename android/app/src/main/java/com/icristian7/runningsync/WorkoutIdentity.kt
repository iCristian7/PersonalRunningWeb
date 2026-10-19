package com.icristian7.runningsync

import java.time.Instant
import kotlin.math.abs

data class WorkoutIdentity(val sourceId: String, val start: Instant, val end: Instant, val samsungId: String? = null)

object WorkoutIdentityMatcher {
    fun find(incoming: WorkoutIdentity, existing: List<WorkoutIdentity>): WorkoutIdentity? {
        val byId = existing.filter { it.sourceId == incoming.sourceId || (incoming.samsungId != null && it.samsungId == incoming.samsungId) }
        check(byId.size <= 1) { "Hay varias sesiones con el mismo identificador. No se han mezclado; revisa los duplicados existentes en la web." }
        if (byId.size == 1) return byId.single()
        val byTime = existing.filter {
            abs(java.time.Duration.between(it.start, incoming.start).toMillis()) <= 2000 &&
                abs(java.time.Duration.between(it.end, incoming.end).toMillis()) <= 2000
        }
        check(byTime.size <= 1) { "Hay varias sesiones con las mismas horas. No se han mezclado; revisa los duplicados existentes en la web." }
        return byTime.singleOrNull()
    }
}

object SamsungMetrics {
    fun secondsPerKm(speedMetersPerSecond: Double?): Double? =
        speedMetersPerSecond?.takeIf { it.isFinite() && it > 0 }?.let { 1000.0 / it }
}
