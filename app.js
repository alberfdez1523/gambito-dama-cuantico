/* ═══════════════════════════════════════════════════════
   ChessAI — v3: Frontend rediseñado con GSAP
   ═══════════════════════════════════════════════════════ */

const API_BASE = '';  // mismo origen — servido por FastAPI

// ─── Wrapper seguro de GSAP para evitar errores si el CDN falla ───
const gsapSafe = {
    to:       (...args) => { try { return gsap.to(...args);       } catch(e) {} },
    from:     (...args) => { try { return gsap.from(...args);     } catch(e) {} },
    fromTo:   (...args) => { try { return gsap.fromTo(...args);   } catch(e) {} },
    timeline: (...args) => { try { return gsap.timeline(...args); } catch(e) {} },
    set:      (...args) => { try { return gsap.set(...args);      } catch(e) {} },
};

// ─── Piece Unicode Map (estilo clásico relleno, estable en móvil/desktop) ───
// Usamos la serie negra para todas y dejamos el color al CSS, como el diseño original.
// FE0E fuerza presentación de texto para evitar fallback emoji en iOS/Android.
const PIECE_UNICODE = {
    wK: '\u265A\uFE0E', wQ: '\u265B\uFE0E', wR: '\u265C\uFE0E', wB: '\u265D\uFE0E', wN: '\u265E\uFE0E', wP: '\u265F\uFE0E',
    bK: '\u265A\uFE0E', bQ: '\u265B\uFE0E', bR: '\u265C\uFE0E', bB: '\u265D\uFE0E', bN: '\u265E\uFE0E', bP: '\u265F\uFE0E'
};

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const DIFF_META = {
    beginner: { icon: '●', label: 'Principiante', elo: '~800' },
    easy:     { icon: '●', label: 'Fácil',        elo: '~1200' },
    medium:   { icon: '●', label: 'Medio',        elo: '~1600' },
    hard:     { icon: '●', label: 'Difícil',      elo: '~2000' },
    master:   { icon: '●', label: 'Maestro',      elo: '~2600' },
};

// ---------------------------------------------------------------------------
// Efectos de sonido generados por WebAudio
// ---------------------------------------------------------------------------
// Mantiene todo autocontenido (sin archivos de audio cortos para cada efecto).
class SoundFX {
    constructor() { this.ctx = null; }
    _getCtx() {
        // El contexto puede empezar suspendido hasta interacción del usuario.
        if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
    }
    _tone(freq, dur, type = 'sine', vol = 0.2) {
        const ctx = this._getCtx(); if (!ctx) return;
        try { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime); o.stop(ctx.currentTime + dur); } catch {}
    }
    move()    { this._tone(600, 0.06, 'sine', 0.15); }
    capture() { this._tone(250, 0.12, 'triangle', 0.25); this._tone(180, 0.15, 'sine', 0.1); }
    check()   { this._tone(880, 0.18, 'square', 0.1); }
    end()     { this._tone(523, 0.12); setTimeout(() => this._tone(659, 0.12), 120); setTimeout(() => this._tone(784, 0.25), 240); }
}

// ---------------------------------------------------------------------------
// Música de fondo (archivo mp3)
// ---------------------------------------------------------------------------
class AmbientMusic {
    constructor() {
        this.audio = new Audio('music/lofi.mp3');
        this.audio.loop = true;
        this.audio.volume = 0.5;
        this.isPlaying = false;
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.audio.play().catch(() => {});
    }

    stop() {
        this.isPlaying = false;
        this.audio.pause();
    }

    setVolume(v) {
        this.audio.volume = Math.max(0, Math.min(1, v));
    }

    toggle() {
        // Devuelve el estado final para refrescar texto del botón desde fuera.
        if (this.isPlaying) this.stop(); else this.start();
        return this.isPlaying;
    }
}

// Global ambient music instance
const ambientMusic = new AmbientMusic();

// ═══════════════════════════════════════
//  START MENU
// ═══════════════════════════════════════

class StartMenu {
    constructor(onPlay) {
        this.onPlay = onPlay;
        this.selectedColor = 'w';
        this.selectedDiff  = 'medium';
        this.serverReady   = false;

        this._bind();
        this._checkServer();
        // Animacion GSAP de entrada de la tarjeta del menu
        this._animateCardIn();
    }

    _animateCardIn() {
        // Anima la tarjeta del menu con un suave efecto de escalado y opacidad
        gsapSafe.to('.start-card', {
            opacity:  1,
            y:        0,
            duration: 0.7,
            ease:     'power3.out',
            delay:    0.1,
        });
        // Anima las piezas decorativas del fondo con un fade-in escalonado
        gsapSafe.from('.hero-piece', {
            opacity:  0,
            scale:    0.5,
            duration: 1.2,
            ease:     'power2.out',
            stagger:  0.12,
            delay:    0.3,
        });
    }

    _bind() {
        // Selector de color del jugador.
        document.getElementById('colorPicker').addEventListener('click', (e) => {
            const btn = e.target.closest('.color-opt');
            if (!btn) return;
            document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.selectedColor = btn.dataset.color;
        });

        // Selector de dificultad de IA.
        document.getElementById('diffGrid').addEventListener('click', (e) => {
            const btn = e.target.closest('.diff-opt');
            if (!btn) return;
            document.querySelectorAll('.diff-opt').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.selectedDiff = btn.dataset.diff;
        });

        // Inicio de partida.
        document.getElementById('startPlayBtn').addEventListener('click', () => {
            if (!this.serverReady) return;
            let color = this.selectedColor;
            // Si el usuario pidió azar, decidimos aquí para que quede fijo en esta partida.
            if (color === 'random') color = Math.random() < 0.5 ? 'w' : 'b';
            this.onPlay(color, this.selectedDiff);
        });
    }

    async _checkServer() {
        const dot  = document.querySelector('#serverStatus .ss-dot');
        const text = document.querySelector('#serverStatus .ss-text');
        const btn  = document.getElementById('startPlayBtn');

        const tryConnect = async () => {
            try {
                // Timeout corto: evita que la UI se quede bloqueada si backend no responde.
                const res = await fetch(API_BASE + '/api/health', { signal: AbortSignal.timeout(3000) });
                if (res.ok) {
                    this.serverReady = true;
                    dot.className = 'ss-dot ready';
                    text.textContent = 'Motor listo — Stockfish 17 local';
                    btn.disabled = false;
                    return true;
                }
            } catch {}
            return false;
        };

        btn.disabled = true;
        // Reintento progresivo al cargar: experiencia más amable al iniciar backend primero.
        for (let i = 0; i < 20; i++) {
            if (await tryConnect()) return;
            await new Promise(r => setTimeout(r, 1500));
        }

        dot.className = 'ss-dot error';
        text.textContent = 'No se pudo conectar al servidor. Ejecuta: python server.py';
    }

    show() {
        document.getElementById('gameScreen').classList.add('hidden');
        document.getElementById('startMenu').classList.remove('hidden');
        // Re-anima la entrada del menu al volver desde el juego
        this._animateCardIn();
    }

    hide() {
        const menu   = document.getElementById('startMenu');
        const screen = document.getElementById('gameScreen');

        // Transicion fluida: fade-out menu -> fade-in game screen
        gsapSafe.to('.start-card', {
            opacity:  0,
            y:        -16,
            scale:    0.97,
            duration: 0.3,
            ease:     'power2.in',
            onComplete: () => {
                menu.classList.add('hidden');
                screen.classList.remove('hidden');
                // Resetear posicion de la card para la siguiente vez que se muestre
                gsapSafe.set('.start-card', { opacity: 0, y: 24, scale: 1 });
                // Animar la entrada de la pantalla de juego
                gsapSafe.from('.header', { opacity: 0, y: -20, duration: 0.4, ease: 'power2.out' });
                gsapSafe.from('.board-frame', { opacity: 0, scale: 0.95, duration: 0.5, ease: 'power3.out', delay: 0.1 });
                gsapSafe.from('.player-bar', { opacity: 0, x: -12, duration: 0.4, ease: 'power2.out', stagger: 0.1, delay: 0.15 });
                gsapSafe.from('.side-panel', { opacity: 0, x: 20, duration: 0.45, ease: 'power2.out', delay: 0.2 });
                gsapSafe.from('.status-bar', { opacity: 0, y: 10, duration: 0.35, ease: 'power2.out', delay: 0.3 });
            }
        });
    }
}

// ═══════════════════════════════════════
//  CHESS APP
// ═══════════════════════════════════════

class ChessApp {
    constructor(playerColor, difficulty) {
        // Estado base de la partida y UI.
        this.game           = new Chess();
        this.selectedSquare = null;
        this.legalMoves     = [];
        this.playerColor    = playerColor;
        this.difficulty     = difficulty;
        this.isThinking     = false;
        this.boardFlipped   = (playerColor === 'b');
        this.lastMove       = null;
        this.sounds         = new SoundFX();
        this.dragData       = null;
        this.destroyed      = false;
        this._touchHandled  = false;
        this._abortCtrl     = new AbortController();

        this.dom = {};
        this._cacheDom();
        this._updateBadge();
        this._updatePlayerBars();
        this.render();
        this._bindEvents();
        // Establecer el estado visual del turno activo al inicio
        this._updateActiveTurn();

        // Si usuario juega negras, la IA mueve primero.
        if (this.playerColor === 'b') {
            setTimeout(() => this._requestAIMove(), 300);
        }
    }

    /** Remove all event listeners and mark instance as dead */
    destroy() {
        this.destroyed = true;
        this._abortCtrl.abort();
    }

    _cacheDom() {
        // Cachear elementos evita querySelector repetitivo durante render.
        const ids = [
            'board', 'moveHistory', 'statusBar', 'thinkingIndicator',
            'chanceWhite', 'chanceDraw', 'chanceBlack',
            'chanceLabelWhite', 'chanceLabelDraw', 'chanceLabelBlack',
            'topCaptures', 'bottomCaptures',
            'topAdvantage', 'bottomAdvantage', 'topName', 'topElo',
            'bottomName', 'bottomElo',
            'promotionModal', 'promotionOptions',
            'gameOverModal', 'gameOverIcon', 'gameOverTitle', 'gameOverMessage',
            'badgeDiff', 'badgeColor'
        ];
        ids.forEach(id => this.dom[id] = document.getElementById(id));
    }

    // -----------------------------------------------------------------------
    // Integración con backend
    // -----------------------------------------------------------------------
    async _requestAIMove() {
        if (this.destroyed) return;
        if (this.game.game_over()) return;
        if (this.game.turn() === this.playerColor) return;
        if (this.isThinking) return;          // evita solicitudes simultáneas

        this.isThinking = true;
        this._updateThinking();

        try {
            const res = await fetch(API_BASE + '/api/move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fen: this.game.fen(), difficulty: this.difficulty })
            });

            if (this.destroyed) return;       // instance was replaced while waiting
            if (!res.ok) throw new Error('Server error');
            const data = await res.json();
            if (this.destroyed) return;

            // Formato UCI: e2e4, e7e8q, etc.
            const from  = data.bestmove.substring(0, 2);
            const to    = data.bestmove.substring(2, 4);
            const promo = data.bestmove.length > 4 ? data.bestmove[4] : undefined;

            const move = this.game.move({ from, to, promotion: promo });
            if (move) {
                this._afterMove(move);
                this._playSound(move);
            }

            // Refresca barra de probabilidades con la evaluación actual.
            this._applyEval(data.evaluation, data.mate);

        } catch (err) {
            console.error('AI move error:', err);
            this._setStatus('Error al contactar el motor', 'ended');
        } finally {
            this.isThinking = false;
            this._updateThinking();
        }
    }

    _applyEval(cp, mate) {
        // Convierte score del motor a una probabilidad más legible para usuario.
        let whiteWin, draw, blackWin;

        if (mate !== null && mate !== undefined) {
            if (mate > 0) { whiteWin = 99; draw = 0.5; blackWin = 0.5; }
            else           { whiteWin = 0.5; draw = 0.5; blackWin = 99; }
        } else {
            const val = cp || 0;
            // Curva sigmoide estilo Lichess para mapear centipawns a probabilidad.
            const wP = 1 / (1 + Math.exp(-0.004 * val));
            // A más ventaja, menor probabilidad de tablas.
            const drawBase = Math.max(0, 1 - Math.abs(val) / 800);
            draw = drawBase * 35;  // max ~35% draw at equal position
            const remaining = 100 - draw;
            whiteWin = remaining * wP;
            blackWin = remaining * (1 - wP);
        }

        // Evitamos valores extremos / negativos por estabilidad visual.
        whiteWin = Math.max(0.5, Math.min(99, whiteWin));
        blackWin = Math.max(0.5, Math.min(99, blackWin));
        draw = Math.max(0, Math.min(99, draw));
        const total = whiteWin + draw + blackWin;
        whiteWin = whiteWin / total * 100;
        draw = draw / total * 100;
        blackWin = blackWin / total * 100;

        this._setChances(Math.round(whiteWin), Math.round(draw), Math.round(blackWin));
    }

    _setChances(w, d, b) {
        // Ajuste final para que siempre sumen 100% tras redondeo.
        const diff = 100 - (w + d + b);
        d += diff;

        if (this.dom.chanceWhite) this.dom.chanceWhite.style.width = w + '%';
        if (this.dom.chanceDraw)  this.dom.chanceDraw.style.width  = d + '%';
        if (this.dom.chanceBlack) this.dom.chanceBlack.style.width = b + '%';
        if (this.dom.chanceLabelWhite) this.dom.chanceLabelWhite.textContent = `\u2b1c ${w}%`;
        if (this.dom.chanceLabelDraw)  this.dom.chanceLabelDraw.textContent  = `\ud83e\udd1d ${d}%`;
        if (this.dom.chanceLabelBlack) this.dom.chanceLabelBlack.textContent = `\u2b1b ${b}%`;
    }

    // -----------------------------------------------------------------------
    // Datos de cabecera
    // -----------------------------------------------------------------------
    _updateBadge() {
        const d = DIFF_META[this.difficulty] || DIFF_META.medium;
        if (this.dom.badgeDiff)  this.dom.badgeDiff.textContent  = `${d.icon} ${d.label}`;
        if (this.dom.badgeColor) this.dom.badgeColor.textContent = this.playerColor === 'w' ? 'Blancas' : 'Negras';
    }

    _updatePlayerBars() {
        const d = DIFF_META[this.difficulty] || DIFF_META.medium;
        this.dom.topName.textContent    = 'Stockfish AI';
        this.dom.topElo.textContent     = `ELO ${d.elo}`;
        this.dom.bottomName.textContent = 'Tú';
        this.dom.bottomElo.textContent  = 'Jugador';
    }

    // -----------------------------------------------------------------------
    // Renderizado
    // -----------------------------------------------------------------------

    render() {
        this._renderBoard();
        this._renderMoveHistory();
        this._renderCaptures();
        this._updateStatus();
    }

    _renderBoard() {
        const el = this.dom.board;
        el.innerHTML = '';

        for (let vr = 0; vr < 8; vr++) {
            for (let vc = 0; vc < 8; vc++) {
                // vr/vc = coordenadas visuales; br/bc = coordenadas reales de tablero.
                const br = this.boardFlipped ? 7 - vr : vr;
                const bc = this.boardFlipped ? 7 - vc : vc;

                const file = 'abcdefgh'[bc];
                const rank = 8 - br;
                const sq   = file + rank;
                const isLight = (br + bc) % 2 === 0;
                const piece = this.game.get(sq);

                const div = document.createElement('div');
                div.className = 'square ' + (isLight ? 'light' : 'dark');
                div.dataset.sq = sq;

                if (this.selectedSquare === sq) div.classList.add('selected');
                if (this.lastMove && (sq === this.lastMove.from || sq === this.lastMove.to)) div.classList.add('last-move');
                if (this.game.in_check() && piece && piece.type === 'k' && piece.color === this.game.turn()) div.classList.add('in-check');

                const isLegal = this.legalMoves.some(m => m.to === sq);

                if (piece) {
                    const key = piece.color + piece.type.toUpperCase();
                    const pel = document.createElement('div');
                    pel.className = 'piece ' + (piece.color === 'w' ? 'white-piece' : 'black-piece');
                    pel.textContent = PIECE_UNICODE[key];
                    // Solo permitimos arrastrar piezas propias cuando es turno del usuario.
                    pel.draggable = (piece.color === this.playerColor && piece.color === this.game.turn() && !this.isThinking && !this.game.game_over());
                    div.appendChild(pel);
                    if (isLegal) div.classList.add('legal-capture');
                } else if (isLegal) {
                    const dot = document.createElement('div');
                    dot.className = 'legal-dot';
                    div.appendChild(dot);
                }

                if (vc === 0) {
                    const lbl = document.createElement('span');
                    lbl.className = 'coord-rank coord-on-' + (isLight ? 'light' : 'dark');
                    lbl.textContent = rank;
                    div.appendChild(lbl);
                }
                if (vr === 7) {
                    const lbl = document.createElement('span');
                    lbl.className = 'coord-file coord-on-' + (isLight ? 'light' : 'dark');
                    lbl.textContent = file;
                    div.appendChild(lbl);
                }

                el.appendChild(div);
            }
        }
    }

    // Helpers de texto para historial.
    _pieceName(piece) {
        const names = { k: 'Rey', q: 'Dama', r: 'Torre', b: 'Alfil', n: 'Caballo', p: 'Peón' };
        return names[piece] || piece;
    }

    _capturedName(piece) {
        const names = { k: 'al Rey', q: 'a la Dama', r: 'a la Torre', b: 'al Alfil', n: 'al Caballo', p: 'un Peón' };
        return names[piece] || piece;
    }

    _describeMove(m) {
        const color = m.color === 'w' ? 'Blancas' : 'Negras';

        // Castling
        if (m.flags.includes('k')) return `${color}: Enroque corto`;
        if (m.flags.includes('q')) return `${color}: Enroque largo`;

        const piece = this._pieceName(m.piece);
        const to = m.to.toUpperCase();

        let desc;
        if (m.captured) {
            desc = `${piece} captura ${this._capturedName(m.captured)} en ${to}`;
        } else {
            desc = `${piece} mueve a ${to}`;
        }

        // Promotion
        if (m.promotion) {
            desc += ` y corona a ${this._pieceName(m.promotion)}`;
        }

        // Check / checkmate flags from SAN
        if (m.san.endsWith('#')) desc += ' ¡Jaque mate!';
        else if (m.san.endsWith('+')) desc += ' ¡Jaque!';

        return desc;
    }

    _renderMoveHistory() {
        const history = this.game.history({ verbose: true });
        const el = this.dom.moveHistory;
        if (!history.length) {
            el.innerHTML = '<div class="move-empty">La partida aún no ha comenzado</div>';
            return;
        }
        let html = '';
        for (let i = 0; i < history.length; i++) {
            const m = history[i];
            const n = i + 1;
            const latest = i === history.length - 1 ? ' latest' : '';
            const icon = m.color === 'w' ? '⬜' : '⬛';
            html += `<div class="move-row${latest}"><span class="move-num">${n}.</span><span class="move-icon">${icon}</span><span class="move-desc">${this._describeMove(m)}</span></div>`;
        }
        el.innerHTML = html;
        el.scrollTop = el.scrollHeight;
        // Animar la ultima entrada del historial con un slide suave
        const latestRow = el.querySelector('.move-row.latest');
        if (latestRow) {
            gsapSafe.from(latestRow, {
                opacity: 0, x: -8, duration: 0.25, ease: 'power2.out'
            });
        }
    }

    _renderCaptures() {
        const history = this.game.history({ verbose: true });
        const capturedBy = { w: [], b: [] };
        history.forEach(m => { if (m.captured) capturedBy[m.color].push(m.captured); });

        // Ordenamos por valor para que las capturas sean fáciles de leer (Q,R,B/N,P).
        const renderPieces = (pieces, capturerColor) => {
            const opColor = capturerColor === 'w' ? 'b' : 'w';
            return [...pieces]
                .sort((a, b) => (PIECE_VALUES[b] || 0) - (PIECE_VALUES[a] || 0))
                .map(p => `<span class="captured-piece">${PIECE_UNICODE[opColor + p.toUpperCase()]}</span>`)
                .join('');
        };

        const aiColor = this.playerColor === 'w' ? 'b' : 'w';
        this.dom.topCaptures.innerHTML    = renderPieces(capturedBy[aiColor], aiColor);
        this.dom.bottomCaptures.innerHTML = renderPieces(capturedBy[this.playerColor], this.playerColor);

        const playerMat = capturedBy[this.playerColor].reduce((s, p) => s + (PIECE_VALUES[p] || 0), 0);
        const aiMat     = capturedBy[aiColor].reduce((s, p) => s + (PIECE_VALUES[p] || 0), 0);
        const diff = playerMat - aiMat;
        this.dom.topAdvantage.textContent    = diff < 0 ? `+${Math.abs(diff)}` : '';
        this.dom.bottomAdvantage.textContent = diff > 0 ? `+${diff}` : '';
    }

    // -----------------------------------------------------------------------
    // Eventos de interacción
    // -----------------------------------------------------------------------

    _bindEvents() {
        const board = this.dom.board;
        const sig   = { signal: this._abortCtrl.signal };

        board.addEventListener('click', (e) => this._onClick(e), sig);
        board.addEventListener('dragstart', (e) => this._onDragStart(e), sig);
        board.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, sig);
        board.addEventListener('drop', (e) => this._onDrop(e), sig);
        board.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false, ...sig });
        board.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false, ...sig });
        board.addEventListener('touchend', (e) => this._onTouchEnd(e), sig);

        document.getElementById('undoBtn').addEventListener('click', () => this.undo(), sig);
        document.getElementById('flipBtn').addEventListener('click', () => this.flip(), sig);
        document.getElementById('resignBtn').addEventListener('click', () => this.resign(), sig);
        document.getElementById('modalNewGame').addEventListener('click', () => { this._closeModals(); window.startMenu.show(); }, sig);
        document.getElementById('modalClose').addEventListener('click', () => this._closeModals(), sig);
        document.getElementById('newGameBtn').addEventListener('click', () => { window.startMenu.show(); }, sig);

        // Controles de música de ambiente.
        const musicBtn = document.getElementById('musicToggleBtn');
        const volumeSlider = document.getElementById('musicVolume');
        musicBtn.addEventListener('click', () => {
            const playing = ambientMusic.toggle();
            musicBtn.textContent = playing ? '\u23F8 Pausar' : '\u25B6 Reproducir';
        }, sig);
        volumeSlider.addEventListener('input', (e) => {
            ambientMusic.setVolume(parseInt(e.target.value) / 100);
        }, sig);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.undo(); }
        }, sig);
    }

    _onClick(e) {
        if (this._touchHandled) return;       // ignora click fantasma posterior a touch
        if (this.isThinking || this.game.game_over()) return;
        if (this.game.turn() !== this.playerColor) return;
        const sqEl = e.target.closest('.square');
        if (!sqEl) return;
        const sq = sqEl.dataset.sq;

        if (this.selectedSquare) {
            const move = this.legalMoves.find(m => m.to === sq);
            if (move) this._tryPlayerMove(move);
            else this._select(sq);
        } else {
            this._select(sq);
        }
    }

    _onDragStart(e) {
        // Drag and drop clásico para escritorio.
        if (this.isThinking || this.game.game_over() || this.game.turn() !== this.playerColor) { e.preventDefault(); return; }
        const sqEl = e.target.closest('.square');
        if (!sqEl) { e.preventDefault(); return; }
        const sq = sqEl.dataset.sq;
        const piece = this.game.get(sq);
        if (!piece || piece.color !== this.playerColor) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/plain', sq);
        e.dataTransfer.effectAllowed = 'move';
        this._select(sq);
    }

    _onDrop(e) {
        e.preventDefault();
        const from = e.dataTransfer.getData('text/plain');
        const sqEl = e.target.closest('.square');
        if (!sqEl || !from) return;
        const to = sqEl.dataset.sq;
        const move = this.legalMoves.find(m => m.from === from && m.to === to);
        if (move) this._tryPlayerMove(move);
        else { this.selectedSquare = null; this.legalMoves = []; this._renderBoard(); }
    }

    _onTouchStart(e) {
        // Guardamos origen del gesto para soportar tap-to-move y drag en móvil.
        if (this.isThinking || this.game.game_over() || this.game.turn() !== this.playerColor) return;
        const touch = e.touches[0];
        const sqEl = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.square');
        if (!sqEl) return;
        const sq = sqEl.dataset.sq;
        const piece = this.game.get(sq);
        if (piece && piece.color === this.playerColor) {
            this.dragData = { sq, startX: touch.clientX, startY: touch.clientY, moved: false };
        }
    }

    _onTouchMove(e) { if (this.dragData) { e.preventDefault(); this.dragData.moved = true; } }

    _onTouchEnd(e) {
        if (!this.dragData) return;
        const data = this.dragData;
        this.dragData = null;

        // Suprime el click sintético que emiten muchos navegadores tras un touch.
        this._touchHandled = true;
        setTimeout(() => { this._touchHandled = false; }, 400);

        if (data.moved && e.changedTouches.length) {
            const touch = e.changedTouches[0];
            const sqEl = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.square');
            if (sqEl) {
                if (!this.selectedSquare || this.selectedSquare !== data.sq) this._select(data.sq);
                const move = this.legalMoves.find(m => m.to === sqEl.dataset.sq);
                if (move) { this._tryPlayerMove(move); return; }
            }
        }

        if (this.selectedSquare) {
            const move = this.legalMoves.find(m => m.to === data.sq);
            if (move) this._tryPlayerMove(move);
            else this._select(data.sq);
        } else {
            this._select(data.sq);
        }
    }

    // -----------------------------------------------------------------------
    // Selección y ejecución de jugadas
    // -----------------------------------------------------------------------

    _select(sq) {
        const piece = this.game.get(sq);
        if (piece && piece.color === this.playerColor && piece.color === this.game.turn()) {
            this.selectedSquare = sq;
            this.legalMoves = this.game.moves({ square: sq, verbose: true });
        } else {
            this.selectedSquare = null;
            this.legalMoves = [];
        }
        this._renderBoard();
    }

    _tryPlayerMove(move) {
        // Si el peón llega a última fila, abrimos modal de promoción.
        if (move.piece === 'p' && (move.to[1] === '8' || move.to[1] === '1')) {
            this._showPromotion(move);
            return;
        }
        this._executePlayerMove(move.from, move.to);
    }

    _executePlayerMove(from, to, promotion) {
        // `chess.js` valida legalidad final antes de aplicar.
        const result = this.game.move({ from, to, promotion: promotion || undefined });
        if (!result) return;
        this._afterMove(result);
        this._playSound(result);
        if (!this.game.game_over()) {
            setTimeout(() => this._requestAIMove(), 150);
        }
    }

    _afterMove(move) {
        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = { from: move.from, to: move.to };
        this.render();
        // Animar la pieza que acaba de moverse con un efecto de "aterrizaje"
        this._animatePieceLand(move.to);
        // Actualizar resaltado de turno activo en las barras de jugador
        this._updateActiveTurn();
        if (this.game.game_over()) setTimeout(() => this._showGameOver(), 400);
    }

    /**
     * Aplica la animacion de aterrizaje a la pieza en la casilla destino.
     * Usa la clase CSS .piece-land definida en style.css.
     */
    _animatePieceLand(sq) {
        const squareEl = this.dom.board.querySelector(`[data-sq="${sq}"]`);
        if (!squareEl) return;
        const pieceEl = squareEl.querySelector('.piece');
        if (!pieceEl) return;
        // Animar con GSAP para mejor control y rendimiento
        gsapSafe.fromTo(pieceEl,
            { scale: 1.3, y: -8, filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.5)) brightness(1.3)' },
            { scale: 1,   y:  0, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4)) brightness(1)',
              duration: 0.35, ease: 'back.out(3)' }
        );
    }

    /**
     * Actualiza la clase active-turn en las barras de jugador
     * para reflejar visualmente de quien es el turno.
     */
    _updateActiveTurn() {
        const topBar    = document.getElementById('topBar');
        const bottomBar = document.getElementById('bottomBar');
        if (!topBar || !bottomBar) return;

        const aiColor   = this.playerColor === 'w' ? 'b' : 'w';
        const isMyTurn  = this.game.turn() === this.playerColor;

        topBar.classList.toggle('active-turn',    !isMyTurn && !this.game.game_over());
        bottomBar.classList.toggle('active-turn',  isMyTurn && !this.game.game_over());
    }

    // Modal de promoción.
    _showPromotion(move) {
        const modal = this.dom.promotionModal;
        const opts  = this.dom.promotionOptions;
        opts.innerHTML = '';
        const color = this.playerColor;
        [{ key: 'q', name: 'Dama' }, { key: 'r', name: 'Torre' }, { key: 'b', name: 'Alfil' }, { key: 'n', name: 'Caballo' }]
            .forEach(({ key, name }) => {
                const btn = document.createElement('button');
                btn.className = 'promo-btn';
                const sym = PIECE_UNICODE[(color === 'w' ? 'w' : 'b') + key.toUpperCase()];
                btn.innerHTML = `<span class="promo-piece">${sym}</span><span class="promo-name">${name}</span>`;
                btn.addEventListener('click', () => { modal.classList.remove('active'); this._executePlayerMove(move.from, move.to, key); });
                opts.appendChild(btn);
            });
        modal.classList.add('active');
    }

    // -----------------------------------------------------------------------
    // Estado visual
    // -----------------------------------------------------------------------
    _updateStatus() {
        const bar  = this.dom.statusBar;
        const dot  = bar.querySelector('.status-dot');
        const text = bar.querySelector('.status-text');

        if (this.game.game_over()) {
            dot.className = 'status-dot ended';
            if (this.game.in_checkmate()) text.textContent = `¡Jaque mate! ${this.game.turn() === 'w' ? 'Negras' : 'Blancas'} ganan`;
            else if (this.game.in_stalemate()) text.textContent = 'Tablas por ahogado';
            else text.textContent = 'Tablas';
            return;
        }
        if (this.isThinking) {
            dot.className = 'status-dot thinking';
            text.textContent = 'Stockfish está pensando…';
        } else if (this.game.turn() === this.playerColor) {
            dot.className = 'status-dot your-turn';
            const c = this.game.turn() === 'w' ? 'Blancas' : 'Negras';
            const ck = this.game.in_check() ? ' — ¡Jaque!' : '';
            text.textContent = `Tu turno — ${c} mueven${ck}`;
        } else {
            dot.className = 'status-dot ai-turn';
            text.textContent = 'Turno de Stockfish…';
        }
    }

    _setStatus(msg, cls) {
        const bar = this.dom.statusBar;
        bar.querySelector('.status-dot').className = 'status-dot ' + cls;
        bar.querySelector('.status-text').textContent = msg;
    }

    _updateThinking() {
        const el = this.dom.thinkingIndicator;
        if (el) el.classList.toggle('active', this.isThinking);
        this._updateStatus();
        this._updateActiveTurn();
    }

    _setEvalBar(pct, label) {
        // legacy — no longer used, kept for safety
    }

    // Acciones manuales del jugador.
    undo() {
        if (this.isThinking || this.game.history().length < 2) return;
        this.game.undo();
        this.game.undo();
        this.selectedSquare = null;
        this.legalMoves = [];
        const h = this.game.history({ verbose: true });
        this.lastMove = h.length > 0 ? { from: h[h.length - 1].from, to: h[h.length - 1].to } : null;
        this.render();
    }

    flip() { this.boardFlipped = !this.boardFlipped; this._renderBoard(); }

    resign() {
        if (this.game.game_over() || this.game.history().length === 0) return;
        this._showGameOverModal('🏳️ Te has rendido', 'Stockfish AI gana la partida.', 'lose');
    }

    // Cierre de partida.
    _showGameOver() {
        if (this.game.in_checkmate()) {
            const lost = this.game.turn() === this.playerColor;
            if (lost) this._showGameOverModal('😔 Derrota', 'Stockfish te ha dado jaque mate.', 'lose');
            else this._showGameOverModal('🎉 ¡Victoria!', '¡Ganaste por jaque mate!', 'win');
        } else if (this.game.in_stalemate()) {
            this._showGameOverModal('🤝 Tablas', 'Partida terminada en tablas por ahogado.', 'draw');
        } else if (this.game.in_draw()) {
            this._showGameOverModal('🤝 Tablas', 'Partida terminada en tablas.', 'draw');
        }
        this.sounds.end();
    }

    _showGameOverModal(title, msg, result) {
        this.dom.gameOverTitle.textContent   = title;
        this.dom.gameOverMessage.textContent = msg;
        this.dom.gameOverIcon.textContent    = result === 'win' ? '\u{1F3C6}' : result === 'lose' ? '\u{1F480}' : '\u{1F91D}';
        this.dom.gameOverModal.classList.add('active');
        // Animar el icono del modal con un efecto dramatico
        gsapSafe.fromTo(this.dom.gameOverIcon,
            { scale: 0.3, opacity: 0, rotation: -10 },
            { scale: 1,   opacity: 1, rotation: 0,
              duration: 0.6, ease: 'back.out(4)', delay: 0.15 }
        );
    }

    _closeModals() {
        document.querySelectorAll('.overlay').forEach(m => m.classList.remove('active'));
    }

    // Sonidos contextuales por tipo de jugada.
    _playSound(move) {
        if (move.captured) this.sounds.capture(); else this.sounds.move();
        if (this.game.in_check()) setTimeout(() => this.sounds.check(), 80);
    }
}

// ═══════════════════════════════════════
//  BOOTSTRAP
// ═══════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    if (typeof Chess === 'undefined') return;

    const startMenu = new StartMenu((color, difficulty) => {
        // Destruimos instancia previa para no dejar listeners vivos.
        if (window.chessApp) {
            window.chessApp.destroy();
            window.chessApp = null;
        }
        startMenu.hide();
        window.chessApp = new ChessApp(color, difficulty);
    });

    window.startMenu = startMenu;
});
