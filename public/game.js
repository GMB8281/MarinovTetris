let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');

// Game background music and tracks
const audio_menu = new Audio('assets/game/audio/main_menu.mp3');
audio_menu.loop = true;
const audio_game = new Audio('assets/game/audio/game_track.mp3');
audio_game.loop = true;

// Game sound effects
const audio_tetris = new Audio('assets/game/audio/effects/tetris.wav');
const audio_clear = new Audio('assets/game/audio/effects/clear_line.wav');

// Game UI elements
const img_pause = new Image();
img_pause.src = 'assets/game/button/ic_pause.svg';

// Stop all audio currently playing and reset playback position
function stopAllAudio() {
    audio_menu.pause();
    audio_menu.currentTime = 0;
    audio_game.pause();
    audio_game.currentTime = 0;
}

// Start playing menu background music
function playMenuMusic() {
    stopAllAudio();
    audio_menu.play().catch(e => {});
}

// Start playing active game background music
function playGameMusic() {
    stopAllAudio();
    audio_game.play().catch(e => {});
}

// Grid configuration constants
const COLS = 10;
const ROWS = 20;

// Holds calculations for responsive grid positioning and sizing
let layout = {};

// Computes the coordinates and cell sizes based on device screen width
function computeLayout() {
    let w = canvas.width;
    if (w >= 600) {
        // Desktop or large screen configuration
        let cellSize = 25;
        let infoWidth = 180;
        let boardWidth = COLS * cellSize;
        let boardHeight = ROWS * cellSize;
        let boardX = Math.max(infoWidth, Math.floor((w - boardWidth) / 2));
        return {
            mobile: false,
            cellSize: cellSize,
            boardX: boardX,
            boardY: 0,
            boardWidth: boardWidth,
            boardHeight: boardHeight,
            infoX: 0,
            infoWidth: infoWidth,
            topBarH: 0,
            canvasHeight: boardHeight
        };
    } else {
        // Mobile layout with top bar container
        let topBarH = 65;
        let cellSize = Math.floor(w / COLS);
        return {
            mobile: true,
            cellSize: cellSize,
            boardX: 0,
            boardY: topBarH,
            boardWidth: COLS * cellSize,
            boardHeight: ROWS * cellSize,
            infoX: 0,
            infoWidth: w,
            topBarH: topBarH,
            canvasHeight: topBarH + ROWS * cellSize
        };
    }
}

// Resizes canvas element dynamically to adapt to viewports
function resizeCanvas() {
    let parent = canvas.parentElement;
    let w = (parent ? parent.clientWidth : 0) || window.innerWidth;
    canvas.width = w;
    layout = computeLayout();
    canvas.height = layout.canvasHeight;
}

// Piece construction using square sprites dynamically
// Piece index references: 0 = O, 1 = S, 2 = Z, 3 = J, 4 = L, 5 = I, 7 = T
const pieces = [
    {
        name: 'O',
        sprite: 'assets/game/sprites/yellow_square.png',
        img: null,
        rotations: [
            [[0,0],[0,1],[1,0],[1,1]]
        ]
    },
    {
        name: 'S',
        sprite: 'assets/game/sprites/red_square.png',
        img: null,
        rotations: [
            [[0,1],[0,2],[1,0],[1,1]],
            [[0,0],[1,0],[1,1],[2,1]],
            [[0,1],[0,2],[1,0],[1,1]],
            [[0,0],[1,0],[1,1],[2,1]]
        ]
    },
    {
        name: 'Z',
        sprite: 'assets/game/sprites/green_square.png',
        img: null,
        rotations: [
            [[0,0],[0,1],[1,1],[1,2]],
            [[0,1],[1,0],[1,1],[2,0]],
            [[0,0],[0,1],[1,1],[1,2]],
            [[0,1],[1,0],[1,1],[2,0]]
        ]
    },
    {
        name: 'J',
        sprite: 'assets/game/sprites/orange_square.png',
        img: null,
        rotations: [
            [[0,0],[1,0],[1,1],[1,2]],
            [[0,1],[0,2],[1,1],[2,1]],
            [[1,0],[1,1],[1,2],[2,2]],
            [[0,1],[1,1],[2,0],[2,1]]
        ]
    },
    {
        name: 'L',
        sprite: 'assets/game/sprites/red_square.png',
        img: null,
        rotations: [
            [[0,2],[1,0],[1,1],[1,2]],
            [[0,0],[1,0],[2,0],[2,1]],
            [[1,0],[1,1],[1,2],[2,0]],
            [[0,0],[0,1],[1,1],[2,1]]
        ]
    },
    {
        name: 'I',
        sprite: 'assets/game/sprites/blue_square.png',
        img: null,
        rotations: [
            [[0,0],[0,1],[0,2],[0,3]],
            [[0,0],[1,0],[2,0],[3,0]],
            [[0,0],[0,1],[0,2],[0,3]],
            [[0,0],[1,0],[2,0],[3,0]]
        ]
    },
    {
        name: 'T',
        sprite: 'assets/game/sprites/purple_square.png',
        img: null,
        rotations: [
            [[0,0],[0,1],[0,2],[1,1]],
            [[0,1],[1,0],[1,1],[2,1]],
            [[0,1],[1,0],[1,1],[1,2]],
            [[0,0],[1,0],[1,1],[2,0]]
        ]
    }
];

// Initialize and load images for each individual block sprite
pieces.forEach(piece => {
    piece.img = new Image();
    piece.img.src = piece.sprite;
});

// Grid board tracking cells and current states
let board = [];
let currentPiece = null;
let nextPieceIndex = null;
let score = 0;
let gameState = 'welcome'; // Options: 'welcome', 'playing', 'gameover', 'paused'

// Gravity timing parameters
const BASE_DROP_DELAY = 800;
const FAST_DROP_DELAY = 50; // Delay in milliseconds when pulling piece down
let dropDelay = BASE_DROP_DELAY; // Dynamic interval based on score and lines built

// Game loop tracking variables
let lastTime = 0;
let dropAccumulator = 0;
let tetrisTextEndTime = 0; // Track the ending display time for high score overlay

// Touch interaction configurations
let touchStartX = 0;
let touchStartY = 0;
let touchLastX = 0;
let touchStartTime = 0;
let touchHoldTimer = null;
let isFastDrop = false;
const TOUCH_TAP_MAX_MOVE = 15; // Threshold in pixels to identify tap action
const TOUCH_TAP_MAX_MS = 300; // Duration limit in milliseconds for a valid tap
const TOUCH_HOLD_MS = 300; // Time frame in milliseconds before activating speed descent

// Initialize grid rows with empty state values
function createBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
        board[r] = new Array(COLS).fill(null);
    }
}

// Update game speed dynamically as block height grows
function updateDropDelay() {
    let highestRow = ROWS;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== null) { highestRow = r; break; }
        }
        if (highestRow !== ROWS) break;
    }
    // Calculate vertical stack progression from the bottom bounds
    let linesUp = ROWS - highestRow;
    // Increase descent acceleration based on vertical blocks present
    dropDelay = BASE_DROP_DELAY / (1 + 0.2 * linesUp);
}

// Extract block coordinate map according to current rotation state
function getCurrentShape() {
    if (!currentPiece) return null;
    return pieces[currentPiece.pieceIndex].rotations[currentPiece.rotIndex];
}

// Validate boundary rules and structural block collisions
function isValidPosition(pieceIndex, rotIndex, row, col) {
    let shape = pieces[pieceIndex].rotations[rotIndex];
    for (let i = 0; i < shape.length; i++) {
        let r = row + shape[i][0];
        let c = col + shape[i][1];
        if (c < 0 || c >= COLS || r >= ROWS) return false;
        if (r < 0) continue;
        if (board[r][c] !== null) return false;
    }
    return true;
}

// Attempt to shift the active falling piece down one unit
function moveDown() {
    if (!currentPiece || gameState !== 'playing') return false;
    let newRow = currentPiece.row + 1;
    if (isValidPosition(currentPiece.pieceIndex, currentPiece.rotIndex, newRow, currentPiece.col)) {
        currentPiece.row = newRow;
        return true;
    } else {
        lockPiece();
        return false;
    }
}

// Lock the current falling piece into the static board structure
function lockPiece() {
    if (!currentPiece) return;
    let shape = getCurrentShape();
    let pieceIndex = currentPiece.pieceIndex;
    for (let i = 0; i < shape.length; i++) {
        let r = currentPiece.row + shape[i][0];
        let c = currentPiece.col + shape[i][1];
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) board[r][c] = pieceIndex;
    }
    clearLines();
    updateDropDelay();
    // Flush descent accumulation tracking to prevent immediate drop of the next piece
    dropAccumulator = 0;
    spawnPiece();
}

function clearLines() {
    let linesCleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
        let full = true;
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === null) { 
                full = false; 
                break; 
            }
        }
        if (full) {
            board.splice(r, 1);
            board.unshift(new Array(COLS).fill(null));
            linesCleared++;
            r++; 
        }
    }
    
    if (linesCleared === 1) score += 100;
    else if (linesCleared === 2) score += 300;
    else if (linesCleared === 3) score += 500;
    else if (linesCleared === 4) score += 800;
    
    if (linesCleared === 4) {
        audio_tetris.currentTime = 0;
        audio_tetris.play().catch(e => {});
        tetrisTextEndTime = performance.now() + 2000;
    } else if (linesCleared > 0) {
        audio_clear.currentTime = 0;
        audio_clear.play().catch(e => {});
    }
}

// Retrieve index of a randomly chosen tetris piece
function randomPiece() {
    return Math.floor(Math.random() * pieces.length);
}

// Generate the next block piece or trigger gameover state if blocked
function spawnPiece() {
    let pieceIndex = nextPieceIndex !== null ? nextPieceIndex : randomPiece();
    nextPieceIndex = randomPiece();
    // Determine horizontal start centering placement
    let shape = pieces[pieceIndex].rotations[0];
    let minC = Math.min(...shape.map(p => p[1]));
    let maxC = Math.max(...shape.map(p => p[1]));
    let startCol = Math.floor((COLS - (maxC - minC + 1)) / 2);
    let startRow = 0;

    currentPiece = { pieceIndex: pieceIndex, rotIndex: 0, row: startRow, col: startCol };
    // Trigger gameover state if block immediately overlaps on birth
    if (!isValidPosition(pieceIndex, 0, startRow, startCol)) {
        gameState = 'gameover';
        currentPiece = null;
        playMenuMusic();
    }
}

// Handle lateral move commands
function moveLeft() {
    if (!currentPiece || gameState !== 'playing') return;
    if (isValidPosition(currentPiece.pieceIndex, currentPiece.rotIndex, currentPiece.row, currentPiece.col - 1))
        currentPiece.col--;
}

function moveRight() {
    if (!currentPiece || gameState !== 'playing') return;
    if (isValidPosition(currentPiece.pieceIndex, currentPiece.rotIndex, currentPiece.row, currentPiece.col + 1))
        currentPiece.col++;
}

// Rotate the active piece configuration
function rotatePiece() {
    if (!currentPiece || gameState !== 'playing') return;
    if (currentPiece.pieceIndex === 0) return; // Skip O piece as rotation produces identical bounds
    let newRot = (currentPiece.rotIndex + 1) % pieces[currentPiece.pieceIndex].rotations.length;
    if (isValidPosition(currentPiece.pieceIndex, newRot, currentPiece.row, currentPiece.col))
        currentPiece.rotIndex = newRot;
}

// Pause and Resume logic operations
function pauseGame() {
    if (gameState !== 'playing') return;
    gameState = 'paused';
    audio_game.pause();
}

function resumeGame() {
    if (gameState !== 'paused') return;
    gameState = 'playing';
    audio_game.play().catch(e => {});
    lastTime = performance.now();
}

// Standardize states for a clean new game cycle
function resetGame() {
    createBoard();
    score = 0;
    nextPieceIndex = null;
    currentPiece = null;
    updateDropDelay();
    dropAccumulator = 0;
    gameState = 'playing';
    tetrisTextEndTime = 0;
    spawnPiece();
    playGameMusic();
}

// Render game environment and block borders
function drawBoard() {
    ctx.fillStyle = '#111';
    ctx.fillRect(layout.boardX, layout.boardY, layout.boardWidth, layout.boardHeight);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(layout.boardX, layout.boardY + r * layout.cellSize);
        ctx.lineTo(layout.boardX + layout.boardWidth, layout.boardY + r * layout.cellSize);
        ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(layout.boardX + c * layout.cellSize, layout.boardY);
        ctx.lineTo(layout.boardX + c * layout.cellSize, layout.boardY + layout.boardHeight);
        ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let pieceIndex = board[r][c];
            if (pieceIndex !== null) {
                let img = pieces[pieceIndex].img;
                if (img && img.complete) {
                    ctx.drawImage(img,
                        layout.boardX + c * layout.cellSize,
                        layout.boardY + r * layout.cellSize,
                        layout.cellSize, layout.cellSize);
                }
            }
        }
    }
}

// Draw current user-controlled active piece
function drawCurrentPiece() {
    if (!currentPiece || (gameState !== 'playing' && gameState !== 'paused')) return;
    let shape = getCurrentShape();
    if (!shape) return;
    let img = pieces[currentPiece.pieceIndex].img;
    if (!img || !img.complete) return;

    for (let i = 0; i < shape.length; i++) {
        let r = currentPiece.row + shape[i][0];
        let c = currentPiece.col + shape[i][1];
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
            ctx.drawImage(img,
                layout.boardX + c * layout.cellSize,
                layout.boardY + r * layout.cellSize,
                layout.cellSize, layout.cellSize);
        }
    }
}

// Render high scores, control icons, and piece previews
function drawInfoPanel() {
    if (layout.mobile) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, canvas.width, layout.topBarH);

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'start';
        ctx.font = 'bold 13px Courier New';
        ctx.fillText('Score', 10, 22);
        ctx.font = '13px Courier New';
        ctx.fillText(score, 10, 42);

        ctx.font = 'bold 13px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('Next', canvas.width / 2, 16);

        if (nextPieceIndex !== null) {
            let shape = pieces[nextPieceIndex].rotations[0];
            let img = pieces[nextPieceIndex].img;
            if (img && img.complete) {
                let pcs = 12;
                let minR = Math.min(...shape.map(p => p[0]));
                let minC = Math.min(...shape.map(p => p[1]));
                let maxC = Math.max(...shape.map(p => p[1]));
                let pw = (maxC - minC + 1) * pcs;
                let offsetX = canvas.width / 2 - pw / 2;
                let offsetY = 22;
                for (let i = 0; i < shape.length; i++) {
                    ctx.drawImage(img,
                        offsetX + (shape[i][1] - minC) * pcs,
                        offsetY + (shape[i][0] - minR) * pcs,
                        pcs, pcs);
                }
            }
        }

        if (gameState === 'playing') {
            let pbW = 32, pbH = 32;
            let pbX = canvas.width - pbW - 10;
            let pbY = Math.floor((layout.topBarH - pbH) / 2);
            canvas.pauseBtn = { x: pbX, y: pbY, w: pbW, h: pbH };
            if (img_pause.complete) ctx.drawImage(img_pause, pbX, pbY, pbW, pbH);
        }

        ctx.textAlign = 'start';
    } else {
        // Desktop visual layout setup
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(layout.infoX, 0, layout.boardX, canvas.height);

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 18px Courier New';
        ctx.fillText('Score:', layout.infoX + 10, 40);
        ctx.font = '16px Courier New';
        ctx.fillText(score, layout.infoX + 10, 70);

        ctx.font = 'bold 18px Courier New';
        ctx.fillText('Next:', layout.infoX + 10, 130);

        if (nextPieceIndex !== null) {
            let shape = pieces[nextPieceIndex].rotations[0];
            let img = pieces[nextPieceIndex].img;
            if (img && img.complete) {
                let previewCellSize = 20;
                let minR = Math.min(...shape.map(p => p[0]));
                let minC = Math.min(...shape.map(p => p[1]));
                let maxC = Math.max(...shape.map(p => p[1]));
                let width = (maxC - minC + 1) * previewCellSize;
                let offsetX = layout.infoX + (layout.infoWidth - width) / 2;
                let offsetY = 160;
                for (let i = 0; i < shape.length; i++) {
                    ctx.drawImage(img,
                        offsetX + (shape[i][1] - minC) * previewCellSize,
                        offsetY + (shape[i][0] - minR) * previewCellSize,
                        previewCellSize, previewCellSize);
                }
            }
        }
    }
}

// Welcome splash screen graphics
function drawWelcomeOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (layout.mobile) {
        let cx = canvas.width / 2;
        let cy = canvas.height / 2;
        let pad = 16;

        let titleFontSize = Math.min(28, Math.floor((canvas.width - pad * 2) / 9));
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.font = 'bold ' + titleFontSize + 'px Courier New';
        ctx.fillText('MarinovTetris', cx, cy - 80);

        let subFontSize = Math.min(15, Math.floor((canvas.width - pad * 2) / 18));
        ctx.font = subFontSize + 'px Courier New';
        ctx.fillText('An opensource Tetris game,', cx, cy - 80 + titleFontSize + 10);
        ctx.fillText('enjoy!', cx, cy - 80 + titleFontSize + 10 + subFontSize + 6);

        let btnWidth = Math.min(140, canvas.width - pad * 2);
        let btnHeight = 44;
        let btnX = cx - btnWidth / 2;
        let btnY = cy - 80 + titleFontSize + 10 + subFontSize * 2 + 28;
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Courier New';
        ctx.fillText('Play!', cx, btnY + 30);
        ctx.textAlign = 'start';
        canvas.welcomeBtn = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };
    } else {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 36px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('MarinovTetris', canvas.width / 2, 180);
        ctx.font = '18px Courier New';
        ctx.fillText('An opensource Tetris game, enjoy!', canvas.width / 2, 220);
        ctx.textAlign = 'start';

        let btnWidth = 150, btnHeight = 50;
        let btnX = canvas.width / 2 - btnWidth / 2;
        let btnY = 280;
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Courier New';
        ctx.textAlign = 'center';
        ctx.fillText('Play!', canvas.width / 2, btnY + 35);
        ctx.textAlign = 'start';
        canvas.welcomeBtn = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };
    }
}

// Screen view setup when falling blocks hit top boundary
function drawGameOverOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, 180);
    ctx.font = '18px Courier New';
    ctx.fillText('Score: ' + score, canvas.width / 2, 220);
    ctx.textAlign = 'start';

    let btnWidth = 160, btnHeight = 50;
    let btnX = canvas.width / 2 - btnWidth / 2;
    let btnY = 280;
    ctx.fillStyle = '#f44336';
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Play Again', canvas.width / 2, btnY + 35);
    ctx.textAlign = 'start';
    canvas.gameoverBtn = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };
}

// Render active state pause overlay screen
function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Game paused', canvas.width / 2, 180);
    ctx.textAlign = 'start';

    let btnWidth = 160, btnHeight = 50;
    let btnX = canvas.width / 2 - btnWidth / 2;
    let btnY = 280;
    ctx.fillStyle = '#2196F3';
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Continue', canvas.width / 2, btnY + 35);
    ctx.textAlign = 'start';
    canvas.continueBtn = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };
}

// Core rendering manager that decides which visual layer gets drawn
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'playing' || gameState === 'gameover' || gameState === 'paused') {
        drawInfoPanel();
        drawBoard();
        drawCurrentPiece();

        if (gameState === 'playing' && !layout.mobile) {
            let pauseBtnX = canvas.width - 60;
            let pauseBtnY = 20;
            canvas.pauseBtn = { x: pauseBtnX, y: pauseBtnY, w: 40, h: 40 };
            if (img_pause.complete) ctx.drawImage(img_pause, canvas.pauseBtn.x, canvas.pauseBtn.y, canvas.pauseBtn.w, canvas.pauseBtn.h);
        }

        if ((gameState === 'playing' || gameState === 'paused') && tetrisTextEndTime > performance.now()) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 48px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('Tetris', layout.boardX + layout.boardWidth / 2, layout.boardY + layout.boardHeight / 2);
            ctx.textAlign = 'start';
        }
    }

    if (gameState === 'welcome') {
        drawWelcomeOverlay();
    } else if (gameState === 'gameover') {
        drawGameOverOverlay();
    } else if (gameState === 'paused') {
        drawPauseOverlay();
    }
}

// RequestAnimationFrame standard cycle updating state models
function gameLoop(timestamp) {
    if (gameState === 'playing') {
        let delta = timestamp - lastTime;
        lastTime = timestamp;
        dropAccumulator += delta;
        let currentDropDelay = isFastDrop ? FAST_DROP_DELAY : dropDelay;
        while (dropAccumulator >= currentDropDelay) {
            dropAccumulator -= currentDropDelay;
            moveDown();
        }
        draw();
    } else {
        draw();
        lastTime = timestamp;
    }
    requestAnimationFrame(gameLoop);
}

// Map physical hardware keyboard buttons to game actions
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        if (gameState === 'playing') pauseGame();
        else if (gameState === 'paused') resumeGame();
        return;
    }
    // Pause with space bar
    if (e.key === ' ' || e.key === 'Spacebar') {
        if (gameState === 'playing') {
            e.preventDefault();
            pauseGame();
        }
        return;
    }
    // Enter key for buttons
    if (e.key === 'Enter') {
        if (gameState === 'welcome' || gameState === 'gameover') {
            e.preventDefault();
            resetGame();
        } else if (gameState === 'paused') {
            e.preventDefault();
            resumeGame();
        }
        return;
    }
    if (gameState !== 'playing') return;
    switch(e.key) {
        case 'ArrowLeft': case 'a': e.preventDefault(); moveLeft(); break;
        case 'ArrowRight': case 'd': e.preventDefault(); moveRight(); break;
        case 'ArrowDown': case 's': e.preventDefault(); moveDown(); break;
        case 'ArrowUp': case 'w': e.preventDefault(); rotatePiece(); break;
    }
});

// Capture mouse pointer tap dynamics on graphical buttons
canvas.addEventListener('click', function(e) {
    let rect = canvas.getBoundingClientRect();
    let scaleX = canvas.width / rect.width;
    let scaleY = canvas.height / rect.height;
    let mouseX = (e.clientX - rect.left) * scaleX;
    let mouseY = (e.clientY - rect.top) * scaleY;

    if (gameState === 'welcome' && canvas.welcomeBtn) {
        let b = canvas.welcomeBtn;
        if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) resetGame();
    } else if (gameState === 'gameover' && canvas.gameoverBtn) {
        let b = canvas.gameoverBtn;
        if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) resetGame();
    } else if (gameState === 'playing' && canvas.pauseBtn) {
        let b = canvas.pauseBtn;
        if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) pauseGame();
    } else if (gameState === 'paused' && canvas.continueBtn) {
        let b = canvas.continueBtn;
        if (mouseX >= b.x && mouseX <= b.x + b.w && mouseY >= b.y && mouseY <= b.y + b.h) resumeGame();
    }
});

// Configure start point parameters on touchscreen interactions
canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    let touch = e.changedTouches[0];
    touchStartX    = touch.clientX;
    touchStartY    = touch.clientY;
    touchLastX     = touch.clientX;
    touchStartTime = performance.now();
    isFastDrop     = false;

    clearTimeout(touchHoldTimer);
    touchHoldTimer = setTimeout(function() {
        if (gameState === 'playing') isFastDrop = true;
    }, TOUCH_HOLD_MS);
}, { passive: false });

// Translate swipe motions into dynamic piece movements or drops
canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (gameState !== 'playing') return;

    let touch = e.changedTouches[0];
    let rect = canvas.getBoundingClientRect();
    let scaleX = canvas.width / rect.width;
    let scaleY = canvas.height / rect.height;

    let cellScreenPx = layout.cellSize / scaleX;
    let cellScreenPy = layout.cellSize / scaleY;

    let dx = touch.clientX - touchLastX;
    if (dx >= cellScreenPx) {
        moveRight();
        touchLastX += cellScreenPx;
        clearTimeout(touchHoldTimer);
        isFastDrop = false;
    } else if (dx <= -cellScreenPx) {
        moveLeft();
        touchLastX -= cellScreenPx;
        clearTimeout(touchHoldTimer);
        isFastDrop = false;
    }

    let dy = touch.clientY - touchStartY;
    if (dy > cellScreenPy && !isFastDrop) {
        clearTimeout(touchHoldTimer);
        isFastDrop = true;
    }
}, { passive: false });

// Evaluate touch release to determine tap signals or rotation actions
canvas.addEventListener('touchend', function(e) {
    e.preventDefault();
    clearTimeout(touchHoldTimer);
    isFastDrop = false;

    let touch = e.changedTouches[0];
    let totalDx = Math.abs(touch.clientX - touchStartX);
    let totalDy = Math.abs(touch.clientY - touchStartY);
    let elapsed = performance.now() - touchStartTime;
    let isTap   = totalDx < TOUCH_TAP_MAX_MOVE &&
                  totalDy < TOUCH_TAP_MAX_MOVE &&
                  elapsed < TOUCH_TAP_MAX_MS;

    if (!isTap) return;

    let rect   = canvas.getBoundingClientRect();
    let scaleX = canvas.width  / rect.width;
    let scaleY = canvas.height / rect.height;
    let tapX   = (touch.clientX - rect.left) * scaleX;
    let tapY   = (touch.clientY - rect.top)  * scaleY;

    function hitBtn(b) {
        return b && tapX >= b.x && tapX <= b.x + b.w && tapY >= b.y && tapY <= b.y + b.h;
    }

    if (gameState === 'welcome' && hitBtn(canvas.welcomeBtn)) {
        resetGame();
    } else if (gameState === 'gameover' && hitBtn(canvas.gameoverBtn)) {
        resetGame();
    } else if (gameState === 'playing' && hitBtn(canvas.pauseBtn)) {
        pauseGame();
    } else if (gameState === 'paused' && hitBtn(canvas.continueBtn)) {
        resumeGame();
    } else if (gameState === 'playing') {
        rotatePiece();
    }
}, { passive: false });

// Bind automatic resize behaviors
window.addEventListener('resize', resizeCanvas);

// Launch sequence setup on initial page load
resizeCanvas();
createBoard();
playMenuMusic();
lastTime = performance.now();
requestAnimationFrame(gameLoop);