::  Story -> Markdown for migration. Preserve every typed content variant;
::  native references remain readable references, never silently disappear.
/-  s=story, cite
/+  text=harness-tlon-story
|%
++  escape
  |=  raw=@t
  ^-  @t
  %+  rap  3
  %+  turn  (trip raw)
  |=  c=@t
  ?:  =('&' c)  '&amp;'
  ?:  =('<' c)  '&lt;'
  ?:  =('>' c)  '&gt;'
  ?:  (lien (trip '\\`*_{}[]()#+-.!|~') |=(x=@t =(x c)))  (cat 3 '\\' c)
  c
++  url
  |=  raw=@t
  ^-  @t
  ?>  &((gth (met 3 raw) 0) (lte (met 3 raw) 4.096))
  ?>  !(lien (trip raw) |=(c=@t |((lte c 32) =(c 127) =(c '\\'))))
  %+  rap  3
  %+  turn  (trip raw)
  |=  c=@t
  ?:  =('<' c)  '%3C'
  ?:  =('>' c)  '%3E'
  ?:  =('(' c)  '%28'
  ?:  =(')' c)  '%29'
  ?:  =('"' c)  '%22'
  c
++  fence
  |=  raw=@t
  ^-  @t
  =/  chars  (trip raw)
  =/  run=@ud  0
  =/  longest=@ud  2
  |-
  ?~  chars  (crip (reap +(longest) '`'))
  =/  next  ?:(=('`' i.chars) +(run) 0)
  $(chars t.chars, run next, longest (max longest next))
++  prefixed
  |=  [prefix=@t body=@t]
  (rap 3 (turn (split-lines:text (trip body)) |=(line=@t (rap 3 prefix line '\0a' ~))))
++  inlines
  |=  [items=(list inline:s) depth=@ud]
  ^-  @t
  ?>  (lte depth 64)
  ?~  items  ''
  =/  node  i.items
  =/  one=@t
    ?@  node  (escape node)
    ?-  -.node
      %bold  (rap 3 '**' (inlines p.node +(depth)) '**' ~)
      %italics  (rap 3 '*' (inlines p.node +(depth)) '*' ~)
      %strike  (rap 3 '~~' (inlines p.node +(depth)) '~~' ~)
      %blockquote  (prefixed '> ' (inlines p.node +(depth)))
        ?(%inline-code %code)
      =/  marks  (fence p.node)
      (rap 3 marks ' ' p.node ' ' marks ~)
      %ship  (scot %p p.node)
      %sect  (rap 3 '@' ?~(p.node 'all' p.node) ~)
      %block  (escape (rap 3 q.node ' [block ' (scot %ud p.node) ']' ~))
      %tag  (escape (cat 3 '#' p.node))
      %link  (rap 3 '[' (escape q.node) '](' (url p.node) ')' ~)
      %task  (rap 3 ?:(p.node '[x] ' '[ ] ') (inlines q.node +(depth)) ~)
      %break  '  \0a'
    ==
  (cat 3 one $(items t.items))
++  listing
  |=  [node=listing:s depth=@ud]
  ^-  @t
  ?>  (lte depth 32)
  ?:  ?=(%item -.node)  (inlines p.node 0)
  =/  intro  (inlines r.node 0)
  =/  children
    %+  turn  q.node
    |=  child=listing:s
    =/  body  (listing child +(depth))
    =/  lines  (split-lines:text (trip body))
    ?~  lines  ''
    =/  prefix  ?:(=(%ordered p.node) '1. ' '- ')
    (rap 3 prefix i.lines '\0a' (rap 3 (turn t.lines |=(line=@t (rap 3 '   ' line '\0a' ~)))) ~)
  (rap 3 intro ?:(=('' intro) '' '\0a') (rap 3 children) ~)
++  markdown
  |=  value=story:s
  ^-  @t
  %+  rap  3
  %+  turn  value
  |=  verse=verse:s
  =/  one=@t
    ?:  ?=(%inline -.verse)  (inlines p.verse 0)
    =/  block  p.verse
    ?-  -.block
      %image  (rap 3 '![' (escape alt.block) '](' (url src.block) ')' ~)
      %cite  (rap 3 '`' (spat (print:cite cite.block)) '`' ~)
        %header
      =/  count  (sub (rsh [3 1] p.block) '0')
      (rap 3 (crip (reap count '#')) ' ' (inlines q.block 0) ~)
      %listing  (listing p.block 0)
      %rule  '---'
        %code
      =/  marks  (fence code.block)
      ::  A malformed language label is rejected, not allowed to break out.
      ?>  !(lien (trip lang.block) |=(c=@t |((lte c 32) =(c '`'))))
      (rap 3 marks lang.block '\0a' code.block '\0a' marks ~)
      %link  (rap 3 '<' (url url.block) '>' ~)
    ==
  (cat 3 one '\0a\0a')
--
