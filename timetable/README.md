# Munich departures display

Wallboard timetable for real-time Munich S-Bahn and MVG U-Bahn, Tram, and Bus departures around Hackerbrücke and Arnulfstraße, sorted by when you need to leave based on each station's walk time.

Live on GitHub Pages: <https://anastasiia-n.github.io/display/timetable/>

## URL parameters

| Parameter | Default | Description |
| :--- | :--- | :--- |
| `filter` | all Hackerbrücke S-Bahns | Comma-separated OR-rules for stations, lines, directions, and downstream stops. |
| `rows` | `9` | Visible departure rows (`1` to `25`). Auto-scales font size and padding to fit `100vh`. |
| `title` | Auto | Custom `<h1>` heading and page `<title>`. |
| `debug` | off | Set `debug=1` to show the active `filter` pill in the header subtitle. |

## Filter grammar (`?filter=...`)

Each comma-separated rule follows `[<station>[~<walkMin>]:][<line>][:<dir>][@<stop>]`. Matching is case-insensitive and umlaut-tolerant (`ä`/`ae`, `ö`/`oe`, `ü`/`ue`, `ß`/`ss`).

- `<station>[~<walkMin>]`: boarding station (defaults to `Hackerbrücke`, `7` min). Append `~<min>` to override the lead time, such as `Hbf~13`.
- `<line>`: line code (`S1` to `S8`, `S20`, `U1` to `U8`, `RB56`, `17`, `153`) or wildcard `S` / `U`. S-Bahn and regional rail query DB IRIS; U-Bahn, Tram, and Bus query MVV EFA.
- `:<dir>`: `east` or `west` along the S-Bahn Stammstrecke trunk (falling back to Hackerbrücke Platform `1` east / `2` west when route data is missing).
- `@<stop>`: requires the train to stop at `<stop>` after the boarding station, filtering out short-turns, cancelled stops, and Südring diversions. For U-Bahn directions, use the next trunk stop (`Hbf:U2@Sendlinger Tor`) to include short-turns, or your exit stop (`Hbf:U2@Feldmoching`) to exclude them.

## Preset stations

| Alias(es) | Display name | Default walk time | Approx. distance |
| :--- | :--- | :---: | :--- |
| `hackerbruecke` (default) | Hackerbrücke | 7 min | ~550 m |
| `donnersbergerbruecke` | Donnersbergerbrücke | 10 min | ~800 m |
| `maillingerstrasse` | Maillingerstraße | 12 min | ~950 m (`U1`, `U7`, Bus `153`) |
| `theresienwiese` | Theresienwiese | 14 min | ~1.1 km (`U4`, `U5`) |
| `hbf`, `hauptbahnhof` | Hauptbahnhof | 15 min | ~1.2 km or S-Bahn transfer |
| `<CustomName>[~<min>]` | `<CustomName>` | 15 min (or `<min>`) | Any other MVV or DB stop |

## Leave-time urgency and polling

Leave Time is `Actual Departure - walkMinutes` (`minsLeft = minsToDep - walkMinutes`): `in Nm` for `1+` min, `LEAVE NOW` at `-1` to `0` min, `RUN NOW` at `-3` to `-2` min, and hidden below `-3` min. Rows from multiple stations are merged and sorted by Leave Time.

A single endpoint polls every 30s; multiple endpoints back off to 60s (with 15s local countdown ticks) to stay within `dbf.finalrewind.org` rate limits.

## Examples

Default (all Hackerbrücke S-Bahns):
`https://anastasiia-n.github.io/display/timetable/`

Eastbound toward the city center:
`https://anastasiia-n.github.io/display/timetable/?filter=east`

Airport trains (S1 west and S8 east, excluding short-turns):
`https://anastasiia-n.github.io/display/timetable/?title=Munich%20Airport&filter=S1@Flughafen,S8@Flughafen`

Westbound commuter lines:
`https://anastasiia-n.github.io/display/timetable/?filter=S3:west,S4:west,S6:west,S8:west`

Only S-Bahns calling at Marienplatz (excludes Südring diversions):
`https://anastasiia-n.github.io/display/timetable/?filter=@Marienplatz`

Eastbound S-Bahn (7m) plus southbound U1/U2 from Hbf (15m):
`https://anastasiia-n.github.io/display/timetable/?filter=east,Hbf:U1@Sendlinger%20Tor,Hbf:U2@Sendlinger%20Tor`

Custom 13m Hbf transfer, 12 rows, and custom title:
`https://anastasiia-n.github.io/display/timetable/?rows=12&title=Way%20Home&filter=S1:west,Hbf~13:U2@Scheidplatz,Hbf~13:U5@Odeonsplatz`

Nearby U-Bahn stations (`Maillingerstraße` U1/U7 and `Theresienwiese` U5):
`https://anastasiia-n.github.io/display/timetable/?filter=Maillingerstrasse:U1@Rotkreuzplatz,Maillingerstrasse:U7@Rotkreuzplatz,Theresienwiese:U5@Karlsplatz`

Large-print 6-row view:
`https://anastasiia-n.github.io/display/timetable/?rows=6&filter=east`

## Running locally

```bash
python3 -m http.server 8000 --directory timetable
```
