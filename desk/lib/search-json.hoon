::  search-json: json conversions for the %search agent
::
::    identity fields are spelled the way clients already spell them —
::    "chat/~zod/general" for a nest, "~zod/notebook" for a notebook —
::    so a result can be routed without re-deriving anything.
::
/-  sr=search
/+  sl=search
|%
++  enjs
  =,  enjs:format
  |%
  ++  nest
    |=  n=nest:v1:sr
    ^-  json
    s+(rap 3 kind.n '/' (scot %p host.n) '/' name.n ~)
  ::
  ++  book
    |=  b=book:v1:sr
    ^-  json
    s+(rap 3 (scot %p ship.b) '/' name.b ~)
  ::
  ++  whom
    |=  w=whom:v1:sr
    ^-  json
    ?-  -.w
      %ship  s+(scot %p p.w)
      %club  s+(scot %uv p.w)
    ==
  ::
  ++  mid
    |=  m=mid:v1:sr
    ^-  json
    (pairs ~[['ship' s+(scot %p ship.m)] ['time' s+(scot %da time.m)]])
  ::
  ++  target
    |=  t=target:v1:sr
    ^-  json
    ?-  -.t
        %channel
      %+  frond  'channel'
      %-  pairs
      :~  ['nest' (nest nest.t)]
          ['post' s+(scot %da post.t)]
          ['reply' ?~(reply.t ~ s+(scot %da u.reply.t))]
      ==
    ::
        %chat
      %+  frond  'chat'
      %-  pairs
      :~  ['whom' (whom whom.t)]
          ['id' (mid id.t)]
          ['reply' ?~(reply.t ~ (mid u.reply.t))]
      ==
    ::
        %note
      %+  frond  'note'
      (pairs ~[['book' (book book.t)] ['id' (numb id.t)]])
    ==
  ::
  ++  source
    |=  s=source:v1:sr
    ^-  json
    s+s
  ::
  ++  doc
    |=  d=doc:v1:sr
    ^-  json
    %-  pairs
    :~  ['target' (target target.d)]
        ['source' (source (owner:sl target.d))]
        ['title' s+title.d]
        ['context' s+context.d]
        ['snippet' s+snippet.d]
        ['author' ?~(author.d ~ s+(scot %p u.author.d))]
        ['time' s+(scot %da time.d)]
    ==
  ::
  ++  hit
    |=  h=hit:v1:sr
    ^-  json
    (pairs ~[['doc' (doc doc.h)] ['score' (numb score.h)]])
  ::
  ++  result
    |=  r=result:v1:sr
    ^-  json
    %-  pairs
    :~  ['query' s+query.r]
        ['hits' a+(turn hits.r hit)]
        ['total' (numb total.r)]
        ['skip' (numb skip.r)]
    ==
  ::
  ++  status
    |=  s=status:v1:sr
    ^-  json
    %-  pairs
    :~  ['docs' (numb docs.s)]
        ['keys' (numb keys.s)]
        ['pending' (numb pending.s)]
        ['lastIndexed' s+(scot %da last-indexed.s)]
    ==
  --
::
++  dejs
  =,  dejs:format
  |%
  ++  ship-rule  ;~(pfix sig fed:ag)
  ++  club-rule  (cook |=(@ `@uv`+<) ;~(pfix (jest '0v') viz:ag))
  ::
  ++  nest  `$-(json nest:v1:sr)`(su ;~((glue fas) sym ship-rule sym))
  ++  book  `$-(json book:v1:sr)`(su ;~((glue fas) ship-rule sym))
  ::
  ++  whom
    ^-  $-(json whom:v1:sr)
    %-  su
    ;~  pose
      (stag %ship ship-rule)
      (stag %club club-rule)
    ==
  ::
  ++  mid
    ^-  $-(json mid:v1:sr)
    (ot ~[[%ship (se %p)] [%time (se %da)]])
  ::
  ++  target
    ^-  $-(json target:v1:sr)
    %-  of
    :~  :-  %channel
        (ot ~[[%nest nest] [%post (se %da)] [%reply (mu (se %da))]])
        :-  %chat
        (ot ~[[%whom whom] [%id mid] [%reply (mu mid)]])
        :-  %note
        (ot ~[[%book book] [%id ni]])
    ==
  ::
  ++  entry
    ^-  $-(json entry:v1:sr)
    %-  ot
    :~  [%target target]
        [%title so]
        [%context so]
        [%text so]
        [%author (mu (se %p))]
        [%time (se %da)]
    ==
  ::
  ++  source
    ^-  $-(json source:v1:sr)
    (su (perk %channels %chat %notes ~))
  ::
  ++  action
    ^-  $-(json action:v1:sr)
    %-  of
    :~  [%touch (ot ~[[%entries (ar entry)]])]
        [%erase (ot ~[[%targets (ar target)]])]
        [%rebuild (ot ~[[%sources (as source)]])]
        [%wipe (ot ~[[%source source]])]
        [%reset ul]
    ==
  --
--
