package com.icristian7.runningsync

import android.app.Activity
import android.os.Bundle
import android.widget.ScrollView
import android.widget.TextView

class PrivacyActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val text = TextView(this).apply {
            textSize = 17f
            setPadding(32, 48, 32, 48)
            text = """
                Running Sync · Privacidad

                App personal de Cristian para llevar sus entrenos de Samsung Health a PersonalRunningWeb.

                Se leen carreras de Samsung Health de la semana elegida mediante Samsung Health Data SDK: fecha, duración, distancia, velocidad media, frecuencia cardíaca, cadencia, desnivel, calorías y comentarios cuando estén disponibles. Las vueltas se añaden desde Health Connect si autorizas esa lectura. No se guardan ni envían rutas GPS ni se escribe en Samsung Health o Health Connect. Las notas de Samsung se conservan aparte de las notas adicionales escritas en la web.

                Al pulsar Sincronizar, los resúmenes se envían mediante HTTPS al proyecto mepqzdircyjyrzkdncju.supabase.co y se guardan vinculados a tu cuenta. No se envían automáticamente a ChatGPT. Tú decides cuándo copiar el resumen y compartirlo.

                La contraseña y los tokens no se guardan en archivos ni registros. La sesión permanece en memoria mientras la app está abierta. La base de datos limita el acceso a las sesiones de su propietario.

                Puedes revocar permisos en Ajustes → Health Connect → Permisos de aplicaciones → Running Sync. Revocar permisos detiene futuras lecturas, pero no borra lo ya sincronizado. Para borrar las sesiones almacenadas, utiliza el panel de tu proyecto de Supabase.

                Esta versión no lee en segundo plano. La lectura directa requiere permisos de Samsung Health y autorización del SDK. La lectura opcional de vueltas de Health Connect puede estar limitada a los 30 días previos a conceder permisos. Si una métrica no está disponible, se conserva como desconocida. El SDK de Samsung no expone vueltas de running. Los avisos de código abierto del SDK se incluyen en los assets de la app.

                Responsable y contacto: Cristian Pérez Segura, cristianperezsegura@gmail.com.
            """.trimIndent()
            append("\n\nAvisos de código abierto del SDK de Samsung:\n\n")
            append(assets.open("SamsungSDK-OpenSourceNotices.txt").bufferedReader().use { it.readText() })
        }
        setContentView(ScrollView(this).apply { addView(text) })
    }
}
