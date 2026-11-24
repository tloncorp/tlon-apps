::  Pure hierarchy operations. No provider, storage, tool or JSON authority.
/-  l=harness-lcm
|%
++  fanout  4
::  Condense a contiguous run, never nodes separated by another depth. This
::  preserves chronology and bounds both the prompt and the number of edges.
++  group
  |=  forest=forest:l
  ^-  (list @ud)
  =/  remaining  roots.forest
  =|  reversed-run=(list @ud)
  =|  depth=(unit @ud)
  |-  ^-  (list @ud)
      ?~  remaining  ~
      =/  node  (~(got by nodes.forest) i.remaining)
      =.  reversed-run  ?:(=(depth `depth.node) [id.node reversed-run] ~[id.node])
      ?:  =(fanout (lent reversed-run))  (flop reversed-run)
      $(remaining t.remaining, depth `depth.node)
++  text
  |=  [forest=forest:l ids=(list @ud)]
  ^-  @t
  %+  rap  3
  %+  turn  ids
  |=  id=@ud
  =/  node  (~(got by nodes.forest) id)
  %+  rap  3
  :~  '[LCM node '  (scot %ud id)  ', depth '  (scot %ud depth.node)
      '; use lcm_expand for original sources]\0a'  body.node  '\0a\0a'
  ==
++  render
  |=  forest=forest:l
  ^-  (unit @t)
  ?~  roots.forest  ~
  `(text forest roots.forest)
::  Validate exact, ordered roots before replacing them. Reject duplicate
::  identity and forward edges, making cycles impossible even on replay.
++  append
  |=  [forest=forest:l id=@ud body=@t sources=(list @ud) children=(list @ud)]
  ^-  (unit forest:l)
  ?:  |((~(has by nodes.forest) id) =('' body) &(?=(~ sources) ?=(~ children)))  ~
  ?:  (lien sources |=(at=@ud |(=(0 at) (gte at id))))  ~
  ?:  (lien children |=(child=@ud |((gte child id) !(~(has by nodes.forest) child))))  ~
  =/  depth=@ud
    ?~  children  0
    +((roll (turn children |=(child=@ud depth:(~(got by nodes.forest) child))) max))
  =/  roots=(unit (list @ud))
    ?~  children  `(snoc roots.forest id)
    =/  remaining  roots.forest
    =|  reversed-prefix=(list @ud)
    |-  ^-  (unit (list @ud))
        ?~  remaining  ~
        ?:  =(i.children i.remaining)
          ?.  =(children (scag (lent children) `(list @ud)`remaining))  ~
          `(weld (flop reversed-prefix) [id (slag (lent children) `(list @ud)`remaining)])
        $(remaining t.remaining, reversed-prefix [i.remaining reversed-prefix])
  ?~  roots  ~
  `[(~(put by nodes.forest) id [id depth body sources children]) u.roots]
::  Old checkpoints keep their original prose and replay semantics. Preserve
::  their recoverable edges; the very oldest opaque summary may have none.
++  legacy
  |=  [forest=forest:l id=@ud body=@t sources=(list @ud)]
  ^-  forest:l
  =/  added  (append forest id body sources roots.forest)
  ?^  added  u.added
  [(~(put by nodes.forest) id [id 0 body sources roots.forest]) ~[id]]
--
