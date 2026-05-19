let canvas = document.getElementById('canvas');
let ctx = canvas.getContext('2d');

// Soundtracks
const audio_menu = new Audio('assets/game/audio/main_menu.mp3');
audio_menu.loop = true;
const audio_game = new Audio('assets/game/audio/game_track.mp3');
audio_game.loop = true;

// Sound effects
const audio_tetris = new Audio('assets/game/audio/effects/tetris.wav');
const audio_clear = new Audio('assets/game/audio/effects/clear_line.wav');

// UI Assets
const img_pause = new Image();
img_pause.src = 'assets/game/button/ic_pause.svg';

// Stop all audio and reset times
function stopAllAudio() {
    audio_menu.pause();
    audio_menu.currentTime = 0;
    audio_game.pause();
    audio_game.currentTime = 0;
}
function playMenuMusic() {
    stopAllAudio();
    audio_menu.play().catch(e => {});
}
function playGameMusic() {
    stopAllAudio();
    audio_game.play().catch(e => {});
}

// Tetris Board Settings, board width and height declared as multiplication for future expansion
const COLS = 10;
const ROWS = 20;
const CELL_SIZE = 25;
const BOARD_X = 180;
const BOARD_Y = 0;
const BOARD_WIDTH = COLS * CELL_SIZE;
const BOARD_HEIGHT = ROWS * CELL_SIZE;
const INFO_X = 0;
const INFO_WIDTH = 180;

//Piece construction using square sprites dynamically
///I am using pieceIndex in order to get a piece
// 0 = O, 1 = S, 2 = Z, 3 = J, 4 = L, 5 = I, 7 = T
const pieces = [
    {
        name: 'O',
        sprite: 'assets/game/sprites/yellow_square.png',
        img: null,
        // O piece has only one orientation (no rotation)
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
            [[0,0],[0,1],[0,2],[1,1]],  // T pointing down
            [[0,1],[1,0],[1,1],[2,1]],  // T pointing left
            [[0,1],[1,0],[1,1],[1,2]],  // T pointing up (added missing orientation)
            [[0,0],[1,0],[1,1],[2,0]]   // T pointing right
        ]
    }
];

// Image construcition for pieces
pieces.forEach(piece => {
    piece.img = new Image();
    piece.img.src = piece.sprite;
});

//Game state variables
let board = []; 
let currentPiece = null;      
let nextPieceIndex = null;    
let score = 0;
let gameState = 'welcome';    // 'welcome', 'playing', 'gameover', 'paused'

// Speed configuration
const BASE_DROP_DELAY = 800;
const FAST_DROP_DELAY = 50; // ms when holding touch
let dropDelay = BASE_DROP_DELAY; // ms between automatic drops

// Timing variables for game loop
let lastTime = 0;
let dropAccumulator = 0;

// Timer to display "Tetris" text
let tetrisTextEndTime = 0;

let touchStartX = 0;
let touchStartY = 0;
let touchLastX  = 0;
let touchStartTime = 0;
let touchHoldTimer = null;
let isFastDrop = false;
const TOUCH_TAP_MAX_MOVE = 15; // px total movement to still count as a tap
const TOUCH_TAP_MAX_MS   = 300; // ms max duration for a tap
const TOUCH_HOLD_MS      = 300; // ms hold before fast-drop activates

//Clear all position
function createBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
        board[r] = new Array(COLS).fill(null);
    }
}

// Update game speed based on stack height
function updateDropDelay() {
    let highestRow = ROWS;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== null) {
                highestRow = r;
                break;
            }
        }
        if (highestRow !== ROWS) break; // Found the highest block
    }
    
    // Calculates how many lines have been built up from the bottom
    let linesUp = ROWS - highestRow; 
    
    // Decrease drop time by effectively increasing speed 0.5x per line up
    dropDelay = BASE_DROP_DELAY / (1 + 0.2 * linesUp);
}

// Get the shape array currently active
function getCurrentShape() {
    if (!currentPiece) return null;
    return pieces[currentPiece.pieceIndex].rotations[currentPiece.rotIndex];
}

// Check if the position is valid for the given piece
function isValidPosition(pieceIndex, rotIndex, row, col) {
    let shape = pieces[pieceIndex].rotations[rotIndex];
    for (let i = 0; i < shape.length; i++) {
        let r = row + shape[i][0];
        let c = col + shape[i][1];
        if (c < 0 || c >= COLS || r >= ROWS) {
            return false; // out of bounds
        }
        if (r < 0) continue; // above the board is allowed
        if (board[r][c] !== null) {
            return false; // cell already occupied
        }
    }
    return true;
}

// Move the current piece down by one cell if possible; returns true on success
function moveDown() {
    if (!currentPiece || gameState !== 'playing') return false;
    let newRow = currentPiece.row + 1;
    if (isValidPosition(currentPiece.pieceIndex, currentPiece.rotIndex, newRow, currentPiece.col)) {
        currentPiece.row = newRow;
        return true;
    } else {
        // Lock the piece in place
        lockPiece();
        return false;
    }
}

// Lock the current piece onto the board, clear lines, and spawn next
function lockPiece() {
    if (!currentPiece) return;
    let shape = getCurrentShape();
    let pieceIndex = currentPiece.pieceIndex;
    
    // Fill board cells with piece index
    for (let i = 0; i < shape.length; i++) {
        let r = currentPiece.row + shape[i][0];
        let c = currentPiece.col + shape[i][1];
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
            board[r][c] = pieceIndex;
        }
    }
    
    // Clear completed lines and adjust game speed based on stack height
    clearLines();
    updateDropDelay(); 
    
    // Reset drop accumulator so new piece doesn't drop instantly
    dropAccumulator = 0;
    
    // Spawn next piece
    spawnPiece();
}

// Clear full lines and update score
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
            // Remove this row
            for (let rr = r; rr > 0; rr--) {
                board[rr] = board[rr-1].slice();
            }
            board[0] = new Array(COLS).fill(null);
            linesCleared++;
            r++; // check the same row again
        }
    }
    // Update score based on lines cleared
    if (linesCleared === 1) score += 100;
    else if (linesCleared === 2) score += 300;
    else if (linesCleared === 3) score += 500;
    else if (linesCleared === 4) score += 800;

    // Play sound effects and possibly show "Tetris" text
    if (linesCleared === 4) {
        audio_tetris.currentTime = 0;
        audio_tetris.play().catch(e => {});
        tetrisTextEndTime = performance.now() + 2000; // show text for 2 seconds
    } else if (linesCleared > 0) {
        audio_clear.currentTime = 0;
        audio_clear.play().catch(e => {});
    }
}

// Generate a random piece index
function randomPiece() {
    return Math.floor(Math.random() * pieces.length);
}

// Spawn a new piece; if fails => game over
function spawnPiece() {
    let pieceIndex;
    if (nextPieceIndex !== null) {
        pieceIndex = nextPieceIndex;
    } else {
        pieceIndex = randomPiece();
    }
    nextPieceIndex = randomPiece(); // prepare next piece

    // Calculate starting column (centered)
    let shape = pieces[pieceIndex].rotations[0];
    let minC = Math.min(...shape.map(p => p[1]));
    let maxC = Math.max(...shape.map(p => p[1]));
    let pieceWidth = maxC - minC + 1;
    let startCol = Math.floor((COLS - pieceWidth) / 2);
    let startRow = 0;

    currentPiece = {
        pieceIndex: pieceIndex,
        rotIndex: 0,
        row: startRow,
        col: startCol
    };

    // Check if the spawn position is valid
    if (!isValidPosition(pieceIndex, 0, startRow, startCol)) {
        gameState = 'gameover';
        currentPiece = null;
        playMenuMusic();
    }
}

// Move piece left/right
function moveLeft() {
    if (!currentPiece || gameState !== 'playing') return;
    if (isValidPosition(currentPiece.pieceIndex, currentPiece.rotIndex,
                        currentPiece.row, currentPiece.col - 1)) {
        currentPiece.col--;
    }
}
function moveRight() {
    if (!currentPiece || gameState !== 'playing') return;
    if (isValidPosition(currentPiece.pieceIndex, currentPiece.rotIndex,
                        currentPiece.row, currentPiece.col + 1)) {
        currentPiece.col++;
    }
}

// Rotate piece
function rotatePiece() {
    if (!currentPiece || gameState !== 'playing') return;
    if (currentPiece.pieceIndex === 0) return; // O piece does not rotate
    let newRot = (currentPiece.rotIndex + 1) % pieces[currentPiece.pieceIndex].rotations.length;
    if (isValidPosition(currentPiece.pieceIndex, newRot,
                        currentPiece.row, currentPiece.col)) {
        currentPiece.rotIndex = newRot;
    }
}

// Pause and Resume Functions
function pauseGame() {
    if (gameState !== 'playing') return;
    gameState = 'paused';
    audio_game.pause(); // Pause music without changing playback speed or time
}

function resumeGame() {
    if (gameState !== 'paused') return;
    gameState = 'playing';
    audio_game.play().catch(e => {}); // Resume music
    lastTime = performance.now(); // Prevent block from dropping instantly after pause
}

// Reset entire game (for new game)
function resetGame() {
    createBoard();
    score = 0;
    nextPieceIndex = null;
    currentPiece = null;
    updateDropDelay(); // reset speed
    dropAccumulator = 0;
    gameState = 'playing';
    tetrisTextEndTime = 0; 
    spawnPiece();
    playGameMusic();
}

function drawBoard() {
    // Draw board background
    ctx.fillStyle = '#111';
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_WIDTH, BOARD_HEIGHT);

    // Draw grid lines
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(BOARD_X, BOARD_Y + r * CELL_SIZE);
        ctx.lineTo(BOARD_X + BOARD_WIDTH, BOARD_Y + r * CELL_SIZE);
        ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(BOARD_X + c * CELL_SIZE, BOARD_Y);
        ctx.lineTo(BOARD_X + c * CELL_SIZE, BOARD_Y + BOARD_HEIGHT);
        ctx.stroke();
    }

    // Draw locked cells
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            let pieceIndex = board[r][c];
            if (pieceIndex !== null) {
                let img = pieces[pieceIndex].img;
                if (img && img.complete) {
                    ctx.drawImage(img,
                        BOARD_X + c * CELL_SIZE,
                        BOARD_Y + r * CELL_SIZE,
                        CELL_SIZE, CELL_SIZE);
                }
            }
        }
    }
}

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
                BOARD_X + c * CELL_SIZE,
                BOARD_Y + r * CELL_SIZE,
                CELL_SIZE, CELL_SIZE);
        }
    }
}

function drawInfoPanel() {
    // Draw info panel background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(INFO_X, 0, INFO_WIDTH, canvas.height);

    // Score
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Courier New';
    ctx.fillText('Score:', INFO_X + 10, 40);
    ctx.font = '16px Courier New';
    ctx.fillText(score, INFO_X + 10, 70);

    // Next piece label
    ctx.font = 'bold 18px Courier New';
    ctx.fillText('Next:', INFO_X + 10, 130);

    // Draw next piece preview
    if (nextPieceIndex !== null) {
        let shape = pieces[nextPieceIndex].rotations[0];
        let img = pieces[nextPieceIndex].img;
        if (img && img.complete) {
            let previewCellSize = 20;
            let minR = Math.min(...shape.map(p => p[0]));
            let maxR = Math.max(...shape.map(p => p[0]));
            let minC = Math.min(...shape.map(p => p[1]));
            let maxC = Math.max(...shape.map(p => p[1]));
            let width = (maxC - minC + 1) * previewCellSize;
            let height = (maxR - minR + 1) * previewCellSize;
            let offsetX = INFO_X + (INFO_WIDTH - width) / 2;
            let offsetY = 160;
            for (let i = 0; i < shape.length; i++) {
                let rowOffset = shape[i][0] - minR;
                let colOffset = shape[i][1] - minC;
                ctx.drawImage(img,
                    offsetX + colOffset * previewCellSize,
                    offsetY + rowOffset * previewCellSize,
                    previewCellSize, previewCellSize);
            }
        }
    }
}

// WelcomeScreen
function drawWelcomeOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('MarinovTetris [BETA]', canvas.width / 2, 180);
    ctx.font = '18px Courier New';
    ctx.fillText('An opensource Tetris game, enjoy!', canvas.width / 2, 220);
    ctx.textAlign = 'start';

    let btnWidth = 150;
    let btnHeight = 50;
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

// GameOverScreen
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

    let btnWidth = 160;
    let btnHeight = 50;
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

// PauseScreen
function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Game paused', canvas.width / 2, 180);
    ctx.textAlign = 'start';

    let btnWidth = 160;
    let btnHeight = 50;
    let btnX = canvas.width / 2 - btnWidth / 2;
    let btnY = 280;
    ctx.fillStyle = '#2196F3'; // Blue for continue
    ctx.fillRect(btnX, btnY, btnWidth, btnHeight);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('Continue', canvas.width / 2, btnY + 35);
    ctx.textAlign = 'start';
    canvas.continueBtn = { x: btnX, y: btnY, w: btnWidth, h: btnHeight };
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'playing' || gameState === 'gameover' || gameState === 'paused') {
        drawInfoPanel();
        drawBoard();
        drawCurrentPiece();

        // Draw Pause button
        if (gameState === 'playing') {
            // Positioned top right, safely inside canvas borders
            let pauseBtnX = canvas.width - 60;
            let pauseBtnY = 20;
            canvas.pauseBtn = { x: pauseBtnX, y: pauseBtnY, w: 40, h: 40 };
            
            if (img_pause.complete) {
                ctx.drawImage(img_pause, canvas.pauseBtn.x, canvas.pauseBtn.y, canvas.pauseBtn.w, canvas.pauseBtn.h);
            }
        }

        // Display "Tetris" text when four lines are cleared
        if ((gameState === 'playing' || gameState === 'paused') && tetrisTextEndTime > performance.now()) {
            ctx.fillStyle = '#FFD700';
            ctx.font = 'bold 48px Courier New';
            ctx.textAlign = 'center';
            ctx.fillText('Tetris', BOARD_X + BOARD_WIDTH / 2, BOARD_Y + BOARD_HEIGHT / 2);
            ctx.textAlign = 'start';
        }
    }

    // Overlays
    if (gameState === 'welcome') {
        drawWelcomeOverlay();
    } else if (gameState === 'gameover') {
        drawGameOverOverlay();
    } else if (gameState === 'paused') {
        drawPauseOverlay();
    }
}

//Game execution
function gameLoop(timestamp) {
    if (gameState === 'playing') {
        let delta = timestamp - lastTime;
        lastTime = timestamp;

        dropAccumulator += delta;
        // Use fast drop delay when holding touch, otherwise normal speed
        let currentDropDelay = isFastDrop ? FAST_DROP_DELAY : dropDelay;
        while (dropAccumulator >= currentDropDelay) {
            dropAccumulator -= currentDropDelay;
            moveDown();
        }
        draw();
    } else {
        draw();
        // Keep lastTime updated even when paused so the piece won't drop instantly on resume
        lastTime = timestamp; 
    }
    requestAnimationFrame(gameLoop);
}

//Keyboard events
document.addEventListener('keydown', function(e) {
    // Handle Escape key for Pause Toggle
    if (e.key === 'Escape') {
        if (gameState === 'playing') {
            pauseGame();
        } else if (gameState === 'paused') {
            resumeGame();
        }
        return; // Early return prevents pieces from moving
    }

    if (gameState !== 'playing') return;
    
    switch(e.key) {
        case 'ArrowLeft':
        case 'a':
            e.preventDefault();
            moveLeft();
            break;
        case 'ArrowRight':
        case 'd':
            e.preventDefault();
            moveRight();
            break;
        case 'ArrowDown':
        case 's':
            e.preventDefault();
            moveDown();
            break;
        case 'ArrowUp':
        case 'w':
            e.preventDefault();
            rotatePiece();
            break;
    }
});

// Click handler for buttons (mouse)
canvas.addEventListener('click', function(e) {
    let rect = canvas.getBoundingClientRect();
    let scaleX = canvas.width / rect.width;
    let scaleY = canvas.height / rect.height;
    let mouseX = (e.clientX - rect.left) * scaleX;
    let mouseY = (e.clientY - rect.top) * scaleY;

    if (gameState === 'welcome' && canvas.welcomeBtn) {
        let b = canvas.welcomeBtn;
        if (mouseX >= b.x && mouseX <= b.x + b.w &&
            mouseY >= b.y && mouseY <= b.y + b.h) {
            resetGame();
        }
    } else if (gameState === 'gameover' && canvas.gameoverBtn) {
        let b = canvas.gameoverBtn;
        if (mouseX >= b.x && mouseX <= b.x + b.w &&
            mouseY >= b.y && mouseY <= b.y + b.h) {
            resetGame();
        }
    } else if (gameState === 'playing' && canvas.pauseBtn) {
        let b = canvas.pauseBtn;
        if (mouseX >= b.x && mouseX <= b.x + b.w &&
            mouseY >= b.y && mouseY <= b.y + b.h) {
            pauseGame();
        }
    } else if (gameState === 'paused' && canvas.continueBtn) {
        let b = canvas.continueBtn;
        if (mouseX >= b.x && mouseX <= b.x + b.w &&
            mouseY >= b.y && mouseY <= b.y + b.h) {
            resumeGame();
        }
    }
});

canvas.addEventListener('touchstart', function(e) {
    e.preventDefault();
    let touch = e.changedTouches[0];
    touchStartX    = touch.clientX;
    touchStartY    = touch.clientY;
    touchLastX     = touch.clientX;
    touchStartTime = performance.now();
    isFastDrop     = false;

    clearTimeout(touchHoldTimer);
    // Activate fast drop after holding still for TOUCH_HOLD_MS
    touchHoldTimer = setTimeout(function() {
        if (gameState === 'playing') {
            isFastDrop = true;
        }
    }, TOUCH_HOLD_MS);
}, { passive: false });

canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    if (gameState !== 'playing') return;

    let touch = e.changedTouches[0];
    let rect = canvas.getBoundingClientRect();
    let scaleX = canvas.width / rect.width;

    // How wide one board cell is in real screen pixels
    let cellScreenPx = CELL_SIZE / scaleX;

    let dx = touch.clientX - touchLastX;
    if (dx >= cellScreenPx) {
        moveRight();
        touchLastX += cellScreenPx;
        // Any horizontal movement cancels the hold timer
        clearTimeout(touchHoldTimer);
        isFastDrop = false;
    } else if (dx <= -cellScreenPx) {
        moveLeft();
        touchLastX -= cellScreenPx;
        clearTimeout(touchHoldTimer);
        isFastDrop = false;
    }
}, { passive: false });

canvas.addEventListener('touchend', function(e) {
    e.preventDefault();
    clearTimeout(touchHoldTimer);
    isFastDrop = false;

    let touch = e.changedTouches[0];
    let totalDx  = Math.abs(touch.clientX - touchStartX);
    let totalDy  = Math.abs(touch.clientY - touchStartY);
    let elapsed  = performance.now() - touchStartTime;
    let isTap    = totalDx < TOUCH_TAP_MAX_MOVE &&
                   totalDy < TOUCH_TAP_MAX_MOVE &&
                   elapsed < TOUCH_TAP_MAX_MS;

    if (!isTap) return;

    // Resolve canvas coordinates for button hit-testing
    let rect   = canvas.getBoundingClientRect();
    let scaleX = canvas.width  / rect.width;
    let scaleY = canvas.height / rect.height;
    let tapX   = (touch.clientX - rect.left) * scaleX;
    let tapY   = (touch.clientY - rect.top)  * scaleY;

    function hitBtn(b) {
        return b && tapX >= b.x && tapX <= b.x + b.w &&
                    tapY >= b.y && tapY <= b.y + b.h;
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
        // Tap on the game area → rotate
        rotatePiece();
    }
}, { passive: false });


createBoard();
playMenuMusic();
lastTime = performance.now();
requestAnimationFrame(gameLoop);