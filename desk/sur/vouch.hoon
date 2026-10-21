::  vouch: shared types for the moon-classification store
::
::    tracks, per moon, whether we believe it's a real (booted) ship or a
::    synthetic bot hosted by its sponsor. %unknown is the default -- the
::    absence of a record. classification is only ever set from authority:
::    a moon seen as network .src is real (a bot never boots), and a moon's
::    sponsor is trusted to declare its own moons real. we never infer from
::    keys or routes, which a spawned-but-unbooted bot would also have.
::
|%
::  $status: what we believe a moon is; %unknown means "no record yet"
::
+$  status  $~(%unknown ?(%unknown %real %bot))
::  $known: a decided classification -- what actually gets stored
::
+$  known  ?(%real %bot)
::  $learn: payload of the %vouch-learn poke -- record .known for a moon
::
+$  learn  [=ship =known]
--
