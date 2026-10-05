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

                Solo se leen carreras de Samsung Health de la semana elegida. Según los permisos concedidos y los datos compartidos, se leen fecha, duración, distancia, frecuencia cardíaca, cadencia, desnivel, calorías y vueltas. No se leen rutas GPS ni se escribe en Health Connect o Samsung Health.

                Al pulsar Sincronizar, los resúmenes se envían mediante HTTPS al proyecto mepqzdircyjyrzkdncju.supabase.co y se guardan vinculados a tu cuenta. No se envían automáticamente a ChatGPT. Tú decides cuándo copiar el resumen y compartirlo.

                La contraseña y los tokens no se guardan en archivos ni registros. La sesión permanece en memoria mientras la app está abierta. La base de datos limita el acceso a las sesiones de su propietario.

                Puedes revocar permisos en Ajustes → Health Connect → Permisos de aplicaciones → Running Sync. Revocar permisos detiene futuras lecturas, pero no borra lo ya sincronizado. Para borrar las sesiones almacenadas, utiliza el panel de tu proyecto de Supabase.

                Esta versión no lee en segundo plano ni solicita acceso ampliado al historial. Los datos disponibles pueden estar limitados a los 30 días previos a conceder permisos. Si una métrica no está disponible, se conserva como desconocida.

                Responsable y contacto: Cristian Pérez Segura, cristianperezsegura@gmail.com.
            """.trimIndent()
        }
        setContentView(ScrollView(this).apply { addView(text) })
    }
}
