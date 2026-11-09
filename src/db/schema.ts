import { index, integer, pgTable, primaryKey, serial, timestamp, varchar } from "drizzle-orm/pg-core";

/** Registered fighters (callsign + gender + avatar). */
export const players = pgTable("players", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 24 }).notNull(),
  email: varchar("email", { length: 254 }).unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  gender: varchar("gender", { length: 8 }).notNull().default("male"),
  face: varchar("face", { length: 8 }).notNull().default("🧑‍🚀"),
  /** all-time best Journey XP */
  sambisaHighscore: integer("sambisa_highscore").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Every ranked Journey run. Leaderboards are computed from these rows per period. */
export const scores = pgTable(
  "scores",
  {
    id: serial("id").primaryKey(),
    playerId: varchar("player_id", { length: 64 })
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    xp: integer("xp").notNull(),
    kills: integer("kills").notNull().default(0),
    zone: varchar("zone", { length: 16 }).notNull().default("forest"),
    mode: varchar("mode", { length: 16 }).notNull().default("journey"),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scores_player_idx").on(t.playerId), index("scores_created_idx").on(t.createdAt), index("scores_xp_idx").on(t.xp)],
);

/** Battle-mode (unranked) match history, kept for the profile record. */
export const battles = pgTable("battles", {
  id: serial("id").primaryKey(),
  playerId: varchar("player_id", { length: 64 })
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  format: varchar("format", { length: 8 }).notNull(),
  zone: varchar("zone", { length: 16 }).notNull(),
  won: integer("won").notNull().default(0),
  netScore: integer("net_score").notNull().default(0),
  mmrDelta: integer("mmr_delta").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Player = typeof players.$inferSelect;
export type Score = typeof scores.$inferSelect;

/** Opaque login sessions; only a SHA-256 hash of the browser token is stored. */
export const sessions = pgTable("sessions", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  playerId: varchar("player_id", { length: 64 }).notNull().references(() => players.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("sessions_player_idx").on(t.playerId)]);

/** Non-personal billboard delivery events for the configured campaign. */
export const adEvents = pgTable("ad_events", {
  id: serial("id").primaryKey(),
  campaign: varchar("campaign", { length: 80 }).notNull(),
  kind: varchar("kind", { length: 16 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Four server-rotated creatives for each city billboard. */
export const billboardCreatives = pgTable("billboard_creatives", {
  slot: integer("slot").notNull(),
  creativeIndex: integer("creative_index").notNull(),
  image: varchar("image_url", { length: 2048 }).notNull().default(""),
  video: varchar("video_url", { length: 2048 }).notNull().default(""),
  destination: varchar("destination_url", { length: 2048 }).notNull().default(""),
  title: varchar("title", { length: 80 }).notNull().default(""),
  campaign: varchar("campaign_id", { length: 80 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.slot, t.creativeIndex] }), index("billboard_creatives_campaign_idx").on(t.campaign)]);

/** Anonymous, short-lived site presence used for the admin's online-player count. */
export const onlineVisitors = pgTable("online_visitors", {
  id: varchar("id", { length: 64 }).primaryKey(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("online_visitors_last_seen_idx").on(t.lastSeen)]);

/** One server-counted online-player sample per minute for the admin chart. */
export const onlineSamples = pgTable("online_samples", {
  minute: timestamp("minute", { withTimezone: true }).primaryKey(),
  active: integer("active").notNull(),
});
