const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 20;

canvas.width = COLS * BLOCK_SIZE;
canvas.height = ROWS * BLOCK_SIZE;

const SHAPES = [
    [[1, 1, 1, 1]],
    [[1, 1], [1, 1]],
    [[0, 1, 0], [1, 1, 1]],
    [[1, 0, 0], [1, 1, 1]],
    [[0, 0, 1], [1, 1, 1]],
    [[1, 1, 0], [0, 1, 1]],
    [[0, 1, 1], [1, 1, 0]]
];

const COLORS = [
    '#63b3ed',
    '#48bb78',
    '#ed8936',
    '#f56565',
    '#9f7aea',
    '#ed64a6',
    '#4fd1c5'
];

let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let gameState = 'idle';
let gameLoop = null;
let dropInterval = 1000;

function createBoard() {
    board = [];
    for (let row = 0; row < ROWS; row++) {
        board[row] = [];
        for (let col = 0; col < COLS; col++) {
            board[row][col] = null;
        }
    }
}

function getRandomPiece() {
    const index = Math.floor(Math.random() * SHAPES.length);
    return {
        shape: SHAPES[index],
        color: COLORS[index],
        x: Math.floor(COLS / 2) - Math.floor(SHAPES[index][0].length / 2),
        y: 0
    };
}

function drawBlock(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
}

function drawBoard() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]) {
                drawBlock(col, row, board[row][col]);
            }
        }
    }
}

function drawPiece(piece) {
    for (let row = 0; row < piece.shape.length; row++) {
        for (let col = 0; col < piece.shape[row].length; col++) {
            if (piece.shape[row][col]) {
                drawBlock(piece.x + col, piece.y + row, piece.color);
            }
        }
    }
}

function drawNextPiece() {
    nextCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (nextPiece) {
        const offsetX = (nextCanvas.width - nextPiece.shape[0].length * BLOCK_SIZE) / 2;
        const offsetY = (nextCanvas.height - nextPiece.shape.length * BLOCK_SIZE) / 2;
        
        for (let row = 0; row < nextPiece.shape.length; row++) {
            for (let col = 0; col < nextPiece.shape[row].length; col++) {
                if (nextPiece.shape[row][col]) {
                    nextCtx.fillStyle = nextPiece.color;
                    nextCtx.fillRect(offsetX + col * BLOCK_SIZE, offsetY + row * BLOCK_SIZE, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
                }
            }
        }
    }
}

function checkCollision(piece, offsetX = 0, offsetY = 0) {
    for (let row = 0; row < piece.shape.length; row++) {
        for (let col = 0; col < piece.shape[row].length; col++) {
            if (piece.shape[row][col]) {
                const newX = piece.x + col + offsetX;
                const newY = piece.y + row + offsetY;
                
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }
                
                if (newY >= 0 && board[newY][newX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

function mergePiece() {
    for (let row = 0; row < currentPiece.shape.length; row++) {
        for (let col = 0; col < currentPiece.shape[row].length; col++) {
            if (currentPiece.shape[row][col]) {
                const boardY = currentPiece.y + row;
                const boardX = currentPiece.x + col;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece.color;
                }
            }
        }
    }
}

function clearLines() {
    let clearedLines = 0;
    
    for (let row = ROWS - 1; row >= 0; row--) {
        if (board[row].every(cell => cell !== null)) {
            board.splice(row, 1);
            board.unshift(new Array(COLS).fill(null));
            clearedLines++;
            row++;
        }
    }
    
    if (clearedLines > 0) {
        const points = [0, 100, 300, 500, 800];
        score += points[clearedLines] * level;
        lines += clearedLines;
        
        if (lines >= level * 10) {
            level++;
            dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        }
        
        updateUI();
    }
}

function rotatePiece() {
    const shape = currentPiece.shape;
    const rotated = [];
    
    for (let col = 0; col < shape[0].length; col++) {
        rotated[col] = [];
        for (let row = shape.length - 1; row >= 0; row--) {
            rotated[col].push(shape[row][col]);
        }
    }
    
    const rotatedPiece = {
        ...currentPiece,
        shape: rotated
    };
    
    if (!checkCollision(rotatedPiece)) {
        currentPiece = rotatedPiece;
    } else {
        const kicks = [-1, 1, -2, 2];
        for (const kick of kicks) {
            rotatedPiece.x += kick;
            if (!checkCollision(rotatedPiece)) {
                currentPiece = rotatedPiece;
                break;
            }
            rotatedPiece.x -= kick;
        }
    }
}

function movePiece(dx, dy) {
    if (!checkCollision(currentPiece, dx, dy)) {
        currentPiece.x += dx;
        currentPiece.y += dy;
        return true;
    }
    return false;
}

function dropPiece() {
    if (!movePiece(0, 1)) {
        mergePiece();
        clearLines();
        spawnPiece();
    }
}

function hardDrop() {
    while (movePiece(0, 1)) {
        score += 2;
    }
    dropPiece();
    updateUI();
}

function spawnPiece() {
    currentPiece = nextPiece || getRandomPiece();
    nextPiece = getRandomPiece();
    
    if (checkCollision(currentPiece)) {
        gameOver();
        return;
    }
    
    drawNextPiece();
}

function gameOver() {
    gameState = 'gameover';
    clearInterval(gameLoop);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('游戏结束', canvas.width / 2, canvas.height / 2);
    ctx.font = '16px Arial';
    ctx.fillText(`最终分数: ${score}`, canvas.width / 2, canvas.height / 2 + 30);
}

function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('lines').textContent = lines;
    document.getElementById('level').textContent = level;
}

function startGame() {
    createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    nextPiece = getRandomPiece();
    spawnPiece();
    gameState = 'playing';
    
    gameLoop = setInterval(() => {
        if (gameState === 'playing') {
            dropPiece();
            drawBoard();
            drawPiece(currentPiece);
        }
    }, dropInterval);
}

function pauseGame() {
    if (gameState === 'playing') {
        gameState = 'paused';
        clearInterval(gameLoop);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('暂停', canvas.width / 2, canvas.height / 2);
    } else if (gameState === 'paused') {
        gameState = 'playing';
        gameLoop = setInterval(() => {
            if (gameState === 'playing') {
                dropPiece();
                drawBoard();
                drawPiece(currentPiece);
            }
        }, dropInterval);
    }
}

function resetGame() {
    clearInterval(gameLoop);
    startGame();
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('pauseBtn').addEventListener('click', pauseGame);
document.getElementById('resetBtn').addEventListener('click', resetGame);

document.addEventListener('keydown', (e) => {
    if (gameState !== 'playing') return;
    
    switch (e.key) {
        case 'ArrowLeft':
            movePiece(-1, 0);
            break;
        case 'ArrowRight':
            movePiece(1, 0);
            break;
        case 'ArrowDown':
            movePiece(0, 1);
            score += 1;
            updateUI();
            break;
        case 'ArrowUp':
            rotatePiece();
            break;
        case ' ':
            hardDrop();
            break;
        case 'p':
        case 'P':
            pauseGame();
            break;
    }
    
    drawBoard();
    drawPiece(currentPiece);
});

createBoard();
drawBoard();