package com.icristian7.runningsync

import android.app.DatePickerDialog
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.text.InputType
import android.view.WindowManager
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.Instant
import com.samsung.android.sdk.health.data.error.HealthDataException
import com.samsung.android.sdk.health.data.error.ErrorCode

class MainActivity : ComponentActivity() {
    private val cloud = CloudClient()
    private var session: CloudSession? = null
    private var monday = startOfWeek(LocalDate.now().minusWeeks(1))
    private lateinit var status: TextView
    private lateinit var weekButton: Button
    private lateinit var email: EditText
    private lateinit var password: EditText
    private val controls = mutableListOf<Button>()
    private var health: HealthConnectClient? = null
    private val permissionLauncher = registerForActivityResult(PermissionController.createRequestPermissionResultContract()) { granted ->
        status.text = if (HealthReader.requiredPermission in granted)
            "Permiso de ejercicios concedido. Los campos opcionales solo se leerán si los autorizas."
        else "Se necesita el permiso de ejercicios para sincronizar."
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
        health = if (HealthConnectClient.getSdkStatus(this) == HealthConnectClient.SDK_AVAILABLE) HealthConnectClient.getOrCreate(this) else null
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            fitsSystemWindows = true
            val padding = (20 * resources.displayMetrics.density).toInt()
            setPadding(padding, padding, padding, padding)
        }
        val scroll = ScrollView(this).apply { addView(layout) }
        setContentView(scroll)
        fun text(value: String, size: Float = 16f) = TextView(this).apply { text = value; textSize = size; setPadding(0, 12, 0, 12); layout.addView(this) }
        fun button(value: String, action: () -> Unit): Button = Button(this).apply {
            text = value; setOnClickListener { action() }; layout.addView(this); controls.add(this)
        }
        text("Running Sync · 0.3.0", 26f)
        text("Métricas originales de Samsung Health → tu web. Duración, distancia, velocidad media, cadencia, desnivel, FC, calorías y notas disponibles en el SDK. No se solicitan rutas GPS ni se modifica Samsung Health.")
        status = text("Primero conecta Samsung Health y entra con tu cuenta de entrenos.")
        button("1. Conectar Samsung Health") {
            runTask {
                val granted = SamsungReader(this).requestPermission(this)
                status.text = if (granted) "Lectura directa de ejercicios autorizada." else "No se concedió el permiso de ejercicios de Samsung Health."
            }
        }
        text("Versión personal de desarrollo: Samsung debe autorizar la lectura del SDK (modo de lectura de pruebas o app registrada). Si no está autorizado, se mostrará un error; no se cambiará silenciosamente a métricas aproximadas.", 14f)
        button("Opcional: permitir vueltas de Health Connect") {
            if (health == null) status.text = "Health Connect no está disponible. Actualiza Android y Health Connect."
            else permissionLauncher.launch(setOf(HealthReader.requiredPermission))
        }
        text("2. Entra con la cuenta que creaste en la pestaña Samsung Health de tu web. Confirma antes el correo de registro.")
        email = EditText(this).apply {
            hint = "Correo"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            layout.addView(this)
        }
        password = EditText(this).apply {
            hint = "Contraseña"; inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            isSaveEnabled = false
            layout.addView(this)
        }
        button("Entrar") {
            val loginEmail = email.text.toString().trim()
            val loginPassword = password.text.toString()
            if (loginEmail.isEmpty() || loginPassword.isEmpty()) status.text = "Introduce correo y contraseña."
            else runTask {
                session = null
                try { session = cloud.signIn(loginEmail, loginPassword); status.text = "Sesión iniciada. Ya puedes sincronizar." }
                finally { password.text.clear() }
            }
        }
        weekButton = button(weekLabel()) {
            DatePickerDialog(this, { _, year, month, day ->
                monday = startOfWeek(LocalDate.of(year, month + 1, day)); weekButton.text = weekLabel()
            }, monday.year, monday.monthValue - 1, monday.dayOfMonth).show()
        }
        button("3. Sincronizar semana") {
            val current = session
            if (current == null) status.text = "Primero entra con tu cuenta."
            else runTask {
                status.text = "Leyendo carreras de Samsung Health…"
                val refreshed = cloud.refresh(current)
                session = refreshed
                val rows = SamsungReader(this).readWeek(monday, refreshed.userId)
                // Optional laps must match one original session unambiguously; no metrics are substituted.
                val lapRows = try { health?.let { HealthReader(it).readLapRows(monday) }.orEmpty() }
                    catch (error: kotlinx.coroutines.CancellationException) { throw error }
                    catch (_: Exception) {
                        rows.forEach { it.getJSONObject("sync_details").put("lap_read_status", "health_connect_unavailable") }
                        emptyList()
                    }
                for (row in rows) {
                    val matches = lapRows.filter { lap ->
                        kotlin.math.abs(java.time.Duration.between(Instant.parse(row.getString("started_at")), Instant.parse(lap.getString("started_at"))).toMillis()) <= 2000 &&
                        kotlin.math.abs(java.time.Duration.between(Instant.parse(row.getString("ended_at")), Instant.parse(lap.getString("ended_at"))).toMillis()) <= 2000
                    }
                    if (matches.size == 1) {
                        row.put("laps", matches.single().getJSONArray("laps"))
                        row.getJSONObject("sync_details").put("lap_source", "health_connect")
                    }
                }
                if (rows.isEmpty()) status.text = "No se encontraron carreras en Samsung Health para esta semana. Sincroniza primero el reloj con Samsung Health y revisa la semana elegida."
                else {
                    status.text = "Enviando ${rows.size} entrenos a tu cuenta…"
                    cloud.upload(rows, refreshed)
                    val missing = rows.count { it.isNull("distance_m") || it.isNull("hr_avg") }
                    val noCadence = rows.count { it.isNull("cadence_avg") }
                    val noElevation = rows.count { it.isNull("elevation_gain_m") }
                    val noLaps = rows.count { it.isNull("laps") }
                    status.text = "Sincronizados ${rows.size} entrenos desde el SDK de Samsung Health. Conservadas sensaciones, notas adicionales y zapatillas.\n$missing sesiones sin distancia o FC media; $noCadence sin cadencia; $noElevation sin desnivel; $noLaps sin vueltas nuevas.\nEl ritmo se obtiene de la velocidad media original cuando está disponible. El SDK no expone vueltas de running: se conservan las anteriores o se añaden las compartidas por Health Connect. Abre la web y pulsa Actualizar."
                }
            }
        }
        button("Abrir mi web") { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://personal-running-web.vercel.app/"))) }
        button("Cerrar sesión") { session = null; password.text.clear(); status.text = "Sesión cerrada." }
        button("Privacidad y permisos") { startActivity(Intent(this, PrivacyActivity::class.java)) }
        text("La sesión se mantiene solo mientras la app está abierta. La contraseña no se guarda. Esta versión sincroniza al pulsar el botón, sin tareas en segundo plano.", 14f)
    }

    private fun runTask(task: suspend () -> Unit) {
        controls.forEach { it.isEnabled = false }
        lifecycleScope.launch {
            try { task() }
            catch (error: kotlinx.coroutines.CancellationException) { throw error }
            catch (error: HealthDataException) {
                status.text = when (error.errorCode) {
                    ErrorCode.ERR_ACCESS_CONTROL, ErrorCode.ERR_INVALID_CALLER -> "Samsung Health no autoriza esta app de desarrollo. Activa la lectura para pruebas del Samsung Health Data SDK o registra el paquete y firma con Samsung. Código: ${error.errorCode}."
                    ErrorCode.ERR_NO_USER_PERMISSION -> "Samsung Health no ha concedido lectura de ejercicios. Pulsa Conectar Samsung Health."
                    ErrorCode.ERR_OLD_VERSION_PLATFORM -> "Actualiza Samsung Health a una versión compatible con el SDK (6.30.2 o posterior)."
                    ErrorCode.ERR_PLATFORM_NOT_INSTALLED, ErrorCode.ERR_PLATFORM_DISABLED, ErrorCode.ERR_PLATFORM_NOT_INITIALIZED -> "Abre Samsung Health y completa su configuración antes de conectar la app."
                    else -> "Samsung Health no pudo completar la lectura (código ${error.errorCode ?: 0}). Abre Samsung Health y vuelve a intentarlo."
                }
            }
            catch (_: SecurityException) { status.text = "Permisos revocados. Vuelve a concederlos en Health Connect." }
            catch (error: Exception) {
                status.text = if (error is IllegalStateException) error.message ?: "No se pudo completar la operación." else "No se pudo completar la operación. Comprueba internet y los permisos, y vuelve a intentarlo."
            }
            finally { controls.forEach { it.isEnabled = true } }
        }
    }

    private fun weekLabel(): String {
        val fmt = DateTimeFormatter.ofPattern("dd/MM/yyyy")
        return "Semana: ${monday.format(fmt)} – ${monday.plusDays(6).format(fmt)} (cambiar)"
    }
    private fun startOfWeek(date: LocalDate) = date.minusDays((date.dayOfWeek.value - 1).toLong())
}
