/**
 * 俄罗斯方块游戏 - 完整游戏逻辑
 * 包含：增强计分、难度选择、排行榜、回放、触屏支持、音效、主题切换
 */

// ========================================
// 全局变量和配置
// ========================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

// 游戏配置
let COLS = 10;
let ROWS = 20;
const BLOCK_SIZE = 20;

// 方块形状定义
const SHAPES = [
    [[1, 1, 1, 1]],                           // I型
    [[1, 1], [1, 1]],                         // O型
    [[0, 1, 0], [1, 1, 1]],                  // T型
    [[1, 0, 0], [1, 1, 1]],                  // L型
    [[0, 0, 1], [1, 1, 1]],                  // J型
    [[1, 1, 0], [0, 1, 1]],                  // S型
    [[0, 1, 1], [1, 1, 0]]                   // Z型
];

// 方块颜色配置 - 渐变色方案
const COLORS = [
    '#63b3ed',  // 蓝色
    '#48bb78',  // 绿色
    '#ed8936',  // 橙色
    '#f56565',  // 红色
    '#9f7aea',  // 紫色
    '#ed64a6',  // 粉色
    '#4fd1c5'   // 青色
];

// 游戏状态变量
let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let gameState = 'idle';  // idle, playing, paused, gameover
let gameLoop = null;
let dropInterval = 1000;

// 增强功能变量
let highScore = 0;
let isMuted = false;
let currentTheme = 'dark';
let moveCount = 0;
let operations = [];  // 操作记录
let isReplaying = false;
let replayIndex = 0;
let replaySpeed = 1;

// 难度配置
const DIFFICULTY_CONFIG = {
    easy: { speed: 1000, cols: 10, rows: 20 },
    normal: { speed: 800, cols: 10, rows: 20 },
    hard: { speed: 500, cols: 12, rows: 24 }
};

let currentDifficulty = 'normal';

// 音频上下文
let audioContext = null;

// ========================================
// 初始化和配置
// ========================================

// 初始化Canvas尺寸
function initializeCanvas() {
    canvas.width = COLS * BLOCK_SIZE;
    canvas.height = ROWS * BLOCK_SIZE;
}

// 初始化游戏板
function createBoard() {
    board = [];
    for (let row = 0; row < ROWS; row++) {
        board[row] = [];
        for (let col = 0; col < COLS; col++) {
            board[row][col] = null;
        }
    }
}

// 加载保存的数据
function loadSavedData() {
    try {
        // 加载最高分
        const savedHighScore = localStorage.getItem('tetrisHighScore');
        if (savedHighScore) {
            highScore = parseInt(savedHighScore);
        }

        // 加载主题
        const savedTheme = localStorage.getItem('tetrisTheme');
        if (savedTheme) {
            currentTheme = savedTheme;
            applyTheme(currentTheme);
        }

        // 加载静音状态
        const savedMuted = localStorage.getItem('tetrisMuted');
        if (savedMuted === 'true') {
            isMuted = true;
            updateMuteButton();
        }

        updateUI();
    } catch (e) {
        console.warn('加载保存数据失败:', e);
    }
}

// 保存数据到localStorage
function saveData(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn('保存数据失败:', e);
    }
}

// ========================================
// 游戏核心逻辑
// ========================================

// 生成随机方块
function getRandomPiece() {
    const index = Math.floor(Math.random() * SHAPES.length);
    return {
        shape: SHAPES[index].map(row => [...row]),
        color: COLORS[index],
        x: Math.floor(COLS / 2) - Math.floor(SHAPES[index][0].length / 2),
        y: 0
    };
}

// 绘制单个方块 - 增强视觉效果
function drawBlock(x, y, color) {
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;

    // 创建渐变效果
    const gradient = ctx.createLinearGradient(px, py, px + BLOCK_SIZE, py + BLOCK_SIZE);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, adjustColor(color, -30));

    ctx.fillStyle = gradient;
    ctx.fillRect(px, py, BLOCK_SIZE - 1, BLOCK_SIZE - 1);

    // 添加高光效果
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(px + 2, py + 2, BLOCK_SIZE - 5, 3);

    // 添加阴影
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px, py, BLOCK_SIZE - 1, BLOCK_SIZE - 1);
}

// 调整颜色亮度
function adjustColor(color, amount) {
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// 绘制游戏板
function drawBoard() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制网格线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * BLOCK_SIZE, 0);
        ctx.lineTo(i * BLOCK_SIZE, canvas.height);
        ctx.stroke();
    }
    for (let i = 0; i <= ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * BLOCK_SIZE);
        ctx.lineTo(canvas.width, i * BLOCK_SIZE);
        ctx.stroke();
    }

    // 绘制已固定的方块
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]) {
                drawBlock(col, row, board[row][col]);
            }
        }
    }
}

// 绘制当前方块
function drawPiece(piece) {
    if (!piece) return;
    for (let row = 0; row < piece.shape.length; row++) {
        for (let col = 0; col < piece.shape[row].length; col++) {
            if (piece.shape[row][col]) {
                drawBlock(piece.x + col, piece.y + row, piece.color);
            }
        }
    }
}

// 绘制下一个方块预览
function drawNextPiece() {
    nextCtx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (!nextPiece) return;

    const offsetX = (nextCanvas.width - nextPiece.shape[0].length * BLOCK_SIZE) / 2;
    const offsetY = (nextCanvas.height - nextPiece.shape.length * BLOCK_SIZE) / 2;

    for (let row = 0; row < nextPiece.shape.length; row++) {
        for (let col = 0; col < nextPiece.shape[row].length; col++) {
            if (nextPiece.shape[row][col]) {
                const px = offsetX + col * BLOCK_SIZE;
                const py = offsetY + row * BLOCK_SIZE;

                // 创建渐变
                const gradient = nextCtx.createLinearGradient(px, py, px + BLOCK_SIZE, py + BLOCK_SIZE);
                gradient.addColorStop(0, nextPiece.color);
                gradient.addColorStop(1, adjustColor(nextPiece.color, -30));

                nextCtx.fillStyle = gradient;
                nextCtx.fillRect(px, py, BLOCK_SIZE - 1, BLOCK_SIZE - 1);

                nextCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                nextCtx.fillRect(px + 2, py + 2, BLOCK_SIZE - 5, 3);
            }
        }
    }
}

// 碰撞检测
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

// 合并方块到游戏板
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

// 消除行并计算分数
function clearLines() {
    let clearedLines = 0;
    let clearedRow = -1;

    // 检测需要消除的行
    for (let row = ROWS - 1; row >= 0; row--) {
        if (board[row].every(cell => cell !== null)) {
            board.splice(row, 1);
            board.unshift(new Array(COLS).fill(null));
            clearedLines++;
            clearedRow = row;
            row++;
        }
    }

    // 计算分数 - 增强计分规则
    if (clearedLines > 0) {
        // 计分规则：1行100分，2行300分，3行600分，4行1000分，乘以等级
        const points = [0, 100, 300, 600, 1000];
        const earnedPoints = points[clearedLines] * level;
        score += earnedPoints;
        lines += clearedLines;

        // 播放消除音效
        playSound('clear');

        // 显示得分飘字
        if (clearedRow >= 0) {
            showScorePopup(earnedPoints, clearedRow);
        }

        // 升级逻辑
        if (lines >= level * 10) {
            level++;
            dropInterval = Math.max(100, dropInterval - 50);
            restartGameLoop();
        }

        updateUI();
    }

    return clearedLines;
}

// 方块旋转
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

    // 尝试旋转，失败则尝试墙踢
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

// 移动方块
function movePiece(dx, dy) {
    if (!checkCollision(currentPiece, dx, dy)) {
        currentPiece.x += dx;
        currentPiece.y += dy;
        return true;
    }
    return false;
}

// 软降 - 加速下落
function softDrop() {
    if (movePiece(0, 1)) {
        score += 1;
        updateUI();
        return true;
    }
    return false;
}

// 硬降 - 直接落到底部
function hardDrop() {
    while (movePiece(0, 1)) {
        score += 2;
    }
    dropPiece();
    updateUI();
    playSound('drop');
}

// 下落一步
function dropPiece() {
    if (!movePiece(0, 1)) {
        mergePiece();
        clearLines();
        spawnPiece();
    }
}

// 生成新方块
function spawnPiece() {
    currentPiece = nextPiece || getRandomPiece();
    nextPiece = getRandomPiece();

    // 检查游戏结束
    if (checkCollision(currentPiece)) {
        gameOver();
        return;
    }

    drawNextPiece();
}

// ========================================
// 游戏控制
// ========================================

// 开始游戏
function startGame(difficulty) {
    currentDifficulty = difficulty || 'normal';
    const config = DIFFICULTY_CONFIG[currentDifficulty];

    COLS = config.cols;
    ROWS = config.rows;
    dropInterval = config.speed;

    initializeCanvas();
    createBoard();
    score = 0;
    lines = 0;
    level = 1;
    moveCount = 0;
    operations = [];
    gameState = 'playing';

    nextPiece = getRandomPiece();
    spawnPiece();

    // 启动游戏循环
    restartGameLoop();

    // 隐藏难度选择界面
    hideDifficultyModal();
    hideGameOverModal();

    updateUI();
    playSound('start');
}

// 重新启动游戏循环
function restartGameLoop() {
    if (gameLoop) {
        clearInterval(gameLoop);
    }

    gameLoop = setInterval(() => {
        if (gameState === 'playing' && !isReplaying) {
            dropPiece();
            draw();
        }
    }, dropInterval);
}

// 暂停游戏
function pauseGame() {
    if (gameState === 'playing') {
        gameState = 'paused';
        clearInterval(gameLoop);
        showPauseOverlay();
        playSound('pause');
    } else if (gameState === 'paused') {
        gameState = 'playing';
        restartGameLoop();
        hidePauseOverlay();
        playSound('pause');
    }
}

// 重新开始游戏
function resetGame() {
    if (gameLoop) {
        clearInterval(gameLoop);
    }
    gameState = 'idle';
    createBoard();
    drawBoard();
    score = 0;
    lines = 0;
    level = 1;
    moveCount = 0;
    operations = [];
    updateUI();
    hidePauseOverlay();
    hideGameOverModal();
}

// 游戏结束
function gameOver() {
    gameState = 'gameover';
    clearInterval(gameLoop);

    // 更新最高分
    if (score > highScore) {
        highScore = score;
        saveData('tetrisHighScore', highScore);
    }

    // 保存到排行榜
    saveToRanking(score, lines);

    // 显示结算界面
    showGameOverModal();

    playSound('gameover');
}

// 更新UI显示
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('lines').textContent = lines;
    document.getElementById('level').textContent = level;
}

// 绘制游戏画面
function draw() {
    drawBoard();
    drawPiece(currentPiece);
}

// ========================================
// 操作记录和回放
// ========================================

// 记录操作
function recordOperation(type, key) {
    if (gameState !== 'playing') return;

    operations.push({
        type: type,
        key: key,
        timestamp: Date.now() - gameStartTime,
        score: score,
        lines: lines
    });
    moveCount++;
}

// 开始回放
function startReplay() {
    if (operations.length === 0) {
        alert('没有可回放的操作记录');
        return;
    }

    isReplaying = true;
    replayIndex = 0;
    hideGameOverModal();
    showReplayOverlay();

    // 重置游戏状态
    createBoard();
    score = 0;
    lines = 0;
    level = 1;
    currentPiece = null;
    nextPiece = getRandomPiece();
    spawnPiece();
    updateUI();
    drawBoard();

    // 开始回放
    replayNextOperation();
}

// 回放下一个操作
function replayNextOperation() {
    if (!isReplaying || replayIndex >= operations.length) {
        stopReplay();
        return;
    }

    const op = operations[replayIndex];

    // 恢复到操作前的状态
    score = op.score;
    lines = op.lines;
    updateUI();

    // 执行操作
    switch (op.type) {
        case 'move':
            if (op.key === 'ArrowLeft') movePiece(-1, 0);
            else if (op.key === 'ArrowRight') movePiece(1, 0);
            else if (op.key === 'ArrowDown') softDrop();
            break;
        case 'rotate':
            rotatePiece();
            break;
        case 'drop':
            hardDrop();
            break;
    }

    draw();

    // 更新进度
    const progress = ((replayIndex + 1) / operations.length * 100).toFixed(0);
    document.getElementById('replayProgress').style.width = progress + '%';
    document.getElementById('replayStatus').textContent = progress + '%';

    replayIndex++;

    // 根据速度设置延迟
    setTimeout(replayNextOperation, 100 / replaySpeed);
}

// 停止回放
function stopReplay() {
    isReplaying = false;
    hideReplayOverlay();
    resetGame();
}

// 切换回放速度
function toggleReplaySpeed() {
    const speeds = [1, 2, 3, 0.5];
    const currentIndex = speeds.indexOf(replaySpeed);
    replaySpeed = speeds[(currentIndex + 1) % speeds.length];
    document.getElementById('replaySpeedBtn').textContent = `速度: ${replaySpeed}x`;
}

// ========================================
// 排行榜系统
// ========================================

// 保存到排行榜
function saveToRanking(score, lines) {
    if (score <= 0) return;

    try {
        let ranking = JSON.parse(localStorage.getItem('tetrisRanking') || '[]');

        ranking.push({
            score: score,
            lines: lines,
            timestamp: Date.now()
        });

        // 按分数降序排序
        ranking.sort((a, b) => b.score - a.score);

        // 只保留前100条记录
        ranking = ranking.slice(0, 100);

        localStorage.setItem('tetrisRanking', JSON.stringify(ranking));
    } catch (e) {
        console.warn('保存排行榜失败:', e);
    }
}

// 显示排行榜
function showRanking() {
    const rankingList = document.getElementById('rankingList');
    let ranking = [];

    try {
        ranking = JSON.parse(localStorage.getItem('tetrisRanking') || '[]');
    } catch (e) {
        ranking = [];
    }

    // 清空现有内容
    rankingList.innerHTML = `
        <div class="ranking-item header">
            <span>排名</span>
            <span>分数</span>
            <span>时间</span>
        </div>
    `;

    // 添加排行数据
    ranking.slice(0, 20).forEach((item, index) => {
        const date = new Date(item.timestamp);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;

        rankingList.innerHTML += `
            <div class="ranking-item">
                <span class="rank">#${index + 1}</span>
                <span class="score">${item.score}</span>
                <span class="date">${dateStr}</span>
            </div>
        `;
    });

    if (ranking.length === 0) {
        rankingList.innerHTML += `
            <div class="ranking-item" style="justify-content: center; color: var(--text-secondary);">
                暂无记录
            </div>
        `;
    }

    document.getElementById('rankingModal').classList.add('active');
}

// ========================================
// 触屏手势支持
// ========================================

let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

function handleTouchStart(e) {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
}

function handleSwipe() {
    if (gameState !== 'playing') return;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const minSwipeDistance = 30;

    // 判断滑动方向
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // 水平滑动
        if (Math.abs(deltaX) > minSwipeDistance) {
            if (deltaX > 0) {
                movePiece(1, 0);
                recordOperation('move', 'ArrowRight');
            } else {
                movePiece(-1, 0);
                recordOperation('move', 'ArrowLeft');
            }
            draw();
        }
    } else {
        // 垂直滑动
        if (Math.abs(deltaY) > minSwipeDistance) {
            if (deltaY < 0) {
                rotatePiece();
                recordOperation('rotate', 'ArrowUp');
            } else {
                softDrop();
                recordOperation('move', 'ArrowDown');
            }
            draw();
        }
    }
}

// ========================================
// 音效系统
// ========================================

// 初始化音频上下文
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// 播放音效
function playSound(type) {
    if (isMuted || !audioContext) return;

    // 确保音频上下文已启动
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 根据类型设置不同的音效
    switch (type) {
        case 'move':
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.05);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.05);
            break;

        case 'rotate':
            oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.08);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.08);
            break;

        case 'drop':
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            break;

        case 'clear':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.15);
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
            break;

        case 'gameover':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
            break;

        case 'start':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(500, audioContext.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            break;

        case 'pause':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(300, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
            break;
    }
}

// 切换静音状态
function toggleMute() {
    isMuted = !isMuted;
    saveData('tetrisMuted', isMuted);
    updateMuteButton();

    if (!isMuted) {
        initAudio();
        playSound('start');
    }
}

// 更新静音按钮显示
function updateMuteButton() {
    const btn = document.getElementById('muteBtn');
    btn.textContent = isMuted ? '🔇 静音' : '🔊 音效';
}

// ========================================
// 主题切换
// ========================================

// 切换主题
function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(currentTheme);
    saveData('tetrisTheme', currentTheme);
}

// 应用主题
function applyTheme(theme) {
    if (theme === 'light') {
        document.body.setAttribute('data-theme', 'light');
    } else {
        document.body.removeAttribute('data-theme');
    }
}

// ========================================
// UI交互
// ========================================

// 显示难度选择模态框
function showDifficultyModal() {
    document.getElementById('difficultyModal').classList.add('active');
}

// 隐藏难度选择模态框
function hideDifficultyModal() {
    document.getElementById('difficultyModal').classList.remove('active');
}

// 显示游戏结束模态框
function showGameOverModal() {
    document.getElementById('finalScore').textContent = score;
    document.getElementById('bestScore').textContent = highScore;
    document.getElementById('finalLines').textContent = lines;
    document.getElementById('gameOverModal').classList.add('active');
}

// 隐藏游戏结束模态框
function hideGameOverModal() {
    document.getElementById('gameOverModal').classList.remove('active');
}

// 显示暂停覆盖层
function showPauseOverlay() {
    document.getElementById('pauseOverlay').classList.add('active');
}

// 隐藏暂停覆盖层
function hidePauseOverlay() {
    document.getElementById('pauseOverlay').classList.remove('active');
}

// 显示回放覆盖层
function showReplayOverlay() {
    document.getElementById('replayOverlay').classList.add('active');
    document.getElementById('replayProgress').style.width = '0%';
    document.getElementById('replayStatus').textContent = '0%';
}

// 隐藏回放覆盖层
function hideReplayOverlay() {
    document.getElementById('replayOverlay').classList.remove('active');
}

// 显示得分飘字
function showScorePopup(points, row) {
    const container = document.getElementById('scorePopupContainer');
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    popup.textContent = `+${points}`;

    // 计算位置
    const canvasRect = canvas.getBoundingClientRect();
    popup.style.left = (canvasRect.left + canvasRect.width / 2) + 'px';
    popup.style.top = (canvasRect.top + row * BLOCK_SIZE) + 'px';

    container.appendChild(popup);

    // 动画结束后移除
    setTimeout(() => {
        popup.remove();
    }, 1000);
}

// ========================================
// 事件监听
// ========================================

let gameStartTime = 0;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeCanvas();
    loadSavedData();
    createBoard();
    drawBoard();
    drawNextPiece();

    // 难度选择按钮
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const difficulty = btn.dataset.difficulty;
            startGame(difficulty);
            gameStartTime = Date.now();
        });
    });

    // 控制按钮
    document.getElementById('startBtn').addEventListener('click', () => {
        initAudio();
        showDifficultyModal();
    });

    document.getElementById('pauseBtn').addEventListener('click', () => {
        if (gameState === 'playing' || gameState === 'paused') {
            pauseGame();
        }
    });

    document.getElementById('resetBtn').addEventListener('click', resetGame);

    // 功能按钮
    document.getElementById('muteBtn').addEventListener('click', () => {
        initAudio();
        toggleMute();
    });

    document.getElementById('themeBtn').addEventListener('click', toggleTheme);

    document.getElementById('rankingBtn').addEventListener('click', showRanking);

    // 游戏结束界面按钮
    document.getElementById('playAgainBtn').addEventListener('click', () => {
        hideGameOverModal();
        showDifficultyModal();
    });

    document.getElementById('replayBtn').addEventListener('click', startReplay);

    document.getElementById('viewRankingBtn').addEventListener('click', () => {
        hideGameOverModal();
        showRanking();
    });

    // 排行榜关闭按钮
    document.getElementById('closeRankingBtn').addEventListener('click', () => {
        document.getElementById('rankingModal').classList.remove('active');
    });

    // 暂停继续按钮
    document.getElementById('continueBtn').addEventListener('click', pauseGame);

    // 回放控制按钮
    document.getElementById('replayPauseBtn').addEventListener('click', () => {
        if (isReplaying) {
            isReplaying = false;
            document.getElementById('replayPauseBtn').textContent = '继续';
        } else if (replayIndex < operations.length) {
            isReplaying = true;
            document.getElementById('replayPauseBtn').textContent = '暂停';
            replayNextOperation();
        }
    });

    document.getElementById('replaySpeedBtn').addEventListener('click', toggleReplaySpeed);

    document.getElementById('replayStopBtn').addEventListener('click', stopReplay);

    // 键盘控制
    document.addEventListener('keydown', (e) => {
        if (gameState !== 'playing') return;

        switch (e.key) {
            case 'ArrowLeft':
                movePiece(-1, 0);
                recordOperation('move', 'ArrowLeft');
                break;
            case 'ArrowRight':
                movePiece(1, 0);
                recordOperation('move', 'ArrowRight');
                break;
            case 'ArrowDown':
                softDrop();
                recordOperation('move', 'ArrowDown');
                break;
            case 'ArrowUp':
                rotatePiece();
                recordOperation('rotate', 'ArrowUp');
                break;
            case ' ':
                e.preventDefault();
                hardDrop();
                recordOperation('drop', 'Space');
                break;
            case 'p':
            case 'P':
                pauseGame();
                break;
        }

        draw();
    });

    // 触屏手势支持
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });

    // 点击模态框外部关闭（仅限排行榜）
    document.getElementById('rankingModal').addEventListener('click', (e) => {
        if (e.target.id === 'rankingModal') {
            document.getElementById('rankingModal').classList.remove('active');
        }
    });

    // 初始化音频（需要用户交互才能启动）
    document.addEventListener('click', () => {
        initAudio();
    }, { once: true });
});

// 窗口大小变化时重新调整Canvas
window.addEventListener('resize', () => {
    // 可以在这里添加响应式调整逻辑
});
