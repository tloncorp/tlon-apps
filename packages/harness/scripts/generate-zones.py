#!/usr/bin/env python3
"""Write desk/lib/harness-zones.hoon: each IANA zone name with the UTC offset
it has on the day this runs.

The scheduler keeps one fixed offset per recurring job, and Tlon Messenger
names the owner's zone as an IANA name (Intl.DateTimeFormat's timeZone), so the
Tlon hand maps that name to an offset through this table. The system tz
database supplies every canonical zone and every backward link, which covers
the names a browser or phone can report.

    python3 scripts/generate-zones.py            from packages/harness
"""
import datetime
import pathlib
import zoneinfo

# Not zones a device reports: tzdata's placeholder and the files the database
# keeps beside the zones.
SKIP = {'Factory', 'localtime', 'posixrules'}

now = datetime.datetime.now(datetime.timezone.utc)


def offset(name):
    delta = now.astimezone(zoneinfo.ZoneInfo(name)).utcoffset()
    minutes = int(delta.total_seconds()) // 60
    sign = '-' if minutes < 0 else '+'
    hours, minutes = divmod(abs(minutes), 60)
    return f'{sign}{hours:02d}:{minutes:02d}'


names = sorted(zoneinfo.available_timezones() - SKIP)
rows = '\n'.join(f"      ['{name}' '{offset(name)}']" for name in names)
source = f"""::  IANA zone names and the UTC offset each had on {now.date().isoformat()}, written by
::  scripts/generate-zones.py from the system tz database. Generated; do not
::  edit by hand.
::
::    A recurring job keeps one fixed offset, so a job created through a
::    zone name runs an hour off once that zone changes daylight saving,
::    until this table is regenerated and the job is created again.
::
|%
::  +offset: the +HH:MM or -HH:MM offset for a zone name, or ~ for a name
::  the table does not know
::
++  offset
  |=  zone=@t
  ^-  (unit @t)
  (~(get by (malt zones)) zone)
::
++  zones
  ^-  (list [@t @t])
  :~
{rows}
  ==
--
"""
target = pathlib.Path(__file__).resolve().parent.parent / 'desk/lib/harness-zones.hoon'
target.write_text(source)
print(f'{len(names)} zones written to {target}')
