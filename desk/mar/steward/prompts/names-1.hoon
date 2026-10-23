::  %steward-prompts-names-1: the file names a projection may carry,
::  returned by the names scry
::
::    json is the names as an array of strings, in text order
::
|_  names=(set @t)
++  grad  %noun
++  grow
  |%
  ++  noun  names
  ++  json
    :-  %a
    %+  turn  (sort ~(tap in names) aor)
    |=(name=@t s+name)
  --
++  grab
  |%
  ++  noun  (set @t)
  --
--
