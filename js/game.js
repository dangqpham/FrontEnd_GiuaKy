const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 30;

// 7 khối tiêu chuẩn, 1 khối bom đặc biệt
const SHAPES = [
    [],
    [[1, 1, 1, 1]],                         // 1: I
    [[1, 0, 0], [1, 1, 1]],                 // 2: J
    [[0, 0, 1], [1, 1, 1]],                 // 3: L
    [[1, 1], [1, 1]],                       // 4: O
    [[0, 1, 1], [1, 1, 0]],                 // 5: S
    [[0, 1, 0], [1, 1, 1]],                 // 6: T
    [[1, 1, 0], [0, 1, 1]],                 // 7: Z
    [[1]]                                   // 8: Khối 1x1 đặc biệt
];

let board = [];
let currentLevel = 1;
let score = 0;
let gameOver = false;

let lastTime = 0;
let dropCounter = 0;

let currentPiece = null;
let nextPiece = null;

// biến riêng
let placedPiecesCount = 0; // số khối đã đặt (màn2)
let levelTimer = 0;         // đếm thời gian (màn 3,4,5)

const boardCanvas = document.getElementById('tetris-board');
const ctx = boardCanvas.getContext('2d');

const nextCanvas = document.getElementById('next-preview');
const nextCtx = nextCanvas.getContext('2d');

const progressDisplay = document.getElementById('progress-display');
const levelDisplay = document.getElementById('level-display');
const noteDisplay = document.getElementById('note-display');
const levelSelectContainer = document.getElementById('level-select-container');

const LEVELS = {
    1: {
        targetScore: 1000,
        speed: 1000,
        note: "Màn 1: Tốc độ cơ bản. Đạt 1000 điểm",
        onInit: () => {},
        onUpdate: (deltaTime) => {},
        onMove: () => true,
        onPlace: () => {}
    },
    2: {
        targetScore: 2000,
        speed: 850,
        note: "Màn 2: Có sẵn 3 hàng rác ở đáy!",
        onInit: () => {
            const trashRows = 3;
            for (let r = ROWS - trashRows; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    board[r][c] = 1;
                }
                const emptyCount = Math.floor(Math.random() * 2) + 2;
                let cleared = 0;
                while (cleared < emptyCount) {
                    const randomCol = Math.floor(Math.random() * COLS);
                    if (board[r][randomCol] !== 0) {
                        board[r][randomCol] = 0;
                        cleared++;
                    }
                }
            }
        },
        onUpdate: (deltaTime) => {},
        onMove: () => true,
        onPlace: () => {}
    },
    3: {
        targetScore: 3000,
        speed: 700,
        note: "Màn 3: Dâng khối rác ngẫu nhiên mỗi 15 giây!",
        onInit: () => {
            levelTimer = 0;
        },
        onUpdate: (deltaTime) => {
            levelTimer += deltaTime;

            if (levelTimer >= 15000) {
                levelTimer = 0;
                let topRowHasBlock = false;
                for (let c = 0; c < COLS; c++) {
                    if (board[0][c] !== 0) {
                        topRowHasBlock = true;
                        break;
                    }
                }
                if (topRowHasBlock) {
                    alert("GAME OVER! Gạch bị đẩy vượt quá đỉnh bàn chơi.");
                    gameOver = true;
                    return;
                }
                for (let r = 0; r < ROWS - 1; r++) {
                    for (let c = 0; c < COLS; c++) {
                        board[r][c] = board[r + 1][c];
                    }
                }
                for (let c = 0; c < COLS; c++) {
                    board[ROWS - 1][c] = 1;
                }
                const emptyCount = Math.floor(Math.random() * 3) + 1;
                let cleared = 0;
                while (cleared < emptyCount) {
                    const randomCol = Math.floor(Math.random() * COLS);
                    if (board[ROWS - 1][randomCol] !== 0) {
                        board[ROWS - 1][randomCol] = 0;
                        cleared++;
                    }
                }
                if (currentPiece && checkCollision(currentPiece, 0, 0)) {
                    currentPiece.y--;
                    if (checkCollision(currentPiece, 0, 0)) {
                        alert("GAME OVER! BẠN ĐÃ THUA CUỘC.");
                        gameOver = true;
                    }
                }
            }
        },
        onMove: () => true,
        onPlace: () => {}
    },
    4: {
        targetScore: 4000,
        speed: 550,
        note: "Màn 4: Khóa di chuyển và xoay gạch ở nửa dưới bàn!",
        onInit: () => {},
        onUpdate: (deltaTime) => {},
        onMove: () => {
            if (currentPiece && currentPiece.y >= ROWS / 2) return false;
            return true;
        },
        onPlace: () => {}
    },
    5: {
        targetScore: 5000,
        speed: 450,
        note: "Màn 5: Thử thách khối biến hình & khối bom nổ!",
        onInit: () => {},
        onUpdate: (deltaTime) => {},
        onMove: () => true,
        onPlace: () => {
        }
    }
};
let dropInterval = LEVELS[currentLevel].speed;


function renderLevelButtons() {
    if (!levelSelectContainer) return;
    levelSelectContainer.innerHTML = '';

    Object.keys(LEVELS).forEach(lvl => {
        const btn = document.createElement('button');
        btn.className = `level-btn ${Number(lvl) === currentLevel ? 'active' : ''}`;
        btn.innerText = `Màn ${lvl}`;
        btn.onclick = () => {
            loadLevel(Number(lvl));
            renderLevelButtons();
        };
        levelSelectContainer.appendChild(btn);
    });
}
// tạo bàn chơi và màn chơi
function resetBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        for (let c = 0; c < COLS; c++) {
            board[r][c] = 0;
        }
    }
}

// cập nhật màn chơi
function updateLevelUI() {
    if (levelDisplay) levelDisplay.innerText = `0${currentLevel}`;
    if (noteDisplay) noteDisplay.innerText = LEVELS[currentLevel].note;
    if (progressDisplay) progressDisplay.innerText = `${score}/${LEVELS[currentLevel].targetScore}`;
    renderLevelButtons();
}

// chuyển màn chơi tự động
function loadLevel(levelNumber) {
    currentLevel = levelNumber;
    score = 0;
    gameOver = false;

    const config = LEVELS[currentLevel];
    dropInterval = config.speed;

    resetBoard();
    updateLevelUI();

    if (typeof config.onInit === 'function') {
        config.onInit();
    }

    currentPiece = null;
    nextPiece = null;
    spawnPiece();
}

// xử lý ma trận, khối gach
function getRandomType() {
    return Math.floor(Math.random() * 7) + 1;
}
function createPiece(type) {
    const matrix = SHAPES[type];
    return {
        type: type,
        matrix: matrix,
        x: Math.floor((COLS - matrix[0].length) / 2),
        y: 0
    };
}

function rotateMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    let result = [];
    for (let c = 0; c < cols; c++) {
        result[c] = [];
        for (let r = rows - 1; r >= 0; r--) {
            result[c].push(matrix[r][c]);
        }
    }
    return result;
}

// vẽ giao diện
function drawBlock(context, x, y, isFilled) {
    if (isFilled) {
        context.fillStyle = '#ffffff';
        context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        context.strokeStyle = '#000000';
        context.lineWidth = 1;
        context.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    } else {
        context.fillStyle = '#000000';
        context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    }
}

function drawGrid() {
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;

    for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(0, r * BLOCK_SIZE);
        ctx.lineTo(COLS * BLOCK_SIZE, r * BLOCK_SIZE);
        ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(c * BLOCK_SIZE, 0);
        ctx.lineTo(c * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        ctx.stroke();
    }
}

function drawNextPreview() {
    nextCtx.fillStyle = '#111111';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    if (!nextPiece) return;

    const matrix = nextPiece.matrix;
    const offsetX = Math.floor((4 - matrix[0].length) / 2);
    const offsetY = Math.floor((4 - matrix.length) / 2);

    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
            if (matrix[r][c] !== 0) {
                drawBlock(nextCtx, offsetX + c, offsetY + r, true);
            }
        }
    }
}

function draw() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    drawGrid();

    // vẽ ô gạch đang cố định
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] !== 0) {
                drawBlock(ctx, c, r, true);
            }
        }
    }

    // vẽ khối đang rơi
    if (currentPiece) {
        const matrix = currentPiece.matrix;
        for (let r = 0; r < matrix.length; r++) {
            for (let c = 0; c < matrix[r].length; c++) {
                if (matrix[r][c] !== 0) {
                    drawBlock(ctx, currentPiece.x + c, currentPiece.y + r, true);
                }
            }
        }
    }
    // đường kẻ cảnh báo cho màn 4
    if (currentLevel === 4) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, (ROWS / 2) * BLOCK_SIZE);
        ctx.lineTo(COLS * BLOCK_SIZE, (ROWS / 2) * BLOCK_SIZE);
        ctx.stroke();
    }
    drawNextPreview();
}

// logic di chuyển, chạm, tính điểm
function checkCollision(piece, offsetX = 0, offsetY = 0) {
    const matrix = piece.matrix;

    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
            if (matrix[r][c] !== 0) {
                let newX = piece.x + c + offsetX;
                let newY = piece.y + r + offsetY;

                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }
                if (newY >= 0 && board[newY][newX] !== 0) {
                    return true;
                }
            }
        }
    }
    return false;
}

function playerRotate() {
    const oldMatrix = currentPiece.matrix;
    currentPiece.matrix = rotateMatrix(currentPiece.matrix);

    if (checkCollision(currentPiece, 0, 0)) {
        currentPiece.matrix = oldMatrix;
    }
}

function mergePiece() {
    const matrix = currentPiece.matrix;
    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
            if (matrix[r][c] !== 0) {
                let boardR = currentPiece.y + r;
                let boardC = currentPiece.x + c;
                if (boardR >= 0) {
                    board[boardR][boardC] = currentPiece.type;
                }
            }
        }
    }
}

function clearLines() {
    let linesCleared = 0;

    for (let r = ROWS - 1; r >= 0; r--) {
        let isFullLine = true;

        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === 0) {
                isFullLine = false;
                break;
            }
        }

        if (isFullLine) {
            linesCleared++;

            for (let y = r; y > 0; y--) {
                for (let x = 0; x < COLS; x++) {
                    board[y][x] = board[y - 1][x];
                }
            }

            for (let x = 0; x < COLS; x++) {
                board[0][x] = 0;
            }

            r++;
        }
    }

    if (linesCleared > 0) {
        const points = [0, 100, 300, 500, 800];
        score += points[linesCleared];

        const target = LEVELS[currentLevel].targetScore;
        progressDisplay.innerText = `${score}/${target}`;

        // điều kiện hoàn thành
        if (score >= target) {
            if (currentLevel < Object.keys(LEVELS).length) {
                alert(`CHÚC MỪNG! BẠN ĐÃ HOÀN THÀNH MÀN ${currentLevel}! CHUYỂN SANG MÀN ${currentLevel + 1}`);
                loadLevel(currentLevel + 1);
            } else {
                alert("XIN CHÚC MỪNG! BẠN ĐÃ PHÁ ĐẢO TOÀN BỘ CÁC MÀN CHƠI!");
                gameOver = true;
            }
        }
    }
}

function spawnPiece() {
    if (!nextPiece) {
        nextPiece = createPiece(getRandomType());
    }
    currentPiece = nextPiece;
    nextPiece = createPiece(getRandomType());

    if (checkCollision(currentPiece, 0, 0)) {
        alert("GAME OVER! BẠN ĐÃ THUA CUỘC.");
        gameOver = true;
    }
}

function dropPiece() {
    if (!checkCollision(currentPiece, 0, 1)) {
        currentPiece.y++;
    } else {
        if (LEVELS[currentLevel].onPlace) {
            LEVELS[currentLevel].onPlace();
        }

        mergePiece();
        clearLines();
        if (!gameOver) {
            spawnPiece();
        }
    }
    dropCounter = 0;
}

function hardDrop() {
    while (!checkCollision(currentPiece, 0, 1)) {
        currentPiece.y++;
    }
    dropPiece();
}

// điều khiển vòng lập game
document.addEventListener('keydown', function(event) {
    if (gameOver) return;

    const canMove = LEVELS[currentLevel].onMove();

    if (event.key === 'ArrowLeft' && canMove) {
        if (!checkCollision(currentPiece, -1, 0)) currentPiece.x--;
    } else if (event.key === 'ArrowRight' && canMove) {
        if (!checkCollision(currentPiece, 1, 0)) currentPiece.x++;
    } else if (event.key === 'ArrowUp' && canMove) {
        playerRotate();
    } else if (event.key === 'ArrowDown' && canMove) {
        dropPiece();
    } else if (event.code === 'Space') {
        event.preventDefault();
        hardDrop();
    }

    draw();
});

function update(time = 0) {
    if (gameOver) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    if (LEVELS[currentLevel].onUpdate) {
        LEVELS[currentLevel].onUpdate(deltaTime);
    }

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        dropPiece();
    }

    draw();
    requestAnimationFrame(update);
}

// khởi chạy
loadLevel(1);
update();