# Running Plan Web v5

Entrenamientos: 123 + 1 plan

## Cambios v5
- Scroll infinito (carga de 15 en 15)
- Cards clickables (sin botón)
- CSS restaurado y mejorado

## Dev
npm install && npm run dev

## Deploy
Vercel (Next.js)

## Samsung Health

La pestaña Samsung Health permite entrar con una cuenta privada, ver los entrenos sincronizados, completar sensaciones/zapatillas/notas y copiar el resumen semanal para ChatGPT.

Configuración: [Supabase](supabase/README.md). App del móvil: [Running Sync](android/README.md).

En Vercel, configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` para Production antes de desplegar. En Supabase → Authentication → URL Configuration, establece `https://personal-running-web.vercel.app` como Site URL para que los correos de confirmación vuelvan a la web publicada. Para las pruebas locales puedes añadir `http://127.0.0.1:3000` y `http://localhost:3000` a Redirect URLs. La cuenta de entrenos se crea desde la web, no es la cuenta del panel de Supabase.

Desarrollo y pruebas requieren Node.js 24. Ejecuta `npm test` para las pruebas del resumen semanal.

La integración necesita una primera prueba con datos reales del móvil. El histórico JSON y sus estadísticas siguen separados de las sesiones privadas sincronizadas para evitar contar dos veces entrenos importados anteriormente.
