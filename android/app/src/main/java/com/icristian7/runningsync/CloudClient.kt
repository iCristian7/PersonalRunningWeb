package com.icristian7.runningsync

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.time.Instant

data class CloudSession(val accessToken: String, val refreshToken: String, val userId: String)

class CloudClient {
    private val base = "https://mepqzdircyjyrzkdncju.supabase.co"
    // This is a public client key. Access still requires a user session and row-level security.
    private val key = "sb_publishable_dU15zQA2xo7E_yIm4uemfA_X0Md0JMv"

    private suspend fun request(path: String, body: String? = null, token: String? = null, upsert: Boolean = false): String = withContext(Dispatchers.IO) {
        val connection = URI(base + path).toURL().openConnection() as HttpURLConnection
        try {
            connection.requestMethod = if (body == null) "GET" else "POST"
            connection.connectTimeout = 20000
            connection.readTimeout = 30000
            connection.setRequestProperty("apikey", key)
            connection.setRequestProperty("Content-Type", "application/json")
            token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            if (upsert) connection.setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal")
            if (body != null) {
                connection.doOutput = true
                connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            if (status !in 200..299) {
                val code = try { JSONObject(connection.errorStream?.bufferedReader()?.use { it.readText() } ?: "{}").optString("code") } catch (_: Exception) { "" }
                if (code == "PGRST204") throw IllegalStateException("Falta actualizar la tabla de Supabase. Ejecuta la migración 202610190001_workout_details.sql antes de sincronizar con esta versión.")
                // Do not expose response bodies, tokens or health payloads in logs/errors.
                throw IllegalStateException(when (status) {
                    400, 401 -> "No se pudo autenticar o enviar los datos. Confirma el correo, revisa la contraseña y vuelve a entrar."
                    403 -> "Acceso denegado. Comprueba los permisos de tu cuenta."
                    404 -> "No se encuentra la tabla de entrenos. Comprueba la configuración de Supabase."
                    else -> "El servidor no pudo completar la sincronización (HTTP $status). Puedes reintentar sin duplicar entrenos."
                })
            }
            connection.inputStream.bufferedReader().use { it.readText() }
        } finally { connection.disconnect() }
    }

    private fun session(response: String): CloudSession {
        val json = JSONObject(response)
        return CloudSession(json.getString("access_token"), json.getString("refresh_token"), json.getJSONObject("user").getString("id"))
    }

    suspend fun signIn(email: String, password: String): CloudSession = session(request(
        "/auth/v1/token?grant_type=password", JSONObject().put("email", email).put("password", password).toString()
    ))

    suspend fun refresh(current: CloudSession): CloudSession = session(request(
        "/auth/v1/token?grant_type=refresh_token", JSONObject().put("refresh_token", current.refreshToken).toString()
    ))

    suspend fun upload(rows: List<JSONObject>, current: CloudSession) {
        if (rows.isEmpty()) return
        val first = rows.minOf { Instant.parse(it.getString("started_at")) }.minusSeconds(2)
        val last = rows.maxOf { Instant.parse(it.getString("started_at")) }.plusSeconds(2)
        val existing = mutableListOf<JSONObject>()
        var offset = 0
        do {
            val page = JSONArray(request("/rest/v1/synced_workouts?user_id=eq.${current.userId}&source=eq.samsung_health&started_at=gte.$first&started_at=lte.$last&select=source_id,started_at,ended_at,sync_details,laps&order=started_at,source_id&limit=1000&offset=$offset", token = current.accessToken))
            for (i in 0 until page.length()) existing.add(page.getJSONObject(i))
            offset += page.length()
        } while (page.length() == 1000)
        fun identity(row: JSONObject) = WorkoutIdentity(row.getString("source_id"),
            Instant.parse(row.getString("started_at")), Instant.parse(row.getString("ended_at")),
            row.optJSONObject("sync_details")?.optString("samsung_id")?.takeIf { it.isNotBlank() })
        val identities = existing.map(::identity)
        // Resolve all aliases before the first write. Ambiguity aborts without merging unrelated runs.
        for (row in rows) {
            val match = WorkoutIdentityMatcher.find(identity(row), identities)
            if (match != null) {
                row.put("source_id", match.sourceId)
                val previous = existing.single { it.getString("source_id") == match.sourceId }
                if (!row.has("laps") && (previous.optJSONArray("laps")?.length() ?: 0) > 0)
                    row.getJSONObject("sync_details").put("lap_source", "health_connect_preserved")
            }
        }
        check(rows.map { it.getString("source_id") }.distinct().size == rows.size) {
            "Dos sesiones coinciden con el mismo entreno guardado. No se han enviado para evitar sobrescribir datos."
        }
        // Omit manual fields: PostgREST only updates the supplied columns on conflict.
        // Explicit user_id is checked by Supabase RLS against the access token.
        rows.groupBy { it.keys().asSequence().toList().sorted() }.values.forEach { group ->
            group.chunked(50).forEach { chunk ->
                request("/rest/v1/synced_workouts?on_conflict=user_id,source,source_id", JSONArray(chunk).toString(), current.accessToken, true)
            }
        }
    }
}
