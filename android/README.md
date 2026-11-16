# Running Sync · 0.10.0

App personal para sincronizar los resúmenes semanales de running desde Samsung Health con la cuenta privada de PersonalRunningWeb.

## Uso

1. Instala `downloads/RunningSync-0.10.0.apk` sobre la versión anterior.
2. Pulsa **Conectar Samsung Health** y concede lectura de ejercicios.
3. Entra con la misma cuenta de entrenos que utilizas en la web.
4. Elige la semana y pulsa **Sincronizar semana**.
5. En la web, pulsa **Actualizar**, completa sensaciones, zapatillas y notas y copia el resumen para ChatGPT. Puedes adjuntar allí las capturas de Samsung que quieras analizar.

Se sincronizan los valores originales disponibles: fecha, duración, distancia, velocidad media, FC media/máxima, cadencia, desnivel, calorías y comentarios. El ritmo se convierte desde la velocidad media original; si falta, el informe identifica el cálculo con duración y distancia. Los campos vacíos se omiten en el texto para ChatGPT.

## Datos y privacidad

La app solo lee resúmenes de ejercicios mediante Samsung Health Data SDK 1.1.0. No utiliza Health Connect ni procesa registros detallados o rutas GPS. No escribe en Samsung Health. Los resúmenes se guardan en Supabase con acceso limitado al propietario. Contraseña y tokens permanecen en memoria. No hay sincronización en segundo plano.

Las nuevas sincronizaciones conservan las notas, sensaciones, zapatillas y metadatos guardados anteriormente. No se ejecuta ninguna eliminación ni cambio de esquema. El histórico manual y su planificación permanecen independientes.

## Acceso personal de desarrollo

Esta app utiliza el SDK oficial de Samsung. La lectura requiere una app registrada o el modo de lectura para desarrollo de Samsung Health, según https://developer.samsung.com/health/data/guide/developer-mode.html. En la pantalla del SDK activa el modo de lectura y concede permiso desde Running Sync. No necesita acceso de escritura.

## Compilar

Abre `android/` con Android Studio. Requiere JDK 17 o posterior y Android SDK plataforma 36; el APK admite Android 14 o posterior. Copia el SDK oficial `samsung-health-data-api-1.1.0.aar` en `android/app/libs/`; no se distribuye en Git. Los avisos de código abierto del SDK se incluyen en los assets.

Ejecuta `gradlew.bat :app:testDebugUnitTest :app:assembleDebug :app:lintDebug`. Conserva la misma clave de firma para instalar actualizaciones sobre la app existente.
