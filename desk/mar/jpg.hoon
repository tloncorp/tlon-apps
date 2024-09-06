:: This is needed because we have a jpg in the dist
|_  dat=@
++  grow
  |%
  ++  mime  [/image/jpeg (as-octs:mimes:html dat)]
  --
++  grab
  |%
  ++  mime  |=([p=mite q=octs] q.q)
  ++  noun  @
  --
++  grad  %mime
--
