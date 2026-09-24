# Estado de implementación

Fecha de corte: 24 de septiembre de 2026.

| Área | Estado | Evidencia o condición |
|---|---|---|
| Contratos, currículo y progreso | Implementado | Tipos públicos, Zod, 16 módulos, 64 actividades, scoring, dominio, diagnóstico y repaso |
| Inicio, navegación y Academia | Implementado | Rutas profundas, inicio nuevo/recurrente, diagnóstico, mapa, error, diario y sprint |
| Coherencia limitada local/IA | Implementado | Capacidad 2/4/6, validación del motor, medidores accesibles y pruebas de propiedades |
| IA cuántica | Implementado | Web Worker, semilla, búsqueda presupuestada, cancelación y fallback local |
| PWA y accesibilidad | Implementado | App shell offline, paquetes educativos, actualización segura, fuentes locales y preferencias |
| Cuenta y progreso local-first | Implementado | Invitado persistente, IndexedDB, magic link/Google opcionales y cola append-only |
| Replays y análisis | Implementado | Acciones neutrales, mediciones reproducibles, análisis clásico/cuántico y laboratorio ramificado |
| API v1 | Implementado | Progreso, recomendación, coach, diario, replay, analítica, partidas, exportación y borrado |
| Esquema Supabase y RLS | Implementado en repositorio | Cinco migraciones versionadas, probadas en CI sobre PGlite; falta aplicarlas al proyecto de destino |
| Lobby online heredado | Endurecido | RPC de unión/abandono/limpieza, trigger de guardia y semilla generada en Postgres; sigue siendo cliente-autoritativo |
| Límites de uso de la API | Implementado (por proceso) | Límite por IP en memoria; con varias instancias necesita un almacén compartido |
| Persistencia API en Supabase | Preparado, no conectado | El adaptador local es en memoria; producción debe implementar el repositorio con `service_role` |
| Online clásico autoritativo | Contrato/beta técnica | Servicio de acciones disponible; el lobby legado sigue durante la transición |
| Online cuántico autoritativo | No expuesto; gate de servidor cerrado | Requiere núcleo TS compartido en servidor y simulación concurrente sin divergencias |
| Competitivo 10+5 y Glicko-2 | No implementado en UI | Requiere beta cerrada estable, carga y operación; no se expone aún al usuario |
| Membresía Stripe | UI preparada, apagada | Requiere Checkout real, webhook/entitlements y revisión de cosméticos |
| Clasificación semanal | No publicada | Solo se habilitará con validación online y controles de integridad |

## Servicios externos pendientes

1. Crear o seleccionar el proyecto Supabase, ejecutar migraciones y configurar Auth anónimo, enlace mágico y Google.
2. Implementar el adaptador de persistencia del backend con credencial `service_role`; esa clave nunca entra en Vite.
3. Configurar Stripe Checkout, webhook idempotente y escritura de entitlements desde servidor.
4. Ejecutar carga del pool Stockfish y del servicio de acciones con concurrencia representativa.
5. Extraer el Game Core a un paquete TypeScript importable por navegador, worker y servicio autoritativo.
6. Completar beta online cerrada antes de añadir y activar el flag competitivo de cliente.

## Verificación completada

- `npm ci`: lockfile reproducible.
- Frontend: ESLint sin avisos, typecheck y 82 pruebas unitarias (incluye la aplicación de todas las migraciones sobre PGlite y las políticas del lobby).
- Backend: ruff y 32 pruebas (incluye path traversal, límite de peticiones y límites de payload cuántico).
- E2E: 22 recorridos en Chromium, más dos pruebas PWA de producción y una de gates apagados. La matriz Firefox/WebKit se mantiene en `npm run e2e`, pero no se ha vuelto a ejecutar tras estos cambios.
- Build: entrada crítica ~116 kB gzip (JS + CSS), vigilada en CI con un presupuesto de 150 kB; precarga PWA ~945 kB.
- Docker: la imagen se construye y sirve la app como usuario sin privilegios; el build falla si Stockfish no tiene su red NNUE.

No se declara listo el competitivo: las pruebas locales validan el código entregado, pero no sustituyen aplicar las migraciones, carga real ni beta operativa.
