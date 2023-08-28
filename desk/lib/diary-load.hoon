/-  d=diary, e=epic
|=  =vase
|^  ^-  state-2
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
  %-  ~(run by old-shelf)
  |=  =diary:one
  ^-  diary:two
  !!  ::TODO  diary(log (log-1-to-2 diary))
::
++  log-1-to-2
  |=  old-diary=diary:one  ::NOTE  because we need the perm also
  ^-  log:two
  %-  ~(gas in *log:two)  ::TODO  ordered map
  %+  murn  ~(tap by log.old-diary)
  |=  [=time =diff:one]
  =;  new=(unit u-diary:two)
    (bind new (lead time))
  !!  ::TODO
  :: ::TODO  we invent rev numbers here. safe/sane??
  :: ?-  -.diff
  ::   ?(%add-sects %del-sects)  [%perm 0 perm.old-diary]  ::TODO  is this correct?
  ::   %create                   ~
  ::   ?(%view %sort)            `[- 0 +]:diff
  ::   %arranged-notes           `[%order 0 +.diff]
  :: ::
  ::     %notes
  ::   :+  %notes  p.p.diff
  ::   ?-  -.q.p.diff
  ::     ?(%add %edit)  xx ::TODO  how? get from old state?
  ::     ?(%add-feel %del-feel)  xx ::TODO  how? get from old state?
  ::     %del           [%set ~]
  ::   ::
  ::     %quips         xx
  ::   ==
  ::   ::  $note = [seal (rev essay)]
  :: ==
--
