::  search: tokenizer and inverted-index core for the %search agent
::
::    the index is a plain inverted map from normalized term to the
::    documents containing it, with a trigram side-index that supplies
::    prefix and typo tolerance. it holds no document text beyond a
::    display snippet, so it stays a fraction of the size of the corpus
::    it covers.
::
::    scoring is deliberately simple: a term's weight in a document comes
::    from where it appeared (title beats body) and how often, a match's
::    contribution comes from how it matched (exact beats substring beats
::    trigram-only), and a document that matches more of the query's
::    distinct terms always outranks one that matches fewer.
::
/-  se=search
|%
+$  card  card:agent:gall
::  weights: a term's worth inside a document
::
++  rank-title  8
++  rank-body   2
::  .rank-cap bounds repetition, so a word repeated 500 times in one
::  message can't outweigh every other document
::
++  rank-cap    64
::  weights: how much a match is worth, by how it matched
::
++  weight-exact  4
++  weight-part   2
++  weight-fuzzy  1
::  matching more of the query's distinct terms always wins, whatever the
::  per-term weights add up to
::
++  term-bonus   10.000
::  bounds on work done per query term and per stored term
::
++  fuzzy-cap    32
++  max-term     32
++  snippet-len  256
::  +owner: which agent owns a target
::
++  owner
  |=  =target:v1:se
  ^-  source:v1:se
  ?-  -.target
    %channel  %channels
    %chat     %chat
    %note     %notes
  ==
::  +word-char: does this byte continue a word?
::
::    bytes at or above 128 are utf-8 continuation or lead bytes; we keep
::    them so non-latin text survives tokenization as whole runs, which
::    the trigram index can still match into.
::
++  word-char
  |=  c=@
  ^-  ?
  ?|  &((gte c 'a') (lte c 'z'))
      &((gte c 'A') (lte c 'Z'))
      &((gte c '0') (lte c '9'))
      =(c '-')
      =(c '_')
      =(c '\'')
      (gte c 128)
  ==
::  +tokens: split text into normalized terms, in order, stopwords dropped
::
++  tokens
  |=  txt=@t
  ^-  (list key:v1:se)
  =/  cs=tape  (cass (trip txt))
  =|  cur=tape
  =|  out=(list @t)
  |-  ^-  (list @t)
  ?~  cs
    (flop (close cur out))
  ?:  (word-char i.cs)
    $(cs t.cs, cur [i.cs cur])
  $(cs t.cs, cur ~, out (close cur out))
::  +close: finish the term being accumulated, if it is worth keeping
::
++  close
  |=  [cur=tape out=(list @t)]
  ^-  (list @t)
  ?~  cur  out
  =/  term=@t  (crip (scag max-term (flop cur)))
  ?:  (~(has in stopwords) term)  out
  [term out]
::  +grams: a term's ordered trigrams
::
::    terms under three bytes have none; they are still reachable by
::    exact match, they just don't participate in fuzzy matching.
::
++  grams
  |=  term=@t
  ^-  (list gram:v1:se)
  =/  t=tape  (trip term)
  =/  len  (lent t)
  ?:  (lth len 3)  ~
  %+  turn  (gulf 0 (sub len 3))
  |=(i=@ud (crip (swag [i 3] t)))
::  +contains: is .nedl a substring of .hay?
::
++  contains
  |=  [nedl=@t hay=@t]
  ^-  ?
  !=(~ (find (trip nedl) (trip hay)))
::  +clip: truncate to .len bytes without splitting a utf-8 sequence
::
++  clip
  |=  [len=@ud txt=@t]
  ^-  @t
  =/  t=tape  (trip txt)
  ?:  (lte (lent t) len)  txt
  =/  cut=@ud
    =|  i=@ud
    |-  ^-  @ud
    ?~  t  i
    =/  wid=@ud
      ?:  (lth i.t 128)  1
      ?:  (lth i.t 224)  2
      ?:  (lth i.t 240)  3
      4
    ?:  (gth (add i wid) len)  i
    $(i (add i wid), t (slag (dec wid) t.t))
  (crip (scag cut (trip txt)))
::  +snippet: the stored display slice of a document body
::
++  snippet
  |=  txt=@t
  ^-  @t
  (clip snippet-len txt)
::  +parent-of: the post or message a reply hangs off, if this is one
::
++  parent-of
  |=  =target:v1:se
  ^-  (unit target:v1:se)
  ?-  -.target
    %channel  ?~(reply.target ~ `target(reply ~))
    %chat     ?~(reply.target ~ `target(reply ~))
    %note     ~
  ==
::  +digest: a target's index key
::
++  digest
  |=  =target:v1:se
  ^-  tid:v1:se
  (shaf %sear (jam target))
::  +dex: index operations
::
++  dex
  |_  ix=index:v1:se
  ::  +strip: retract a document and every posting that points at it
  ::
  ++  strip
    |=  =tid:v1:se
    ^+  ix
    ?~  ks=(~(get by trail.ix) tid)
      ix(docs (~(del by docs.ix) tid))
    ::  a term whose last posting just went away is dropped outright, and
    ::  its trigrams with it, so vocabulary doesn't leak as content churns
    ::
    =/  res
      =/  kl=(list key:v1:se)  ~(tap in u.ks)
      =/  ts=(map key:v1:se postings:v1:se)  terms.ix
      =/  dead=(set key:v1:se)  ~
      |-  ^-  [(map key:v1:se postings:v1:se) (set key:v1:se)]
      ?~  kl  [ts dead]
      ?~  ps=(~(get by ts) i.kl)  $(kl t.kl)
      =/  rest=postings:v1:se  (~(del by u.ps) tid)
      ?~  rest
        $(kl t.kl, ts (~(del by ts) i.kl), dead (~(put in dead) i.kl))
      $(kl t.kl, ts (~(put by ts) i.kl rest))
    =.  terms.ix  -.res
    =.  grams.ix  (shed +.res)
    =.  trail.ix  (~(del by trail.ix) tid)
    =.  docs.ix   (~(del by docs.ix) tid)
    ix
  ::  +shed: drop trigram entries for terms that no longer exist
  ::
  ++  shed
    |=  dead=(set key:v1:se)
    ^-  (jug gram:v1:se key:v1:se)
    =/  kl=(list key:v1:se)  ~(tap in dead)
    =/  gg  grams.ix
    |-  ^-  (jug gram:v1:se key:v1:se)
    ?~  kl  gg
    =/  gs=(list gram:v1:se)  (grams i.kl)
    =.  gg
      |-  ^-  (jug gram:v1:se key:v1:se)
      ?~  gs  gg
      =/  s=(set key:v1:se)  (~(del in (~(get ju gg) i.gs)) i.kl)
      ?~  s  $(gs t.gs, gg (~(del by gg) i.gs))
      $(gs t.gs, gg (~(put by gg) i.gs s))
    $(kl t.kl)
  ::  +sow: add trigram entries for newly seen terms
  ::
  ++  sow
    |=  fresh=(set key:v1:se)
    ^-  (jug gram:v1:se key:v1:se)
    =/  kl=(list key:v1:se)  ~(tap in fresh)
    =/  gg  grams.ix
    |-  ^-  (jug gram:v1:se key:v1:se)
    ?~  kl  gg
    =/  gs=(list gram:v1:se)  (grams i.kl)
    =.  gg
      |-  ^-  (jug gram:v1:se key:v1:se)
      ?~  gs  gg
      $(gs t.gs, gg (~(put ju gg) i.gs i.kl))
    $(kl t.kl)
  ::  +weigh: a document's per-term weights
  ::
  ++  weigh
    |=  [title=@t text=@t]
    ^-  (map key:v1:se rank:v1:se)
    =/  out  (tally ~ (tokens title) rank-title)
    (tally out (tokens text) rank-body)
  ::
  ++  tally
    |=  [out=(map key:v1:se rank:v1:se) ks=(list key:v1:se) w=rank:v1:se]
    ^-  (map key:v1:se rank:v1:se)
    |-
    ?~  ks  out
    =/  cur  (~(gut by out) i.ks 0)
    =/  new  ?:((gte cur rank-cap) cur (add cur w))
    $(ks t.ks, out (~(put by out) i.ks new))
  ::  +catalog: index a document, replacing any earlier version of it
  ::
  ::    a document with no indexable terms (only stopwords, punctuation or
  ::    emoji) is retracted rather than stored: nothing could ever match it.
  ::
  ++  catalog
    |=  =entry:v1:se
    ^+  ix
    =/  =tid:v1:se  (digest target.entry)
    =.  ix  (strip tid)
    =/  weights  (weigh title.entry text.entry)
    ?:  =(~ weights)  ix
    =/  ks=(set key:v1:se)  ~(key by weights)
    =/  fresh=(set key:v1:se)
      %-  silt
      %+  skim  ~(tap in ks)
      |=(k=key:v1:se !(~(has by terms.ix) k))
    =/  =doc:v1:se
      :*  target.entry
          title.entry
          context.entry
          (snippet text.entry)
          author.entry
          time.entry
      ==
    =.  docs.ix   (~(put by docs.ix) tid doc)
    =.  trail.ix  (~(put by trail.ix) tid ks)
    =/  par=(unit target:v1:se)  (parent-of target.entry)
    =?  kids.ix  ?=(^ par)  (~(put ju kids.ix) (digest u.par) tid)
    =.  terms.ix
      =/  wl=(list [k=key:v1:se r=rank:v1:se])  ~(tap by weights)
      =/  ts  terms.ix
      |-  ^-  (map key:v1:se postings:v1:se)
      ?~  wl  ts
      =/  ps=postings:v1:se  (~(gut by ts) k.i.wl ~)
      $(wl t.wl, ts (~(put by ts) k.i.wl (~(put by ps) tid r.i.wl)))
    =.  grams.ix  (sow fresh)
    ix
  ::  +retract: remove a document and every reply hanging off it
  ::
  ::    +strip alone is what a re-index wants — an edited message keeps
  ::    its replies. a deletion wants this, so the replies don't survive
  ::    as results pointing at a message that no longer exists.
  ::
  ++  retract
    |=  =tid:v1:se
    ^+  ix
    =/  par=(unit tid:v1:se)
      ?~  d=(~(get by docs.ix) tid)  ~
      ?~  p=(parent-of target.u.d)  ~
      `(digest u.p)
    =/  children=(list tid:v1:se)  ~(tap in (~(get ju kids.ix) tid))
    =.  ix       (strip tid)
    =.  kids.ix  (~(del by kids.ix) tid)
    =?  kids.ix  ?=(^ par)  (~(del ju kids.ix) u.par tid)
    |-  ^+  ix
    ?~  children  ix
    $(children t.children, ix (retract i.children))
  ::  +erase: retract a document by target
  ::
  ++  erase
    |=  =target:v1:se
    ^+  ix
    (retract (digest target))
  ::  +purge: retract every document owned by one source
  ::
  ++  purge
    |=  =source:v1:se
    ^+  ix
    =/  tl=(list tid:v1:se)
      %+  murn  ~(tap by docs.ix)
      |=  [=tid:v1:se =doc:v1:se]
      ^-  (unit tid:v1:se)
      ?.(=(source (owner target.doc)) ~ `tid)
    |-  ^+  ix
    ?~  tl  ix
    $(tl t.tl, ix (retract i.tl))
  ::  +nearby: stored terms sharing enough trigrams with .term
  ::
  ++  nearby
    |=  term=key:v1:se
    ^-  (list key:v1:se)
    =/  gs=(list gram:v1:se)  (grams term)
    =/  total  (lent gs)
    ?:  =(0 total)  ~
    =/  counts=(map key:v1:se @ud)
      =/  counts=(map key:v1:se @ud)  ~
      |-  ^+  counts
      ?~  gs  counts
      =/  ks=(list key:v1:se)  ~(tap in (~(get ju grams.ix) i.gs))
      =.  counts
        |-  ^+  counts
        ?~  ks  counts
        $(ks t.ks, counts (~(put by counts) i.ks +((~(gut by counts) i.ks 0))))
      $(gs t.gs)
    ::  a 60% trigram overlap keeps "chanel" reaching "channel" without
    ::  dragging in every term that happens to share one slice
    ::
    =/  kept=(list [k=key:v1:se n=@ud])
      %+  skim  ~(tap by counts)
      |=  [k=key:v1:se n=@ud]
      &(!=(k term) (gte (mul 10 n) (mul 6 total)))
    %+  scag  fuzzy-cap
    %+  turn
      %+  sort  kept
      |=([a=[k=key:v1:se n=@ud] b=[k=key:v1:se n=@ud]] (gth n.a n.b))
    |=([k=key:v1:se n=@ud] k)
  ::  +candidates: per-document score contribution for one query term
  ::
  ++  candidates
    |=  term=key:v1:se
    ^-  (map tid:v1:se @ud)
    =/  out=(map tid:v1:se @ud)
      %-  ~(run by (~(gut by terms.ix) term ~))
      |=(r=rank:v1:se (mul r weight-exact))
    =/  near=(list key:v1:se)  (nearby term)
    |-  ^-  (map tid:v1:se @ud)
    ?~  near  out
    =/  w=@ud  ?:((contains term i.near) weight-part weight-fuzzy)
    =/  pl=(list [p=tid:v1:se q=rank:v1:se])
      ~(tap by (~(gut by terms.ix) i.near ~))
    =.  out
      |-  ^-  (map tid:v1:se @ud)
      ?~  pl  out
      =/  cur  (~(gut by out) p.i.pl 0)
      $(pl t.pl, out (~(put by out) p.i.pl (max cur (mul q.i.pl w))))
    $(near t.near)
  ::  +seek: score every document matching .query
  ::
  ::    results are ranked by how many of the query's distinct terms the
  ::    document matched, then by score, then by recency.
  ::
  ++  seek
    |=  [query=@t src=(unit source:v1:se)]
    ^-  (list hit:v1:se)
    =/  qs=(list key:v1:se)  ~(tap in (silt (tokens query)))
    =/  acc=(map tid:v1:se [hits=@ud score=@ud])
      =/  acc=(map tid:v1:se [hits=@ud score=@ud])  ~
      |-  ^+  acc
      ?~  qs  acc
      =/  cl=(list [p=tid:v1:se q=@ud])  ~(tap by (candidates i.qs))
      =.  acc
        |-  ^+  acc
        ?~  cl  acc
        =/  cur=[hits=@ud score=@ud]  (~(gut by acc) p.i.cl [0 0])
        %=  $
          cl   t.cl
          acc  (~(put by acc) p.i.cl [+(hits.cur) (add score.cur q.i.cl)])
        ==
      $(qs t.qs)
    =/  hits=(list hit:v1:se)
      %+  murn  ~(tap by acc)
      |=  [=tid:v1:se v=[hits=@ud score=@ud]]
      ^-  (unit hit:v1:se)
      ?~  d=(~(get by docs.ix) tid)  ~
      =/  wanted=?
        ?~  src  &
        =(u.src (owner target.u.d))
      ?.  wanted  ~
      `[u.d (add (mul hits.v term-bonus) score.v)]
    %+  sort  hits
    |=  [a=hit:v1:se b=hit:v1:se]
    ?.  =(score.a score.b)  (gth score.a score.b)
    (gth time.doc.a time.doc.b)
  --
::  producer helpers
::
::    +running lets a producing agent stay quiet on ships where %search
::    isn't installed, the same way they guard their %activity pokes.
::
++  running
  |=  [our=ship now=@da]
  ^-  ?
  .^(? %gu /(scot %p our)/search/(scot %da now)/$)
::
++  submit
  |=  [our=ship =action:v1:se]
  ^-  card
  [%pass /search/submit %agent [our %search] %poke %search-action-1 !>(action)]
::
::  +stopwords: terms too common to be worth an inverted-index posting
::
::    kept as one space-separated cord rather than a list literal purely
::    for legibility; +tokens consults this once per word, so the parse
::    is memoized rather than re-run on every lookup.
::
++  stopwords
  ~+
  ^-  (set @t)
  %-  silt
  %+  rash
    ^-  @t
    %-  crip
    ;:  weld
      "a about after again all also am an and any are as at be been "
      "being both but by can could did do does doing don't down each "
      "for from had has have he her here hers him his how i if in into "
      "is it it's its just me more most my no nor not of off ok on once "
      "only or other ought our ours out over own same she should so "
      "some such than that the their them then there these they this "
      "those to too under until up very was we were what when where "
      "which while who whom why will with would yes yet you your yours"
    ==
  (more ace (cook crip (plus ;~(less ace prn))))
--
