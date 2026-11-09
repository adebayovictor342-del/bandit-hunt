export type Gender = "male" | "female";
export type SkirmishZone = "forest" | "city" | "hideout";
export type BackgroundId = "village-one" | "village-two" | "background-three" | "background-four";
export type SkirmishGameMode = "journey" | "battle";
export type BattleFormat = "1v1" | "2v2";

export interface BackgroundMeta {
  id: BackgroundId;
  label: string;
  image: string;
  zone: SkirmishZone;
}

export const BACKGROUNDS: BackgroundMeta[] = [
  { id: "village-one", label: "Village One", image: "/images/village-one.jpg", zone: "forest" },
  { id: "village-two", label: "Village Two", image: "/images/village-two-updated.jpg", zone: "forest" },
  { id: "background-three", label: "Background 3", image: "/images/background-three.jpg", zone: "city" },
  { id: "background-four", label: "Background 4", image: "/images/background-four.jpg", zone: "city" },
];

export const backgroundMeta = (id: BackgroundId): BackgroundMeta => BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];

export interface ZoneMeta {
  id: SkirmishZone;
  name: string;
  tagline: string;
  emoji: string;
  hazard: string;
  bgGradient: string;
  accent: string;
  description: string;
  /** optional painted preview of the arena */
  image?: string;
}

export const ZONES: ZoneMeta[] = [
  {
    id: "forest",
    name: "Sambisa Forest",
    tagline: "Village One · Village Two",
    emoji: "🌲",
    hazard: "Open Sand & Ambush from the Huts",
    bgGradient: "from-amber-900 via-yellow-950 to-ink-950",
    accent: "text-emerald-300",
    description: "The classic combat theatre. Golden sand, baobabs and acacias, thatched-hut villages and smoke rising on the horizon.",
    image: "/images/village-one.jpg",
  },
  {
    id: "city",
    name: "City Center",
    tagline: "Urban Warzone & Rooftops",
    emoji: "🏙️",
    hazard: "Crossfire & Neon Billboards",
    bgGradient: "from-blue-950 via-slate-900 to-ink-950",
    accent: "text-cyan-300",
    description: "Concrete skyscrapers with glowing windows, steel construction cranes, and street barricades.",
    image: "/images/background-three.jpg",
  },
  {
    id: "hideout",
    name: "Desert Hideout",
    tagline: "Underground Bunker & Sand Dunes",
    emoji: "🏜️",
    hazard: "Sandstorms & Heavy Artillery",
    bgGradient: "from-amber-950 via-slate-900 to-ink-950",
    accent: "text-amber-300",
    description: "Heavily fortified military bunker surrounded by sand dunes, radar antennas, and ammo crates.",
  },
];

export interface CombatantBattleStats {
  id: string;
  name: string;
  avatarFace: string;
  gender: Gender;
  isPlayer: boolean;
  isTeammate: boolean;
  damageInflicted: number;
  damageReceived: number;
  kills: number;
  deaths: number;
  netScore: number;
}

export interface LobbyBot {
  id: string;
  name: string;
  avatarFace: string;
  gender: Gender;
  level: number;
}

/** Male operative pool — Blue Squad in gender-sorted matchmaking. */
export const MALE_LOBBY_BOTS: LobbyBot[] = [
  { id: "vex", name: "Vex_Reaper", avatarFace: "🤖", gender: "male", level: 48 },
  { id: "bram", name: "Bram_Havoc", avatarFace: "🐨", gender: "male", level: 41 },
  { id: "rex", name: "Rex_Blitz", avatarFace: "🐸", gender: "male", level: 37 },
  { id: "zed", name: "Zed_Striker", avatarFace: "🐲", gender: "male", level: 52 },
  { id: "otto", name: "Otto_Breach", avatarFace: "🐻", gender: "male", level: 44 },
  { id: "dash", name: "Dash_Magnum", avatarFace: "🐢", gender: "male", level: 33 },
];

/** Female operative pool — Red Squad in gender-sorted matchmaking. */
export const FEMALE_LOBBY_BOTS: LobbyBot[] = [
  { id: "nova", name: "Nova_Vixen", avatarFace: "🦊", gender: "female", level: 46 },
  { id: "juno", name: "Juno_Valkyrie", avatarFace: "🦄", gender: "female", level: 51 },
  { id: "kite", name: "Kite_Sniper", avatarFace: "🐼", gender: "female", level: 54 },
  { id: "lumi", name: "Lumi_Siren", avatarFace: "🦁", gender: "female", level: 39 },
  { id: "cleo", name: "Cleo_Widow", avatarFace: "🐱", gender: "female", level: 43 },
  { id: "skye", name: "Skye_Talon", avatarFace: "🦅", gender: "female", level: 36 },
];

const blankStats = {
  damageInflicted: 0,
  damageReceived: 0,
  kills: 0,
  deaths: 0,
  netScore: 0,
};

function pickBots(pool: LobbyBot[], count: number, seed: number): LobbyBot[] {
  const arr = pool.slice();
  // deterministic shuffle so a lobby is stable per matchmaking tick
  let s = seed || 1;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, count);
}

/** Builds a lobby whose human operatives match the player's selected fighter. */
export function buildGenderSortedLobby(
  playerName: string,
  playerGender: Gender,
  format: BattleFormat,
  seed = Date.now(),
): CombatantBattleStats[] {
  const player: CombatantBattleStats = {
    id: "player",
    name: playerName || "You",
    avatarFace: playerGender === "female" ? "👩‍🚀" : "👨‍🚀",
    gender: playerGender,
    isPlayer: true,
    isTeammate: true,
    ...blankStats,
  };
  const samePool = playerGender === "male" ? MALE_LOBBY_BOTS : FEMALE_LOBBY_BOTS;

  if (format === "1v1") {
    const [rival] = pickBots(samePool, 1, seed);
    return [
      player,
      {
        id: rival.id,
        name: rival.name,
        avatarFace: rival.avatarFace,
        gender: rival.gender,
        isPlayer: false,
        isTeammate: false,
        ...blankStats,
      },
    ];
  }

  const [mate] = pickBots(samePool, 1, seed + 7);
  const rivals = pickBots(samePool.filter((bot) => bot.id !== mate.id), 2, seed + 131);
  return [
    player,
    {
      id: mate.id,
      name: mate.name,
      avatarFace: mate.avatarFace,
      gender: mate.gender,
      isPlayer: false,
      isTeammate: true,
      ...blankStats,
    },
    ...rivals.map((r) => ({
      id: r.id,
      name: r.name,
      avatarFace: r.avatarFace,
      gender: r.gender,
      isPlayer: false,
      isTeammate: false,
      ...blankStats,
    })),
  ];
}

export const teamLabelFor = (gender: Gender) => (gender === "male" ? "♂ Male Squad" : "♀ Female Squad");

export interface BattleResult {
  matchDurationSec: number;
  format: BattleFormat;
  zone: SkirmishZone;
  playerWon: boolean;
  playerNetScore: number;
  mvp: CombatantBattleStats;
  combatants: CombatantBattleStats[];
  mmrDelta: number;
}
