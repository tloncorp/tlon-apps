#!/usr/bin/env python3
"""Generate packages/harness/desk/lib/harness-timezone.hoon from system tzdata.

Reads POSIX TZ footers from /usr/share/zoneinfo for every Region/City and UTC
zone, plus ICU/Intl compatibility links that browsers and mobile devices send
(for example Asia/Calcutta, Europe/Kiev, America/Buenos_Aires), verifies the
computed UTC offsets against Python's zoneinfo.ZoneInfo across Nov 2026-2029,
and writes the pure Hoon library using compact sorted cord tables (so Ford
compiles the library in milliseconds instead of minutes).
"""

from __future__ import annotations

import argparse
import calendar
import datetime as dt
import re
import subprocess
import sys
import zoneinfo
from pathlib import Path

ZONEINFO_DIR = Path("/usr/share/zoneinfo")
OUT_PATH = Path(__file__).resolve().parent.parent / "desk/lib/harness-timezone.hoon"

IANA_NAME_RE = re.compile(r"^(?:UTC|[A-Za-z]+(?:/[A-Za-z0-9_+-]+)+)$")

# ICU / Intl.supportedValuesOf('timeZone') names and common legacy aliases that
# mobile/browser clients send even when modern tzdata links them elsewhere.
EXTRA_ALIASES: dict[str, str] = {
    "Africa/Asmera": "Africa/Asmara",
    "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
    "America/Catamarca": "America/Argentina/Catamarca",
    "America/Cordoba": "America/Argentina/Cordoba",
    "America/Godthab": "America/Nuuk",
    "America/Indianapolis": "America/Indiana/Indianapolis",
    "America/Jujuy": "America/Argentina/Jujuy",
    "America/Louisville": "America/Kentucky/Louisville",
    "America/Mendoza": "America/Argentina/Mendoza",
    "Asia/Calcutta": "Asia/Kolkata",
    "Asia/Katmandu": "Asia/Kathmandu",
    "Asia/Rangoon": "Asia/Yangon",
    "Asia/Saigon": "Asia/Ho_Chi_Minh",
    "Atlantic/Faeroe": "Atlantic/Faroe",
    "Europe/Kiev": "Europe/Kyiv",
    "Pacific/Enderbury": "Pacific/Kanton",
    "Pacific/Ponape": "Pacific/Pohnpei",
    "Pacific/Truk": "Pacific/Chuuk",
    "US/Alaska": "America/Anchorage",
    "US/Aleutian": "America/Adak",
    "US/Arizona": "America/Phoenix",
    "US/Central": "America/Chicago",
    "US/Eastern": "America/New_York",
    "US/Hawaii": "Pacific/Honolulu",
    "US/Mountain": "America/Denver",
    "US/Pacific": "America/Los_Angeles",
    "Canada/Atlantic": "America/Halifax",
    "Canada/Central": "America/Winnipeg",
    "Canada/Eastern": "America/Toronto",
    "Canada/Mountain": "America/Edmonton",
    "Canada/Newfoundland": "America/St_Johns",
    "Canada/Pacific": "America/Vancouver",
}

TZ_OFFSET_RE = re.compile(r"^([+-]?)(\d+)(?::(\d{2}))?(?::(\d{2}))?$")
TZ_TRANS_RE = re.compile(r"^M(\d+)\.(\d+)\.(\d+)(?:/([+-]?\d+(?::\d{2})?(?::\d{2})?))?$")
TZ_MAIN_RE = re.compile(
    r"^(?:<[^>]+>|[A-Za-z]+)([+-]?\d+(?::\d{2})?(?::\d{2})?)"
    r"(?:(?:<[^>]+>|[A-Za-z]+)([+-]?\d+(?::\d{2})?(?::\d{2})?)?)?$"
)


def parse_hms_minutes(text: str) -> int:
    m = TZ_OFFSET_RE.match(text)
    if not m:
        raise ValueError(f"Bad offset/time: {text!r}")
    sign = -1 if m.group(1) == "-" else 1
    hours = int(m.group(2))
    mins = int(m.group(3) or "0")
    secs = int(m.group(4) or "0")
    if secs != 0:
        raise ValueError(f"Sub-minute offset unsupported: {text!r}")
    return sign * (hours * 60 + mins)


def parse_posix_tz(tz: str) -> tuple[int, tuple[int, tuple[int, int, int, int], tuple[int, int, int, int]] | None]:
    parts = tz.split(",")
    m = TZ_MAIN_RE.match(parts[0])
    if not m:
        raise ValueError(f"Cannot parse POSIX TZ: {tz!r}")
    # POSIX TZ negates the sign relative to ISO 8601 (e.g. PST8 means UTC-08:00).
    std = -parse_hms_minutes(m.group(1))
    if len(parts) == 1:
        return (std, None)
    if len(parts) != 3:
        raise ValueError(f"Unexpected POSIX TZ parts: {tz!r}")
    dst = -parse_hms_minutes(m.group(2)) if m.group(2) else std + 60
    start = parse_transition(parts[1])
    end = parse_transition(parts[2])
    return (std, (dst, start, end))


def parse_transition(spec: str) -> tuple[int, int, int, int]:
    m = TZ_TRANS_RE.match(spec)
    if not m:
        raise ValueError(f"Unsupported transition rule: {spec!r}")
    month = int(m.group(1))
    week = int(m.group(2))
    weekday = int(m.group(3))
    at_min = parse_hms_minutes(m.group(4)) if m.group(4) else 120
    return (month, week, weekday, at_min)


def transition_utc(year: int, tr: tuple[int, int, int, int], before_offset_min: int) -> dt.datetime:
    month, week, weekday, at_min = tr
    # Python calendar.weekday: Mon=0..Sun=6; POSIX/cron: Sun=0..Sat=6
    first_wday = (dt.date(year, month, 1).weekday() + 1) % 7
    dim = calendar.monthrange(year, month)[1]
    d1 = 1 + ((weekday - first_wday) % 7)
    if week == 5:
        d = d1 + 28
        if d > dim:
            d -= 7
    else:
        d = d1 + (week - 1) * 7
    base = dt.datetime(year, month, d, 0, 0, tzinfo=dt.timezone.utc)
    return base + dt.timedelta(minutes=at_min - before_offset_min)


def offset_at(
    rule: tuple[int, tuple[int, tuple[int, int, int, int], tuple[int, int, int, int]] | None],
    at: dt.datetime,
) -> int:
    std, dst_spec = rule
    if dst_spec is None:
        return std
    dst_off, start_tr, end_tr = dst_spec
    t_start = transition_utc(at.year, start_tr, std)
    t_end = transition_utc(at.year, end_tr, dst_off)
    if t_start < t_end:
        return dst_off if (t_start <= at < t_end) else std
    return dst_off if (at >= t_start or at < t_end) else std


def read_footer(zone: str) -> str:
    data = (ZONEINFO_DIR / zone).read_bytes()
    parts = data.rsplit(b"\n", 2)
    if len(parts) < 2 or not parts[-2]:
        raise ValueError(f"Missing TZif footer in {zone}")
    return parts[-2].decode("ascii")


def encode_rule(
    rule: tuple[int, tuple[int, tuple[int, int, int, int], tuple[int, int, int, int]] | None],
) -> str:
    std, dst_spec = rule
    if dst_spec is None:
        return f"{std}"
    dst_off, (sm, sw, sd, sat), (em, ew, ed, eat) = dst_spec
    return f"{std},{dst_off},{sm},{sw},{sd},{sat},{em},{ew},{ed},{eat}"


def chunk_cord(text: str, width: int = 80) -> list[str]:
    """Emit Hoon cord literal chunks joined by rap 3."""
    escaped = text.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\0a")
    chunks: list[str] = []
    i = 0
    while i < len(escaped):
        end = min(i + width, len(escaped))
        # Avoid splitting an escape sequence like \0a across chunks.
        while end > i and end < len(escaped):
            if escaped[end - 1] == "\\":
                end -= 1
            elif end >= 2 and escaped[end - 2 : end] == "\\0":
                end -= 2
            else:
                break
        chunks.append(f"'{escaped[i:end]}'")
        i = end
    return chunks


def detect_tzdata_release(override: str | None = None) -> str:
    if override:
        return override.strip()
    tzdata_zi = ZONEINFO_DIR / "tzdata.zi"
    if tzdata_zi.is_file():
        first = tzdata_zi.read_text(encoding="ascii", errors="ignore").splitlines()[:1]
        if first:
            m = re.match(r"^#\s*version\s+(\S+)", first[0])
            if m:
                return m.group(1)
    plus_version = ZONEINFO_DIR / "+VERSION"
    if plus_version.is_file():
        ver = plus_version.read_text(encoding="ascii", errors="ignore").strip()
        if ver:
            return ver
    try:
        out = subprocess.check_output(
            ["dpkg-query", "-W", "-f=${Version}", "tzdata"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        if out:
            return out.split("-", 1)[0]
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass
    raise RuntimeError(
        "Could not detect IANA tzdata release from /usr/share/zoneinfo; pass --tzdata-version"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate desk/lib/harness-timezone.hoon from system tzdata.")
    parser.add_argument("--tzdata-version", help="Override detected IANA tzdata release name (e.g. 2026e).")
    args = parser.parse_args()
    release = detect_tzdata_release(args.tzdata_version)

    zones_raw = sorted(z for z in zoneinfo.available_timezones() if IANA_NAME_RE.match(z))
    zone_rules: dict[str, tuple] = {}
    for z in zones_raw:
        if not (ZONEINFO_DIR / z).is_file():
            continue
        zone_rules[z] = parse_posix_tz(read_footer(z))

    for alias, target in sorted(EXTRA_ALIASES.items()):
        if alias not in zone_rules:
            if target not in zone_rules:
                raise KeyError(f"Alias target missing: {alias} -> {target}")
            zone_rules[alias] = zone_rules[target]

    # Verify every zone in system zoneinfo against ZoneInfo from Nov 2026 through 2029.
    mismatches: list[tuple[str, dt.datetime, int, int]] = []
    for z in zones_raw:
        if z not in zone_rules:
            continue
        zi = zoneinfo.ZoneInfo(z)
        rule = zone_rules[z]
        check_times: list[dt.datetime] = [
            dt.datetime(2026, 11, 15, 12, 0, tzinfo=dt.timezone.utc),
            dt.datetime(2026, 12, 15, 12, 0, tzinfo=dt.timezone.utc),
        ]
        for year in (2027, 2028, 2029):
            for month in (1, 3, 4, 6, 9, 10, 11, 12):
                check_times.append(dt.datetime(year, month, 15, 12, 0, tzinfo=dt.timezone.utc))
            if rule[1] is not None:
                dst_off, start_tr, end_tr = rule[1]
                for t in (transition_utc(year, start_tr, rule[0]), transition_utc(year, end_tr, dst_off)):
                    check_times.extend([t - dt.timedelta(seconds=1), t, t + dt.timedelta(seconds=1)])
        for t in check_times:
            expected = int(t.astimezone(zi).utcoffset().total_seconds() // 60)
            got = offset_at(rule, t)
            if got != expected:
                mismatches.append((z, t, expected, got))
                break

    if mismatches:
        unexpected = [
            m for m in mismatches
            if m[0] not in {"Africa/Casablanca", "Africa/El_Aaiun", "Asia/Gaza", "Asia/Hebron"}
        ]
        if unexpected:
            print("UNEXPECTED MISMATCHES:", unexpected[:10], file=sys.stderr)
            sys.exit(1)
        print(f"Verified {len(zones_raw)} zones (known Ramadan-pause footer diffs: {[m[0] for m in mismatches]})")
    else:
        print(f"Verified {len(zones_raw)} zones with 0 mismatches across Nov 2026-2029!")

    unique_rules = sorted(set(zone_rules.values()), key=lambda r: (r[0], r[1] is not None, r[1] or ()))
    rule_idx = {r: f"{i:02d}" for i, r in enumerate(unique_rules)}

    # Sorted by ASCII byte order (matches Hoon +aor for ASCII keys).
    zone_table = "\n" + "\n".join(f"{name}={rule_idx[zone_rules[name]]}" for name in sorted(zone_rules)) + "\n"
    rule_table = "\n" + "\n".join(f"{i:02d}={encode_rule(r)}" for i, r in enumerate(unique_rules)) + "\n"

    # Sanity-check our binary search table ordering in Python.
    sorted_keys = sorted(zone_rules)
    assert sorted_keys == sorted(sorted_keys, key=lambda s: s.encode("ascii"))
    print(
        f"Total zones (with aliases): {len(zone_rules)}, unique rules: {len(unique_rules)}, "
        f"zone-table: {len(zone_table)}B, rule-table: {len(rule_table)}B"
    )

    lines: list[str] = [
        "::  IANA timezone table and DST-aware calendar arithmetic. Pure data/functions.",
        f"::  Generated by packages/harness/scripts/gen-timezone-table.py from IANA tzdata {release}.",
        "/-  c=harness-cron",
        "/+  calendar=harness-cron",
        "|%",
        f"++  tzdata-release  '{release}'",
        "+$  transition  [month=@ud week=@ud weekday=@ud at=@sd]",
        "+$  dst-rule  [offset=@sd start=transition end=transition]",
        "+$  zone-rule  [std=@sd dst=(unit dst-rule)]",
        "+$  local-clock",
        "  $:  local=@t",
        "      date=@t",
        "      time=@t",
        "      offset=@t",
        "      weekday=@t",
        "      minutes=@sd",
        "  ==",
        "::  Binary search a sorted '\\0a'-delimited 'key=value' cord table.",
        "++  table-get",
        "  |=  [table=@t key=@t]",
        "  ^-  (unit @t)",
        "  ?:  |(=('' key) (gth (met 3 key) 64))  ~",
        "  =/  len=@ud  (met 3 table)",
        "  ?:  (lth len 3)  ~",
        "  =/  lo=@ud  0",
        "  =/  hi=@ud  (dec len)",
        "  |-",
        "  ?:  (gte lo hi)  ~",
        "  =/  mid=@ud  (div (add lo hi) 2)",
        "  ::  Find the '\\0a' immediately before the line covering mid.",
        "  =/  prev=@ud",
        "    =/  at=@ud  mid",
        "    |-",
        "    ?:  =(10 (cut 3 [at 1] table))  at",
        "    ?:  =(0 at)  0",
        "    $(at (dec at))",
        "  =/  start=@ud  +(prev)",
        "  ?:  (gte start hi)  ~",
        "  =/  eq=@ud",
        "    =/  at=@ud  start",
        "    |-",
        "    ?:  |(=(at hi) =(61 (cut 3 [at 1] table)))  at",
        "    $(at +(at))",
        "  =/  nl=@ud",
        "    =/  at=@ud  +(eq)",
        "    |-",
        "    ?:  |(=(at hi) =(10 (cut 3 [at 1] table)))  at",
        "    $(at +(at))",
        "  =/  cand=@t  (cut 3 [start (sub eq start)] table)",
        "  ?:  =(key cand)  `(cut 3 [+(eq) (sub nl +(eq))] table)",
        "  ?:  (aor key cand)",
        "    ?:  (lte prev lo)  ~",
        "    $(hi prev)",
        "  ?:  (gte nl hi)  ~",
        "  $(lo nl)",
        "::",
        "++  parse-sd",
        "  |=  text=@t",
        "  ^-  @sd",
        "  ?:  =('-' (cut 3 [0 1] text))",
        "    (new:si | (need (rush (rsh [3 1] text) dem)))",
        "  (new:si & (need (rush text dem)))",
        "::",
        "++  parse-rule",
        "  |=  text=@t",
        "  ^-  zone-rule",
        "  =/  parts=(list @t)  (split:calendar text ',')",
        "  ?:  =(1 (lent parts))",
        "    [(parse-sd (snag 0 parts)) ~]",
        "  :*  (parse-sd (snag 0 parts))",
        "      :-  ~",
        "      :*  (parse-sd (snag 1 parts))",
        "          :*  (need (rush (snag 2 parts) dem))",
        "              (need (rush (snag 3 parts) dem))",
        "              (need (rush (snag 4 parts) dem))",
        "              (parse-sd (snag 5 parts))",
        "          ==",
        "          :*  (need (rush (snag 6 parts) dem))",
        "              (need (rush (snag 7 parts) dem))",
        "              (need (rush (snag 8 parts) dem))",
        "              (parse-sd (snag 9 parts))",
        "          ==",
        "      ==",
        "  ==",
        "::",
        "++  valid",
        "  |=  name=@t",
        "  ^-  ?",
        "  ?=(^ (table-get zone-table name))",
        "::",
        "++  trim",
        "  |=  text=@t",
        "  ^-  @t",
        "  =/  chars=tape  (trip text)",
        "  =/  space  |=(c=@tD |(=(32 c) =(9 c) =(10 c) =(13 c)))",
        "  =/  lead",
        "    |=  t=tape",
        "    |-  ^-  tape",
        "        ?~  t  ~",
        "        ?.  (space i.t)  t",
        "        $(t t.t)",
        "  (crip (flop (lead (flop (lead chars)))))",
        "::",
        "++  lookup",
        "  |=  name=@t",
        "  ^-  (unit zone-rule)",
        "  =/  idx  (table-get zone-table name)",
        "  ?~  idx  ~",
        "  =/  spec  (table-get rule-table u.idx)",
        "  ?~  spec  ~",
        "  `(parse-rule u.spec)",
        "::",
        "++  shift",
        "  |=  [at=@da minutes=@sd]",
        "  ^-  @da",
        "  =/  parts  (old:si minutes)",
        "  =/  delta=@dr  (mul +.parts ~m1)",
        "  ?:(-.parts (add at delta) (sub at delta))",
        "::",
        "++  days-in-month",
        "  |=  [year-num=@ud month=@ud]",
        "  ^-  @ud",
        "  =/  leap=?",
        "    |(=(0 (mod year-num 400)) &(=(0 (mod year-num 4)) !=(0 (mod year-num 100))))",
        "  =/  counts=(list @ud)  ~[31 ?:(leap 29 28) 31 30 31 30 31 31 30 31 30 31]",
        "  (snag (dec month) counts)",
        "::",
        "++  weekday-of",
        "  |=  day=@da",
        "  ^-  @ud",
        "  (mod (add 6 (div (sub day ~2000.1.1) ~d1)) 7)",
        "::",
        "++  transition-utc",
        "  |=  [year-num=@ud tr=transition before=@sd]",
        "  ^-  @da",
        "  =/  first=@da  (year [[& year-num] month.tr [1 0 0 0 ~]])",
        "  =/  first-wday=@ud  (weekday-of first)",
        "  =/  delta=@ud  (mod (sub (add 7 weekday.tr) first-wday) 7)",
        "  =/  d1=@ud  +(delta)",
        "  =/  dim=@ud  (days-in-month year-num month.tr)",
        "  =/  day-num=@ud",
        "    ?:  =(5 week.tr)",
        "      =/  cand=@ud  (add d1 28)",
        "      ?:((lte cand dim) cand (sub cand 7))",
        "    (add d1 (mul (dec week.tr) 7))",
        "  =/  local-day=@da  (year [[& year-num] month.tr [day-num 0 0 0 ~]])",
        "  (shift local-day (dif:si at.tr before))",
        "::",
        "++  offset-at",
        "  |=  [rule=zone-rule at=@da]",
        "  ^-  @sd",
        "  ?~  dst.rule  std.rule",
        "  =/  year-num=@ud  y:(yore at)",
        "  ?:  (lth year-num 2.000)  std.rule",
        "  =/  t-start=@da  (transition-utc year-num start.u.dst.rule std.rule)",
        "  =/  t-end=@da  (transition-utc year-num end.u.dst.rule offset.u.dst.rule)",
        "  ?:  (lth t-start t-end)",
        "    ?:(&((gte at t-start) (lth at t-end)) offset.u.dst.rule std.rule)",
        "  ?:(|((gte at t-start) (lth at t-end)) offset.u.dst.rule std.rule)",
        "::",
        "++  pad-two",
        "  |=  number=@ud",
        "  ^-  tape",
        '  ?:  (lth number 10)  "0{(a-co:co number)}"',
        "  (a-co:co number)",
        "::",
        "++  format-offset",
        "  |=  minutes=@sd",
        "  ^-  @t",
        "  =/  parts  (old:si minutes)",
        '  =/  sign=tape  ?:(-.parts "+" "-")',
        "  =/  hours=@ud  (div +.parts 60)",
        "  =/  mins=@ud  (mod +.parts 60)",
        '  (crip "{sign}{(pad-two hours)}:{(pad-two mins)}")',
        "::",
        "++  weekday-name",
        "  |=  at=@da",
        "  ^-  @t",
        "  =/  names=(list @t)",
        "    ~['Sunday' 'Monday' 'Tuesday' 'Wednesday' 'Thursday' 'Friday' 'Saturday']",
        "  =/  day-index=@ud",
        "    ?:  (gte at ~1969.12.28)",
        "      (mod (div (sub at ~1969.12.28) ~d1) 7)",
        "    0",
        "  (snag day-index names)",
        "::",
        "++  clock",
        "  |=  [name=@t at=@da]",
        "  ^-  (unit local-clock)",
        "  =/  rule  (lookup name)",
        "  ?~  rule  ~",
        "  =/  minutes=@sd  (offset-at u.rule at)",
        "  =/  local-da=@da  (shift at minutes)",
        "  =/  =date  (yore local-da)",
        "  =/  date-part=@t",
        '    (crip "{(a-co:co y.date)}-{(pad-two m.date)}-{(pad-two d.t.date)}")',
        "  =/  time-part=@t",
        '    (crip "{(pad-two h.t.date)}:{(pad-two m.t.date)}:{(pad-two s.t.date)}")',
        "  =/  offset-text=@t  (format-offset minutes)",
        "  =/  local-iso=@t  (rap 3 date-part 'T' time-part offset-text ~)",
        "  `[local-iso date-part time-part offset-text (weekday-name local-da) minutes]",
        "::",
        "::  Resolve a local wall-clock instant to UTC in a DST-aware zone.",
        "::  Ambiguous fall-back wall times fire once on the first (earlier) occurrence.",
        "::  Nonexistent spring-forward wall times fire at the transition instant.",
        "++  resolve-wall",
        "  |=  [rule=zone-rule wall=@da]",
        "  ^-  @da",
        "  =/  u-std=@da  (shift wall (dif:si --0 std.rule))",
        "  ?~  dst.rule  u-std",
        "  =/  u-dst=@da  (shift wall (dif:si --0 offset.u.dst.rule))",
        "  =/  ok-std=?  =(std.rule (offset-at rule u-std))",
        "  =/  ok-dst=?  =(offset.u.dst.rule (offset-at rule u-dst))",
        "  ?:  &(ok-std ok-dst)  (min u-std u-dst)",
        "  ?:  ok-std  u-std",
        "  ?:  ok-dst  u-dst",
        "  =/  year-num=@ud  y:(yore wall)",
        "  =/  t-start=@da  (transition-utc year-num start.u.dst.rule std.rule)",
        "  =/  t-end=@da  (transition-utc year-num end.u.dst.rule offset.u.dst.rule)",
        "  ?:  =(--1 (cmp:si offset.u.dst.rule std.rule))  t-start",
        "  t-end",
        "::",
        "++  next-in-zone",
        "  |=  [pattern=pattern:c rule=zone-rule after=@da]",
        "  ^-  (unit @da)",
        "  ?.  (gte after ~2000.1.1)  ~",
        "  ?~  dst.rule",
        "    =/  local-after=@da  (shift after std.rule)",
        "    %+  bind  (next:calendar pattern local-after)",
        "    |=(at=@da (shift at (dif:si --0 std.rule)))",
        "  =/  local-after=@da  (shift after (offset-at rule after))",
        "  =/  =date  (yore local-after)",
        "  =.  date  date(h.t 0, m.t 0, s.t 0, f.t ~)",
        "  =/  day=@da  (year date)",
        "  =/  slots=(list @ud)",
        "    %+  skim  (gulf 0 1.439)",
        "    |=  minute=@ud",
        "    &((~(has in hours.pattern) (div minute 60)) (~(has in minutes.pattern) (mod minute 60)))",
        "  =/  days-searched=@ud  0",
        "  |-",
        "  ?:  =(1.461 days-searched)  ~",
        "  =/  found=(unit @da)",
        "    ?.  (day-matches:calendar pattern day)  ~",
        "    =/  remaining=(list @ud)  slots",
        "    |-",
        "    ?~  remaining  ~",
        "    =/  wall=@da  (add day (mul i.remaining ~m1))",
        "    =/  utc=@da  (resolve-wall rule wall)",
        "    ?:  (gth utc after)  `utc",
        "    $(remaining t.remaining)",
        "  ?^  found  found",
        "  $(days-searched +(days-searched), day (add day ~d1))",
        "::",
        "++  rule-table",
        "  ^-  @t",
        "  '''",
        rule_table.strip("\n"),
        "  '''",
        "::",
        "++  zone-table",
        "  ^-  @t",
        "  '''",
        zone_table.strip("\n"),
        "  '''",
        "--",
    ]

    # Wait: Hoon triple-quoted '''...''' strips leading/trailing newlines, so wrap with \0a!
    # Replace the ''' blocks with exact '\0a' wrapping via cat 3.
    idx_rt = lines.index("++  rule-table")
    lines = lines[:idx_rt]
    lines.extend([
        "++  rule-table",
        "  ^-  @t",
        "  %+  rap  3",
        "  :~  '\\0a'",
        "      '''",
        *[f"      {row}" for row in rule_table.strip("\n").split("\n")],
        "      '''",
        "      '\\0a'",
        "  ==",
        "::",
        "++  zone-table",
        "  ^-  @t",
        "  %+  rap  3",
        "  :~  '\\0a'",
        "      '''",
        *[f"      {row}" for row in zone_table.strip("\n").split("\n")],
        "      '''",
        "      '\\0a'",
        "  ==",
        "--",
    ])

    OUT_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_PATH} ({len(lines)} lines)")


if __name__ == "__main__":
    main()
