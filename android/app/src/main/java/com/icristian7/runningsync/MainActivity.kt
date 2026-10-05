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
        text("Running Sync", 26f)
        text("Samsung Health → tu web. Se leen solo carreras de Samsung Health de la semana seleccionada. No se solicitan rutas GPS ni se modifica Samsung Health.")
        button("1. Conceder permisos") {
            if (health == null) status.text = "Health Connect no está disponible. Actualiza Android y Health Connect."
            else permissionLauncher.launch(HealthReader.permissions)
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
            val reader = health
            if (current == null) status.text = "Primero entra con tu cuenta."
            else if (reader == null) status.text = "Health Connect no está disponible."
            else runTask {
                status.text = "Leyendo carreras de Samsung Health…"
                val refreshed = cloud.refresh(current)
                session = refreshed
                val rows = HealthReader(reader).readWeek(monday, refreshed.userId)
                if (rows.isEmpty()) status.text = "No se encontraron carreras. Revisa la semana, sincroniza el reloj con Samsung Health y comprueba sus permisos de escritura en Health Connect. Sin permiso de historial, Health Connect limita los datos anteriores a los 30 días previos a autorizar la app."
                else {
                    status.text = "Enviando ${rows.size} entrenos a tu cuenta…"
                    cloud.upload(rows, refreshed)
                    val missing = rows.count { it.isNull("distance_m") || it.isNull("hr_avg") }
                    status.text = "Sincronizados ${rows.size} entrenos. Las sincronizaciones repetidas actualizan las mismas sesiones y conservan sensaciones, notas y zapatillas.\n$missing sesiones sin distancia o FC media compartidas por Samsung Health. Abre la web y pulsa Actualizar."
                }
            }
        }
        button("Abrir mi web") { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://personal-running-web.vercel.app/"))) }
        button("Cerrar sesión") { session = null; password.text.clear(); status.text = "Sesión cerrada." }
        button("Privacidad y permisos") { startActivity(Intent(this, PrivacyActivity::class.java)) }
        status = text("La primera sincronización requiere permisos e inicio de sesión.")
        text("La sesión se mantiene solo mientras la app está abierta. La contraseña no se guarda. Esta versión sincroniza al pulsar el botón, sin tareas en segundo plano.", 14f)
    }

    private fun runTask(task: suspend () -> Unit) {
        controls.forEach { it.isEnabled = false }
        lifecycleScope.launch {
            try { task() }
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
