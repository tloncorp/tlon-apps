::  js: JavaScript source, kept as a raw @t. Used so static .js assets can be
::  imported with /* and served directly (the agent sets the content-type).
::
|_  txt=@t
++  grow
  |%
  ++  noun  txt
  ++  mime  [/text/javascript (as-octs:mimes:html txt)]
  --
++  grab
  |%
  ++  noun  @t
  ++  mime  |=([p=mite q=octs] (@t q.q))
  --
++  grad  %noun
--
