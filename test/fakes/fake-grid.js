import { EventEmitter } from 'node:events';

const clamp = (n) => Math.max(0, Math.min(15, Math.round(n)));

export class FakeGrid extends EventEmitter {
  constructor({ cols = 16, rows = 8 } = {}) {
    super();
    this.cols = cols;
    this.rows = rows;
    this.frame = Array.from({ length: rows }, () => new Array(cols).fill(0));
  }

  setLevel(x, y, level) {
    if (y < 0 || y >= this.rows || x < 0 || x >= this.cols) return;
    this.frame[y][x] = clamp(level);
  }

  getLevel(x, y) {
    return this.frame[y][x];
  }

  clear() {
    for (let y = 0; y < this.rows; y++) this.frame[y].fill(0);
  }

  emitPress(x, y, s) {
    this.emit('press', x, y, s);
  }

  frameString() {
    return this.frame.map((row) => row.join(' ')).join('\n');
  }
}
