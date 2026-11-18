# Munich Departures Display

Zero-dependency wallboard timetable showing real-time **Munich S-Bahn** and **MVG U-Bahn / Tram / Bus** departures around **Hackerbrücke / Arnulfstraße**, sorted by **when to leave** based on each station's walking or transfer time.

**GitHub Pages URL:**
<https://anastasiia-n.github.io/display/timetable/>

---

## URL Parameters

All configuration is controlled via URL query parameters so any wall display, kiosk, or personal bookmark can customize its own view without code changes.

| Parameter | Default | Description |
| :--- | :--- | :--- |
| `filter` | *(all Hackerbrücke S-Bahns)* | Comma-separated OR-rules filtering stations, lines, directions, and downstream stops. |
| `rows` | `9` | Number of departure rows to show (`1`–`25`). Automatically scales row typography and padding to fit `100vh`. |
| `title` | Auto (`Munich Hackerbrücke` / `Munich Departures`) | Custom `<h1>` heading and browser tab title (e.g. `?title=Munich%20Airport`). |
| `debug` | *(off)* | Set `debug=1` to display the active `filter` rule pill in the header subtitle. |

---

## Filter Grammar (`?filter=...`)

`?filter=` accepts one or more **comma-separated OR-rules**. A departure is shown if it matches **any** rule.

```text
[<station>[~<walkMin>]:][<line>][:<dir>][@<stop>]
```

All matching is **case-insensitive** and **umlaut-tolerant** (`ä`↔`ae`, `ö`↔`oe`, `ü`↔`ue`, `ß`↔`ss`), so plain ASCII works cleanly in URLs without percent-encoding German characters.

### Rule Components

1. **`<station>[~<walkMin>]`** *(optional — defaults to `Hackerbrücke`, `7` min)*
   - Selects the boarding station and optionally overrides its lead time in minutes using `~<walkMin>` (for example, `Hbf~13` for a 13-minute transfer instead of the 15-minute default).
2. **`<line>`** *(optional — defaults to all lines on that station's backend)*
   - Specific line such as `S1`–`S8`, `S20`, `U1`–`U8`, `RB56`, `17`, `153`, or category wildcards `S` (all S-Bahns) / `U` (all U-Bahns).
   - Lines starting with `S` or regional rail (`RB`, `RE`, `BRB`, etc.) query **DB IRIS**; `U`-Bahn, Tram, and Bus lines query **MVV EFA**.
3. **`:<dir>`** *(optional — `east` or `west`)*
   - Matches S-Bahn direction along the Munich Stammstrecke trunk using remaining live corridor stops (falling back to Hackerbrücke Platform `1` = `east`, Platform `2` = `west` if route details are unavailable).
   - Resilient to variable end stops (e.g., `S3` ending at *Deisenhofen* vs. *Holzkirchen*) and skipped intermediate stops.
4. **`@<stop>`** *(optional — substring match on remaining live stops)*
   - Only includes departures that **actually call at `<stop>` after the boarding station** (automatically excluding cancelled stops, Südring diversions that skip downtown stops, and trains that short-turn earlier).
   - **Tip for U-Bahn directions:**
     - Use the **next trunk stop** (e.g. `Hbf:U2@Sendlinger Tor` or `Hbf:U2@Koenigsplatz`) to capture *all* trains in that direction, including short-turns.
     - Use **your exit stop** (e.g. `Hbf:U2@Feldmoching`) to automatically exclude trains that terminate earlier (such as *Harthof* short-turns).

---

## Preset Stations & Default Walk Times

| URL Alias(es) | Display Name | Default Lead Time | Approx. Distance / Mode |
| :--- | :--- | :---: | :--- |
| `hackerbruecke` *(default)* | `Hackerbrücke` | `7` min | ~550 m walk |
| `donnersbergerbruecke` | `Donnersbergerbrücke` | `10` min | ~800 m walk |
| `maillingerstrasse` | `Maillingerstraße` | `12` min | ~950 m walk (`U1` / `U7` / Bus `153`) |
| `theresienwiese` | `Theresienwiese` | `14` min | ~1.1 km walk (`U4` / `U5`) |
| `hbf`, `hauptbahnhof` | `Hauptbahnhof` | `15` min | ~1.2 km walk or S-Bahn hop + transfer |
| `<CustomName>[~<min>]` | `<CustomName>` | `15` min *(or `<min>`)* | Any other MVV / DB station (e.g. `Ostbahnhof`, `Sendlinger Tor`) |

---

## Leave-Time Urgency & Multi-Station Sorting

For each departure, `Leave Time = Actual Departure − walkMinutes` (`minsLeft = minsToDep − walkMinutes`):

- **`in Nm`** (`minsLeft >= 1`): Leave in `N` minutes.
- **`LEAVE NOW`** (`-1 <= minsLeft <= 0`, red urgent badge): Head out now to reach the platform comfortably.
- **`RUN NOW`** (`-3 <= minsLeft <= -2`, red urgent badge): Tight connection — hurry.
- **Hidden** (`minsLeft < -3`): No longer reachable on foot.

When combining stations with different lead times (such as a `7` min walk to Hackerbrücke and a `15` min walk/transfer to Hauptbahnhof U-Bahn), rows are **merged and sorted by Leave Time** (`leaveTimestamp`) so the next train you need to act on always appears at the top.

> **Rate-limit courtesy:** A single station/backend refreshes every **30 seconds**; multi-endpoint boards automatically switch to **60 seconds** (while updating on-screen countdowns every 15 seconds) to respect `dbf.finalrewind.org`'s `≤ 1 request/station/minute` guideline.

---

## Example GitHub Pages URLs

- **Default (all S-Bahns from Hackerbrücke, both directions):**
  `https://anastasiia-n.github.io/display/timetable/`

- **Eastbound toward City Center / Ostbahnhof (Hackerbrücke):**
  `https://anastasiia-n.github.io/display/timetable/?filter=east`

- **Munich Airport (S1 west + S8 east on one board, excluding short-turns):**
  `https://anastasiia-n.github.io/display/timetable/?title=Munich%20Airport&filter=S1@Flughafen,S8@Flughafen`

- **Westbound S-Bahn commuter lines (any end stop, even if skipping stops):**
  `https://anastasiia-n.github.io/display/timetable/?filter=S3:west,S4:west,S6:west,S8:west`

- **Only S-Bahns actually calling at Marienplatz (excludes Südring diversions):**
  `https://anastasiia-n.github.io/display/timetable/?filter=@Marienplatz`

- **Multi-station board: Eastbound S-Bahn (7 min) + Southbound U1/U2 from Hbf (15 min):**
  `https://anastasiia-n.github.io/display/timetable/?filter=east,Hbf:U1@Sendlinger%20Tor,Hbf:U2@Sendlinger%20Tor`

- **Custom transfer time (`~13` min) + dense 12-row layout + custom title:**
  `https://anastasiia-n.github.io/display/timetable/?rows=12&title=Way%20Home&filter=S1:west,Hbf~13:U2@Scheidplatz,Hbf~13:U5@Odeonsplatz`

- **Walkable nearby U-Bahn stations (`Maillingerstraße` U1/U7 & `Theresienwiese` U4/U5):**
  `https://anastasiia-n.github.io/display/timetable/?filter=Maillingerstrasse:U1@Rotkreuzplatz,Maillingerstrasse:U7@Rotkreuzplatz,Theresienwiese:U5@Karlsplatz`

- **Large-print 6-row view for viewing from across the floor:**
  `https://anastasiia-n.github.io/display/timetable/?rows=6&filter=east`

---

## Running Locally

No build tools or dependencies are required. Serve the folder over local HTTP (or open `index.html` directly in a browser):

```bash
python3 -m http.server 8000 --directory timetable
```

Then open `http://localhost:8000/?filter=east,Hbf:U2@Sendlinger%20Tor`.
