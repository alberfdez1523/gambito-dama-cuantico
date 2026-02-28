# ♛ ChessAI — Juega contra Stockfish en tu navegador

Aplicación web de ajedrez que te permite jugar contra el motor **Stockfish 17** de forma local. Incluye selección de color, cinco niveles de dificultad, evaluación en tiempo real, historial de movimientos y detección de jaque mate / tablas.

---

## Estructura del proyecto

```
CHESS-IA/
├── server.py          ← Backend FastAPI (sirve el frontend y comunica con Stockfish)
├── index.html         ← Interfaz principal
├── app.js             ← Lógica del tablero, turnos e interacción con la API
├── style.css          ← Estilos
├── package.json       ← Metadatos del proyecto
└── engine/
    └── stockfish/     ← Código fuente / binario de Stockfish
```

## Cómo funciona

1. **`server.py`** levanta un servidor FastAPI en `http://localhost:3000`.
2. Sirve los archivos estáticos (HTML, JS, CSS) y expone dos endpoints:
   - `POST /api/move` — recibe un FEN + dificultad y devuelve el mejor movimiento de Stockfish, junto con la evaluación de la posición.
   - `POST /api/eval` — devuelve solo la evaluación de una posición dada.
   - `GET /api/health` — comprueba que el motor esté listo.
3. **`app.js`** maneja toda la interfaz: dibuja el tablero, valida movimientos con [chess.js](https://github.com/jhlywa/chess.js), y tras cada jugada del usuario envía el FEN al servidor para obtener la respuesta de Stockfish.

### Niveles de dificultad

| Nivel        | Skill Level | Profundidad | ELO aprox. |
|--------------|:-----------:|:-----------:|:----------:|
| Principiante |      0      |      1      |   ~800     |
| Fácil        |      5      |      5      |  ~1200     |
| Medio        |     10      |     10      |  ~1600     |
| Difícil      |     15      |     14      |  ~2000     |
| Maestro      |     20      |     20      |  ~2600     |

---

## Requisitos previos

- **Python 3.10+**
- **Binario de Stockfish** (`.exe` en Windows) dentro de la carpeta `engine/`
- Dependencias de Python: `fastapi`, `uvicorn`, `python-chess`

---

## Instalación

### 1. Clonar o descargar el proyecto

```bash
git clone <url-del-repo>
cd CHESS-IA
```

### 2. Crear un entorno virtual e instalar dependencias

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate

pip install fastapi uvicorn python-chess
```

### 3. Colocar el binario de Stockfish

Descarga Stockfish desde [stockfishchess.org](https://stockfishchess.org/download/) y coloca el ejecutable en algún lugar dentro de `engine/`. El servidor lo buscará automáticamente. Ejemplo:

```
engine/
└── stockfish/
    └── stockfish-windows-x86-64-avx2.exe
```

---

## Arrancar la aplicación

```bash
python server.py
```

Verás en la terminal:

```
✓ Stockfish: engine\stockfish\stockfish-windows-x86-64-avx2.exe
Starting Stockfish engine …
✓ Engine ready

🚀  ChessAI server → http://localhost:3000
```

Abre **http://localhost:3000** en tu navegador y empieza a jugar.

---

## Uso

1. Elige tu **color** (Blancas, Negras o Azar).
2. Selecciona el **nivel de dificultad**.
3. Pulsa **Jugar**.
4. Haz tus movimientos haciendo clic o arrastrando las piezas.
5. Stockfish responderá automáticamente en su turno.

### Acciones disponibles durante la partida

| Botón        | Acción                                     |
|--------------|--------------------------------------------|
| ↩ Deshacer   | Deshace tu último movimiento y el de la IA |
| 🔄 Girar     | Gira el tablero 180°                       |
| 🏳️ Rendirse | Termina la partida como derrota            |
| ⟳ Nueva Partida | Vuelve al menú de inicio                |

---

## Licencia

MIT
