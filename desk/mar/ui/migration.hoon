/-  u=ui, g=groups
|_  mig=migration:u
++  grad  %noun
++  grow
  |%
  ++  noun  mig
  ++  json
    =,  enjs:format
    |^
    %-  pairs
    :~  chat/(imported chat-imports.mig)
        heap/(imported heap-imports.mig)
        diary/(imported diary-imports.mig)
        wait/a/(turn wait.mig ship)
    ==
    ++  imported
      |=  =imported:u
      %-  pairs
      %+  turn  ~(tap by imported)
      |=  [f=flag:g imp=?]
      [(rap 3 (scot %p p.f) '/' q.f ~) b/imp]
    --
  --
++  grab
  |%
  ++  noun  migration:u
  --
--
