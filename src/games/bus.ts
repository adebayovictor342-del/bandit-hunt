/** Shared state written by the on-screen controls and read by the game loop. */
export interface Bus {
  /** one-shot / held buttons */
  jet: boolean;
  left: boolean;
  right: boolean;
  tap: boolean;
  /** shield button held */
  shield: boolean;
  /** one-shot bomb throw */
  bomb: boolean;
  /** left stick: move (x) and jet (y, negative = up), -1..1 */
  lx: number;
  ly: number;
  /** right stick: aim direction and whether it is pushed far enough to fire */
  rx: number;
  ry: number;
  rOn: boolean;
}

export const newBus = (): Bus => ({
  jet: false,
  left: false,
  right: false,
  tap: false,
  shield: false,
  bomb: false,
  lx: 0,
  ly: 0,
  rx: 0,
  ry: 0,
  rOn: false,
});

export function resetBus(b: Bus) {
  b.jet = false;
  b.left = false;
  b.right = false;
  b.shield = false;
  b.bomb = false;
  b.lx = 0;
  b.ly = 0;
  b.rx = 0;
  b.ry = 0;
  b.rOn = false;
}
