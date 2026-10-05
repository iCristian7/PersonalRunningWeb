package com.icristian7.runningsync

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI

data class CloudSession(val accessToken: String, val refreshToken: String, val userId: String)

class CloudClient {
    private val base = "https://mepqzdircyjyrzkdncju.supabase.co"
    // This is a public client key. Access still requires a user session and row-level security.
    private val key = "sb_publishable_dU15zQA2xo7E_yIm4uemfA_X0Md0JMv"

    private suspend fun request(path: String, body: String, token: String? = null, upsert: Boolean = false): String = withContext(Dispatchers.IO) {
        val connection = URI(base + path).toURL().openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 20000
            connection.readTimeout = 30000
            connection.setRequestProperty("apikey", key)
            connection.setRequestProperty("Content-Type", "application/json")
            token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            if (upsert) connection.setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal")
            connection.doOutput = true
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            if (status !in 200..299) {
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
        // Omit manual fields: PostgREST only updates the supplied columns on conflict.
        // Explicit user_id is checked by Supabase RLS against the access token.
        rows.chunked(50).forEach { chunk ->
            request("/rest/v1/synced_workouts?on_conflict=user_id,source,source_id", JSONArray(chunk).toString(), current.accessToken, true)
        }
    }
}
