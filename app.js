/* ═══════════════════════════════════════════════════════
   ChessAI — v2: Local Stockfish via Python API
   ═══════════════════════════════════════════════════════ */

const API_BASE = '';  // same origin — served by FastAPI

// ─── Piece Unicode Map (all use filled glyphs so CSS color works) ───
const PIECE_UNICODE = {
    wK: '\u265A', wQ: '\u265B', wR: '\u265C', wB: '\u265D', wN: '\u265E', wP: '\u265F',
    bK: '\u265A', bQ: '\u265B', bR: '\u265C', bB: '\u265D', bN: '\u265E', bP: '\u265F'
};

const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const DIFF_META = {
    beginner: { icon: '🟢', label: 'Principiante', elo: '~800' },
    easy:     { icon: '🟡', label: 'Fácil',        elo: '~1200' },
    medium:   { icon: '🟠', label: 'Medio',        elo: '~1600' },
    hard:     { icon: '🔴', label: 'Difícil',      elo: '~2000' },
    master:   { icon: '💀', label: 'Maestro',      elo: '~2600' },
};

// ─── Sound FX ───
class SoundFX {
    constructor() { this.ctx = null; }
    _getCtx() {
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

// ─── Ambient Music (MP3 file) ───
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
    }

    _bind() {
        // Color picker
        document.getElementById('colorPicker').addEventListener('click', (e) => {
            const btn = e.target.closest('.color-opt');
            if (!btn) return;
            document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.selectedColor = btn.dataset.color;
        });

        // Difficulty grid
        document.getElementById('diffGrid').addEventListener('click', (e) => {
            const btn = e.target.closest('.diff-opt');
            if (!btn) return;
            document.querySelectorAll('.diff-opt').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.selectedDiff = btn.dataset.diff;
        });

        // Play button
        document.getElementById('startPlayBtn').addEventListener('click', () => {
            if (!this.serverReady) return;
            let color = this.selectedColor;
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
        // Retry up to 20 times (every 1.5s = ~30s total wait)
        for (let i = 0; i < 20; i++) {
            if (await tryConnect()) return;
            await new Promise(r => setTimeout(r, 1500));
        }

        dot.className = 'ss-dot error';
        text.textContent = 'No se pudo conectar al servidor. Ejecuta: python server.py';
    }

    show() {
        document.getElementById('startMenu').classList.remove('hidden');
        document.getElementById('gameScreen').classList.add('hidden');
    }

    hide() {
        document.getElementById('startMenu').classList.add('hidden');
        document.getElementById('gameScreen').classList.remove('hidden');
    }
}

// ═══════════════════════════════════════
//  CHESS APP
// ═══════════════════════════════════════

class ChessApp {
    constructor(playerColor, difficulty) {
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

        // If AI plays white, request move immediately
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

    // ── API calls ──
    async _requestAIMove() {
        if (this.destroyed) return;
        if (this.game.game_over()) return;
        if (this.game.turn() === this.playerColor) return;
        if (this.isThinking) return;          // prevent concurrent AI requests

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

            // Parse UCI move
            const from  = data.bestmove.substring(0, 2);
            const to    = data.bestmove.substring(2, 4);
            const promo = data.bestmove.length > 4 ? data.bestmove[4] : undefined;

            const move = this.game.move({ from, to, promotion: promo });
            if (move) {
                this._afterMove(move);
                this._playSound(move);
            }

            // Update eval
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
        let whiteWin, draw, blackWin;

        if (mate !== null && mate !== undefined) {
            if (mate > 0) { whiteWin = 99; draw = 0.5; blackWin = 0.5; }
            else           { whiteWin = 0.5; draw = 0.5; blackWin = 99; }
        } else {
            const val = cp || 0;
            // Lichess-style win probability: sigmoid with k≈0.004
            const wP = 1 / (1 + Math.exp(-0.004 * val));
            // Draw probability decreases as advantage grows
            const drawBase = Math.max(0, 1 - Math.abs(val) / 800);
            draw = drawBase * 35;  // max ~35% draw at equal position
            const remaining = 100 - draw;
            whiteWin = remaining * wP;
            blackWin = remaining * (1 - wP);
        }

        // Clamp
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
        // Ensure they add up to 100
        const diff = 100 - (w + d + b);
        d += diff;

        if (this.dom.chanceWhite) this.dom.chanceWhite.style.width = w + '%';
        if (this.dom.chanceDraw)  this.dom.chanceDraw.style.width  = d + '%';
        if (this.dom.chanceBlack) this.dom.chanceBlack.style.width = b + '%';
        if (this.dom.chanceLabelWhite) this.dom.chanceLabelWhite.textContent = `\u2b1c ${w}%`;
        if (this.dom.chanceLabelDraw)  this.dom.chanceLabelDraw.textContent  = `\ud83e\udd1d ${d}%`;
        if (this.dom.chanceLabelBlack) this.dom.chanceLabelBlack.textContent = `\u2b1b ${b}%`;
    }

    // ── Badge ──
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

    // ══════════════════════════════════
    //  RENDERING
    // ══════════════════════════════════

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

    // ── Move description helpers ──
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
    }

    _renderCaptures() {
        const history = this.game.history({ verbose: true });
        const capturedBy = { w: [], b: [] };
        history.forEach(m => { if (m.captured) capturedBy[m.color].push(m.captured); });

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

    // ══════════════════════════════════
    //  EVENTS
    // ══════════════════════════════════

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

        // Music controls
        const musicBtn = document.getElementById('musicToggleBtn');
        const volumeSlider = document.getElementById('musicVolume');
        musicBtn.addEventListener('click', () => {
            const playing = ambientMusic.toggle();
            musicBtn.textContent = playing ? '⏸ Pausar' : '▶ Reproducir';
        }, sig);
        volumeSlider.addEventListener('input', (e) => {
            ambientMusic.setVolume(parseInt(e.target.value) / 100);
        }, sig);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.undo(); }
        }, sig);
    }

    _onClick(e) {
        if (this._touchHandled) return;       // skip synthetic click after touch
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

        // Suppress the synthetic click the browser fires after touch
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

    // ══════════════════════════════════
    //  SELECTION & MOVES
    // ══════════════════════════════════

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
        if (move.piece === 'p' && (move.to[1] === '8' || move.to[1] === '1')) {
            this._showPromotion(move);
            return;
        }
        this._executePlayerMove(move.from, move.to);
    }

    _executePlayerMove(from, to, promotion) {
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
        if (this.game.game_over()) setTimeout(() => this._showGameOver(), 400);
    }

    // ═══ Promotion ═══
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

    // ═══ UI Updates ═══
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
    }

    _setEvalBar(pct, label) {
        // legacy — no longer used, kept for safety
    }

    // ═══ Game Actions ═══
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

    // ═══ Game Over ═══
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
        this.dom.gameOverIcon.textContent    = result === 'win' ? '🏆' : result === 'lose' ? '💀' : '🤝';
        this.dom.gameOverModal.classList.add('active');
    }

    _closeModals() {
        document.querySelectorAll('.overlay').forEach(m => m.classList.remove('active'));
    }

    // ═══ Sound ═══
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
        // Destroy previous game instance to remove its event listeners
        if (window.chessApp) {
            window.chessApp.destroy();
            window.chessApp = null;
        }
        startMenu.hide();
        window.chessApp = new ChessApp(color, difficulty);
    });

    window.startMenu = startMenu;
});
