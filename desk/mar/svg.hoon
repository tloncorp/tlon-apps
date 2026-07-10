::  svg: SVG markup, kept as a raw @t. Used so static .svg assets can be
::  imported with /* and served directly (the agent sets the content-type).
::
|_  txt=@t
++  grow
  |%
  ++  noun  txt
  ++  mime  [/image/svg (as-octs:mimes:html txt)]
  --
++  grab
  |%
  ++  noun  @t
  ++  mime  |=([p=mite q=octs] (@t q.q))
  --
++  grad  %noun
--
