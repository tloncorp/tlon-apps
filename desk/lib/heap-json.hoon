/-  h=heap
/-  meta
|%
++  enjs
  =,  enjs:format
  |%
  ++  flag
    |=  f=flag:h
    ^-  json
    s/(rap 3 (scot %p p.f) '/' q.f ~)
  ::
  ++  ship
    |=  her=@p
    n+(rap 3 '"' (scot %p her) '"' ~)
  ::
  ++  briefs
    |=  bs=briefs:h
    %-  pairs
    %+  turn  ~(tap by bs)
    |=  [f=flag:h b=brief:briefs:h]
    [(rap 3 (scot %p p.f) '/' q.f ~) (brief b)]
  ::
  ++  brief-update
    |=  u=update:briefs:h
    %-  pairs
    :~  flag/(flag p.u)
        brief/(brief q.u)
    ==
  ::
  ++  brief
    |=  b=brief:briefs:h
    %-  pairs
    :~  last/(time last.b)
        count/(numb count.b)
        read-id/?~(read-id.b ~ (time u.read-id.b))
    ==
  ::
  ++  stash
    |=  st=stash:h
    %-  pairs
    %+  turn  ~(tap by st)
    |=  [f=flag:h he=heap:h]
    [(rap 3 (scot %p p.f) '/' q.f ~) (heap he)]
  ++  heap
    |=  he=heap:h
    %-  pairs
    :~  perms/(perm perm.he)
    ==
  ++  perm
    |=  p=perm:h
    %-  pairs
    :~  writers/a/(turn ~(tap in writers.p) (lead %s))
    ==
  ++  update
    |=  =update:h
    %-  pairs
    :~  time+s+(scot %ud p.update)
        diff+(diff q.update)
    ==
  ::
  ++  diff
    |=  =diff:h
    %+  frond  -.diff
    ?+  -.diff  ~
      %curios     (curios-diff p.diff)
    ==
  ::
  ++  curios-diff
    |=  =diff:curios:h
    %-  pairs
    :~  time/s/(scot %ud p.diff)
        delta/(curios-delta q.diff)
    ==
  ::
  ++  curios-delta
    |=  =delta:curios:h
    %+  frond  -.delta
    ?+  -.delta  ~
      %add       (heart p.delta)
      %del       ~
      %add-feel  (add-feel +.delta)
    ==
  ::
  ++  heart
    |=  =heart:h
    %-  pairs
    :~  title+?~(title.heart ~ s+u.title.heart)
        content/a/(turn content.heart inline)
        author+(ship author.heart)
        sent+(time sent.heart)
        replying+?~(replying.heart ~ s/(scot %ud u.replying.heart))
    ==
  ::
  ++  inline
    |=  i=inline:h
    ^-  json
    ?@  i  s+i
    %+  frond  -.i
    ?-  -.i
        %break
      ~
    ::
        ?(%code %tag %inline-code)
      s+p.i
    ::
        ?(%italics %bold %strike %blockquote)
      :-  %a
      (turn p.i inline)
    ::
        %link
      %-  pairs
      :~  href+s+p.i
          content+s+q.i
      ==
    ==
  ::
  ++  add-feel
    |=  [her=@p =feel:h]
    %-  pairs
    :~  feel+s+feel
        ship+(ship her)
    ==
  ::
  ++  curios
    |=  =curios:h
    ^-  json
    %-  pairs
    %+  turn  (tap:on:curios:h curios) 
    |=  [key=@da c=curio:h]
    [(scot %ud key) (curio c)]
  ::
  ++  curio
    |=  =curio:h
    %-  pairs
    :~  seal+(seal -.curio)
        heart+(heart +.curio)
    ==
  ::
  ++  seal
    |=  =seal:h
    %-  pairs
    :~  time+(time time.seal)
    ::
        :-  %feels
        %-  pairs
        %+  turn  ~(tap by feels.seal)
        |=  [her=@p =feel:h]
        [(scot %p her) s+feel]
    ::
        :-  %replied
        :-  %a
        (turn ~(tap in replied.seal) (cork (cury scot %ud) (lead %s)))
    ==
  --
++  dejs
  =,  dejs:format
  |%
  ++  ship  (su ;~(pfix sig fed:ag))
  ++  flag  `$-(json flag:h)`(su flag-rule)
  ++  flag-rule  ;~((glue fas) ;~(pfix sig fed:ag) sym)
  ++  create
    ^-  $-(json create:h)
    %-  ot
    :~  group+flag
        name+(se %tas)
        title+so
        description+so
        readers+(as (se %tas))
        writers+(as (se %tas))
    ==
  ++  action
    ^-  $-(json action:h)
    %-  ot
    :~  flag+flag
        update+update
    ==
  ::
  ++  update
    |=  j=json
    ^-  update:h
    ?>  ?=(%o -.j)
    [*time (diff (~(got by p.j) %diff))]
  ::
  ++  diff
    ^-  $-(json diff:h)
    %-  of
    :~  curios/curios-diff
        add-sects/add-sects
        del-sects/del-sects
    ==
  ::
  ++  curios-diff
    ^-  $-(json diff:curios:h)
    %-  ot
    :~  time/(se %ud)
        delta/curios-delta
    ==
  ++  curios-delta
    ^-  $-(json delta:curios:h)
    %-  of
    :~  add/heart
        del/ul
        add-feel/add-feel
    ==
  ::
  ++  add-sects  (as (se %tas))
  ::
  ++  del-sects  (as (se %tas))
  ::
  ++  heart
    ^-  $-(json heart:h)
    %-  ot
    :~  title/(mu so)
        content/(ar inline)
        author/ship
        sent/di
        replying/(mu (se %ud))
    ==
  ::
  ++  inline
    |=  j=json
    ^-  inline:h
    ?:  ?=([%s *] j)  p.j
    =>  .(j `json`j)
    %.  j
    %-  of
    :~  italics/(ar inline)
        bold/(ar inline)
        strike/(ar inline)
        blockquote/(ar inline)
        inline-code/so
        code/so
        tag/so
        break/ul
    ::
      :-  %link
      %-  ot
      :~  href/so
          content/so
      ==
    ==
  ::
  ++  add-feel
    %-  ot
    :~  ship/ship
        feel/so
    ==
  ::
  ++  remark-action
    %-  ot
    :~  flag/flag
        diff/remark-diff
    ==
  ::
  ++  remark-diff
    %-  of
    :~  read/ul
        watch/ul
        unwatch/ul
    ==
  --
--
