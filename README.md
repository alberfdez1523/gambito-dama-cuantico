# ChessAI

Aplicacion web para jugar ajedrez contra Stockfish desde el navegador.

Incluye:
- Seleccion de color (blancas, negras o azar)
- 5 niveles de dificultad
- Historial descriptivo de movimientos
- Probabilidades de victoria/tablas/derrota segun evaluacion del motor
- Soporte de mouse y tactil
- Musica ambiente y efectos de sonido

## Stack tecnico

- Frontend: `index.html` + `style.css` + `app.js`
- Reglas de ajedrez en cliente: `chess.js`
- Backend: `FastAPI` (`server.py`)
- Motor: `Stockfish` local via `python-chess`

## Estructura

```txt
CHESS-IA/
|- app.js
|- index.html
|- style.css
|- server.py
|- requirements.txt
|- render.yaml
|- package.json
|- music/
|  \- lofi.mp3
\- engine/
     \- stockfish/
```

## Requisitos

- Python 3.10 o superior
- Pip actualizado
- Binario de Stockfish disponible (en `engine/` o instalado en el sistema)

## Instalacion local

1. Crear y activar entorno virtual.

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate
```

2. Instalar dependencias.

```bash
pip install -r requirements.txt
```

3. Asegurar Stockfish.

- Opcion A: tener `stockfish` instalado en el sistema (PATH).
- Opcion B: colocar el ejecutable dentro de `engine/`.

Ejemplo en Windows:

```txt
engine/
\- stockfish/
     \- stockfish-windows-x86-64-avx2.exe
```

## Ejecutar en local

```bash
python server.py
```

Luego abrir:

```txt
http://localhost:3000
```

## API

- `GET /api/health`
    Verifica que el backend esta vivo y que Stockfish se detecto.

- `POST /api/move`
    Pide la mejor jugada para una posicion.

    Body:

```json
{
    "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "difficulty": "medium"
}
```

    Respuesta:

```json
{
    "bestmove": "e2e4",
    "evaluation": 22,
    "mate": null,
    "ponder": "c7c5"
}
```

- `POST /api/eval`
    Evalua posicion sin forzar jugada.

## Dificultades

| Nivel | Skill | Depth | Time (s) | ELO aprox |
|---|---:|---:|---:|---:|
| beginner | 0 | 1 | 0.05 | 800 |
| easy | 5 | 5 | 0.15 | 1200 |
| medium | 10 | 10 | 0.3 | 1600 |
| hard | 15 | 14 | 0.6 | 2000 |
| master | 20 | 20 | 1.0 | 2600 |

## Publicar gratis para compartirla con cualquiera

La forma mas simple para que cualquier persona entre por URL es desplegar en Render.

### Opcion recomendada: Render (gratis)

1. Subir el proyecto a GitHub.
2. Crear cuenta en Render: `https://render.com`.
3. En Render, crear un nuevo servicio desde el repositorio.
4. Detectara `render.yaml` automaticamente.
5. Esperar build y deploy.
6. Compartir la URL publica de Render (ejemplo: `https://chess-ia.onrender.com`).

Notas importantes:
- Plan gratis puede "dormir" la app tras inactividad; el primer acceso tarda unos segundos.
- `server.py` ya soporta puerto dinamico con variable `PORT` (requerido en cloud).
- Si Render no encontrara Stockfish por paquete del sistema, puedes subir un binario Linux en `engine/`.

### Configuracion manual en Render (si no usa `render.yaml`)

- Environment: `Python`
- Build Command:

```bash
pip install -r requirements.txt ; apt-get update ; apt-get install -y stockfish
```

- Start Command:

```bash
python server.py
```

## Calidad y mantenimiento

- El codigo de frontend y backend esta comentado por secciones para que sea facil de mantener.
- El backend reutiliza una sola instancia de Stockfish para mejor rendimiento.
- Se protege el acceso a `engine/` desde el router estatico.

## Solucion de problemas

- Error `Stockfish binary not found`:
    Instala Stockfish en sistema o coloca ejecutable en `engine/`.

- El boton `Jugar` queda deshabilitado:
    Revisa que `python server.py` este en ejecucion y que `GET /api/health` responda `ok`.

- En movil no arrastra piezas:
    La app soporta touch; prueba tap en origen y destino si el gesto no se reconoce.

## Licencia

MIT
