/-  c=chat
|%
++  enjs
  =,  enjs:format
  |%
  ++  ship
    |=  her=@p
    n+(rap 3 '"' (scot %p her) '"' ~)
  ++  update
    |=  =update:c
    %-  pairs
    :~  time+s+(scot %ud p.update)
        diff+(diff q.update)
    ==
  ++  diff
    |=  =diff:c
    %+  frond  -.diff
    ?+  -.diff  ~
      %add  (memo p.diff)
    ==
  ::
  ++  memo 
    |=  =memo:c
    %-  pairs
    :~  author+(ship author.memo)
        sent+(time sent.memo)
        content+s+content.memo
    ==
  ::
  ++  seal
    |=  =seal:c
    %-  pairs
    :~  time+s+(scot %ud time.seal)
    ::
        :-  %feel
        %-  pairs
        %+  turn  ~(tap by feel.seal)
        |=  [=term ships=(set @p)]
        [term a+(turn ~(tap in ships) ship)]
    ==
  ++  writ
    |=  =writ:c
    %-  pairs
    :~  seal+(seal -.writ)
        memo+(memo +.writ)
    ==
  ::
  ++  writs
    |=  =writs:c
    ^-  json
    :-  %a
    %+  turn  writs
    |=  [tim=@da w=writ:c]
    %-  pairs
    :~  time+s+(scot %ud tim)
        writ+(writ w)
    ==
  --
++  dejs
  =,  dejs:format
  |%
  ++  ship  (su ;~(pfix sig fed:ag))
  ++  flag  (su ;~((glue fas) ;~(pfix sig fed:ag) sym))
  ++  action
    ^-  $-(json action:c)
    %-  ot
    :~  flag+flag
        update+update
    ==
  ++  update
    |=  j=json
    ^-  update:c
    ?>  ?=(%o -.j)
    [*time (diff (~(got by p.j) %diff))]
  ::
  ++  diff
    %-  of
    :~  add/memo
    ==
  ++  memo
    %-  ot
    :~  author/ship
        sent/di
        content/so
    ==
  --
--
