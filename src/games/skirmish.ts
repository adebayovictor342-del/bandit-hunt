import { backdrop, clamp, H, hint, rand, rr, W, type Callbacks, type Game, type Input } from "./common";
import { drawSambisaBackdrop, drawSambisaForeground, preloadSambisa } from "./sambisaBackdrop";
import { STANCE_HITBOX, STANCE_SPEED, STANCE_THRUST, drawBattleOperative, drawSoldier, fighterBounds, fighterFootOffset, fighterScale, pointInFighter, soldierMuzzle, FIGHTER_RELOAD_SECONDS, leftFacingAim, type FighterAnimation, type Stance } from "./soldier";
import { drawMilitaryDrone, droneMuzzle } from "./drone";
import { drawFlyingBot, flyingBotMuzzle } from "./flyingBot";
import { DAGGER_SPEED, DAGGER_GRAVITY, DAGGER_THROW_TIME, DAGGER_RELEASE_AT, DAGGER_DAMAGE, drawDagger, type ThrownDagger } from "./dagger";
import type {
  BattleFormat,
  BattleResult,
  CombatantBattleStats,
  SkirmishGameMode,
  SkirmishZone,
  BackgroundId,
} from "./skirmishTypes";
import { backgroundMeta } from "./skirmishTypes";
import type { Gender } from "./skirmishTypes";
import { playGameSound } from "./audio";

/*
 * Sambisa Fighter — Mini Militia style, landscape.
 *   Left stick  : move; push up to fly (jetpack fuel)
 *   Right stick : aim + fire (release = auto-aim at nearest enemy)
 *   SHIELD      : bubble that blocks incoming bullets, missiles and blasts
 *   BOMB        : lobbed grenade that explodes on impact
 *
 * Supports two distinct game modes:
 *   1) "journey" — King of the Hill / Arcade survival. 1 life, no respawns.
 *   2) "battle"  — Online Multiplayer simulator. Continuous 3s respawns, match timer,
 *                  1v1 duel or 2v2 skirmish, tracking Net Damage (Inflicted - Received).
 *
 * Supports 3 combat zones:
 *   - "forest"  : Daylight Sahel savanna — baobabs, acacias, thatched huts, smoke plumes, golden sand.
 *   - "city"    : Background 3 — Nigerian market street, hills and landmarks, daylight asphalt.
 *   - "hideout" : Desert military bunker, satellite radar dish, sand dunes, ammo barrels.
 */

export interface SkirmishOptions {
  mode?: SkirmishGameMode;
  zone?: SkirmishZone;
  background?: BackgroundId;
  matchDurationSec?: number;
  matchType?: BattleFormat;
  playerName?: string;
  /** verified from the player profile — drives sprite + team selection */
  playerGender?: Gender | null;
  /** live stance (stand / kneel / prone) — read every frame via ref */
  getStance?: () => Stance;
  /** gender-sorted lobby from the matchmaking matrix; when present it seeds the arena */
  roster?: CombatantBattleStats[];
  onBattleEnd?: (result: BattleResult) => void;
  onDamageUpdate?: (stats: { playerInflicted: number; playerReceived: number; netScore: number }) => void;
  onRespawnCountdown?: (secondsLeft: number | null) => void;
}

const PH = 36;
const GRAV = 1180;
const JET_ACC = 1650;
const FUEL_MAX = 100;
const FUEL_BURN = 24;
const FUEL_REGEN = 30;
const MOVE = 240;
const SH_MAX = 120;
const SH_BURN = 34;
const SH_REGEN = 20;
const BOMB_MAX = 3;
const BOMB_REFILL = 3.5;
const BOMB_GRAV = 900;
const REGEN_DELAY = 1.6;
const REGEN_RATE = 14;
const MED_HEAL = 26;
const TANK_ARMOUR = 0.34;
const JET_DMG = 6;
const JET_RATE = 0.08;
const INTER_MAG = 3;
const INTER_RELOAD = 3.1;
const INTER_RANGE = 420;

const groundY = () => H - Math.round(clamp(H * 0.1, 30, 180));
const heroMin = () => 70;
const heroSpawn = () => W * 0.25;
const heroMax = () => W * 0.46;
/** Flying enemies remain well above the tallest standing/jumping fighter. */
const AIR_TOP = 78;
const airLaneBottom = () => Math.max(AIR_TOP + 24, Math.min(H * 0.46, groundY() - 128));

type FoeKind = "bandit" | "thrower" | "gunner" | "bot" | "heli" | "tank";
type AllyKind = "gunman" | "bot" | "jet" | "interceptor";

interface Foe {
  id: number;
  kind: FoeKind;
  x: number;
  y: number;
  hp: number;
  max: number;
  vx: number;
  vy: number;
  hoverY: number;
  fire: number;
  drop: number;
  missile: number;
  burst: number;
  phase: number;
  flash: number;
  hold: number;
  throwTimer: number;
  throwReleased: boolean;
  gait: number;
  moveBlend: number;
  aimAngle: number;
  hitReact: number;
  reload: number;
  rounds: number;
  crouch: number;
  burstGap: number;
}

function enemyAnimation(f: Foe): FighterAnimation {
  return { speed: f.vx, gait: f.gait, moveBlend: f.moveBlend, aimAngle: f.aimAngle, hit: f.hitReact, reload: f.reload, crouch: f.crouch, phase: f.phase, throwProgress: f.throwTimer > 0 ? 1 - f.throwTimer / DAGGER_THROW_TIME : -1 };
}

interface Ally {
  kind: AllyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  max: number;
  fire: number;
  life: number;
  phase: number;
  flash: number;
  ammo?: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  foe: boolean;
  heavy?: boolean;
  sourceId?: string;
}

interface Missile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  smoke: number;
  _seen?: boolean;
  _d0?: number;
  _near?: boolean;
}

interface Dart {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  smoke: number;
  _seen?: boolean;
}

interface Bomb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuse: number;
  foe: boolean;
  spin: number;
  shell: boolean;
  _seen?: boolean;
}

interface Marker {
  x: number;
  owner: number;
  t: number;
  delay: number;
}

interface Boom {
  x: number;
  y: number;
  t: number;
  r: number;
  foe: boolean;
}

interface Med {
  x: number;
  y: number;
  vy: number;
  life: number;
  bob: number;
}

interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  c: string;
}

interface BattleFighter {
  id: string;
  name: string;
  avatarFace: string;
  gender: Gender;
  isPlayer: boolean;
  isTeammate: boolean;
  x: number;
  y: number;
  vy: number;
  hp: number;
  maxHp: number;
  fuel: number;
  spawnShield: number;
  fireTimer: number;
  deadTimer: number; // > 0 means respawning
  aimAng: number;
  damageInflicted: number;
  damageReceived: number;
  kills: number;
  deaths: number;
  netScore: number;
  phase: number;
  flash: number;
  moving: boolean;
}

export function createSkirmish(cb: Callbacks, options?: SkirmishOptions): Game {
  const mode: SkirmishGameMode = options?.mode || "journey";
  const background: BackgroundId = options?.background ?? (options?.zone === "city" ? "background-three" : "village-one");
  const zone: SkirmishZone = options?.background ? backgroundMeta(background).zone : options?.zone || "forest";
  const paintedScene = zone === "forest" || zone === "city";
  if (paintedScene) preloadSambisa(background);
  const matchDurationSec = options?.matchDurationSec || 180;
  const matchType: BattleFormat = options?.matchType || "2v2";
  const playerName = options?.playerName || "You";
  const playerGender: Gender = options?.playerGender ?? "male";

  // Both modes share the same responsive scale and planted-feet anchor.
  const battleMuzzle = (x: number, yy: number, angle: number) => soldierMuzzle(x, yy + PH / 2, angle, "stand", fighterScale());
  const ceilingY = () => Math.max(30, fighterScale() * 37.5 - PH / 2 + 6);

  const isBattle = mode === "battle";
  const is2v2 = matchType === "2v2";

  let hx = 0;
  let y = 0;
  let vy = 0;
  let t = 0;
  let hp = 100;
  let fuel = FUEL_MAX;
  let shield = SH_MAX;
  let shieldOn = false;
  let shieldIdle = 0;
  let bombs = BOMB_MAX;
  let bombT = 0;
  let thrust = 0;
  let kills = 0;
  let shake = 0;
  let scroll = 0;
  let spawnT = 1.2;
  let fireT = 0;
  let aim = 0;
  let aiming = false;
  let playerFlash = 0;
  let playerStance: Stance = "stand";
  let moveAmt = 0;
  let lastHit = -9;
  let jetCool = 10;
  let gunmanCool = 0;
  let botCool = 0;
  let interCool = 0;
  let nextId = 1;

  // Battle Mode continuous respawn & timer state
  let matchTimeRemaining = matchDurationSec;
  let playerRespawnCountdown = 0; // > 0 means dead, counting down 3s
  let playerSpawnShield = 0;
  let playerDamageInflicted = 0;
  let playerDamageReceived = 0;
  let playerDeaths = 0;
  let matchEnded = false;

  let battleCombatants: BattleFighter[] = [];

  let foes: Foe[] = [];
  let allies: Ally[] = [];
  let shots: Bullet[] = [];
  let missiles: Missile[] = [];
  let darts: Dart[] = [];
  let daggers: ThrownDagger[] = [];
  let lobs: Bomb[] = [];
  let markers: Marker[] = [];
  let booms: Boom[] = [];
  let meds: Med[] = [];
  let puffs: Puff[] = [];
  let stars: { x: number; y: number; r: number }[] = [];
  let starsFor = 0;
  let previousGroundY = groundY();
  function addShot(shot: Bullet) {
    shots.push(shot);
  }

  const playerBounds = () => fighterBounds(hx, y + PH / 2, aim, isBattle ? "stand" : playerStance, fighterScale());
  const shieldGeometry = () => {
    const bounds = playerBounds();
    return { y: (bounds.top + bounds.bottom) / 2, radius: Math.max(34, (bounds.bottom - bounds.top) * 0.64) };
  };
  const enemyBounds = (f: Foe) => fighterBounds(f.x, f.y + PH / 2, f.aimAngle, "stand", fighterScale(), enemyAnimation(f));
  const allyStance = (a: Ally): Stance => foes.some((f) => Math.hypot(f.x - a.x, f.y - a.y) < 540) ? "kneel" : "stand";
  const allyBounds = (a: Ally) => fighterBounds(a.x, a.y + PH / 2, 0, allyStance(a), fighterScale());

  // All human operatives in the match use the fighter gender selected by the player.
  if (isBattle) {
    const oppGender: Gender = playerGender;
    const fallbackRoster: CombatantBattleStats[] = [
      {
        id: "player",
        name: playerName,
        avatarFace: playerGender === "female" ? "👩‍🚀" : "👨‍🚀",
        gender: playerGender,
        isPlayer: true,
        isTeammate: true,
        damageInflicted: 0,
        damageReceived: 0,
        kills: 0,
        deaths: 0,
        netScore: 0,
      },
      {
        id: "rival1",
        name: oppGender === "female" ? "Nova_Vixen" : "Vex_Reaper",
        avatarFace: oppGender === "female" ? "🦊" : "🤖",
        gender: oppGender,
        isPlayer: false,
        isTeammate: false,
        damageInflicted: 0,
        damageReceived: 0,
        kills: 0,
        deaths: 0,
        netScore: 0,
      },
    ];
    if (is2v2) {
      fallbackRoster.push(
        {
          id: "ally1",
          name: playerGender === "female" ? "Juno_Valkyrie" : "Bram_Havoc",
          avatarFace: playerGender === "female" ? "🦄" : "🐨",
          gender: playerGender,
          isPlayer: false,
          isTeammate: true,
          damageInflicted: 0,
          damageReceived: 0,
          kills: 0,
          deaths: 0,
          netScore: 0,
        },
        {
          id: "rival2",
          name: oppGender === "female" ? "Kite_Sniper" : "Zed_Striker",
          avatarFace: oppGender === "female" ? "🐼" : "🐲",
          gender: oppGender,
          isPlayer: false,
          isTeammate: false,
          damageInflicted: 0,
          damageReceived: 0,
          kills: 0,
          deaths: 0,
          netScore: 0,
        },
      );
    }
    const src = options?.roster && options.roster.length >= 2 ? options.roster : fallbackRoster;
    // Lobby order is not guaranteed: place sides from team identity rather than
    // array position, with enough room for the larger sprites and nametags.
    let rivalIndex = 0;
    battleCombatants = src.slice(0, is2v2 ? 4 : 2).map((c, i) => {
      const x = c.isPlayer ? heroSpawn() : c.isTeammate ? W * 0.10 : W * (rivalIndex++ === 0 ? 0.72 : 0.88);
      return {
        id: c.id,
        name: c.name,
        avatarFace: c.avatarFace,
        gender: c.gender,
        isPlayer: c.isPlayer,
        isTeammate: c.isTeammate,
        x,
        y: groundY() - PH / 2,
        vy: 0,
        hp: 100,
        maxHp: 100,
        fuel: 100,
        spawnShield: 2.0,
        fireTimer: c.isPlayer ? 0 : 0.5 + i * 0.2,
        deadTimer: 0,
        aimAng: c.isTeammate ? 0 : Math.PI,
        damageInflicted: 0,
        damageReceived: 0,
        kills: 0,
        deaths: 0,
        netScore: 0,
        phase: i * 1.5,
        flash: 0,
        moving: false,
      };
    });
  }

  const game: Game = {
    phase: "ready",
    score: 0,
    step,
    draw,
    debug: () => ({
      y,
      vy,
      hp,
      fuel,
      shield,
      shieldOn,
      bombs,
      foes,
      allies,
      lobs,
      shots,
      missiles,
      darts,
      daggers,
      markers,
      meds,
      px: hx,
      t,
      kills,
      playerStance,
      threat: threat(),
      isBattle,
      zone,
      matchTimeRemaining,
      playerRespawnCountdown,
      playerDamageInflicted,
      playerDamageReceived,
      netScore: playerDamageInflicted - playerDamageReceived,
      playerFlash,
      battleCombatants,
      groundY: groundY(),
      fighterScale: fighterScale(),
      playerBounds: playerBounds(),
    }),
  };

  const level = () => t / 34;
  const threat = () => Math.min(8, level() + foes.length * 0.2 + (100 - hp) / 50);

  function burst(x: number, yy: number, c: string, n = 8, spread = 150) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(30, spread);
      puffs.push({ x, y: yy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.25, 0.6), max: 0.6, r: rand(1.6, 3.6), c });
    }
    if (puffs.length > 260) puffs.splice(0, puffs.length - 260);
  }

  function explodeVisual(x: number, yy: number) {
    booms.push({ x, y: yy, t: 0, r: 72, foe: false });
  }

  function explode(x: number, yy: number, foe: boolean, radius: number) {
    playGameSound("explosion");
    booms.push({ x, y: yy, t: 0, r: radius, foe });
    shake = Math.max(shake, 0.35);
    burst(x, yy, "#ffd166", 16, 260);
    burst(x, yy, "#ff8a5c", 10, 200);

    if (isBattle) {
      // In battle mode, damage combatants based on team
      for (const c of battleCombatants) {
        if (c.deadTimer > 0 || c.spawnShield > 0) continue;
        const d = Math.hypot(x - c.x, yy - c.y);
        if (d < radius) {
          const dmg = 32;
          applyFighterDamage(c, dmg, foe ? "rival" : "player");
        }
      }
      return;
    }

    if (foe) {
      if (Math.hypot(x - hx, yy - y) < radius) hurt(24);
      for (const a of allies) if (Math.hypot(x - a.x, yy - a.y) < radius) hurtAlly(a, 5);
    } else {
      for (const f of foes) {
        if (Math.hypot(x - f.x, yy - f.y) < radius) {
          f.hp -= f.kind === "tank" ? 7 : 4;
          f.flash = 0.14;
          f.hitReact = 1;
          if (f.hp <= 0) killFoe(f);
        }
      }
    }
    foes = foes.filter((f) => f.hp > 0);
    allies = allies.filter((a) => a.hp > 0);
  }

  function killFoe(f: Foe) {
    kills++;
    // Sambisa High-Velocity Matrix: Final_XP = Total_Kills * 10 (76 kills = 760 XP)
    const finalXP = kills * 10;
    game.score = finalXP;
    cb.onScore(finalXP);
    const ground = f.kind === "bandit" || f.kind === "thrower" || f.kind === "gunner";
    burst(f.x, f.y, ground ? "#fb7185" : "#ff8a5c", f.kind === "tank" ? 26 : 14, f.kind === "tank" ? 280 : 200);
    if (f.kind === "tank") {
      explodeVisual(f.x, f.y);
      shake = Math.max(shake, 0.45);
    }
    const chance = hp < 45 ? 0.62 : hp < 80 ? 0.4 : 0.16;
    const bonus = f.kind === "tank" || f.kind === "heli" ? 0.35 : 0;
    if (Math.random() < chance + bonus) meds.push({ x: f.x, y: f.y, vy: -90, life: 13, bob: rand(0, 6) });
  }

  function hurtAlly(a: Ally, d: number) {
    a.hp -= d;
    a.flash = 0.12;
    if (a.hp <= 0) {
      burst(a.x, a.y, "#7be9ff", 16, 220);
      explodeVisual(a.x, a.y);
    }
  }

  function applyFighterDamage(c: BattleFighter, dmg: number, sourceId: string) {
    if (c.deadTimer > 0 || c.spawnShield > 0) return;
    c.hp = Math.max(0, c.hp - dmg);
    c.flash = 0.16;
    c.damageReceived += dmg;
    playGameSound("fighter-hit");

    if (sourceId === "player") {
      playerDamageInflicted += dmg;
    } else if (c.isPlayer) {
      playerDamageReceived += dmg;
      shake = Math.max(shake, 0.35);
      lastHit = t;
    }

    // find source combatant to credit
    const attacker = battleCombatants.find((b) => b.id === sourceId);
    if (attacker && !attacker.isPlayer) {
      attacker.damageInflicted += dmg;
    }

    if (c.hp <= 0) {
      // Eliminated!
      c.deaths++;
      burst(c.x, c.y, c.isTeammate ? "#7be9ff" : "#fb7185", 22, 220);
      explodeVisual(c.x, c.y);

      if (attacker) {
        attacker.kills++;
      } else if (sourceId === "player") {
        kills++;
      }

      // Enter 3-second respawn state!
      c.deadTimer = 3.0;

      if (c.isPlayer) {
        playerDeaths++;
        playerRespawnCountdown = 3.0;
        options?.onRespawnCountdown?.(3);
      }
    }

    // update net scores
    for (const b of battleCombatants) {
      b.netScore = b.damageInflicted - b.damageReceived;
    }
    // game.score always means Final_XP; net damage stays a separate battle metric
    game.score = kills * 10;

    options?.onDamageUpdate?.({
      playerInflicted: playerDamageInflicted,
      playerReceived: playerDamageReceived,
      netScore: playerDamageInflicted - playerDamageReceived,
    });
  }

  function spawn() {
    const lv = level();
    const UNLOCK: [FoeKind, number, number, number][] = [
      ["bandit", 0, 30, 9],
      ["bot", 8, 28, 5],
      ["thrower", 14, 15, 3],
      ["gunner", 22, 15, 3],
      ["heli", 38, 12, 2],
      ["tank", 52, 10, 2],
    ];

    const live: Partial<Record<FoeKind, number>> = {};
    for (const f of foes) live[f.kind] = (live[f.kind] ?? 0) + 1;
    const avail = UNLOCK.filter(([k, at, , cap]) => t >= at && (live[k] ?? 0) < cap);
    if (!avail.length) return;
    let r = Math.random() * avail.reduce((sum, [, , w]) => sum + w, 0);
    let kind: FoeKind = avail[0][0];
    for (const [k, , w] of avail) {
      if (r < w) {
        kind = k;
        break;
      }
      r -= w;
    }

    const tier = Math.floor(lv);
    const f: Foe = {
      id: nextId++,
      kind,
      x: W + 40,
      y: groundY() - PH / 2,
      hp: 2,
      max: 2,
      vx: 0,
      vy: 0,
      hoverY: 0,
      fire: rand(1.1, 2.2),
      drop: rand(2.2, 4),
      missile: rand(1.4, 2.6),
      burst: 0,
      phase: rand(0, 6),
      flash: 0,
      hold: 0,
      throwTimer: 0,
      throwReleased: false,
      gait: rand(0, Math.PI * 2),
      moveBlend: 0,
      aimAngle: Math.PI,
      hitReact: 0,
      reload: 0,
      rounds: 3,
      crouch: 0,
      burstGap: 0,
    };

    if (kind === "bandit") {
      f.vx = Math.min(140, rand(54, 92) + t * 0.3);
      f.hp = f.max = 4 + tier * 2;
      f.hold = 210;
    } else if (kind === "thrower") {
      f.vx = rand(65, 85);
      f.hp = f.max = 7 + tier * 2;
      f.hold = 290;
      f.fire = rand(1.5, 2.4);
    } else if (kind === "gunner") {
      f.vx = rand(40, 64);
      f.hp = f.max = 7 + tier * 2;
      f.hold = 260;
      f.fire = rand(1.4, 2.4);
    } else if (kind === "bot") {
      f.hoverY = rand(AIR_TOP + 6, airLaneBottom() - 8);
      f.y = f.hoverY;
      f.vx = rand(55, 85);
      f.hp = f.max = 5 + tier * 2;
      f.hold = 250;
    } else if (kind === "heli") {
      f.hoverY = rand(AIR_TOP, Math.max(AIR_TOP + 12, Math.min(H * 0.3, airLaneBottom() - 24)));
      f.y = f.hoverY;
      f.vx = 65;
      f.hp = f.max = 22 + tier * 5;
      f.hold = 300;
      f.drop = rand(1.4, 2.6);
      f.missile = rand(1.4, 2.6);
    } else {
      f.y = groundY() - 20;
      f.vx = rand(26, 40);
      f.hp = f.max = 30 + tier * 8;
      f.hold = 300;
      f.fire = rand(2.2, 3.4);
    }
    foes.push(f);
  }

  function callHelp(dt: number) {
    const d = threat();
    gunmanCool = Math.max(0, gunmanCool - dt);
    botCool = Math.max(0, botCool - dt);

    const wantGunmen = d >= 3.4 ? 2 : d >= 2.2 ? 1 : 0;
    const liveGunmen = allies.filter((a) => a.kind === "gunman").length;
    if (liveGunmen < wantGunmen && gunmanCool <= 0) {
      allies.push({
        kind: "gunman",
        x: rand(40, 90),
        y: groundY() - PH / 2,
        vx: 0,
        vy: 0,
        hp: 10,
        max: 10,
        fire: rand(0.3, 0.9),
        life: 34,
        phase: rand(0, 6),
        flash: 0,
      });
      gunmanCool = 7;
    }

    interCool = Math.max(0, interCool - dt);
    const airThreat = foes.some((f) => f.kind === "heli") || missiles.length > 0;
    const wantInter = airThreat ? (d >= 4.6 ? 2 : 1) : 0;
    const liveInter = allies.filter((a) => a.kind === "interceptor").length;
    if (liveInter < wantInter && interCool <= 0) {
      allies.push({
        kind: "interceptor",
        ammo: INTER_MAG,
        x: -24,
        y: rand(78, 150),
        vx: 0,
        vy: 0,
        hp: 8,
        max: 8,
        fire: 0.35,
        life: 26,
        phase: rand(0, 6),
        flash: 0,
      });
      interCool = 6;
    }

    const wantBots = d >= 3.8 ? 2 : d >= 2.9 ? 1 : 0;
    const liveBots = allies.filter((a) => a.kind === "bot").length;
    if (liveBots < wantBots && botCool <= 0) {
      allies.push({
        kind: "bot",
        x: -30,
        y: rand(90, groundY() - 130),
        vx: 150,
        vy: 0,
        hp: 6,
        max: 6,
        fire: rand(0.3, 0.9),
        life: 22,
        phase: rand(0, 6),
        flash: 0,
      });
      botCool = 6;
    }

    if (d >= 3.6 && jetCool <= 0 && !allies.some((a) => a.kind === "jet")) {
      allies.push({
        kind: "jet",
        x: -70,
        y: rand(60, H * 0.4),
        vx: 430,
        vy: 0,
        hp: 10,
        max: 10,
        fire: 0,
        life: 7,
        phase: 0,
        flash: 0,
      });
      jetCool = 15;
    }
  }

  function hurt(d: number) {
    if (game.phase !== "playing") return;
    if (shieldOn && shield > 0) {
      shield = Math.max(0, shield - d * 1.1);
      shieldIdle = 0;
      burst(hx + rand(-14, 14), y + rand(-14, 14), "#7be9ff", 5, 110);
      return;
    }
    playGameSound("fighter-hit");
    hp -= d;
    lastHit = t;
    shake = Math.max(shake, 0.3);
    if (hp <= 0) {
      hp = 0;
      game.phase = "over";
      shake = 0.5;
      burst(hx, y, "#7be9ff", 26, 240);
      burst(hx, y, "#ffd166", 16, 190);
      const finalXP = kills * 10;
      game.score = finalXP;
      cb.onOver(finalXP);
    }
  }

  function reset() {
    hx = heroSpawn();
    y = groundY() - PH / 2;
  }

  function finishBattleMode() {
    if (matchEnded) return;
    matchEnded = true;
    game.phase = "over";

    // sync player stats to combatants
    const pFighter = battleCombatants.find((b) => b.isPlayer);
    if (pFighter) {
      pFighter.damageInflicted = playerDamageInflicted;
      pFighter.damageReceived = playerDamageReceived;
      pFighter.kills = kills;
      pFighter.deaths = playerDeaths;
      pFighter.netScore = playerDamageInflicted - playerDamageReceived;
    }

    for (const b of battleCombatants) {
      b.netScore = b.damageInflicted - b.damageReceived;
    }

    // Determine MVP
    const sorted = [...battleCombatants].sort((a, b) => b.netScore - a.netScore);
    const mvp = sorted[0];

    const blueNet = battleCombatants.filter((b) => b.isTeammate).reduce((acc, b) => acc + b.netScore, 0);
    const redNet = battleCombatants.filter((b) => !b.isTeammate).reduce((acc, b) => acc + b.netScore, 0);
    const playerWon = is2v2 ? blueNet >= redNet : (pFighter?.netScore || 0) >= sorted[1].netScore;

    const result: BattleResult = {
      matchDurationSec,
      format: matchType,
      zone,
      playerWon,
      playerNetScore: playerDamageInflicted - playerDamageReceived,
      mvp: { ...mvp },
      combatants: battleCombatants.map((b) => ({ ...b })),
      mmrDelta: playerWon ? 36 : -18,
    };

    // PLATFORM SYSTEM LOOP SYNC — the battle result carries two numbers:
    //  * net damage decides the match winner (MMR / MMR ladder only)
    //  * Final_XP = Total_Kills * 10 is what the leaderboard index consumes,
    //    so Journey and Battle feed the boards through one identical matrix.
    const finalXP = kills * 10;
    game.score = finalXP;
    cb.onOver(finalXP);

    options?.onBattleEnd?.(result);
  }

  function step(dt: number, input: Input) {
    // When rotation or resizing changes the logical world height, keep every
    // fighter at the same distance above the newly positioned ground plane.
    const nextGroundY = groundY();
    if (nextGroundY !== previousGroundY) {
      const delta = nextGroundY - previousGroundY;
      if (hx !== 0) y = clamp(y + delta, ceilingY(), nextGroundY - PH / 2);
      for (const f of foes) {
        if (f.kind === "bandit" || f.kind === "gunner" || f.kind === "thrower" || f.kind === "tank") f.y += delta;
        else { f.hoverY = clamp(f.hoverY + delta, AIR_TOP, airLaneBottom()); f.y = f.hoverY; }
      }
      for (const a of allies) a.y += delta;
      for (const c of battleCombatants) c.y = clamp(c.y + delta, ceilingY(), nextGroundY - PH / 2);
      for (const item of [...shots, ...missiles, ...darts, ...daggers, ...lobs, ...meds, ...puffs, ...booms]) item.y += delta;
      previousGroundY = nextGroundY;
    }
    t += dt;
    playerFlash = Math.max(0, playerFlash - dt);
    if (hx === 0) reset();

    if (game.phase === "ready") {
      scroll += 26 * dt;
      y = groundY() - PH / 2;
      hx = clamp(hx, heroMin(), heroMax());
      if (input.tap) {
        game.phase = "playing";
        cb.onStart();
      }
      return;
    }

    shake = Math.max(0, shake - dt);
    for (const p of puffs) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 460 * dt;
      p.life -= dt;
    }
    puffs = puffs.filter((p) => p.life > 0);
    for (const b of booms) b.t += dt;
    booms = booms.filter((b) => b.t < 0.42);

    if (game.phase === "over") return;

    scroll += 40 * dt;
    jetCool = Math.max(0, jetCool - dt);

    // ==========================================
    // BATTLE MODE LOGIC (Online Multiplayer)
    // ==========================================
    if (isBattle) {
      // Countdown match timer
      matchTimeRemaining = Math.max(0, matchTimeRemaining - dt);
      if (matchTimeRemaining <= 0) {
        finishBattleMode();
        return;
      }

      // Handle Player Respawn Countdown (3s respawn)
      if (playerRespawnCountdown > 0) {
        playerRespawnCountdown -= dt;
        options?.onRespawnCountdown?.(Math.ceil(Math.max(0, playerRespawnCountdown)));
        if (playerRespawnCountdown <= 0) {
          // Re-spawn player into arena!
          hx = heroSpawn();
          y = 80;
          vy = 0;
          hp = 100;
          fuel = FUEL_MAX;
          playerSpawnShield = 2.5; // invulnerable shield
          playerRespawnCountdown = 0;
          options?.onRespawnCountdown?.(null);
          burst(hx, y, "#7be9ff", 18, 180);
        }
      }

      if (playerSpawnShield > 0) {
        playerSpawnShield = Math.max(0, playerSpawnShield - dt);
      }

      // Step Player in Battle Mode if alive
      if (playerRespawnCountdown <= 0) {
        // Shield & move
        shieldOn = (input.shield && shield > 2) || playerSpawnShield > 0;
        if (input.shield && shield > 2) {
          shield = Math.max(0, shield - SH_BURN * dt);
          shieldIdle = 0;
        } else {
          shieldIdle += dt;
          if (shieldIdle > 1) shield = Math.min(SH_MAX, shield + SH_REGEN * dt);
        }

        hx = clamp(hx + clamp(input.lx, -1, 1) * MOVE * dt, 40, W - 40);
        const want = clamp(Math.max(-input.ly, input.held ? 1 : 0), 0, 1);
        thrust = fuel > 0 ? want : 0;
        if (thrust > 0.02) fuel = Math.max(0, fuel - FUEL_BURN * thrust * dt);
        else fuel = Math.min(FUEL_MAX, fuel + FUEL_REGEN * dt);
        vy = clamp(vy + (GRAV - JET_ACC * thrust) * dt, -330, 330);
        y += vy * dt;
        const floor = groundY() - PH / 2;
        if (y > floor) {
          y = floor;
          vy = Math.min(vy, 0);
        }
        if (y < ceilingY()) {
          y = ceilingY();
          vy = Math.max(vy, 0);
        }
        if (t - lastHit > REGEN_DELAY) hp = Math.min(100, hp + REGEN_RATE * dt);

        // Aiming & firing
        let closestRival: BattleFighter | null = null;
        let cDist = 1e9;
        for (const c of battleCombatants) {
          if (c.isTeammate || c.deadTimer > 0) continue;
          const d = Math.hypot(c.x - hx, c.y - y);
          if (d < cDist) {
            cDist = d;
            closestRival = c;
          }
        }

        aiming = input.rOn || input.mouseFire;
        if (input.rOn) aim = Math.atan2(input.ry, input.rx);
        else if (input.mouseFire) aim = Math.atan2(input.py - y, input.px - hx);
        else if (closestRival) aim = Math.atan2(closestRival.y - y, closestRival.x - hx);

        fireT -= dt;
        if ((aiming || closestRival) && fireT <= 0) {
          fireT = aiming ? 0.12 : 0.22;
          const muzzle = battleMuzzle(hx, y, aim);
          addShot({
            x: muzzle.x,
            y: muzzle.y,
            vx: Math.cos(aim) * 660,
            vy: Math.sin(aim) * 660,
            dmg: 8,
            foe: false,
            sourceId: "player",
          });
          playGameSound("rifle-shot");
          playerFlash = 0.105;
          puffs.push({ x: muzzle.x, y: muzzle.y, vx: 0, vy: 0, life: 0.09, max: 0.09, r: 7, c: "#ffd166" });
        }

        // Bomb throwing
        bombT -= dt;
        if (bombs < BOMB_MAX && bombT <= 0) {
          bombs++;
          bombT = BOMB_REFILL;
        }
        if (input.bombTap && bombs > 0) {
          bombs--;
          if (bombT <= 0) bombT = BOMB_REFILL;
          playGameSound("dagger-throw");
          lobs.push({
            x: hx + Math.cos(aim) * 18,
            y: y - 8,
            vx: Math.cos(aim) * 430 + 60,
            vy: Math.sin(aim) * 430 - 170,
            fuse: 1.5,
            foe: false,
            spin: rand(-8, 8),
            shell: false,
          });
        }
      }

      // Step AI combatants (Rivals & Allies)
      for (const c of battleCombatants) {
        if (c.isPlayer) {
          c.x = hx;
          c.y = y;
          c.phase = t;
          c.aimAng = aim;
          c.moving = Math.abs(input.lx) > 0.08;
          c.hp = hp;
          c.fuel = fuel;
          c.deadTimer = playerRespawnCountdown;
          c.spawnShield = playerSpawnShield;
          continue;
        }

        c.flash = Math.max(0, c.flash - dt);
        c.phase += dt;

        // Respawn countdown
        if (c.deadTimer > 0) {
          c.deadTimer -= dt;
          if (c.deadTimer <= 0) {
            c.hp = c.maxHp;
            c.fuel = 100;
            c.spawnShield = 2.0;
            c.x = c.isTeammate ? rand(W * 0.15, W * 0.35) : rand(W * 0.65, W * 0.85);
            c.y = 80;
            burst(c.x, c.y, c.isTeammate ? "#7be9ff" : "#fb7185", 16, 160);
          }
          continue;
        }

        if (c.spawnShield > 0) {
          c.spawnShield = Math.max(0, c.spawnShield - dt);
        }

        // AI Movement: seek enemy, avoid ground edge, fly dynamically
        const enemies = battleCombatants.filter((e) => e.isTeammate !== c.isTeammate && e.deadTimer <= 0);
        let target = enemies[0];
        let bestDist = 1e9;
        for (const e of enemies) {
          const d = Math.hypot(e.x - c.x, e.y - c.y);
          if (d < bestDist) {
            bestDist = d;
            target = e;
          }
        }

        if (target) {
          // move toward preferred combat distance (~200px)
          const dir = target.x > c.x ? 1 : -1;
          const dist = Math.abs(target.x - c.x);
          const moveSpeed = dist > 220 ? 160 : dist < 120 ? -120 : 40 * Math.sin(c.phase * 2);
          c.moving = Math.abs(moveSpeed) > 8;
          c.x = clamp(c.x + dir * moveSpeed * dt, 40, W - 40);

          // jetpack hovering
          const targetY = clamp(target.y - 40 + Math.sin(c.phase * 3) * 60, 60, groundY() - 70);
          const wantUp = c.y > targetY && c.fuel > 10;
          if (wantUp) {
            c.fuel = Math.max(0, c.fuel - FUEL_BURN * dt);
            c.vy = clamp(c.vy - JET_ACC * 0.6 * dt, -250, 250);
          } else {
            c.fuel = Math.min(100, c.fuel + FUEL_REGEN * dt);
            c.vy = clamp(c.vy + GRAV * dt, -250, 250);
          }
          c.y += c.vy * dt;
          if (c.y < ceilingY()) { c.y = ceilingY(); c.vy = Math.max(0, c.vy); }
          if (c.y > groundY() - PH / 2) {
            c.y = groundY() - PH / 2;
            c.vy = 0;
          }

          // Aim & Fire
          c.aimAng = Math.atan2(target.y - c.y, target.x - c.x);
          c.fireTimer -= dt;
          if (c.fireTimer <= 0) {
            c.fireTimer = rand(0.18, 0.32);
            const muzzle = battleMuzzle(c.x, c.y, c.aimAng);
            addShot({
              x: muzzle.x,
              y: muzzle.y,
              vx: Math.cos(c.aimAng) * 560,
              vy: Math.sin(c.aimAng) * 560,
              dmg: 7,
              foe: !c.isTeammate,
              sourceId: c.id,
            });
            c.flash = 0.1;
          }
        }
      }

      // Step Battle Mode bullets & collisions
      for (const s of shots) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        // Collision with combatants
        for (const c of battleCombatants) {
          if (c.deadTimer > 0) continue;
          const isEnemyBullet = s.foe ? c.isTeammate : !c.isTeammate;
          if (!isEnemyBullet) continue;

          // Shield check
          if (c.isPlayer && shieldOn && shield > 0 && Math.hypot(s.x - hx, s.y - shieldGeometry().y) < shieldGeometry().radius) {
            s.x = 99999;
            shield = Math.max(0, shield - 4);
            burst(hx, s.y, "#7be9ff", 4, 80);
            break;
          }

          if (pointInFighter(s.x, s.y, fighterBounds(c.x, c.y + PH / 2, c.aimAng, "stand", fighterScale()), 2)) {
            s.x = 99999;
            burst(c.x, c.y, c.isTeammate ? "#7be9ff" : "#ffd166", 4, 90);
            applyFighterDamage(c, s.dmg, s.sourceId || (s.foe ? "rival" : "player"));
            break;
          }
        }
      }
      shots = shots.filter((s) => s.x > -40 && s.x < W + 40 && s.y > -40 && s.y < H + 40);

      // Step bombs in battle mode
      for (const b of lobs) {
        b.vy += BOMB_GRAV * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.fuse -= dt;
        if (b.y >= groundY() - 4 || b.fuse <= 0) {
          b.fuse = -1;
          explode(b.x, Math.min(b.y, groundY() - 2), b.foe, 68);
        }
      }
      lobs = lobs.filter((b) => b.fuse > 0 && b.x > -60 && b.x < W + 90);

      return;
    }

    // ==========================================
    // JOURNEY MODE (Standard Survival, 1 Life)
    // ==========================================
    shieldOn = input.shield && shield > 2;
    if (shieldOn) {
      shield = Math.max(0, shield - SH_BURN * dt);
      shieldIdle = 0;
    } else {
      shieldIdle += dt;
      if (shieldIdle > 1) shield = Math.min(SH_MAX, shield + SH_REGEN * dt);
    }

    // stance: chosen by the player on the ground, always stand when airborne
    const groundedNow = y >= groundY() - PH / 2 - 0.6;
    moveAmt = clamp(input.lx, -1, 1);
    playerStance = groundedNow ? (options?.getStance?.() ?? "stand") : "stand";
    hx = clamp(hx + moveAmt * MOVE * STANCE_SPEED[playerStance] * dt, heroMin(), heroMax());
    const want = clamp(Math.max(-input.ly, input.held ? 1 : 0), 0, 1);
    thrust = fuel > 0 ? want : 0;
    if (thrust > 0.02) fuel = Math.max(0, fuel - FUEL_BURN * thrust * dt);
    else fuel = Math.min(FUEL_MAX, fuel + FUEL_REGEN * dt);
    vy = clamp(vy + (GRAV - JET_ACC * thrust * STANCE_THRUST[playerStance]) * dt, -330, 330);
    y += vy * dt;
    const floor = groundY() - PH / 2;
    if (y > floor) {
      y = floor;
      vy = Math.min(vy, 0);
    }
    if (y < ceilingY()) {
      y = ceilingY();
      vy = Math.max(vy, 0);
    }
    if (t - lastHit > REGEN_DELAY) hp = Math.min(100, hp + REGEN_RATE * dt);

    let target: Foe | null = null;
    let best = 1e9;
    for (const f of foes) {
      const d = Math.hypot(f.x - hx, f.y - y);
      if (d < best) {
        best = d;
        target = f;
      }
    }
    aiming = input.rOn || input.mouseFire;
    if (input.rOn) aim = Math.atan2(input.ry, input.rx);
    else if (input.mouseFire) aim = Math.atan2(input.py - y, input.px - hx);
    else if (target) aim = Math.atan2(target.y - y, target.x - hx);

    fireT -= dt;
    if ((aiming || target) && fireT <= 0) {
      fireT = aiming ? 0.12 : 0.22;
      const muzzle = soldierMuzzle(hx, y + PH / 2, aim, playerStance, fighterScale());
      addShot({
        x: muzzle.x,
        y: muzzle.y,
        vx: Math.cos(aim) * 660,
        vy: Math.sin(aim) * 660,
        dmg: 1,
        foe: false,
      });
      playGameSound("rifle-shot");
      playerFlash = 0.105;
      puffs.push({ x: muzzle.x, y: muzzle.y, vx: 0, vy: 0, life: 0.09, max: 0.09, r: 7, c: "#ffd166" });
    }

    bombT -= dt;
    if (bombs < BOMB_MAX && bombT <= 0) {
      bombs++;
      bombT = BOMB_REFILL;
    }
    if (input.bombTap && bombs > 0) {
      bombs--;
      if (bombT <= 0) bombT = BOMB_REFILL;
      playGameSound("dagger-throw");
      lobs.push({
        x: hx + Math.cos(aim) * 18,
        y: y - 8,
        vx: Math.cos(aim) * 430 + 60,
        vy: Math.sin(aim) * 430 - 170,
        fuse: 1.5,
        foe: false,
        spin: rand(-8, 8),
        shell: false,
      });
    }

    spawnT -= dt;
    if (spawnT <= 0 && foes.length < 9) {
      spawn();
      const lv = level();
      if (lv > 2 && Math.random() < 0.3) spawn();
      spawnT = Math.max(0.46, 1.35 - lv * 0.09) * rand(0.75, 1.3);
    }
    callHelp(dt);

    for (const f of foes) {
      f.flash = Math.max(0, f.flash - dt);
      f.phase += dt;
      f.hitReact = Math.max(0, f.hitReact - dt * 4.5);
      f.burstGap = Math.max(0, f.burstGap - dt);
      if (f.reload > 0) {
        f.reload = Math.max(0, f.reload - dt);
        if (f.reload === 0) f.rounds = 3;
      }
      f.throwTimer = Math.max(0, f.throwTimer - dt);
      if (f.kind === "bot" || f.kind === "heli") f.hoverY = clamp(f.hoverY, AIR_TOP, airLaneBottom());
      const standoff = hx + f.hold;
      const advancing = f.x > standoff + 1 && !(f.kind === "thrower" && f.throwTimer > 0);
      if (f.kind === "bandit" || f.kind === "thrower" || f.kind === "gunner") {
        const damp = 1 - Math.exp(-dt * 9);
        f.moveBlend += ((advancing ? 1 : 0) - f.moveBlend) * damp;
        const previousStep = Math.floor(f.gait / Math.PI);
        f.gait += dt * f.vx * 0.14 * f.moveBlend;
        if (f.moveBlend > 0.6 && Math.floor(f.gait / Math.PI) !== previousStep) {
          puffs.push({ x: f.x + Math.sin(f.gait) * 5, y: f.y + 18, vx: rand(4, 13), vy: rand(-13, -5), life: 0.28, max: 0.28, r: rand(1.3, 2.4), c: "rgba(170,143,98,0.48)" });
        }
        const targetAim = leftFacingAim(Math.atan2(y - (f.y - 12), hx - f.x));
        const difference = Math.atan2(Math.sin(targetAim - f.aimAngle), Math.cos(targetAim - f.aimAngle));
        f.aimAngle += difference * (1 - Math.exp(-dt * 12));
        const targetCrouch = f.kind === "gunner" && !advancing ? 2 : f.kind === "bandit" && !advancing ? 1 : 0;
        f.crouch += (targetCrouch - f.crouch) * (1 - Math.exp(-dt * 8));
      }
      if (advancing && !(f.kind === "thrower" && f.throwTimer > 0)) f.x -= f.vx * dt;
      // Dagger fighters keep their distance instead of charging into melee.
      if (f.kind === "thrower" && f.x - hx < 210) {
        f.x = Math.min(W - 28, f.x + f.vx * 1.25 * dt);
      }
      if (f.kind === "thrower" && f.throwTimer > 0 && f.throwTimer <= DAGGER_RELEASE_AT && !f.throwReleased) {
        f.throwReleased = true;
        const origin = soldierMuzzle(f.x, f.y + 18, f.aimAngle, "stand", fighterScale(), "dagger", enemyAnimation(f));
        const flightTime = Math.max(0.2, Math.abs(hx - origin.x) / DAGGER_SPEED);
        const angle = leftFacingAim(Math.atan2(y - origin.y - 0.5 * DAGGER_GRAVITY * flightTime * flightTime, hx - origin.x));
        daggers.push({ x: origin.x, y: origin.y, vx: Math.cos(angle) * DAGGER_SPEED, vy: Math.sin(angle) * DAGGER_SPEED, life: 2.8, ownerId: f.id });
        playGameSound("dagger-throw");
      }

      if (f.kind === "bot") {
        // A fixed hover anchor with a tiny bob; no descent or ground contact.
        f.y = clamp(f.hoverY + Math.sin(f.phase * 2.2) * 3, AIR_TOP, airLaneBottom());
      } else if (f.kind === "heli") {
        f.y = clamp(f.hoverY + Math.sin(f.phase * 1.6) * 2, AIR_TOP, airLaneBottom());
        f.drop -= dt;
        if (f.drop <= 0 && f.x < W - 10 && f.x > hx + 60) {
          markers.push({ x: clamp(hx + rand(-10, 10), 30, W - 30), owner: f.id, t: 0, delay: 0.75 });
          f.drop = rand(2.6, 4.2);
        }
        f.missile -= dt;
        if (f.missile <= 0 && f.x < W - 10) {
          const salvo = level() > 3.4 ? 3 : level() > 2.0 ? 2 : 1;
          for (let k = 0; k < salvo; k++) {
            const ang = Math.atan2(y - f.y, hx - f.x) + (salvo > 1 ? (k === 0 ? -0.22 : 0.22) : 0);
            missiles.push({
              x: f.x - 18,
              y: f.y + 6 + k * 8,
              vx: Math.cos(ang) * 150,
              vy: Math.sin(ang) * 150,
              life: 5.5,
              smoke: 0,
            });
          }
          f.missile = rand(3.6, 6);
          f.flash = 0.16;
          playGameSound("missile-launch");
        }
      }

      f.fire -= dt;
      if (f.kind === "thrower" && f.fire <= 0 && f.throwTimer <= 0 && f.x < W - 16 && f.x - hx > 140 && f.x - hx < 620) {
        f.throwTimer = DAGGER_THROW_TIME;
        f.throwReleased = false;
        f.fire = rand(2.1, 3.0);
      }
      if (f.fire <= 0 && f.reload <= 0 && f.x < W - 8 && f.kind !== "thrower") {
        if (f.kind === "tank") {
          const dx = hx - f.x;
          const fall = Math.max(40, groundY() - 10 - (f.y - 26));
          const tof = Math.sqrt((2 * fall) / BOMB_GRAV);
          lobs.push({ x: f.x - 26, y: f.y - 26, vx: dx / Math.max(0.35, tof), vy: -150, fuse: 4, foe: true, spin: 0, shell: true });
          f.flash = 0.18;
          f.fire = Math.max(1.5, rand(2.6, 3.8) - t * 0.008);
        } else if (f.kind === "gunner") {
          f.burst = 3;
          f.burstGap = 0;
          f.fire = Math.max(1.4, rand(2.4, 3.6) - t * 0.01);
        } else {
          const targetAngle = Math.atan2(y - f.y, hx - f.x);
          const ang = f.kind === "bandit" ? leftFacingAim(targetAngle) : targetAngle;
          const spread = f.kind === "bot" ? 0.06 : 0.02;
          const firedAngle = ang + rand(-spread, spread);
          const muzzle = f.kind === "bandit"
            ? soldierMuzzle(f.x, f.y + 18, firedAngle, f.x > hx + f.hold ? "stand" : "kneel", fighterScale(), "rifle", enemyAnimation(f))
            : f.kind === "bot" ? flyingBotMuzzle(f.x, f.y, firedAngle) : { x: f.x, y: f.y - 4 };
          addShot({
            x: muzzle.x,
            y: muzzle.y,
            vx: Math.cos(firedAngle) * 300,
            vy: Math.sin(firedAngle) * 300,
            dmg: f.kind === "bandit" ? 7 : f.kind === "heli" ? 8 : 6,
            foe: true,
          });
          f.flash = 0.14;
          if (f.kind === "bandit") {
            f.rounds--;
            if (f.rounds <= 0) f.reload = FIGHTER_RELOAD_SECONDS;
          }
          const rate = f.kind === "bandit" ? rand(0.55, 0.85) : f.kind === "bot" ? rand(1.2, 2.1) : rand(1.8, 2.9);
          f.fire = Math.max(0.65, rate - t * 0.012);
        }
      }
      if (f.burst > 0 && f.fire < 1e8) {
        f.hold = 260;
        if (f.burstGap <= 0) {
          f.burstGap = 0.16;
          const ang = leftFacingAim(Math.atan2(y - f.y, hx - f.x));
          const firedAngle = ang + rand(-0.05, 0.05);
          const muzzle = soldierMuzzle(f.x, f.y + 18, firedAngle, "prone", fighterScale(), "mg", enemyAnimation(f));
          addShot({
            x: muzzle.x,
            y: muzzle.y,
            vx: Math.cos(firedAngle) * 330,
            vy: Math.sin(firedAngle) * 330,
            dmg: 6,
            foe: true,
          });
          f.flash = 0.12;
          f.burst--;
        }
      }
    }
    foes = foes.filter((f) => f.hp > 0 && f.x > -70);

    for (const m of markers) {
      m.t += dt;
      if (m.t < m.delay) continue;
      const owner = foes.find((f) => f.id === m.owner);
      if (owner) {
        const fall = Math.max(30, groundY() - 4 - owner.y);
        const tof = Math.sqrt((2 * fall) / BOMB_GRAV);
        lobs.push({
          x: owner.x,
          y: owner.y + 10,
          vx: (m.x - owner.x) / tof,
          vy: 0,
          fuse: tof + 1.2,
          foe: true,
          spin: rand(-4, 4),
          shell: false,
        });
      }
      m.t = 1e9;
    }
    markers = markers.filter((m) => m.t < 1e8);

    for (const a of allies) {
      a.life -= dt;
      a.phase += dt;
      a.flash = Math.max(0, a.flash - dt);
      if (a.kind === "jet") {
        a.x += a.vx * dt;
      } else if (a.kind === "bot") {
        const hold = hx - 60 + Math.sin(a.phase * 0.8) * 30;
        a.x += clamp(hold - a.x, -120, 120) * dt * 2;
        a.y += Math.sin(a.phase * 2.2) * 26 * dt;
        a.y = clamp(a.y, 60, groundY() - 120);
      } else if (a.kind === "interceptor") {
        const holdX = clamp(hx - 46, 36, W * 0.34);
        const holdY = clamp(y - 74, 46, groundY() - 120);
        a.x += clamp(holdX - a.x, -170, 170) * dt * 1.7;
        a.y += clamp(holdY - a.y, -170, 170) * dt * 1.7;
      } else {
        a.y = groundY() - PH / 2;
        const hold = clamp(hx - 70, 30, W * 0.3);
        a.x += clamp(hold - a.x, -60, 60) * dt;
      }
      a.fire -= dt;

      if (a.kind === "interceptor") {
        let m: Missile | null = null;
        let md = 1e9;
        for (const mm of missiles) {
          const q = Math.hypot(mm.x - a.x, mm.y - a.y);
          if (q < md) {
            md = q;
            m = mm;
          }
        }
        if (m && a.fire <= 0 && md < INTER_RANGE && (a.ammo ?? 0) > 0) {
          const ang = Math.atan2(m.y - a.y, m.x - a.x);
          darts.push({ x: a.x + 10, y: a.y, vx: Math.cos(ang) * 500, vy: Math.sin(ang) * 500, life: 2.4, smoke: 0 });
          a.flash = 0.12;
          a.ammo = (a.ammo ?? 1) - 1;
          a.fire = a.ammo > 0 ? 0.5 : INTER_RELOAD;
          if (a.ammo <= 0) a.ammo = INTER_MAG;
        }
        continue;
      }

      let tgt: Foe | null = null;
      let bd = 1e9;
      for (const f of foes) {
        const d = Math.hypot(f.x - a.x, f.y - a.y);
        if (d < bd) {
          bd = d;
          tgt = f;
        }
      }
      if (a.fire <= 0 && tgt) {
        const ang = Math.atan2(tgt.y - a.y, tgt.x - a.x);
        const isJet = a.kind === "jet";
        const sp = isJet ? 820 : 620;
        const muzzle = a.kind === "gunman"
          ? soldierMuzzle(a.x, a.y + PH / 2, ang, allyStance(a), fighterScale())
          : a.kind === "bot" ? droneMuzzle(a.x, a.y, ang, 0.6) : { x: a.x + 12, y: a.y - 6 };
        addShot({
          x: muzzle.x,
          y: muzzle.y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          dmg: isJet ? JET_DMG : 1,
          foe: false,
          heavy: isJet,
        });
        a.flash = 0.1;
        a.fire = isJet ? JET_RATE : a.kind === "bot" ? 0.42 : 0.5;
      }
    }
    allies = allies.filter((a) => a.hp > 0 && a.life > 0 && a.x < W + 120);

    for (const s of shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    for (const s of shots) {
      if (s.foe) {
        if (shieldOn && shield > 0 && Math.hypot(s.x - hx, s.y - shieldGeometry().y) < shieldGeometry().radius) {
          s.x = 99999;
          shield = Math.max(0, shield - 4);
          shieldIdle = 0;
          burst(hx, s.y, "#7be9ff", 4, 90);
          continue;
        }
        if (pointInFighter(s.x, s.y, playerBounds())) {
          s.x = 99999;
          hurt(s.dmg);
          continue;
        }
        for (const a of allies) {
          if (a.kind === "gunman" ? pointInFighter(s.x, s.y, allyBounds(a), 2) : Math.abs(s.x - a.x) < 13 && Math.abs(s.y - a.y) < 17) {
            s.x = 99999;
            hurtAlly(a, s.dmg * 0.5);
            break;
          }
        }
      } else {
        for (const f of foes) {
          const groundFighter = f.kind === "bandit" || f.kind === "gunner" || f.kind === "thrower";
          const rx = f.kind === "bot" ? 34 : f.kind === "heli" ? 26 : 30;
          const ry = f.kind === "bot" ? 26 : f.kind === "heli" ? 20 : 18;
          const hit = groundFighter ? pointInFighter(s.x, s.y, enemyBounds(f)) : Math.abs(s.x - f.x) < rx && Math.abs(s.y - f.y) < ry;
          if (hit) {
            f.hp -= f.kind === "tank" && !s.heavy ? s.dmg * TANK_ARMOUR : s.dmg;
            f.flash = 0.1;
            f.hitReact = 1;
            playGameSound(f.kind === "bot" || f.kind === "heli" ? "drone-hit" : "fighter-hit");
            burst(f.x, f.y, f.kind === "tank" ? "#cbd5f5" : "#ffd166", 3, 80);
            s.x = 99999;
            if (f.hp <= 0) killFoe(f);
            break;
          }
        }
      }
    }
    foes = foes.filter((f) => f.hp > 0);
    allies = allies.filter((a) => a.hp > 0);
    shots = shots.filter((s) => s.x > -40 && s.x < W + 40 && s.y > -40 && s.y < H + 40);

    for (const knife of daggers) {
      knife.life -= dt;
      if (knife.life <= 0) continue;
      knife.vy += DAGGER_GRAVITY * dt;
      knife.x += knife.vx * dt;
      knife.y += knife.vy * dt;
      if (shieldOn && shield > 0 && Math.hypot(knife.x - hx, knife.y - shieldGeometry().y) < shieldGeometry().radius) {
        shield = Math.max(0, shield - 8);
        shieldIdle = 0;
        knife.life = 0;
        burst(knife.x, knife.y, "#9ce8f0", 5, 100);
      } else if (pointInFighter(knife.x, knife.y, playerBounds(), 3)) {
        knife.life = 0;
        hurt(DAGGER_DAMAGE);
      } else {
        for (const ally of allies) {
          if (ally.kind === "gunman" ? pointInFighter(knife.x, knife.y, allyBounds(ally), 3) : Math.abs(knife.x - ally.x) < 16 && Math.abs(knife.y - ally.y) < 20) {
            hurtAlly(ally, DAGGER_DAMAGE * 0.5);
            knife.life = 0;
            break;
          }
        }
      }
      if (knife.y >= groundY() - 1) {
        knife.life = 0;
        burst(knife.x, groundY() - 2, "#b9a47b", 3, 50);
      }
    }
    daggers = daggers.filter((knife) => knife.life > 0 && knife.x > -55 && knife.x < W + 55 && knife.y > -45 && knife.y < H + 25);

    for (const m of missiles) {
      m.life -= dt;
      m.smoke += dt;
      const ang = Math.atan2(m.vy, m.vx);
      const want2 = Math.atan2(y - m.y, hx - m.x);
      let diff = want2 - ang;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const turn = clamp(diff, -2.1 * dt, 2.1 * dt);
      const sp = Math.min(400, Math.hypot(m.vx, m.vy) + 240 * dt);
      const na = ang + turn;
      m.vx = Math.cos(na) * sp;
      m.vy = Math.sin(na) * sp;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.smoke > 0.03) {
        m.smoke = 0;
        puffs.push({ x: m.x, y: m.y, vx: rand(-14, 14), vy: rand(-14, 6), life: 0.4, max: 0.4, r: rand(1.8, 3.4), c: "rgba(220,220,235,0.8)" });
      }
      let done = false;
      if (shieldOn && shield > 0 && Math.hypot(m.x - hx, m.y - shieldGeometry().y) < shieldGeometry().radius) {
        shield = Math.max(0, shield - 18);
        shieldIdle = 0;
        burst(m.x, m.y, "#7be9ff", 12, 170);
        done = true;
      } else if (pointInFighter(m.x, m.y, playerBounds(), 4)) {
        explode(m.x, m.y, true, 52);
        done = true;
      } else {
        for (const a of allies) {
          if (Math.hypot(m.x - a.x, m.y - a.y) < 18) {
            hurtAlly(a, 6);
            explode(m.x, m.y, true, 44);
            done = true;
            break;
          }
        }
      }
      if (m.y > groundY() - 2) {
        explode(m.x, groundY() - 4, true, 48);
        done = true;
      }
      if (done || m.life <= 0) m.life = -1;
    }
    missiles = missiles.filter((m) => m.life > 0 && m.x > -60 && m.x < W + 80);

    for (const d of darts) {
      d.life -= dt;
      let m: Missile | null = null;
      let md = 1e9;
      for (const mm of missiles) {
        const q = Math.hypot(mm.x - d.x, mm.y - d.y);
        if (q < md) {
          md = q;
          m = mm;
        }
      }
      if (m) {
        const ang = Math.atan2(d.vy, d.vx);
        const want2 = Math.atan2(m.y - d.y, m.x - d.x);
        let diff = want2 - ang;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const na = ang + clamp(diff, -3.4 * dt, 3.4 * dt);
        const sp = Math.min(540, Math.hypot(d.vx, d.vy) + 260 * dt);
        d.vx = Math.cos(na) * sp;
        d.vy = Math.sin(na) * sp;
      }
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.smoke += dt;
      if (d.smoke > 0.045) {
        d.smoke = 0;
        puffs.push({ x: d.x, y: d.y, vx: rand(-10, 10), vy: rand(-10, 4), life: 0.3, max: 0.3, r: rand(1.4, 2.6), c: "rgba(170,240,255,0.75)" });
      }
      if (m && md < 20) {
        m.life = -1;
        d.life = -1;
        booms.push({ x: d.x, y: d.y, t: 0, r: 32, foe: false });
        burst(d.x, d.y, "#7be9ff", 14, 210);
        shake = Math.max(shake, 0.16);
      }
    }
    darts = darts.filter((d) => d.life > 0 && d.x > -50 && d.x < W + 70 && d.y > -50 && d.y < H + 50);
    missiles = missiles.filter((m) => m.life > 0);
    allies = allies.filter((a) => a.hp > 0);

    for (const b of lobs) {
      b.vy += BOMB_GRAV * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.fuse -= dt;
      let hit = b.y >= groundY() - 4 || b.fuse <= 0;
      if (!hit && !b.foe) for (const f of foes) if (Math.hypot(b.x - f.x, b.y - f.y) < 22) hit = true;
      if (!hit && b.foe && Math.hypot(b.x - hx, b.y - y) < 20) hit = true;
      if (hit) {
        b.fuse = -1;
        explode(b.x, Math.min(b.y, groundY() - 2), b.foe, b.foe ? (b.shell ? 58 : 66) : 70);
      }
    }
    lobs = lobs.filter((b) => b.fuse > 0 && b.x > -60 && b.x < W + 90);

    for (const m of meds) {
      m.vy += 900 * dt;
      m.y = Math.min(groundY() - 12, m.y + m.vy * dt);
      if (m.y >= groundY() - 12) m.vy = 0;
      m.bob += dt;
      m.life -= dt;
      m.x += clamp(hx - m.x, -1, 1) * 150 * dt;
      if (Math.hypot(m.x - hx, m.y - y) < 38) {
        m.life = -1;
        hp = Math.min(100, hp + MED_HEAL);
        shield = Math.min(SH_MAX, shield + 25);
        burst(m.x, m.y, "#4ade80", 12, 170);
      }
    }
    meds = meds.filter((m) => m.life > 0);

    for (const f of foes) {
      if (f.kind === "thrower" || f.kind === "bot" || f.kind === "heli") continue;
      const player = playerBounds();
      const enemy = f.kind === "tank" ? null : enemyBounds(f);
      const touching = enemy
        ? player.left < enemy.right && player.right > enemy.left && player.top < enemy.bottom && player.bottom > enemy.top
        : Math.abs(f.x - hx) < 21 && Math.abs(f.y - y) < STANCE_HITBOX[playerStance] + 7;
      if (touching) {
        hurt(f.kind === "tank" ? 20 : 10);
        if (f.kind !== "tank") {
          f.hp = 0;
          burst(f.x, f.y, "#fb7185", 12, 190);
        }
      }
    }
    foes = foes.filter((f) => f.hp > 0);
  }

  /* ------------------------------ drawing ------------------------------ */

  function ridge(ctx: CanvasRenderingContext2D, offset: number, base: number, amp: number, color: string, step: number) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-40, H + 40);
    const off = -((offset % (step * 4)) + step * 4) % (step * 4);
    for (let i = -1; i <= W / step + 3; i++) {
      const x = off + i * step;
      const h = base - amp * (0.35 + 0.65 * Math.abs(Math.sin((i + 3) * 2.399 + offset * 0.004)));
      ctx.lineTo(x, base);
      ctx.lineTo(x + step / 2, h);
      ctx.lineTo(x + step, base);
    }
    ctx.lineTo(W + 40, H + 40);
    ctx.closePath();
    ctx.fill();
  }

  function town(ctx: CanvasRenderingContext2D, offset: number) {
    const g0 = groundY();
    const step = 96;
    const off = -((offset % step) + step) % step;
    for (let i = -1; i <= W / step + 2; i++) {
      const x = off + i * step;
      const seed = ((i % 7) + 7) % 7;
      const hgt = 58 + seed * 13;
      const wdt = 44 + ((seed * 17) % 26);
      ctx.fillStyle = "#121c3d";
      ctx.fillRect(x, g0 - hgt, wdt, hgt);
      ctx.fillStyle = "#0d1530";
      ctx.beginPath();
      ctx.moveTo(x - 4, g0 - hgt);
      ctx.lineTo(x + wdt / 2, g0 - hgt - 16);
      ctx.lineTo(x + wdt + 4, g0 - hgt);
      ctx.closePath();
      ctx.fill();
      for (let wy = g0 - hgt + 12; wy < g0 - 14; wy += 20) {
        for (let wx = x + 7; wx < x + wdt - 8; wx += 16) {
          const lit = (wx * 7 + wy * 13 + seed) % 5 < 2;
          ctx.fillStyle = lit ? "rgba(255,209,102,0.75)" : "rgba(120,160,255,0.12)";
          ctx.fillRect(wx, wy, 7, 9);
        }
      }
    }
  }

  function pines(ctx: CanvasRenderingContext2D, offset: number) {
    const step = 34;
    const off = -((offset % step) + step) % step;
    const g0 = groundY();
    for (let i = -1; i <= W / step + 1; i++) {
      const x = off + i * step;
      const tall = 40 + ((i * 37) % 24);
      ctx.fillStyle = "#0b2a3a";
      for (let k = 0; k < 3; k++) {
        const w = 24 - k * 6;
        const yTop = g0 - tall + k * 12;
        ctx.beginPath();
        ctx.moveTo(x, yTop);
        ctx.lineTo(x + w / 2, yTop + 20);
        ctx.lineTo(x - w / 2, yTop + 20);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function citySkyscrapers(ctx: CanvasRenderingContext2D, offset: number) {
    const g0 = groundY();
    const step = 78;
    const off = -((offset % step) + step) % step;
    for (let i = -1; i <= W / step + 2; i++) {
      const x = off + i * step;
      const seed = ((i % 8) + 8) % 8;
      const hgt = 100 + seed * 22;
      const wdt = 52 + ((seed * 11) % 24);

      ctx.fillStyle = "#0d182e";
      ctx.fillRect(x, g0 - hgt, wdt, hgt);

      // Skyscraper lit grid windows
      for (let wy = g0 - hgt + 10; wy < g0 - 12; wy += 14) {
        for (let wx = x + 6; wx < x + wdt - 8; wx += 10) {
          const lit = (wx * 11 + wy * 17) % 7 < 3;
          ctx.fillStyle = lit ? "rgba(56, 217, 245, 0.65)" : "rgba(255, 255, 255, 0.08)";
          ctx.fillRect(wx, wy, 5, 7);
        }
      }

      // Neon brand billboard atop some buildings
      if (seed === 2 || seed === 5) {
        ctx.fillStyle = "#1e293b";
        rr(ctx, x + 4, g0 - hgt - 18, wdt - 8, 14, 3);
        ctx.fill();
        ctx.fillStyle = seed === 2 ? "#ffd166" : "#38d9f5";
        ctx.font = "bold 8px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(seed === 2 ? "NITRO" : "APEX", x + wdt / 2, g0 - hgt - 8);
      }
    }
  }

  function desertBunker(ctx: CanvasRenderingContext2D, offset: number) {
    const g0 = groundY();
    const bx = W * 0.18 - ((offset * 0.2) % (W + 200));

    // Fortified concrete bunker
    ctx.fillStyle = "#473c33";
    rr(ctx, bx - 30, g0 - 45, 80, 45, 6);
    ctx.fill();
    ctx.fillStyle = "#2e2620";
    ctx.fillRect(bx - 12, g0 - 32, 44, 8); // slit aperture

    // Camouflage Sandbags
    ctx.fillStyle = "#8c7355";
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        rr(ctx, bx - 26 + c * 14 + (r % 2) * 6, g0 - 10 - r * 8, 16, 7, 3);
        ctx.fill();
      }
    }

    // Communication Radar Satellite Dish
    const dishX = bx + 36;
    const dishY = g0 - 65;
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(dishX, g0 - 45);
    ctx.lineTo(dishX, dishY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(dishX, dishY, 14, Math.PI * 0.8, Math.PI * 1.8);
    ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(dishX, dishY - 14, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function flyingBot(ctx: CanvasRenderingContext2D, f: Foe) {
    drawFlyingBot(ctx, { x: f.x, y: f.y, aim: Math.atan2(y - f.y, hx - f.x), phase: f.phase, flash: f.flash });
  }

  function heli(ctx: CanvasRenderingContext2D, f: Foe) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.fillStyle = "#202729";
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(14, -4, 26, 6);
    ctx.fillStyle = "#353e3b";
    ctx.beginPath();
    ctx.moveTo(34, -4);
    ctx.lineTo(44, -14);
    ctx.lineTo(44, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(180,235,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(-11, -2, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#151c1d";
    rr(ctx, -12, 9, 20, 6, 2);
    ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(-13, 10, 3, 4);
    ctx.strokeStyle = "#111718";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-6, 14);
    ctx.lineTo(-6, 20);
    ctx.moveTo(8, 14);
    ctx.lineTo(8, 20);
    ctx.moveTo(-16, 20);
    ctx.lineTo(18, 20);
    ctx.stroke();
    const sp = Math.sin(f.phase * 30) * 30;
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-2, -15);
    ctx.lineTo(-2, -13);
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-2 - sp, -15);
    ctx.lineTo(-2 + sp, -15);
    ctx.stroke();
    if (f.flash > 0) {
      ctx.fillStyle = `rgba(255,209,102,${f.flash * 5})`;
      ctx.beginPath();
      ctx.arc(-24, 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function tank(ctx: CanvasRenderingContext2D, f: Foe) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.fillStyle = "#1d2433";
    rr(ctx, -30, 6, 60, 14, 6);
    ctx.fill();
    ctx.fillStyle = "#39445c";
    for (let i = 0; i < 6; i++) {
      const wx = -26 + i * 10 + ((f.phase * 40) % 10);
      ctx.beginPath();
      ctx.arc(Math.min(24, wx), 13, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
    const g = ctx.createLinearGradient(0, -10, 0, 8);
    g.addColorStop(0, "#6b7384");
    g.addColorStop(1, "#38404f");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-30, 6);
    ctx.lineTo(-24, -8);
    ctx.lineTo(22, -8);
    ctx.lineTo(30, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#59627a";
    rr(ctx, -12, -20, 26, 13, 4);
    ctx.fill();
    ctx.save();
    ctx.translate(-10, -14);
    ctx.rotate(clamp(Math.atan2(y - (f.y - 14), hx - f.x), -1.1, 0.25));
    ctx.fillStyle = "#2b3245";
    rr(ctx, -30, -3.5, 32, 7, 3);
    ctx.fill();
    if (f.flash > 0) {
      ctx.fillStyle = `rgba(255,209,102,${f.flash * 5})`;
      ctx.beginPath();
      ctx.moveTo(-30, -7);
      ctx.lineTo(-46, 0);
      ctx.lineTo(-30, 7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-18, -8);
    ctx.lineTo(-18, 6);
    ctx.moveTo(-4, -8);
    ctx.lineTo(-4, 6);
    ctx.moveTo(10, -8);
    ctx.lineTo(10, 6);
    ctx.stroke();
    ctx.restore();
  }

  function allyInterceptor(ctx: CanvasRenderingContext2D, a: Ally) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.shadowColor = "rgba(123,233,255,0.8)";
    ctx.shadowBlur = 12;
    ctx.fillStyle = "#15607f";
    rr(ctx, -14, -7, 28, 15, 5);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#0e3d55";
    rr(ctx, 4, -12, 16, 5, 2);
    ctx.fill();
    rr(ctx, 4, 7, 16, 5, 2);
    ctx.fill();
    ctx.fillStyle = a.flash > 0 ? "#ffd166" : "#7be9ff";
    ctx.beginPath();
    ctx.arc(20, -9.5, 2.3, 0, Math.PI * 2);
    ctx.arc(20, 9.5, 2.3, 0, Math.PI * 2);
    ctx.fill();
    const sweep = Math.sin(a.phase * 2.6) * 0.7;
    ctx.save();
    ctx.translate(-4, -8);
    ctx.rotate(sweep);
    ctx.strokeStyle = "rgba(190,250,255,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 7, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -7);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#b8f4ff";
    ctx.beginPath();
    ctx.arc(-6, 0, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(190,250,255,0.6)";
    ctx.lineWidth = 2;
    const w = Math.sin(a.phase * 22) * 6;
    ctx.beginPath();
    ctx.moveTo(-15, -8);
    ctx.lineTo(-15 - w, -14);
    ctx.moveTo(15, -8);
    ctx.lineTo(15 + w, -14);
    ctx.stroke();
    ctx.restore();
  }

  function allyBot(ctx: CanvasRenderingContext2D, a: Ally) {
    let target: Foe | null = null;
    let best = Infinity;
    for (const f of foes) {
      const d = Math.hypot(f.x - a.x, f.y - a.y);
      if (d < best) { best = d; target = f; }
    }
    drawMilitaryDrone(ctx, {
      x: a.x, y: a.y, aim: target ? Math.atan2(target.y - a.y, target.x - a.x) : 0,
      phase: a.phase, vx: a.vx, vy: a.vy, flash: a.flash, friendly: true, scale: 0.6,
    });
  }

  function allyJet(ctx: CanvasRenderingContext2D, a: Ally) {
    ctx.save();
    ctx.translate(a.x, a.y);
    const g = ctx.createLinearGradient(-30, 0, 10, 0);
    g.addColorStop(0, "rgba(123,233,255,0)");
    g.addColorStop(1, "rgba(123,233,255,0.85)");
    ctx.fillStyle = g;
    ctx.fillRect(-46, -2.5, 46, 5);
    ctx.fillStyle = "#dbe9ff";
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-16, -3);
    ctx.lineTo(-16, 3);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#7be9ff";
    ctx.beginPath();
    ctx.moveTo(2, -4);
    ctx.lineTo(-10, -18);
    ctx.lineTo(-2, -4);
    ctx.closePath();
    ctx.moveTo(2, 4);
    ctx.lineTo(-10, 18);
    ctx.lineTo(-2, 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#18304f";
    ctx.beginPath();
    ctx.ellipse(10, -1, 6, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function bar(ctx: CanvasRenderingContext2D, x: number, yy: number, w: number, h: number, v: number, col: string) {
    ctx.fillStyle = paintedScene ? "rgba(30,20,10,0.38)" : "rgba(255,255,255,0.16)";
    rr(ctx, x, yy, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = col;
    rr(ctx, x, yy, w * clamp(v, 0, 1), h, h / 2);
    ctx.fill();
  }

  /** Player and allies wear camouflage; rival operatives wear black. */
  function drawFighter(ctx: CanvasRenderingContext2D, c: BattleFighter, facing: number, trim: string, jet: boolean) {
    const scale = fighterScale();
    drawBattleOperative(ctx, {
      x: c.x, y: c.y + PH / 2 - fighterFootOffset(0) * scale,
      facing, aim: c.aimAng, phase: c.phase, scale,
      moving: c.moving, airborne: c.y + PH / 2 < groundY() - 0.6,
      jet, flash: c.flash, camo: c.isTeammate, female: c.gender === "female", trim,
    });
  }

  function draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    const g0 = groundY();
    if (paintedScene) {
      drawSambisaBackdrop(ctx, scroll, t, g0, background);
    } else {
    backdrop(ctx, scroll);

    // Rebuild stars to fill screen
    if (starsFor !== W * 7919 + H) {
      starsFor = W * 7919 + H;
      stars = Array.from({ length: Math.round((W * H) / 4200) }, () => ({ x: rand(0, W), y: rand(0, g0 - 120), r: rand(0.5, 1.6) }));
    }
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (const s of stars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    }

    // Zone Background Features
    if (paintedScene) {
      /* painted scenery and floor are already drawn */
    } else {
      // Desert Hideout: Sand dunes, bunker, antenna
      ridge(ctx, scroll * 0.08, g0 - 100, Math.min(140, H * 0.28), "#3d2218", 120);
      ridge(ctx, scroll * 0.18 + 200, g0 - 60, Math.min(100, H * 0.2), "#2d1612", 90);
      desertBunker(ctx, scroll);

      // Desert sand terrain & rocks
      ctx.fillStyle = "#78350f";
      ctx.fillRect(-40, g0, W + 80, H - g0 + 40);
      ctx.fillStyle = "#b45309";
      ctx.fillRect(-40, g0, W + 80, 8);
      ctx.fillStyle = "#d97706";
      for (let x = -((scroll * 1.4) % 24); x < W + 40; x += 24) {
        ctx.beginPath();
        ctx.arc(x + 10, g0 + 4, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ==========================================
    // DRAW BATTLE MODE COMBATANTS
    // ==========================================
    if (isBattle) {
      for (const c of battleCombatants) {
        if (c.deadTimer > 0) continue; // dead, currently in 3s respawn
        const isTeammate = c.isTeammate;
        const trim = isTeammate ? "#7be9ff" : "#fb7185";

        // Gender-verified sprite engine switch
        drawFighter(
          ctx,
          c.isPlayer ? { ...c, flash: playerFlash } : c,
          c.aimAng > Math.PI / 2 || c.aimAng < -Math.PI / 2 ? -1 : 1,
          trim,
          c.isPlayer ? thrust > 0.05 : c.vy < -5 && c.fuel > 0,
        );

        const bounds = fighterBounds(c.x, c.y + PH / 2, c.aimAng, "stand", fighterScale());
        // Keep the respawn bubble and nameplate around the enlarged avatar.
        if (c.spawnShield > 0) {
          ctx.strokeStyle = "rgba(255, 209, 102, 0.8)";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(c.x, (bounds.top + bounds.bottom) / 2, Math.max(30, (bounds.bottom - bounds.top) * 0.64), 0, Math.PI * 2);
          ctx.stroke();
        }

        // Nametag (with gender mark) & Health Bar over head
        ctx.save();
        ctx.translate(c.x, Math.max(12, bounds.top - 8));
        ctx.font = "bold 9px sans-serif";
        ctx.textAlign = "center";
        const tag = `${c.gender === "female" ? "♀ " : "♂ "}${c.name}${c.isPlayer ? " (You)" : ""}`;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.strokeStyle = "rgba(5,9,19,0.8)";
        ctx.strokeText(tag, 0, 0);
        ctx.fillStyle = isTeammate ? "#7be9ff" : "#fb7185";
        ctx.fillText(tag, 0, 0);

        // Small HP bar
        bar(ctx, -16, 3, 32, 3, c.hp / c.maxHp, isTeammate ? "#38d9f5" : "#f43f5e");
        ctx.restore();
      }

      // Draw Top Match Status Bar in Battle Mode
      ctx.save();
      ctx.fillStyle = "rgba(5, 9, 19, 0.75)";
      rr(ctx, W / 2 - 110, 10, 220, 36, 12);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const mins = Math.floor(matchTimeRemaining / 60);
      const secs = Math.floor(matchTimeRemaining % 60);
      const timeFmt = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

      ctx.font = "bold 15px 'Space Grotesk', monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = matchTimeRemaining < 30 ? "#fb7185" : "#ffd166";
      ctx.fillText(`⏱️ ${timeFmt}`, W / 2, 32);

      // Player Net Score live banner
      const net = playerDamageInflicted - playerDamageReceived;
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = net >= 0 ? "#34d399" : "#fb7185";
      ctx.fillText(`Net: ${net >= 0 ? "+" : ""}${net}`, W / 2 - 100, 25);
      ctx.restore();
    } else {
      // ==========================================
      // DRAW JOURNEY MODE COMBATANTS
      // ==========================================
      for (const a of allies) {
        if (a.kind === "jet") allyJet(ctx, a);
        else if (a.kind === "bot") allyBot(ctx, a);
        else if (a.kind === "interceptor") allyInterceptor(ctx, a);
        else {
          let near: Foe | null = null;
          let nd = 1e9;
          for (const f of foes) {
            const d = Math.hypot(f.x - a.x, f.y - a.y);
            if (d < nd) {
              nd = d;
              near = f;
            }
          }
          drawSoldier(ctx, {
            x: a.x,
            y: a.y + 18,
            aim: near ? Math.atan2(near.y - a.y, near.x - a.x) : 0,
            stance: near && nd < 540 ? "kneel" : "stand",
            phase: a.phase,
            moving: !(near && nd < 540),
            airborne: false,
            faction: "soldier",
            team: "#7be9ff",
            gun: "rifle",
            flash: a.flash,
            scale: fighterScale(),
            female: playerGender === "female",
          });
        }
        if (a.hp < a.max) {
          ctx.globalAlpha = 0.75;
          const top = a.kind === "gunman" ? allyBounds(a).top - 6 : a.y - 26;
          bar(ctx, a.x - 12, top, 24, 3, a.hp / a.max, "#7be9ff");
          ctx.globalAlpha = 1;
        }
      }

      for (const f of foes) {
        if (f.kind === "bandit" || f.kind === "thrower" || f.kind === "gunner") {
          const advancing = f.moveBlend > 0.08;
          drawSoldier(ctx, {
            x: f.x,
            y: f.y + 18,
            aim: f.aimAngle,
            animation: enemyAnimation(f),
            stance: f.kind === "thrower" ? "stand" : advancing ? "stand" : f.kind === "gunner" ? "prone" : "kneel",
            phase: f.phase,
            moving: advancing,
            airborne: false,
            faction: "bandit",
            team: f.kind === "gunner" ? "#ff9f5a" : f.kind === "thrower" ? "#ffd166" : "#ff6b7f",
            gun: f.kind === "thrower" ? "dagger" : f.kind === "gunner" ? "mg" : "rifle",
            flash: f.flash,
            scale: fighterScale(),
            female: playerGender === "female",
          });
        }
        else if (f.kind === "bot") flyingBot(ctx, f);
        else if (f.kind === "heli") heli(ctx, f);
        else tank(ctx, f);

        if (f.max > 2) {
          const w = f.kind === "heli" || f.kind === "tank" || f.kind === "bot" ? 44 : 24;
          const isGroundFighter = f.kind === "bandit" || f.kind === "gunner" || f.kind === "thrower";
          const barY = isGroundFighter ? enemyBounds(f).top - 6 : f.y - (f.kind === "bot" ? 42 : f.kind === "heli" ? 30 : f.kind === "tank" ? 34 : 24);
          ctx.globalAlpha = 0.7;
          bar(ctx, f.x - w / 2, barY, w, 3, f.hp / f.max, f.kind === "tank" ? "#cbd5f5" : "#ff9ab8");
          ctx.globalAlpha = 1;
        }
      }

      for (const m of markers) {
        const k = clamp(m.t / m.delay, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.45 + 0.45 * Math.sin(t * 22);
        ctx.strokeStyle = "#ff6b6b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m.x, g0 - 3, 20 * (1 - k) + 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(m.x, g0 - 3, 9, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(m.x - 15, g0 - 3);
        ctx.lineTo(m.x + 15, g0 - 3);
        ctx.moveTo(m.x, g0 - 18);
        ctx.lineTo(m.x, g0 + 12);
        ctx.stroke();
        ctx.restore();
      }

      for (const m of meds) {
        const fade = m.life < 3 && Math.floor(m.life * 6) % 2 === 0 ? 0.35 : 1;
        const yy = m.y + Math.sin(m.bob * 3) * 2;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.shadowColor = "rgba(74,222,128,0.85)";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#f3fff6";
        rr(ctx, m.x - 9, yy - 8, 18, 16, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(m.x - 2, yy - 5.5, 4, 11);
        ctx.fillRect(m.x - 6.5, yy - 1.5, 13, 4);
        ctx.restore();
      }

      for (const d of darts) {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(Math.atan2(d.vy, d.vx));
        ctx.shadowColor = "rgba(123,233,255,0.9)";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#d9fbff";
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-5, -3);
        ctx.lineTo(-5, 3);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#38d9f5";
        ctx.fillRect(-8, -1.6, 5, 3.2);
        ctx.restore();
      }

      for (const m of missiles) {
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(Math.atan2(m.vy, m.vx));
        const fl = 6 + Math.random() * 7;
        const g = ctx.createLinearGradient(-10 - fl, 0, -8, 0);
        g.addColorStop(0, "rgba(255,120,60,0)");
        g.addColorStop(1, "#ffd166");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-9, -3);
        ctx.lineTo(-10 - fl, 0);
        ctx.lineTo(-9, 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#e8edf7";
        rr(ctx, -9, -3, 16, 6, 2.5);
        ctx.fill();
        ctx.fillStyle = "#ff5f7a";
        ctx.beginPath();
        ctx.moveTo(7, -3);
        ctx.lineTo(14, 0);
        ctx.lineTo(7, 3);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#9aa6bf";
        ctx.beginPath();
        ctx.moveTo(-6, -3);
        ctx.lineTo(-11, -8);
        ctx.lineTo(-3, -3);
        ctx.closePath();
        ctx.moveTo(-6, 3);
        ctx.lineTo(-11, 8);
        ctx.lineTo(-3, 3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      if (game.phase !== "over") {
        const blink = t - lastHit < 0.6 && Math.floor(t * 14) % 2 === 0;
        if (!blink) {
          const jetting = thrust > 0.05 && game.phase === "playing";
          drawSoldier(ctx, {
            x: hx,
            y: y + PH / 2,
            aim,
            stance: playerStance,
            phase: t,
            moving: Math.abs(moveAmt) > 0.08 && y >= groundY() - PH / 2 - 0.6,
            airborne: y < groundY() - PH / 2 - 0.6,
            faction: "soldier",
            team: "#7be9ff",
            gun: "rifle",
            flash: playerFlash,
            jet: jetting,
            scale: fighterScale(),
            female: playerGender === "female",
          });
        }
        if (shieldOn) {
          const pulse = 1 + Math.sin(t * 16) * 0.03;
          const bubble = shieldGeometry();
          const g = ctx.createRadialGradient(hx, bubble.y, 6, hx, bubble.y, bubble.radius * pulse);
          g.addColorStop(0, "rgba(123,233,255,0.05)");
          g.addColorStop(0.75, "rgba(123,233,255,0.18)");
          g.addColorStop(1, "rgba(123,233,255,0.42)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(hx, bubble.y, bubble.radius * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "rgba(190,250,255,0.9)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    for (const knife of daggers) {
      drawDagger(ctx, knife.x, knife.y, Math.atan2(knife.vy, knife.vx));
    }

    // Bombs and shells
    for (const b of lobs) {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.shell ? Math.atan2(b.vy, b.vx) : b.spin * t);
      if (b.shell) {
        ctx.fillStyle = "#cbd5f5";
        rr(ctx, -8, -3.5, 16, 7, 3);
        ctx.fill();
        ctx.fillStyle = "#ff8a5c";
        ctx.beginPath();
        ctx.moveTo(8, -3.5);
        ctx.lineTo(14, 0);
        ctx.lineTo(8, 3.5);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = b.foe ? "#ff8a5c" : "#ffd166";
        rr(ctx, -5, -7, 10, 14, 4);
        ctx.fill();
        ctx.fillStyle = "#2a1c12";
        ctx.fillRect(-1.5, -10, 3, 4);
      }
      ctx.restore();
      if (!b.shell) {
        ctx.fillStyle = `rgba(255,220,140,${0.4 + 0.4 * Math.sin(t * 30)})`;
        ctx.beginPath();
        ctx.arc(b.x, b.y - 10, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Common Bullets
    for (const s of shots) {
      ctx.strokeStyle = s.foe ? "#ff9ab8" : s.heavy ? "#ffd166" : "#7be9ff";
      ctx.lineWidth = s.foe ? 2.4 : s.heavy ? 4.2 : 3;
      ctx.shadowColor = s.foe ? "rgba(255,120,150,0.9)" : s.heavy ? "rgba(255,209,102,0.9)" : "rgba(123,233,255,0.9)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.016, s.y - s.vy * 0.016);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    for (const b of booms) {
      const k = b.t / 0.42;
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = b.foe ? "rgba(255,140,110,0.55)" : "rgba(255,209,102,0.55)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * (0.35 + k * 0.75), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 3 * (1 - k);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * (0.4 + k), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const p of puffs) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (paintedScene) drawSambisaForeground(ctx, background, scroll, t, g0);

    // Player HUD in Journey Mode
    if (!isBattle) {
      ctx.globalAlpha = paintedScene ? 0.9 : 0.6;
      bar(ctx, 14, 14, 96, 6, hp / 100, hp > 55 ? "#34d399" : hp > 25 ? "#ffd166" : "#fb7185");
      bar(ctx, 14, 24, 96, 4, fuel / FUEL_MAX, "#ffb454");
      bar(ctx, 14, 32, 96, 4, shield / SH_MAX, "#7be9ff");
      for (let i = 0; i < BOMB_MAX; i++) {
        ctx.fillStyle = i < bombs ? "#ffd166" : paintedScene ? "rgba(30,20,10,0.38)" : "rgba(255,255,255,0.16)";
        ctx.beginPath();
        ctx.arc(19 + i * 12, 46, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (game.phase === "ready") {
      const prompt = isBattle ? "TOUCH TO JOIN BATTLE" : "TOUCH TO DEPLOY";
      const sub = isBattle
        ? "Dual-Stick Combat · 3s Respawns · Maximize Net Score"
        : "Dual Sticks Move & Aim · SHIELD Blocks Fire · BOMB Throws";
      hint(ctx, t, prompt, sub, H * 0.44);
    }
    ctx.restore();
  }

  return game;
}
