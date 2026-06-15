/* =============================================================
   sprites.js — loads the sprite sheet and slices buildings out.
   The sheet is a 4-column × 4-row grid (1254 × 1254 px).
   Call Sprites.load() before the first frame.
   ============================================================= */

const SHEET_W = 1254, SHEET_H = 1254, COLS = 4, ROWS = 4;
const CELL_W = SHEET_W / COLS;   // ~313.5 px per cell
const CELL_H = SHEET_H / ROWS;

// [sheetRow, sheetCol] for each building key
const SPRITE_MAP = {
  lab:     [0, 0],   // command tower (antenna)
  oxygen:  [0, 2],   // green biodome (plants inside)
  home:    [0, 3],   // long habitat module
  battery: [1, 3],   // twin energy cylinders
  solar:   [2, 0],   // solar panel array
  farm:    [0, 1],   // small glass dome → hydroponic farm
  medBay:  [1, 2],   // airlock / medical entrance
  factory: [3, 1],   // robotic arm factory
};

const Sprites = {
  sheet: null,
  ready: false,

  load() {
    const img = new Image();
    img.onload  = () => { this.sheet = img; this.ready = true; };
    img.onerror = () => console.warn('[Sprites] Sheet failed to load — procedural fallback active.');
    img.src = 'sprite assets/designs.png';
  },

  /* Draw the sprite for `key` centred at (cx, baseY) in canvas coords.
     Returns true if a sprite was drawn, false if key is unmapped. */
  draw(ctx, key, cx, baseY, z) {
    if (!this.ready) return false;
    const pos = SPRITE_MAP[key];
    if (!pos) return false;
    const [sr, sc] = pos;
    const dw = 88 * z, dh = 88 * z;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.sheet,
      sc * CELL_W, sr * CELL_H, CELL_W, CELL_H,   // source rect
      cx - dw / 2, baseY - dh * 0.82, dw, dh       // dest: anchor ~bottom-centre
    );
    ctx.imageSmoothingEnabled = prev;
    return true;
  },
};
