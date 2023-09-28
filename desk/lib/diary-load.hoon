/-  d=diary, e=epic
|^  |=  =vase
    ^-  state-2
    =+  !<([old=versioned-state cool=epic:e] vase)
    |-
    ?-  -.old
      %0  $(old (state-0-to-1 old))
      %1  $(old (state-1-to-2 old))
      %2  old
    ==
::
+$  versioned-state  $%(state-0 state-1 state-2)
+$  state-0
  $:  %0
      shelf=shelf:zero
      voc=(map [flag:zero plan:zero] (unit said:zero))
      imp=(map flag:zero ?)
  ==
+$  state-1
  $:  %1
      =shelf:one
      voc=(map [flag:one plan:one] (unit said:one))
      imp=(map flag:one ?)
  ==
+$  state-2
  $:  %2
      =shelf:d
      voc=(map [flag:d plan:d] (unit said:d))
  ==
++  zero  zero:old:d
++  one   one:old:d
++  two   d
++  state-0-to-1
  |=  s=state-0
  ^-  state-1
  %*  .  *state-1
    shelf  (shelf-0-to-1 shelf.s)
    voc    voc.s
    imp    imp.s
  ==
::
++  shelf-0-to-1
  |=  old-shelf=shelf:zero
  ^-  shelf:one
  %-  malt
  %+  turn
    ~(tap by old-shelf)
  |=  [=flag:one old-diary=diary:zero]
  ^-  [flag:one diary:one]
  [flag [~ old-diary]]
::
++  state-1-to-2
  |=  s=state-1
  ^-  state-2
  %*  .  *state-2
    shelf  (shelf-1-to-2 shelf.s)
    voc    voc.s
  ==
::
++  shelf-1-to-2
  |=  old-shelf=shelf:one
  ^-  shelf:two
  %-  ~(urn by old-shelf)
  |=  [=flag:d =diary:one]
  ^-  diary:two
  :-  :*  (notes-1-to-2 notes.diary)
          [%0 arranged-notes.diary]
          [%0 view.diary]
          [%0 sort.diary]
          [%0 perm.diary]
      ==
  :*  (net-1-to-2 flag net.diary)
      (log-1-to-2 diary)
      remark.diary
      *window:diary:two
      *future:diary:two
  ==
::
++  notes-1-to-2
  |=  old=notes:one
  ^-  notes:two
  %-  ~(urn by old)
  |=  [id=@da =note:one]
  `(note-1-to-2 id note)
::
++  note-1-to-2
  |=  [id=@da old=note:one]
  ^-  note:two
  [[id (quips-1-to-2 quips.old) (feels-1-to-2 feels.old)] %0 +.old]
::
++  quips-1-to-2
  |=  old=quips:one
  ^-  quips:two
  %-  ~(urn by old)
  |=  [id=@da =quip:one]
  `(quip-1-to-2 id quip)
::
++  quip-1-to-2
  |=  [id=@da old=quip:one]
  ^-  quip:two
  [[id (feels-1-to-2 feels.old)] +.old]
::
++  feels-1-to-2
  |=  old=(map ship feel:j:d)
  ^-  feels:j:d
  %-  ~(run by old)
  |=  =feel:one
  [%0 `feel]
::
++  net-1-to-2
  |=  [=flag:two old-net=net:one]
  ^-  net:two
  ?-  -.old-net
    %sub  +>.old-net
    %pub  [& %chi ~]
  ==
::
++  log-1-to-2
  |=  old-diary=diary:one  ::NOTE  because we need the perm also
  ^-  log:two
  %+  gas:log-on:two  *log:two
  %+  murn  (tap:log-on:d log.old-diary)
  |=  [=time =diff:one]
  =;  new=(unit u-channel:two)
    (bind new (lead time))
  ?-    -.diff
      ?(%add-sects %del-sects)  `[%perm 0 perm.old-diary]
      %create                   `[%create p.diff]
      %view                     `[%view 0 p.diff]
      %sort                     `[%sort 0 p.diff]
      %arranged-notes           `[%order 0 p.diff]
      %notes
    =;  nup=(unit u-note:two)
      ?~  nup  ~
      `[%note p.p.diff u.nup]
    =/  old-note  (get:on:notes:one notes.old-diary p.p.diff)
    ?-    -.q.p.diff
        %del                    `[%set ~]
        ?(%add %edit)
      :+  ~  %set
      ?~  old-note  ~
      `(note-1-to-2 p.p.diff u.old-note)
    ::
        ?(%add-feel %del-feel)
      ?~  old-note  ~
      `[%feels (feels-1-to-2 feels.u.old-note)]
    ::
        %quips
      ?~  old-note  ~
      =*  diff-quip  p.q.p.diff
      =;  qup=(unit u-quip:two)
        ?~  qup  ~
        `[%quip p.diff-quip u.qup]
      =/  old-quip  (get:on:quips:one quips.u.old-note p.diff-quip)
      ?-    +<.diff-quip
          %del  `[%set ~]
          %add
        :+  ~  %set
        ?~  old-quip  ~
        `(quip-1-to-2 p.diff-quip u.old-quip)
      ::
          ?(%add-feel %del-feel)
        ^-  (unit u-quip:two)
        ?~  old-quip  ~
        `[%feels (feels-1-to-2 feels.u.old-quip)]
      ==
    ==
  ==
--
