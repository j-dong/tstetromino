/* vim: set cc=80: */

function assert(cond: boolean, message: string | null = null) {
    'use strict';
    if (!cond) throw message || 'assertion failed';
}

function isInt(x: number): boolean {
    'use strict';
    return x === (x|0);
}

function arrayMax(xs: number[], min?: number): number {
    return xs.reduce((x, y) => Math.max(x, y), min || xs[0]);
}

const PIECE_STRINGS = [
    // I
    '#   ' +
    'O:  ' +
    'O:  ' +
    '#   ',
    // J
    ' #  ' +
    ' O  ' +
    '##  ' +
    '    ',
    // L
    '#   ' +
    'O   ' +
    '##  ' +
    '    ',
    // O
    'OO  ' +
    'OO  ' +
    '    ' +
    '    ',
    // S
    ' ## ' +
    '#O  ' +
    '    ' +
    '    ',
    // Z
    '##  ' +
    ' O# ' +
    '    ' +
    '    ',
    // T
    '#O# ' +
    ' #  ' +
    '    ' +
    '    ',
];

const BACKGROUND_COLOR = '#343434';
const COLORS = [
    BACKGROUND_COLOR,
    // I
    'cyan',
    // J
    'blue',
    // L
    'orange',
    // O
    'yellow',
    // S
    'lime',
    // Z
    'red',
    // T
    'purple',
];

const NUM_BLOCKS = 4;

class Point {
    constructor(public x: number, public y: number) {
        void(x); void(y);
    }

    clone(): Point {
        return new Point(this.x, this.y);
    }

    rotate(ccw: boolean, center: Point) {
        const xFactor = ccw ? -1 :  1;
        const yFactor = ccw ?  1 : -1;
        [this.x, this.y] = [
            center.x + xFactor * (this.y - center.y),
            center.y + yFactor * (this.x - center.x)
        ];
    }
}

const POINT_ZERO: Point = new Point(0, 0);

class Piece {
    public position: Point;

    constructor(public blocks: Point[],
                public centroid: Point,
                public index: number,
                position: Point = POINT_ZERO) {
        assert(blocks.length === NUM_BLOCKS,
            'piece must have ' + NUM_BLOCKS + ' blocks');
        assert(isInt(centroid.x * 2) && isInt(centroid.y * 2),
            'centroid should be a multiple of 1/2');
        assert(isInt(index), 'index should be an integer');
        assert(index > 0, 'index should be greater than 0');
        this.position = position.clone();
    }

    clone(): Piece {
        return new Piece(
            this.blocks.map(p => p.clone()),
            this.centroid.clone(),
            this.index,
            this.position.clone(),
        );
    }

    render(colorOverride: string | null = null,
        positionOverrideX: number | null = null,
        positionOverrideY: number | null = null) {
        const posX = positionOverrideX || this.position.x;
        const posY = positionOverrideY || this.position.y;
        for (const pt of this.blocks) {
            if (pt.y + posY < 0) continue;
            gridEls[pt.y + posY][pt.x + posX]
                .setColor(colorOverride || COLORS[this.index]);
        }
    }

    place() {
        for (const pt of this.blocks) {
            grid[pt.y + this.position.y][pt.x + this.position.x] = this.index;
        }
    }

    rotate(ccw: boolean = false) {
        for (var pt of this.blocks) {
            pt.rotate(ccw, this.centroid);
        }
    }

    fitsAt(x: number, y: number): boolean {
        for (var pt of this.blocks) {
            const px = pt.x + x;
            const py = pt.y + y;
            if (px < 0 || px >= GRID_WIDTH || py >= GRID_HEIGHT)
                return false;
            if (py < 0) continue;
            if (grid[py][px] !== 0)
                return false;
        }
        return true;
    }

    moveDown(): boolean {
        if (this.fitsAt(this.position.x, this.position.y + 1)) {
            this.position.y++;
            return false;
        }
        this.place();
        return true;
    }

    moveHoriz(dx: number): boolean {
        assert(isInt(dx), 'dx should be a number');
        if (this.fitsAt(this.position.x + dx, this.position.y)) {
            this.position.x += dx;
            return true;
        }
        return false;
    }

    kickRotate(ccw: boolean): boolean {
        this.rotate(ccw);
        for (const d of KICK_DELTAS) {
            if (this.fitsAt(this.position.x + d.x, this.position.y + d.y)) {
                this.position.x += d.x;
                this.position.y += d.y;
                return true;
            }
        }
        this.rotate(!ccw);
        return false;
    }
}

class Bag {
    private bag: Piece[];
    private index: number;

    constructor() {
        this.bag = PIECES.map(p => p.clone());
        this.shuffle();
    }

    shuffle() {
        for (let i = this.bag.length - 1; i > 0; i--) {
            const j = (Math.random() * (i + 1)) | 0;
            [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
        }
        this.index = 0;
    }

    next(): Piece {
        const ret = this.bag[this.index];
        this.index++;
        if (this.index >= this.bag.length) {
            this.shuffle();
        }
        return ret;
    }
}

function pieceFromString(str: string, index: number): Piece {
    'use strict';
    let blocks: Point[] = [];
    assert(str.length === NUM_BLOCKS * NUM_BLOCKS,
        'piece string should have length ' + NUM_BLOCKS * NUM_BLOCKS);
    let centroid = [0, 0];
    let centroid_count = 0;
    for (let i = 0; i < NUM_BLOCKS * NUM_BLOCKS; i++) {
        let c = str[i];
        let x = i % NUM_BLOCKS,
            y = i / NUM_BLOCKS | 0;
        if (c === '#' || c === 'O') blocks.push(new Point(x, y));
        if (c === 'O' || c === ':') {
            centroid[0] += x;
            centroid[1] += y;
            centroid_count++;
        }
    }
    assert(blocks.length === NUM_BLOCKS,
        'piece string should have ' + NUM_BLOCKS + ' blocks');
    assert(centroid_count > 0,
        'piece string should have at least one centroid');
    return new Piece(blocks, new Point(
        centroid[0] / centroid_count,
        centroid[1] / centroid_count), index);
}

const PIECES = PIECE_STRINGS.map(
    (str, i) => pieceFromString(str, i + 1));
const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const CELL_SIZE = '10px';
let gridEls: GridCellElement[][];
const grid: number[][] = [];
for (let y = 0; y < GRID_HEIGHT; y++) {
    grid.push([]);
    for (let x = 0; x < GRID_WIDTH; x++) {
        grid[y].push(0);
    }
}
const bag: Bag = new Bag();
const MAX_KICK = 3;
const KICK_RANGE: number[] = [];
for (let dx = -MAX_KICK; dx <= MAX_KICK; dx++)
    KICK_RANGE.push(dx);
const KICK_DELTAS = KICK_RANGE
    .map(dy => KICK_RANGE
        .map(dx => new Point(dx, dy)))
    .reduce((a, b) => a.concat(b), []).sort((a, b) => {
        const a_sqmag = a.x * a.x + a.y * a.y;
        const b_sqmag = b.x * b.x + b.y * b.y;
        return a_sqmag - b_sqmag;
    });

let currentPiece: Piece | null = null;

function spawn() {
    assert(currentPiece === null, 'spawning while current piece is not null');
    currentPiece = bag.next().clone();
    const spawnX = (GRID_WIDTH - arrayMax(currentPiece.blocks.map(p => p.x)))
        / 2 | 0;
    const spawnY = -1 - arrayMax(currentPiece.blocks.map(p => p.y));
    currentPiece.position = new Point(spawnX, spawnY);
}

class GridCellElement {
    constructor(private el: HTMLElement) {
        assert(el.tagName === 'TD', 'grid cells should be <td> elements');
        el.style.backgroundColor = BACKGROUND_COLOR;
    }

    setColor(color: string) {
        this.el.style.backgroundColor = color;
    }
}

function renderGrid() {
    for (let y = 0; y < GRID_HEIGHT; y++) {
        for (let x = 0; x < GRID_WIDTH; x++) {
            gridEls[y][x].setColor(COLORS[grid[y][x]]);
        }
    }
}

function render() {
    renderGrid();
    if (currentPiece !== null) {
        let ghostY = currentPiece.position.y;
        while (currentPiece.fitsAt(currentPiece.position.x, ghostY + 1))
            ghostY++;
        currentPiece.render('gray', currentPiece.position.x, ghostY);
        currentPiece.render();
    }
}

function clearLines() {
    for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
        if (grid[y].every(x => x !== 0)) {
            grid.splice(y, 1);
        }
    }
    while (grid.length !== GRID_HEIGHT) {
        const newRow: number[] = [];
        for (let x = 0; x < GRID_WIDTH; x++) newRow.push(0);
        grid.unshift(newRow);
    }
}

function movePieceDown() {
    if (currentPiece === null) { spawn(); return; }
    if (currentPiece.moveDown())
        currentPiece = null;
    else
        clearLines();
    render();
}

function createGrid() {
    'use strict';
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.border = 'none';
    gridEls = [];
    for (let y = 0; y < GRID_HEIGHT; y++) {
        let tr = document.createElement('tr');
        table.appendChild(tr);
        let row: GridCellElement[] = [];
        for (let x = 0; x < GRID_WIDTH; x++) {
            let td = document.createElement('td');
            td.style.width = CELL_SIZE;
            td.style.height = CELL_SIZE;
            tr.appendChild(td);
            row.push(new GridCellElement(td));
        }
        gridEls.push(row);
    }
    document.body.appendChild(table);
}

function setupKeyboard() {
    'use strict';
    window.addEventListener('keydown', (ev) => {
        if (currentPiece === null) return;
        if (ev.code === 'ArrowLeft') {
            if (currentPiece.moveHoriz(-1)) {
                render();
            }
        } else if (ev.code === 'ArrowRight') {
            if (currentPiece.moveHoriz(1)) {
                render();
            }
        } else if (ev.code === 'ArrowDown') {
            currentPiece.moveDown();
            render();
        } else if (ev.code === 'ArrowUp') {
            while (!currentPiece.moveDown());
            render();
        } else if (ev.code === 'KeyZ') {
            if (currentPiece.kickRotate(true)) {
                render();
            }
        } else if (ev.code === 'KeyX') {
            if (currentPiece.kickRotate(false)) {
                render();
            }
        }
    });
}

function init() {
    'use strict';
    createGrid();
    setupKeyboard();
    let gameTimer = setInterval(() => {
        try {
            movePieceDown();
        } catch (e) {
            clearInterval(gameTimer);
        }
    }, 200);
}

document.addEventListener('DOMContentLoaded', init);
