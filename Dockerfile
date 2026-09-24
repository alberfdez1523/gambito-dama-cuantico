# syntax=docker/dockerfile:1

# ─── 1. Stockfish compilado desde el código incluido ─────────────────────────
# La imagen oficial de GCC ya incluye make y curl (para descargar la red NNUE).
FROM gcc:13-bookworm AS engine
WORKDIR /stockfish
COPY engine/stockfish/src ./src
COPY engine/stockfish/scripts ./scripts
WORKDIR /stockfish/src
# ARCH=x86-64 es portable; usa --build-arg STOCKFISH_ARCH=x86-64-avx2 si el host lo soporta.
ARG STOCKFISH_ARCH=x86-64
# `bench` falla si la red NNUE no se descargó: mejor romper el build que desplegar
# un motor que se cae en la primera búsqueda.
RUN make -j"$(nproc)" build ARCH="${STOCKFISH_ARCH}" \
 && strip stockfish \
 && ./stockfish bench 16 1 6 > /dev/null

# ─── 2. Frontend (Vite + PWA) ────────────────────────────────────────────────
FROM node:20-bookworm-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Variables públicas de compilación (nunca claves privadas).
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_FEATURE_SUPPORTER="0"
ARG VITE_SUPPORTER_CHECKOUT_URL=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_FEATURE_SUPPORTER=$VITE_FEATURE_SUPPORTER \
    VITE_SUPPORTER_CHECKOUT_URL=$VITE_SUPPORTER_CHECKOUT_URL
RUN npm run build

# ─── 3. Runtime ──────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    FORWARDED_ALLOW_IPS="*"
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY --from=engine /stockfish/src/stockfish /usr/local/bin/stockfish
COPY server.py ./
COPY backend ./backend
COPY music ./music
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN useradd --system --uid 10001 --home /app gambito && chown -R gambito /app
USER gambito
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"8000\")}/api/health', timeout=4)"
CMD ["python", "server.py"]
