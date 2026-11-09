# Sambisa Fighter

The website contains secure sign-up/sign-in, profile history and weekly/monthly/all-time leaderboards. Play opens a persistent landscape city home, labeled **Somewhere in Ibadan**, with moving traffic and pedestrians. The helicopter stays parked until a mission is selected and its setup is confirmed.

## Game flow

1. **Play on the website → live city home.** There is no automatic takeoff or city timeout. All five billboards can be opened for a larger preview.
2. **Start → choose Journey or Battle over the live city → choose the map.** Journey requires an account to save ranked scores, but has **unlimited runs** with no ticket or five-play restriction. Battle uses AI opponents and is unranked.
3. If sign-in/sign-up is needed, the return URL retains the pending mission and map. Successful authentication resumes that mode's setup instead of restarting the city. Stale anonymous session responses cannot overwrite a new login.
4. After setup (and Battle matchmaking), the helicopter takes off and disappears into cloud cover before the battlefield is mounted.
5. An ended Journey or completed Battle shows results immediately; aborting a mission returns directly to City Home. The helicopter does not fly back.

The browser requests fullscreen/landscape during the Play gesture where supported. Browsers without orientation locking use a CSS-rotated landscape shell for all in-game screens. On Play, a Tomi Tech Studio loading screen remains visible until the city has rendered and all bundled city/game sounds are ready; failed asset loads show an explicit retry action. The city renderer uses antialiasing and device-scaled resolution, animated soldiers patrol the base, and pedestrians cross the flyover with non-graphic collision reactions to traffic.

## Fighter gender and sound assets

The gender selected during sign-up determines the player's fighter. Human teammates, rivals, and Journey operatives use that same selection, so choosing female displays female fighters throughout the match. Existing accounts use the gender saved on their profile.

Add audio files to `public/audio/` with these exact names:

| File | Sound | Playback |
| --- | --- | --- |
| `city-street-ambience.mp3` | Ibadan street/market ambience | Loops while the city is visible |
| `passing-cars.mp3` | Passing road traffic | Loops while the city is visible |
| `helicopter-loop.mp3` | Distant helicopter | Loops while the city is visible |
| `market-hawker.mp3` | Market hawker calls | Plays intermittently over city ambience |
| `rifle-shot.wav` | Gunfire | Plays when weapons fire |
| `drone-hit.wav` | Bullet impact on a flying bot, drone, or helicopter | Plays on a hit |
| `fighter-hit.wav` | Bullet impact on a fighter/player | Plays when a fighter takes damage |
| `dagger-throw.wav` | Dagger or bomb release/throw | Plays when a dagger or bomb is thrown |
| `missle-launch.wav` | Missile launch (filename is spelled `missle`) | Plays when a helicopter launches missiles |
| `explosion impact, missle and bomb impact.wav` | Explosion / bomb impact | Plays on bomb and explosive impacts |

Use short, clear sound effects; make the three loop tracks seamless. The hawker clip is a short one-shot, not a loop. The scheduler also looks for `danfo-conductor.mp3` for Nigerian conductor calls; that file was not among the gathered assets, so add it to `public/audio/` to provide that sound. The gathered effects listed above are already in `public/audio/`; keep their filenames exact, including the spaces and the `missle` spelling. Files are loaded from `/audio/<filename>`. Missing files are reported in the browser console. Sound starts from the **Play Now** gesture; city ambience continues while the city stays rendered beneath setup overlays and pauses when the city or tab is no longer visible.

## Five digital billboards

There are **five independent image/video placements** in the live city. Each placement supports four creatives. The server selects the creative using a shared 10-second epoch schedule; clients refresh at the next server-provided boundary rather than choosing an ad with their own clock. Each opens an in-game preview, and creatives fit within the board without being cropped. A configured campaign can have a labeled **Visit Advertiser** link. An unconfigured rotation slot shows an unsold placeholder.

Manage ads at `/admin`. Configure `ADMIN_PASSWORD` and a long random `ADMIN_SESSION_SECRET` in Netlify site environment variables, then redeploy. The admin page requires the password and creates a short-lived, HTTP-only admin session cookie. Do not use the normal player account password as the admin password.

In `/admin`, fill up to four ads for each placement. Creative URLs may be HTTPS or a local path served from `public/` (for example `/ads/creative.webp`). Landing pages must use HTTPS. A video takes priority, with the image as an optional poster. Give each active ad its own campaign ID for reporting. Empty creatives are skipped, so a placement with fewer than four active ads still rotates only among its active ads. Use responsive, landscape artwork: billboard images are fit inside the sign and are not cropped.

The admin app stores campaigns in PostgreSQL and creates its billboard, presence and chart tables on first use; the database role must be allowed to create tables and indexes. Impressions are counted after a loaded creative is at least 50% visible for one continuous second. Clicks and impressions are validated against the selected creative and stored in `ad_events`. The admin dashboard shows an online count with a 90-second presence window and a server-sampled, rolling one-hour curve. This is direct image/video placement, not a connected ad network or certified third-party measurement service.

## Netlify deployment

The repository includes `netlify.toml` with the Next.js build command, `.next` publish directory, and Node.js 22 runtime. Connect the repository to Netlify and deploy with the detected Next.js runtime. Configure `DATABASE_URL` in the Netlify site environment with a reachable PostgreSQL database whose tables match `src/db/schema.ts`; the database is required for accounts, scores, leaderboards, ad events, admin-managed ads, and online presence. Also configure `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET` before using `/admin`. Redeploy after changing environment variables. The server's database role needs table-creation privileges for the admin/presence tables created at first use.

For local development, copy `.env.example` to `.env.local` and set `DATABASE_URL` to your Supabase PostgreSQL connection string. The application currently connects to PostgreSQL server-side through `pg`; it does not yet use Supabase Auth or the Supabase anon key. Keep the database URL, password, and admin secrets in `.env.local` locally and in Netlify environment-variable settings for deployment. `.env.local` is ignored by Git. URL-encode reserved characters in database credentials before placing them in the connection URL.

## Accounts and data

Passwords use salted scrypt hashes. An opaque HTTP-only cookie identifies a server-side session. Production cookies are secure, host-bound and partitioned (`SameSite=None; Secure; Partitioned`) so sign-in also works in embedded previews. Account, profile and score writes reject foreign browser origins. Existing legacy sessions can still be read and are cleared on sign-out. Scores, profile edits and battle history are bound to that session, not a submitted player ID. PostgreSQL access uses Drizzle (`src/db/schema.ts`).

## Ibadan map data and rendering

`public/data/ibadan.json` contains a compact offline extraction of real Dugbe streets and building footprints. Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the Open Database License (ODbL). Landmarks, the flyover, footbridge and operations base are stylized game elements, not a survey-grade city replica or a representation of an actual military facility.

The city uses instanced and batched geometry, adaptive resolution and bounded flight paths. City assets are reused between menu screens; the WebGL renderer is disposed before active gameplay. A vector-animation fallback supports devices without WebGL. The fog, distant clouds and composited cloud layer hide the modeled boundary during departure. Rendering pauses in hidden tabs; frame rate remains dependent on the device and browser.
