# fetch-event-source

This is pulled from https://github.com/gfortaine/fetch-event-source which
is a fork of https://github.com/Azure/fetch-event-source. We have since
modified it to include %eyre channel specific handling. In addition, the
way which this parses SSE events may be non-standard, but handles all
cases that this library cares about.

**Don't use generically!**
