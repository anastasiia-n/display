/**
 * Munich S-Bahn & U-Bahn Departure Board
 *
 * Loaded directly via `<script src="app.js" defer>` (no build step, works over `file://`
 * and static HTTP) while exporting pure helpers via CommonJS for Node verification tests.
 *
 * URL Query Parameters:
 * - `?filter=<rule>,<rule>,...`
 *     Comma-separated OR-rules using grammar: `[<station>[~<walkMin>]:][<line>][:<east|west>][@<stop>]`
 *     Examples: `east`, `S1:west,S8:east`, `S1@Flughafen`, `Hbf~13:U2@Sendlinger Tor`
 * - `?rows=<1..25>`  Number of departure rows to display (default 9; auto-scales typography/padding)
 * - `?title=<text>`  Custom heading & page `<title>` override
 * - `?debug=1`       Show the parsed filter rule pill in the header subtitle
 *
 * Dual-Backend Architecture (`dbf.finalrewind.org` v3):
 * - DB IRIS-TTS (`/<station>.json?rt=1&detailed=1&version=3`): S-Bahn & regional/long-distance rail
 * - MVV EFA (`/<station>.json?efa=MVV&rt=1&detailed=1&version=3`): MVG U-Bahn, Tram & Bus
 * Rules targeting the same `(station, backend)` share one HTTP request; polling backs off from
 * 30s to 60s when multiple endpoints are active to respect DBF's <= 1 req/station/min guideline.
 */

// ============================================================================
// 1. Configuration & Munich Transit Constants
// ============================================================================

const DBF_BASE_URL = 'https://dbf.finalrewind.org';

const DEFAULT_CUSTOM_WALK_MINUTES = 15;
const PAST_CUTOFF_MS = 30 * 60 * 1_000; // >30m ago -> next-day post-midnight departure
const FUTURE_WRAP_MS = 18 * 60 * 60 * 1_000; // >18h ahead -> delayed pre-midnight departure

const MISSED_LEAVE_CUTOFF_MIN = -3; // Hide once >3m past optimal walk departure
const RUN_NOW_THRESHOLD_MIN = -2; // -3m..-2m -> "RUN NOW"; -1m..0m -> "LEAVE NOW"

const DEFAULT_MAX_ROWS = 9;
const MIN_ROWS = 1;
const MAX_ALLOWED_ROWS = 25;

const CLOCK_INTERVAL_MS = 1_000;
const UI_COUNTDOWN_TICK_MS = 15_000;
const SINGLE_ENDPOINT_REFRESH_MS = 30_000;
const MULTI_ENDPOINT_REFRESH_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;
const STALE_DATA_THRESHOLD_MS = 120_000;

const SBAHN_LINE_RE = /^S(\d{1,2})?$/;
const UBAHN_LINE_RE = /^U(\d{1,2})?$/;
const RAIL_LINE_RE = /^(?:RB|RE|IRE|ICE|IC|EC|RJX|RJ|BRB|ALX|WB)\d*$/;
const MVG_URBAN_LINE_RE = /^(?:[NX]\d{1,3}|\d{1,3})$/;

// Order matters: multi-digit prefixes (S20) must precede single-digit prefixes (S2).
const LINE_CLASS_MAP = [
  ['S20', 's20'],
  ['S1', 's1'],
  ['S2', 's2'],
  ['S3', 's3'],
  ['S4', 's4'],
  ['S5', 's5'],
  ['S6', 's6'],
  ['S7', 's7'],
  ['S8', 's8'],
  ['U1', 'u1'],
  ['U2', 'u2'],
  ['U3', 'u3'],
  ['U4', 'u4'],
  ['U5', 'u5'],
  ['U6', 'u6'],
  ['U7', 'u7'],
  ['U8', 'u8'],
];

// Numeric `efaQuery` IDs (91000006/7/8) target exact MVV stop records directly, avoiding
// EFA "Backend error: name list" disambiguation failures and separating Hbf U-Bahn/Tram
// (91000006) from Hbf DB/S-Bahn (91000100).
const STATION_PRESETS = [
  {
    id: 'hackerbruecke',
    aliases: ['hackerbruecke', 'muenchen hackerbruecke'],
    displayName: 'Hackerbrücke',
    shortName: 'Hackerbrücke',
    defaultWalkMinutes: 7,
    irisQuery: 'München Hackerbrücke',
    efaQuery: '91000007',
    isSBahnStation: true,
  },
  {
    id: 'donnersbergerbruecke',
    aliases: ['donnersbergerbruecke', 'muenchen donnersbergerbruecke'],
    displayName: 'Donnersbergerbrücke',
    shortName: 'Donnersbergerbrücke',
    defaultWalkMinutes: 10,
    irisQuery: 'München Donnersbergerbrücke',
    efaQuery: '91000008',
    isSBahnStation: true,
  },
  {
    id: 'maillingerstrasse',
    aliases: ['maillingerstrasse', 'mailingerstrasse', 'maillingerstr', 'mailingerstr'],
    displayName: 'Maillingerstraße',
    shortName: 'Maillingerstr.',
    defaultWalkMinutes: 12,
    irisQuery: 'Maillingerstraße',
    efaQuery: 'Maillingerstraße',
    isSBahnStation: false,
  },
  {
    id: 'theresienwiese',
    aliases: ['theresienwiese'],
    displayName: 'Theresienwiese',
    shortName: 'Theresienwiese',
    defaultWalkMinutes: 14,
    irisQuery: 'Theresienwiese',
    efaQuery: 'Theresienwiese',
    isSBahnStation: false,
  },
  {
    id: 'hbf',
    aliases: ['hbf', 'hauptbahnhof', 'muenchen hbf', 'muenchen hauptbahnhof'],
    displayName: 'Hauptbahnhof',
    shortName: 'Hbf',
    defaultWalkMinutes: 15,
    irisQuery: 'München Hbf',
    efaQuery: '91000006',
    isSBahnStation: true,
  },
];

const DEFAULT_STATION = STATION_PRESETS[0];

const KNOWN_CUSTOM_SBAHN_STATIONS = new Set([
  'pasing',
  'muenchen pasing',
  'laim',
  'muenchen laim',
  'hirschgarten',
  'muenchen hirschgarten',
  'karlsplatz',
  'stachus',
  'muenchen karlsplatz',
  'marienplatz',
  'muenchen marienplatz',
  'isartor',
  'muenchen isartor',
  'rosenheimer platz',
  'muenchen rosenheimer platz',
  'ostbahnhof',
  'muenchen ost',
  'leuchtenbergring',
  'muenchen leuchtenbergring',
  'berg am laim',
  'muenchen berg am laim',
  'giesing',
  'muenchen giesing',
  'moosach',
  'muenchen moosach',
  'heimeranplatz',
  'mittersendling',
  'obermenzing',
]);

// Neither DB IRIS nor MVV EFA provides cardinal direction flags; we infer east/west along
// the Munich S-Bahn Stammstrecke trunk from the first matching downstream corridor stop.
const EAST_ANCHORS = [
  'muenchen hbf',
  'muenchen hauptbahnhof',
  'hauptbahnhof',
  'karlsplatz',
  'marienplatz',
  'isartor',
  'rosenheimer platz',
  'ostbahnhof',
  'muenchen ost',
  'leuchtenbergring',
  'berg am laim',
  'giesing',
];

const WEST_ANCHORS = [
  'donnersbergerbruecke',
  'hirschgarten',
  'laim',
  'pasing',
  'heimeranplatz',
  'mittersendling',
  'moosach',
  'obermenzing',
];

// Cross-backend stop name equivalence groups (e.g., DB IRIS uses "München Ost" and
// "München Karlsplatz", while MVV EFA uses "Ostbahnhof", "Karlsplatz (Stachus)", and
// spells U1 Maillingerstraße as "Mailingerstraße" in route arrays).
const STOP_SYNONYM_GROUPS = [
  ['ostbahnhof', 'muenchen ost'],
  ['hbf', 'hauptbahnhof', 'muenchen hbf', 'muenchen hauptbahnhof'],
  ['karlsplatz', 'stachus', 'muenchen karlsplatz'],
  ['maillingerstrasse', 'mailingerstrasse'],
];

// ============================================================================
// 2. Text & Token Normalization
// ============================================================================

function normalizeText(raw) {
  if (raw == null) return '';
  return String(raw)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[-–—/(),.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLine(raw) {
  if (!raw) return '';
  return String(raw).replace(/\s+/g, '').toUpperCase();
}

function isDirectionToken(token) {
  const norm = normalizeText(token);
  return norm === 'east' || norm === 'west';
}

function isLineToken(token) {
  if (!token || token.includes('~')) return false;
  const compact = normalizeLine(token);
  return (
    SBAHN_LINE_RE.test(compact) ||
    UBAHN_LINE_RE.test(compact) ||
    RAIL_LINE_RE.test(compact) ||
    MVG_URBAN_LINE_RE.test(compact)
  );
}

// DB IRIS concatenates category and line name ("S S8", "RB RB16"); normalize S/U lines
// to compact MVV form ("S8", "U2") and collapse doubled regional prefixes ("RB 16").
function formatLineName(rawName) {
  if (!rawName) return '';
  return String(rawName)
    .trim()
    .replace(/^S\s*(?:S\s*)?(\d{1,2})\b/i, 'S$1')
    .replace(/^U\s*(\d{1,2})\b/i, 'U$1')
    .replace(/^(RB|RE)\s+\1\s*/i, '$1 ')
    .replace(/\s+/g, ' ');
}

function getLineClass(lineName) {
  if (!lineName) return 's-default';
  const compactTokens = String(lineName)
    .toUpperCase()
    .replace(/\b([SU])\s+(\d{1,2})\b/g, '$1$2')
    .trim()
    .split(/\s+/);

  const match = LINE_CLASS_MAP.find(([prefix]) => compactTokens.includes(prefix));
  return match ? match[1] : 's-default';
}

function formatDestinationName(rawDest) {
  if (!rawDest) return '';
  let text = String(rawDest).trim();

  if (/^m(?:ü|ue)nchen[\s-]+ost(?:bahnhof)?$/i.test(text)) {
    return 'Ostbahnhof';
  }
  if (/^m(?:ü|ue)nchen[\s-]+hbf(?:\s*\(tief\))?$/i.test(text)) {
    return 'Hauptbahnhof';
  }

  // Strip redundant leading "München-" / "München " prefixes and DB regional suffixes
  // like "(Oberbay)" or "(b München)" so S-Bahn rows match MVV station signage.
  text = text.replace(/^M(?:ü|ue)nchen(?:-[\s]*|\s+)(?=\S)/i, '');
  text = text.replace(/\s*\((?:Oberbay|Obb|b\s+[^)]+)\)\s*$/i, '');

  return text.trim();
}

// ============================================================================
// 3. URL Filter Grammar & Endpoint Grouping
// ============================================================================

function resolveStation(rawStationToken) {
  if (!rawStationToken || !rawStationToken.trim()) {
    return {
      ...DEFAULT_STATION,
      walkMinutes: DEFAULT_STATION.defaultWalkMinutes,
      customWalk: false,
    };
  }

  const tildeIdx = rawStationToken.indexOf('~');
  const rawName = (tildeIdx >= 0 ? rawStationToken.slice(0, tildeIdx) : rawStationToken).trim();
  const rawWalkStr = tildeIdx >= 0 ? rawStationToken.slice(tildeIdx + 1).trim() : '';
  const parsedWalk = rawWalkStr !== '' ? Number(rawWalkStr) : NaN;
  const hasCustomWalk = Number.isFinite(parsedWalk) && parsedWalk >= 0;
  const customWalkMinutes = hasCustomWalk ? Math.round(parsedWalk) : null;

  const normName = normalizeText(rawName);
  if (!normName) {
    return {
      ...DEFAULT_STATION,
      walkMinutes: hasCustomWalk ? customWalkMinutes : DEFAULT_STATION.defaultWalkMinutes,
      customWalk: hasCustomWalk,
    };
  }

  const preset = STATION_PRESETS.find((p) => p.aliases.includes(normName));
  if (preset) {
    return {
      ...preset,
      walkMinutes: hasCustomWalk ? customWalkMinutes : preset.defaultWalkMinutes,
      customWalk: hasCustomWalk,
    };
  }

  // Map custom "Ostbahnhof" / "Stachus" queries to DB IRIS's official station names
  let irisQuery = rawName;
  if (normName === 'ostbahnhof') irisQuery = 'München Ost';
  else if (normName === 'stachus' || normName === 'karlsplatz') irisQuery = 'München Karlsplatz';

  return {
    id: normName.replace(/\s+/g, '_'),
    aliases: [normName],
    displayName: rawName,
    shortName: rawName,
    defaultWalkMinutes: DEFAULT_CUSTOM_WALK_MINUTES,
    walkMinutes: hasCustomWalk ? customWalkMinutes : DEFAULT_CUSTOM_WALK_MINUTES,
    customWalk: hasCustomWalk,
    irisQuery,
    efaQuery: rawName,
    isSBahnStation: KNOWN_CUSTOM_SBAHN_STATIONS.has(normName),
  };
}

function selectBackend(rule) {
  if (rule.line) {
    const line = normalizeLine(rule.line);
    if (SBAHN_LINE_RE.test(line) || RAIL_LINE_RE.test(line)) {
      return 'iris';
    }
    return 'efa';
  }
  return rule.station.isSBahnStation ? 'iris' : 'efa';
}

// Parses `[<station>[~<walkMin>]:][<line>][:<dir>][@<stop>]`.
// Positional disambiguation before `@`:
// - 1 token:  `<dir>` ("east") | `<line>` ("S8", "U2") | `<station>` ("Hbf")
// - 2 tokens: `<line>:<dir>` ("S1:west") | `<station>:<dir>` ("Hbf:east") | `<station>:<line>` ("Hbf:U2")
// - 3 tokens: `<station>:<line>:<dir>` ("Donnersbergerbruecke:S1:west")
function parseSingleRule(rawRule) {
  const trimmed = rawRule.trim();
  if (!trimmed) return null;

  const atIndex = trimmed.indexOf('@');
  const beforeAt = (atIndex >= 0 ? trimmed.slice(0, atIndex) : trimmed).trim();
  const rawStop = atIndex >= 0 ? trimmed.slice(atIndex + 1).trim() : '';

  let rawStation = '';
  let rawLine = '';
  let rawDir = '';

  const parts = beforeAt ? beforeAt.split(':').map((p) => p.trim()) : [];

  if (parts.length === 1) {
    const [p0] = parts;
    if (isDirectionToken(p0)) {
      rawDir = p0;
    } else if (isLineToken(p0)) {
      rawLine = p0;
    } else {
      rawStation = p0;
    }
  } else if (parts.length === 2) {
    const [p0, p1] = parts;
    if (isDirectionToken(p1)) {
      rawDir = p1;
      if (isLineToken(p0)) {
        rawLine = p0;
      } else {
        rawStation = p0;
      }
    } else {
      rawStation = p0;
      rawLine = p1;
    }
  } else if (parts.length >= 3) {
    rawStation = parts[0];
    rawLine = parts[1];
    rawDir = parts[2];
  }

  const station = resolveStation(rawStation);
  const line = rawLine ? normalizeLine(rawLine) : null;
  const direction = isDirectionToken(rawDir) ? normalizeText(rawDir) : null;
  const stop = rawStop ? normalizeText(rawStop) : null;

  const rule = {
    raw: trimmed,
    station,
    line,
    direction,
    stop,
  };
  rule.backend = selectBackend(rule);
  return rule;
}

function parseFilterRules(filterParam = '') {
  const segments = String(filterParam || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const parsed = segments.map(parseSingleRule).filter(Boolean);

  if (parsed.length === 0) {
    const station = resolveStation('');
    const defaultRule = {
      raw: '',
      station,
      line: null,
      direction: null,
      stop: null,
      isDefault: true,
    };
    defaultRule.backend = selectBackend(defaultRule);
    return [defaultRule];
  }

  return parsed;
}

function buildEndpointUrl(station, backend) {
  if (backend === 'efa') {
    const query = encodeURIComponent(station.efaQuery);
    return `${DBF_BASE_URL}/${query}.json?efa=MVV&rt=1&detailed=1&version=3`;
  }
  const query = encodeURIComponent(station.irisQuery);
  return `${DBF_BASE_URL}/${query}.json?rt=1&detailed=1&version=3`;
}

function groupRulesByEndpoint(rules) {
  const groups = new Map();

  for (const rule of rules) {
    const key = `${rule.station.id}__${rule.backend}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        station: rule.station,
        backend: rule.backend,
        url: buildEndpointUrl(rule.station, rule.backend),
        rules: [],
      });
    }
    groups.get(key).rules.push(rule);
  }

  return Array.from(groups.values());
}

// ============================================================================
// 4. Route, Stop & Direction Resolution (EFA + IRIS)
// ============================================================================

function isCancelledItem(item) {
  if (!item || typeof item !== 'object') return false;
  return Boolean(item.isCancelled || item.is_cancelled || item.cancelled);
}

function isStopCancelled(stop) {
  if (!stop || typeof stop !== 'object') return false;
  if (isCancelledItem(stop)) return true;
  // MVV EFA marks stops beyond a short-turn terminal with arr_delay = "-9999"
  // (while the short-turn terminal itself keeps a real arrival delay and dep_delay = "-9999").
  return (
    String(stop.arr_delay) === '-9999' &&
    (stop.dep_delay == null || String(stop.dep_delay) === '-9999')
  );
}

function getStopName(stop) {
  if (!stop) return '';
  if (typeof stop === 'string') return stop;
  return stop.name || stop.full_name || '';
}

function expandStopSynonyms(normTarget) {
  const targets = new Set([normTarget]);
  for (const group of STOP_SYNONYM_GROUPS) {
    if (group.some((term) => normTarget === term || normTarget.includes(term))) {
      for (const term of group) {
        targets.add(term);
      }
    }
  }
  return Array.from(targets);
}

// Centralized Munich stop matcher guarding against substring collisions:
// - West-end "Laim" must not match east-end "Berg am Laim" (or U5 "Laimer Platz").
// - Bare "Hbf" / "Hauptbahnhof" must match Munich Hbf, not "Augsburg Hbf" / "Hannover Hauptbahnhof".
// - Bare "Muenchen Ost" matches on word boundary.
function matchesSingleStopTerm(normStop, term) {
  if (!normStop || !term) return false;

  if (term === 'hbf' || term === 'hauptbahnhof') {
    return (
      normStop === 'hbf' ||
      normStop === 'hauptbahnhof' ||
      normStop.startsWith('hauptbahnhof ') ||
      normStop.includes('muenchen hbf') ||
      normStop.includes('muenchen hauptbahnhof')
    );
  }
  if (term === 'muenchen ost') {
    return /\bmuenchen ost\b/.test(normStop);
  }
  if (term === 'laim' || term === 'muenchen laim') {
    if (/\bberg am laim\b/.test(normStop)) return false;
    return /\blaim\b/.test(normStop);
  }

  return normStop.includes(term);
}

function matchesStopWithSynonyms(stopName, rawTarget) {
  const normStop = normalizeText(stopName);
  const normTarget = normalizeText(rawTarget);
  if (!normStop || !normTarget) return false;

  const variants = expandStopSynonyms(normTarget);
  return variants.some((variant) => matchesSingleStopTerm(normStop, variant));
}

function matchesStationStop(stopName, station) {
  const aliases = station.aliases || [station.displayName];
  return aliases.some((alias) => matchesStopWithSynonyms(stopName, alias));
}

function partitionStops(stops) {
  const liveStops = [];
  const cancelledStops = [];
  for (const stop of stops) {
    const name = getStopName(stop);
    if (!name) continue;
    if (isStopCancelled(stop)) {
      cancelledStops.push(name);
    } else {
      liveStops.push(name);
    }
  }
  return {
    hasRoute: true,
    terminatesHere: liveStops.length === 0,
    liveStops,
    cancelledStops,
  };
}

function getRemainingLiveStops(departure, station) {
  // MVV EFA provides `next_route` already sliced strictly after the queried station.
  if (Array.isArray(departure.next_route)) {
    return partitionStops(departure.next_route);
  }

  // DB IRIS provides full `route` from origin to destination; slice strictly after `station`.
  if (Array.isArray(departure.route) && departure.route.length > 0) {
    const stationIdx = departure.route.findIndex((s) =>
      matchesStationStop(getStopName(s), station),
    );

    if (stationIdx >= 0 && isStopCancelled(departure.route[stationIdx])) {
      return {
        hasRoute: true,
        terminatesHere: true,
        liveStops: [],
        cancelledStops: departure.route.map(getStopName).filter(Boolean),
      };
    }

    const afterSlice =
      stationIdx >= 0 ? departure.route.slice(stationIdx + 1) : departure.route;
    return partitionStops(afterSlice);
  }

  return {
    hasRoute: false,
    terminatesHere: false,
    liveStops: departure.destination ? [departure.destination] : [],
    cancelledStops: [],
  };
}

function detectDirection(departure, station, routeInfo) {
  for (const stopName of routeInfo.liveStops) {
    const normStop = normalizeText(stopName);
    if (!normStop) continue;

    if (EAST_ANCHORS.some((anchor) => matchesSingleStopTerm(normStop, anchor))) {
      return 'east';
    }
    if (WEST_ANCHORS.some((anchor) => matchesSingleStopTerm(normStop, anchor))) {
      return 'west';
    }
  }

  // Hackerbrücke has a single Stammstrecke island platform: Gleis 1 = eastbound, Gleis 2 = westbound.
  if (!routeInfo.hasRoute && station.id === 'hackerbruecke') {
    const plat = String(departure.scheduledPlatform || departure.platform || '').trim();
    if (plat === '1') return 'east';
    if (plat === '2') return 'west';
  }

  return null;
}

function isDestinationCancelled(rawDest, routeInfo) {
  if (!rawDest || !routeInfo.hasRoute || routeInfo.cancelledStops.length === 0) {
    return false;
  }
  return routeInfo.cancelledStops.some((cs) => matchesStopWithSynonyms(cs, rawDest));
}

function matchesStop(departure, routeInfo, ruleStop) {
  if (!ruleStop) return true;

  const candidateStops = [...routeInfo.liveStops];
  if (departure.destination && !isDestinationCancelled(departure.destination, routeInfo)) {
    candidateStops.push(departure.destination);
  }

  return candidateStops.some((stopName) => matchesStopWithSynonyms(stopName, ruleStop));
}

function matchesLine(departure, ruleLine) {
  if (!ruleLine) return true;
  const target = normalizeLine(ruleLine);
  if (!target) return true;

  const raw = String(departure.line || departure.train || '');
  const depCompact = normalizeLine(formatLineName(raw));
  const rawTokens = raw
    .trim()
    .split(/\s+/)
    .map((t) => normalizeLine(t))
    .filter(Boolean);

  if (target === 'S') {
    return /^S\d+$/.test(depCompact) || rawTokens.includes('S');
  }
  if (target === 'U') {
    return /^U\d+$/.test(depCompact);
  }

  return depCompact === target || rawTokens.includes(target);
}

function matchesRule(departure, rule, routeInfo) {
  if (!matchesLine(departure, rule.line)) return false;

  if (rule.direction) {
    const dir = detectDirection(departure, rule.station, routeInfo);
    if (dir !== rule.direction) return false;
  }

  if (rule.stop && !matchesStop(departure, routeInfo, rule.stop)) {
    return false;
  }

  return true;
}

// ============================================================================
// 5. Time, Delay & Walk Countdown Calculation
// ============================================================================

function formatTime(date) {
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseMinutesOfDay(hhmm) {
  if (typeof hhmm !== 'string' || !/^\d{1,2}:\d{2}$/.test(hhmm.trim())) return null;
  const [h, m] = hhmm.trim().split(':').map(Number);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function extractDelayAndTimes(departure) {
  // MVV EFA v3 provides Unix epoch timestamps in seconds.
  if (
    departure.sched_datetime != null ||
    departure.datetime != null ||
    departure.rt_datetime != null
  ) {
    const schedSec = Number(
      departure.sched_datetime ?? departure.datetime ?? departure.rt_datetime,
    );
    const actualSec = Number(
      departure.rt_datetime ?? departure.datetime ?? departure.sched_datetime,
    );

    if (!Number.isFinite(schedSec) || !Number.isFinite(actualSec) || actualSec <= 0) {
      return { delay: 0, schedTime: '', actualDate: null };
    }

    const schedDate = new Date(schedSec * 1_000);
    const actualDate = new Date(actualSec * 1_000);
    const rawDelay = Number(departure.delay);
    const computedDelay = Math.round((actualSec - schedSec) / 60);
    const delay =
      Number.isFinite(rawDelay) && rawDelay > 0
        ? rawDelay
        : Math.max(0, computedDelay);

    return {
      delay,
      schedTime: formatTime(schedDate),
      actualDate,
    };
  }

  // DB IRIS pure terminating arrival at its final station has scheduledDeparture === null.
  if (
    'scheduledDeparture' in departure &&
    departure.scheduledDeparture === null &&
    !departure.sched_dep &&
    !departure.time
  ) {
    return { delay: 0, schedTime: '', actualDate: null };
  }

  const schedCandidate =
    departure.sched_dep || departure.scheduledDeparture || departure.time || '';
  const schedTime = parseMinutesOfDay(schedCandidate) !== null ? schedCandidate.trim() : '';

  let delay = 0;
  const explicitDelay =
    departure.delayDeparture ?? departure.dep_delay ?? departure.delay ?? null;

  if (explicitDelay !== null && explicitDelay !== '') {
    const numericDelay = Number(explicitDelay);
    if (Number.isFinite(numericDelay) && numericDelay > 0) {
      delay = Math.round(numericDelay);
    }
  } else if (schedTime && departure.rt_dep) {
    const schedMins = parseMinutesOfDay(schedTime);
    const rtMins = parseMinutesOfDay(departure.rt_dep);
    if (schedMins !== null && rtMins !== null) {
      const diff = (rtMins - schedMins + 1_440) % 1_440;
      if (diff > 0 && diff < 720) {
        delay = diff;
      }
    }
  }

  return { delay, schedTime, actualDate: null };
}

function calculateTimes(
  schedStr,
  delayMin = 0,
  walkMinutes = DEFAULT_STATION.defaultWalkMinutes,
  now = new Date(),
  actualDateOverride = null,
) {
  let actualDep = actualDateOverride ? new Date(actualDateOverride) : null;

  if (!actualDep) {
    const schedMins = parseMinutesOfDay(schedStr);
    if (schedMins === null) {
      return {
        leaveStr: '--:--',
        actualDepStr: '--:--',
        tag: '',
        isUrgent: false,
        isPast: true,
        minsLeft: -Infinity,
        minsToDep: -Infinity,
        leaveTimestamp: Infinity,
        depTimestamp: Infinity,
      };
    }

    const hours = Math.floor(schedMins / 60);
    const minutes = schedMins % 60;
    actualDep = new Date(now);
    actualDep.setHours(hours, minutes + (Number(delayMin) || 0), 0, 0);

    if (actualDep.getTime() < now.getTime() - PAST_CUTOFF_MS) {
      actualDep.setDate(actualDep.getDate() + 1);
    } else if (actualDep.getTime() > now.getTime() + FUTURE_WRAP_MS) {
      actualDep.setDate(actualDep.getDate() - 1);
    }
  }

  const depTimestamp = actualDep.getTime();
  const leaveTimestamp = depTimestamp - walkMinutes * 60_000;
  const minsToDep = Math.round((depTimestamp - now.getTime()) / 60_000);
  const minsLeft = minsToDep - walkMinutes;

  if (minsLeft < MISSED_LEAVE_CUTOFF_MIN) {
    return {
      leaveStr: '--:--',
      actualDepStr: formatTime(actualDep),
      tag: '',
      isUrgent: false,
      isPast: true,
      minsLeft,
      minsToDep,
      leaveTimestamp,
      depTimestamp,
    };
  }

  const leaveDate = new Date(leaveTimestamp);
  let tag = `in ${minsLeft}m`;
  let isUrgent = false;

  if (minsLeft <= RUN_NOW_THRESHOLD_MIN) {
    tag = 'RUN NOW';
    isUrgent = true;
  } else if (minsLeft <= 0) {
    tag = 'LEAVE NOW';
    isUrgent = true;
  }

  return {
    leaveStr: formatTime(leaveDate),
    actualDepStr: formatTime(actualDep),
    tag,
    isUrgent,
    isPast: false,
    minsLeft,
    minsToDep,
    leaveTimestamp,
    depTimestamp,
  };
}

// ============================================================================
// 6. Departure Processing, Deduplication & Scaling
// ============================================================================

function resolveEffectiveDestination(departure, routeInfo) {
  const rawDest = departure.destination || '';
  if (!isDestinationCancelled(rawDest, routeInfo)) {
    return formatDestinationName(rawDest);
  }
  const lastLive = routeInfo.liveStops[routeInfo.liveStops.length - 1];
  return formatDestinationName(lastLive || rawDest);
}

function processEndpointDepartures(rawDepartures, endpointGroup, now = new Date()) {
  const results = [];

  for (const d of rawDepartures || []) {
    if (isCancelledItem(d)) continue;

    const routeInfo = getRemainingLiveStops(d, endpointGroup.station);
    if (routeInfo.terminatesHere) continue;

    const matchedRules = endpointGroup.rules.filter((rule) =>
      matchesRule(d, rule, routeInfo),
    );
    if (matchedRules.length === 0) continue;

    // If multiple rules match the same departure with different `~walkMin` overrides,
    // use the shortest walk lead time configured for that station.
    const chosenRule = matchedRules.reduce((best, curr) =>
      curr.station.walkMinutes < best.station.walkMinutes ? curr : best,
    );

    const { delay, schedTime, actualDate } = extractDelayAndTimes(d);
    const timing = calculateTimes(
      schedTime,
      delay,
      chosenRule.station.walkMinutes,
      now,
      actualDate,
    );
    if (timing.isPast) continue;

    const lineName = formatLineName(d.line || d.train || '');
    const destination = resolveEffectiveDestination(d, routeInfo);

    results.push({
      ...d,
      station: chosenRule.station,
      schedTime,
      delay,
      lineName,
      destination,
      timing,
    });
  }

  return results;
}

function deduplicateDepartures(departures) {
  const seen = new Set();
  const unique = [];

  for (const item of departures) {
    const stationId = item.station ? item.station.id : 'default';
    const key = `${stationId}_${item.timing.actualDepStr}_${normalizeLine(item.lineName)}_${item.destination}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

function mergeAndSortDepartures(departures, maxRows = DEFAULT_MAX_ROWS) {
  const sorted = [...departures].sort(
    (a, b) =>
      a.timing.leaveTimestamp - b.timing.leaveTimestamp ||
      a.timing.depTimestamp - b.timing.depTimestamp,
  );
  return deduplicateDepartures(sorted).slice(0, maxRows);
}

// Above 9 rows, `padScale` shrinks slightly faster (`* 0.9`) than `fontScale` because fixed
// 2px row borders do not scale down inside `body { overflow: hidden }`. Below 9 rows,
// `fontScale` is damped and capped at `1.2` so columns never collide horizontally.
function resolveRowConfig(rawRows) {
  const parsed =
    rawRows != null && String(rawRows).trim() !== '' ? Number(rawRows) : NaN;
  const rows = Number.isFinite(parsed)
    ? Math.min(MAX_ALLOWED_ROWS, Math.max(MIN_ROWS, Math.round(parsed)))
    : DEFAULT_MAX_ROWS;

  const ratio = DEFAULT_MAX_ROWS / rows;
  let fontScale = 1;
  let padScale = 1;

  if (rows > DEFAULT_MAX_ROWS) {
    fontScale = Number(ratio.toFixed(3));
    padScale = Number((ratio * 0.9).toFixed(3));
  } else if (rows < DEFAULT_MAX_ROWS) {
    fontScale = Number(Math.min(1.2, 1 + (ratio - 1) * 0.4).toFixed(3));
    padScale = Number(Math.min(1.35, 1 + (ratio - 1) * 0.5).toFixed(3));
  }

  return { rows, fontScale, padScale };
}

function getDistinctStationContexts(rules) {
  const map = new Map();
  for (const rule of rules) {
    const key = `${rule.station.id}__${rule.station.walkMinutes}`;
    if (!map.has(key)) {
      map.set(key, rule.station);
    }
  }
  return Array.from(map.values());
}

function resolveHeaderState(rules, rawFilter = '', customTitle = '') {
  const trimmedTitle = String(customTitle || '').trim();
  const contexts = getDistinctStationContexts(rules);
  const isUnfilteredDefault = rules.length === 1 && Boolean(rules[0].isDefault);
  const filterLabel = isUnfilteredDefault
    ? ''
    : rules.map((r) => r.raw).filter(Boolean).join(', ') || String(rawFilter || '').trim();

  if (contexts.length === 1) {
    const st = contexts[0];
    const isHackerbrueckeSBahn =
      st.id === DEFAULT_STATION.id && rules.every((r) => r.backend === 'iris');
    const subtitleText = isHackerbrueckeSBahn
      ? `${st.walkMinutes} min walk to ${st.displayName} S-Bahn`
      : `${st.walkMinutes} min to ${st.displayName}`;
    return {
      pageTitle: trimmedTitle || `Munich ${st.displayName} Departures`,
      heading: trimmedTitle || `Munich ${st.displayName}`,
      subtitleText,
      filterLabel,
    };
  }

  const summary = contexts
    .map((st) => `${st.shortName} (${st.walkMinutes}m)`)
    .join(' \u00b7 ');
  return {
    pageTitle: trimmedTitle || 'Munich Departures',
    heading: trimmedTitle || 'Munich Departures',
    subtitleText: summary,
    filterLabel,
  };
}

// ============================================================================
// 7. DOM Rendering, Polling Loop & Exports
// ============================================================================

function createSpan(className, text) {
  const span = document.createElement('span');
  span.className = className;
  span.textContent = text;
  return span;
}

function applyRowScale(rowConfig) {
  const root = document.documentElement;
  if (!root) return;
  root.style.setProperty('--font-scale', String(rowConfig.fontScale));
  root.style.setProperty('--pad-scale', String(rowConfig.padScale));
}

function updateHeader(
  rules,
  rawFilter,
  customTitle = '',
  showFilterPill = false,
  staleSince = null,
) {
  const titleEl = document.getElementById('board-title');
  const subtitleEl = document.getElementById('board-subtitle');
  if (!titleEl || !subtitleEl) return;

  const state = resolveHeaderState(rules, rawFilter, customTitle);
  document.title = state.pageTitle;
  titleEl.textContent = state.heading;
  subtitleEl.replaceChildren(document.createTextNode(state.subtitleText));

  if (showFilterPill && state.filterLabel) {
    subtitleEl.append(createSpan('filter-pill', state.filterLabel));
  }
  if (staleSince) {
    subtitleEl.append(
      createSpan('stale-pill', `Offline \u00b7 updated ${formatTime(staleSince)}`),
    );
  }
}

function createDepartureRow(item, showStationBadge) {
  const { schedTime, delay, lineName, timing, destination, station } = item;
  const tr = document.createElement('tr');

  const leaveTd = document.createElement('td');
  leaveTd.className = 'col-leave';
  leaveTd.append(document.createTextNode(`${timing.leaveStr} `));
  if (timing.tag) {
    const tagClass = timing.isUrgent ? 'leave-tag urgent' : 'leave-tag';
    leaveTd.append(createSpan(tagClass, timing.tag));
  }

  const depTd = document.createElement('td');
  depTd.className = 'col-dep';
  depTd.append(document.createTextNode(`${timing.actualDepStr} `));
  if (delay > 0) {
    depTd.append(createSpan('delay-badge', `+${delay} min`));
    if (timing.actualDepStr !== schedTime) {
      depTd.append(document.createTextNode(' '));
      depTd.append(createSpan('sched-sub', schedTime));
    }
  }

  const lineTd = document.createElement('td');
  lineTd.className = 'col-line';
  lineTd.append(createSpan(`badge ${getLineClass(lineName)}`, lineName));

  const destTd = document.createElement('td');
  destTd.className = 'col-dest';
  if (showStationBadge && station) {
    const wrap = document.createElement('div');
    wrap.className = 'dest-wrap';
    wrap.append(
      createSpan('dest-name', destination || ''),
      createSpan('station-badge', station.shortName),
    );
    destTd.append(wrap);
  } else {
    destTd.append(createSpan('dest-name', destination || ''));
  }

  tr.append(leaveTd, depTd, lineTd, destTd);
  return tr;
}

function createEmptyRow() {
  const tr = document.createElement('tr');
  tr.className = 'empty-row';
  const td = document.createElement('td');
  td.colSpan = 4;
  td.className = 'empty-state';
  td.textContent = 'No matching upcoming departures';
  tr.append(td);
  return tr;
}

function renderBoard(departures, showStationBadge) {
  const board = document.getElementById('board');
  if (!board) return;

  if (departures.length === 0) {
    board.replaceChildren(createEmptyRow());
    return;
  }

  board.replaceChildren(
    ...departures.map((item) => createDepartureRow(item, showStationBadge)),
  );
}

function updateClock() {
  const clockEl = document.getElementById('clock');
  if (!clockEl) return;
  const formatted = formatTime(new Date());
  if (clockEl.textContent !== formatted) {
    clockEl.textContent = formatted;
  }
}

async function fetchEndpointGroup(group) {
  const options =
    typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
      ? { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }
      : undefined;

  const response = await fetch(group.url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${group.url}`);
  }
  const data = await response.json();
  if (data && data.error) {
    throw new Error(`API error for ${group.url}: ${data.error}`);
  }
  return data.departures || [];
}

function init() {
  const params = new URLSearchParams(window.location.search);
  const rawFilter = params.getAll('filter').join(',');
  const customTitle = params.get('title') || '';
  const showFilterPill = params.get('debug') === '1';
  const rowConfig = resolveRowConfig(params.get('rows'));
  const rules = parseFilterRules(rawFilter);
  const endpointGroups = groupRulesByEndpoint(rules);
  const contexts = getDistinctStationContexts(rules);
  const showStationBadge = contexts.length > 1;

  // Cache latest successful raw payload per endpoint so countdowns age smoothly between
  // 60s multi-endpoint polls and transient network failures surface a staleness indicator.
  const cachedPayloads = new Map();
  let lastUpdatedAt = null;
  let isFetching = false;

  applyRowScale(rowConfig);
  updateHeader(rules, rawFilter, customTitle, showFilterPill, null);

  function renderFromCache() {
    if (cachedPayloads.size === 0) return;
    const now = new Date();
    const merged = [];
    for (const group of endpointGroups) {
      const rawDeps = cachedPayloads.get(group.key);
      if (rawDeps) {
        merged.push(...processEndpointDepartures(rawDeps, group, now));
      }
    }
    const visibleDepartures = mergeAndSortDepartures(merged, rowConfig.rows);
    renderBoard(visibleDepartures, showStationBadge);

    const isStale =
      lastUpdatedAt !== null &&
      now.getTime() - lastUpdatedAt.getTime() > STALE_DATA_THRESHOLD_MS;
    updateHeader(
      rules,
      rawFilter,
      customTitle,
      showFilterPill,
      isStale ? lastUpdatedAt : null,
    );
  }

  async function pollEndpoints() {
    if (isFetching) return;
    isFetching = true;
    try {
      const settled = await Promise.allSettled(
        endpointGroups.map((group) => fetchEndpointGroup(group)),
      );

      let fulfilledCount = 0;
      settled.forEach((result, index) => {
        const group = endpointGroups[index];
        if (result.status === 'fulfilled') {
          fulfilledCount += 1;
          cachedPayloads.set(group.key, result.value);
        } else {
          console.error(`Fetch error (${group.key}):`, result.reason);
        }
      });

      if (fulfilledCount > 0) {
        lastUpdatedAt = new Date();
      }
      renderFromCache();
    } finally {
      isFetching = false;
    }
  }

  updateClock();
  setInterval(updateClock, CLOCK_INTERVAL_MS);
  setInterval(renderFromCache, UI_COUNTDOWN_TICK_MS);

  pollEndpoints();
  const refreshMs =
    endpointGroups.length > 1 ? MULTI_ENDPOINT_REFRESH_MS : SINGLE_ENDPOINT_REFRESH_MS;
  setInterval(pollEndpoints, refreshMs);
}

const isNodeCommonJS = typeof module !== 'undefined' && Boolean(module.exports);

if (typeof document !== 'undefined' && !isNodeCommonJS) {
  init();
}

if (isNodeCommonJS) {
  module.exports = {
    normalizeText,
    normalizeLine,
    parseFilterRules,
    resolveStation,
    selectBackend,
    groupRulesByEndpoint,
    isCancelledItem,
    isStopCancelled,
    getRemainingLiveStops,
    detectDirection,
    matchesStop,
    matchesLine,
    matchesRule,
    extractDelayAndTimes,
    calculateTimes,
    processEndpointDepartures,
    mergeAndSortDepartures,
    deduplicateDepartures,
    formatLineName,
    formatDestinationName,
    getLineClass,
    resolveHeaderState,
    resolveRowConfig,
  };
}
