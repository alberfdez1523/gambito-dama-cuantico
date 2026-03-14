# Gambito de Dama Cuantico

Aplicacion web de ajedrez con dos modos de juego:

- Modo clasico
  - Vs IA (Stockfish)
  - 2 jugadores locales (sin IA)
- Modo cuantico
  - 2 jugadores locales (sin IA)
  - Superposicion, fusion, enroque cuantico, medicion y efecto tunel

## Novedades recientes (Marzo 2026)

- Rebranding completo a `Gambito de Dama Cuantico`.
- Modo clasico con selector de oponente:
  - `Vs IA` (Stockfish)
  - `2 jugadores locales`
- Modo cuantico orientado a `2 jugadores locales`.
- Ruleta de medicion manual:
  - el usuario decide cuando girar,
  - muestra probabilidad vivo/muerto,
  - conserva resultado ~1 segundo antes de cerrar.
- Casuisticas de captura cuantica explicadas en UI y documentacion.
- Paneles laterales adaptados a movil (reglas y casuisticas en `details`).

## Implementaciones actuales

### Modo Clasico

- Reglas completas via `chess.js`
- 5 niveles de dificultad contra Stockfish (`beginner` a `master`)
- Opcion de partida local 2 jugadores
- Historial de jugadas descriptivo
- Barra de evaluacion (vs IA)
- Reloj opcional por color
- Promocion, enroque, deteccion de jaque mate y tablas

### Modo Cuantico (2 jugadores)

- Movimiento cuantico (split): piezas no peon pueden dividirse en 2 casillas
- Divisiones sucesivas: probabilidades 50/50, 25/25, etc.
- Fusion: estados de una misma pieza se reunen en una casilla
- Enroque cuantico con entrelazamiento
- Efecto tunel al atravesar estados cuanticos
- Medicion probabilistica al capturar entre estados clasicos/cuanticos
- Ruleta visual de medicion con:
  - porcentaje vivo/muerto
  - giro animado
  - resultado del colapso

#### Casuisticas de captura (cuantico)

- Clasica -> Clasica: captura normal, sin medicion.
- Clasica -> Cuantica: se mide la pieza objetivo.
  - Si existe en esa casilla, la captura ocurre.
  - Si no existe, la captura falla y la pieza objetivo colapsa en su otra posicion.
- Cuantica -> Clasica: se mide la pieza atacante.
  - Si existe, captura y colapsa a estado clasico.
  - Si no existe, la captura falla, pierde turno y colapsa en la otra casilla.
- Cuantica -> Cuantica:
  - Primero se mide la atacante.
  - Si la atacante existe, se mide la objetivo con la misma logica.

## UI / UX

- Frontend React + TypeScript + Vite
- Animaciones con Framer Motion
- Sonidos de jugada/captura/jaque/fin
- Musica ambiente con control de volumen
- Tema visual oscuro/claro
- Panel lateral con reglas claras por modo

## Stack tecnico

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion
- Motor clasico: `chess.js`
- Backend: FastAPI (`server.py`)
- IA: Stockfish via `python-chess`

## Estructura relevante

```txt
frontend/
  src/
    components/
      StartMenu.tsx
      GameScreen.tsx
      QuantumGameScreen.tsx
      QuantumMeasurementRoulette.tsx
      Board.tsx
      QuantumBoard.tsx
    hooks/
      useChessGame.ts
      useQuantumChess.ts
    lib/
      quantumEngine.ts
      types.ts
server.py
```

## Instalacion

### Requisitos

- Python 3.10+
- Node.js 18+
- Stockfish (en PATH o dentro de `engine/`)

### Backend

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
python server.py
```

### Frontend (build)

```bash
cd frontend
npm install
npm run build
```

La app se sirve en `http://localhost:8000` desde FastAPI usando `frontend/dist`.

Nota: el frontend legado de la raíz fue eliminado. Si `frontend/dist` no existe, compílalo antes de arrancar el backend o usa `npm run dev` dentro de `frontend/`.

## API disponible

- `GET /api/health`
- `POST /api/move`
- `POST /api/eval`
- `POST /api/quantum/move` (mantenido para analisis multiverso, aunque el modo cuantico actual esta orientado a 2 jugadores)

## Nombre del proyecto

- Nombre publico: `Gambito de Dama Cuantico`
- Servicio Render sugerido: `gambito-dama-cuantico`

## Notas de uso

- En modo clasico 2 jugadores y en modo cuantico no hace falta motor IA para jugar.
- Si quieres usar modo clasico vs IA, asegurate de que Stockfish este detectado.

## Licencia

MIT
