/* =============================================================
   sprites.js — loads the sprite sheet and slices buildings out.
   The sheet is a 4-column × 4-row grid (1254 × 1254 px).
   Call Sprites.load() before the first frame.
   ============================================================= */

const SHEET_COLS = 4, SHEET_ROWS = 4;
// Integer cell sizes avoid sub-pixel bleed between adjacent cells.
const CELL_W = Math.floor(1254 / SHEET_COLS); // 313 px
const CELL_H = Math.floor(1254 / SHEET_ROWS); // 313 px
const TRIM   = 3;  // px to skip at each cell edge (prevents neighbour bleed)

// [sheetRow, sheetCol] for each building key
const SPRITE_MAP = {
  lab:     [0, 0],   // command tower
  oxygen:  [0, 2],   // green biodome (plants)
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
    img.onload = () => {
      /* Preprocess: knock out near-white achromatic pixels that AI generators
         embed as the sprite-sheet background instead of true alpha.
         Coloured building pixels (saturation > 30) are always preserved. */
      const off = document.createElement('canvas');
      off.width  = img.width;
      off.height = img.height;
      const oc = off.getContext('2d', { willReadFrequently: true });
      oc.drawImage(img, 0, 0);

      const id = oc.getImageData(0, 0, img.width, img.height);
      const d  = id.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue; // already transparent
        const r = d[i], g = d[i + 1], b = d[i + 2];
        const lo  = Math.min(r, g, b);
        const sat = Math.max(r, g, b) - lo;   // colour saturation proxy
        // Only touch achromatic (grey/white) pixels above brightness 180.
        // Fully transparent above 220; fade from 180 → 220.
        if (sat < 30 && lo > 180) {
          const t  = Math.min(1, (lo - 180) / 40);
          d[i + 3] = Math.round(d[i + 3] * (1 - t));
        }
      }
      oc.putImageData(id, 0, 0);

      this.sheet = off;
      this.ready = true;
    };
    img.onerror = () => console.warn('[Sprites] Sheet failed — procedural fallback active.');
    img.src = 'sprite assets/designs.png';
  },

  /* Draw the sprite for `key` centred at (cx, baseY).
     Returns true if drawn, false if the key has no mapping. */
  draw(ctx, key, cx, baseY, z) {
    if (!this.ready) return false;
    const pos = SPRITE_MAP[key];
    if (!pos) return false;
    const [sr, sc] = pos;

    // Source rect with trim to avoid neighbour-cell bleed
    const sx = sc * CELL_W + TRIM;
    const sy = sr * CELL_H + TRIM;
    const sw = CELL_W - TRIM * 2;
    const sh = CELL_H - TRIM * 2;

    // Dest: 96×96 CSS-px at z=1 — building base sits just above tile centre
    const dw = 96 * z, dh = 96 * z;
    const dx = cx - dw / 2;
    const dy = baseY - dh * 0.84;   // ~84% above tile centre, 16% below

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.sheet, sx, sy, sw, sh, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = false;
    return true;
  },
};
