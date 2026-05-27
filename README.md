# Running Plan Web (minimalista)

Web minimalista para consultar entrenamientos desde cualquier sitio (móvil) y desplegar en Vercel.

## Novedad v2
- Listado completo de entrenamientos
- Buscador por fecha (input date)
- Texto libre de búsqueda
- El último entreno aparece destacado arriba

## Requisitos
- Node.js 18+ (recomendado 20)

## Desarrollo
```bash
npm install
npm run dev
```

## Cómo actualizar entrenamientos
1. Edita `data/workouts.json`
2. Añade una nueva entrada en el array `workouts`
3. Haz commit y push a GitHub (Vercel redeploy automático)

## Endpoints
- `GET /api/workouts` devuelve el JSON completo.

## Tip
Guarda la web como acceso directo en el móvil (Añadir a pantalla de inicio).
