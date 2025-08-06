/*  sigils  %jam  /lib/sigil/sigils/jam
::  sigil-symbols: svg symbols for phonemes, for use in /lib/sigil
::
::    the map is keyed by phoneme cords and contains functions for
::    generating lists of manxes based on fore- and background colors,
::    intended to be wrapped up in an svg <g> for further processing.
::
::    shapes and default attributes sourced from:
::    https://github.com/urbit/sigil-js/blob/fdea06f/src/index.json
::
::NOTE  to reduce svg size, we exclude certain common/shared attributes.
::      we expect the /lib/sigil to wrap these elements in a <g> which sets
::      those attributes, letting them be inherited. they are as follows:
::        =fill    fg
::        =stroke  bg
::        =stroke-linecap  "square"
::        =stroke-width
::      we assume the defaults specified above, and only include those
::      attributes below if they deviate from those. (this includes adding
::      stroke="none" for elements whose original specification did not
::      include a stroke.)
::      unfortunately, the vector-effect attribute cannot be inherted by <g>
::      children, so we have to inline it for every element here.
::      for ease of change, we leave excluded attributes as comments here.
::
^~
::  to regenerate the sigil data perform the following commands on the dojo:
::  =s -build-file /=groups=/lib/sigil/sigils/hoon
::  *symbols/jam (jam s)
::  |cp %/symbols/jam /=groups=/lib/sigil/sigils/jam
::
=/  svgs=(map cord (list manx))
  !<((map cord (list manx)) [-:!>(*(map cord (list manx))) (cue sigils)])
|=  [p=cord fg=tape bg=tape]
^-  (list manx)
=/  m=(list manx)  (~(got by svgs) p)
%+  turn  m
|=  ma=manx
%=  ma
    a.g
  %+  turn  a.g.ma
  |=  [n=mane v=tape]
  ?:  =("fg" v)
    [n fg]
  ?:  =("bg" v)
    [n bg]
  [n v]
==