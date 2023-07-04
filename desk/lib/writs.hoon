/-  c=chat
/+  mp=mop-extensions
|_  pac=pact:c
++  mope  ((mp time wool:c) lte)
++  gas
  |=  ls=(list [=time =wool:c])
  ^+  pac
  %_    pac
      wit  (gas:on:wools:c wit.pac ls)
  ::
      dex  
    %-  ~(gas by dex.pac)
    %+  turn  ls
    |=  [=time =wool:c]
    ^-  [id:c _time]
    [id.parent.wool time]
  ==
::
++  brief
  |=  [our=ship last-read=time]
  ^-  brief:briefs:c
  =/  =time
    ?~  tim=(ram:on:wools:c wit.pac)  *time
    key.u.tim
  =/  unreads
    (lot:on:wools:c wit.pac `last-read ~)
  =/  read-id=(unit id:c)  
    (bind (pry:on:wools:c unreads) |=([key=@da val=wool:c] id.parent.val))
  =/  count
    (lent (skim ~(tap by unreads) |=([tim=^time =wool:c] !=(author.parent.wool our))))
  [time count read-id]
::
++  get
  |=  =id:c
  ^-  (unit [=time =wool:c])
  ?~  tim=(~(get by dex.pac) id)
    ~
  ?~  wit=(get:on:wools:c wit.pac u.tim)
    ~
  `[u.tim u.wit]
::
++  jab
  |=  [=id:c fun=$-(wool:c wool:c)]
  ^+  pac
  ?~  v=(get id)  pac
  =.  wit.pac  (put:on:wools:c wit.pac time.u.v (fun wool.u.v))
  pac
::
++  got
  |=  =id:c
  ^-  [=time =wool:c]
  (need (get id))
::
++  weave
  |=  [wit=wools:c =time =seal:c =delta:wools:c]
  ^-  wools:c
  ::  TODO thread weave
  wit
++  reduce
  |=  [now=time =id:c del=delta:wools:c]
  ^+  pac
  ?-  -.del
      %add
    =/  =seal:c  [id ~ ~]
    ?:  (~(has by dex.pac) id)
      pac
    |-
    ?:  (has:on:wools:c wit.pac now)  
      $(now `@da`(add now ^~((div ~s1 (bex 16)))))
    =.  wit.pac
      ?~  thread.p.del
        (put:on:wools:c wit.pac now *stitch:c *writs:c [seal p.del])
      (weave wit.pac now seal del)
    =.  dex.pac  (~(put by dex.pac) id now)
    pac
  ::
      %del
    =/  tim=(unit time)  (~(get by dex.pac) id)
    ?~  tim  pac
    =/  =time  (need tim)
    =^  wit=(unit wool:c)  wit.pac
      (del:on:wools:c wit.pac time)
    =.  dex.pac  (~(del by dex.pac) id)
    pac
  ::
      %add-feel
    %+  jab  id
    |=  =wool:c
    ::  TODO thread handle thread reaction
    :*  stitch.wool
        thread.wool
        parent.wool(feels (~(put by feels.parent.wool) [p q]:del))
    ==
  ::
      %del-feel
    %+  jab  id
    |=  =wool:c
    :*  stitch.wool
        thread.wool
        parent.wool(feels (~(del by feels.parent.wool) p.del))
    ==
  ==
::
++  peek
  |=  [care=@tas =(pole knot)]
  ^-  (unit (unit cage))
  =*  on   on:wools:c
  ?+    pole  [~ ~]
  ::
      [%newest count=@ ~]
    =/  count  (slav %ud count.pole)
    ``chat-wools+!>((gas:on *wools:c (top:mope wit.pac count)))
  ::
      [%older start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    ``chat-wools+!>((gas:on *wools:c (bat:mope wit.pac `start count)))
  ::
      [%newer start=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  start  (slav %ud start.pole)
    ``chat-wools+!>((gas:on *wools:c (tab:on wit.pac `start count)))
  ::
      [%around time=@ count=@ ~]
    =/  count  (slav %ud count.pole)
    =/  time  (slav %ud time.pole)
    =/  older  (bat:mope wit.pac `time count)
    =/  newer  (tab:on:wools:c wit.pac `time count)
    =/  wool   (get:on:wools:c wit.pac time)
    =-  ``chat-wools+!>(-)
    %+  gas:on  *wools:c
    ?~  wool
      (welp older newer)
    (welp (snoc older [time u.wool]) newer)
  ::
      [%wool %id ship=@ time=@ ~]
    =/  ship  (slav %p ship.pole)
    =/  time  (slav %ud time.pole)
    ?.  ?=(%u care)
      ``wool+!>((got ship `@da`time))
    ``flag+!>(?~((get ship `@da`time) | &))
  ==
::
++  search
  =<
    |%
    ++  mention
      |=  [sip=@ud len=@ud nedl=^ship]
      ^-  scan:c
      (scour sip len (mntn nedl))
    ++  text
      |=  [sip=@ud len=@ud nedl=@t]
      ^-  scan:c
      (scour sip len (txt nedl))
    --
  |%
  +$  query
    $:  skip=@ud
        more=@ud
        =scan:c
    ==
  ++  scour
    |=  [sip=@ud len=@ud matc=$-(wool:c ?)]
    ?>  (gth len 0)
    ^-  scan:c
    %-  flop
    =<  scan.-
    %^    (dop:mope query)
        wit.pac     :: (gas:on:wools:c wit.pac ls)
      [sip len ~]   :: (gas:on:quilt:h *quilt:h (bat:mope quilt `idx blanket-size))
    |=  $:  =query
            =time
            =wool:c
        ==
    ^-  [(unit wool:c) stop=? _query]
    :-  ~
    ?:  (matc wool)
      ?:  =(0 skip.query)
        :-  =(1 more.query)
        query(more (dec more.query), scan [[time wool] scan.query])
      [| query(skip (dec skip.query))]
    [| query]
  ++  mntn
    |=  nedl=ship
    ^-  $-(wool:c ?)
    |=  =wool:c
    ^-  ?
    ?.  ?=(%story -.content.parent.wool)
      |
    =/  ls=(list inline:c)   q.p.content.parent.wool
    |-
    ?~  ls    |
    ?@  i.ls  $(ls t.ls)
    ?+  -.i.ls  $(ls t.ls)
      %ship                                  =(nedl p.i.ls)
      ?(%bold %italics %strike %blockquote)  |($(ls p.i.ls) $(ls t.ls))
    ==
  ::
  ++  txt
    |=  nedl=@t
    ^-  $-(wool:c ?)
    |=  =wool:c
    ^-  ?
    ?.  ?=(%story -.content.parent.wool)
      |
    |^
      =/  ls=(list inline:c)  q.p.content.parent.wool
      |-
      ?~  ls  |
      ?@  i.ls
        |((find nedl i.ls |) $(ls t.ls))
      ?.  ?=(?(%bold %italics %strike %blockquote) -.i.ls)
        $(ls t.ls)
      |($(ls p.i.ls) $(ls t.ls))
    ++  find
      |=  [nedl=@t hay=@t case=?]
      ^-  ?
      =/  nlen  (met 3 nedl)
      =/  hlen  (met 3 hay)
      ?:  (lth hlen nlen)
        |
      =?  nedl  !case
        (cass nedl)
      =/  pos  0
      =/  lim  (sub hlen nlen)
      |-
      ?:  (gth pos lim)
        |
      ?:  .=  nedl
          ?:  case
            (cut 3 [pos nlen] hay)
          (cass (cut 3 [pos nlen] hay))
        &
      $(pos +(pos))
    ++  cass
      |=  text=@t
      ^-  @t
      %^    run
          3
        text
      |=  dat=@
      ^-  @
      ?.  &((gth dat 64) (lth dat 91))
        dat
      (add dat 32)
    --
  --
--
