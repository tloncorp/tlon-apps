::  %volume-value: a notification configuration value
::
/+  *volume
|_  =value
++  grad  %noun
++  grow
  |%
  ++  noun  value
  ++  json
    `^json`?~(value ~ s+value)
  --
++  grab
  |%
  ++  noun  ^value
  --
--
