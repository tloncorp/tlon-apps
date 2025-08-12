/*  emoji-data  %emojimart  /lib/emojimart/emoji/jam
::  emojimart: conversions for old-style emojimart-shortcode ":reacts:"
::
|%
::  +kill: emoji shortcode to unicode
::
++  kill
  ::NOTE  memoization speeds up repeated lookups, common during migration.
  ::      on sample migration (data from palfun), 1.5s -> 0.9s
  |=  rac=@t  ~+
  ^-  (unit @)
  %+  rush  rac
  %+  sear
    |=  [k=@t c=?(~ %1 %2 %3 %4 %5 %6)]
    ^-  (unit @)
    ?~  d=(~(get by data) k)  ~  ::  can't find shortcode
    ?~  c
      `?@(u.d u.d n.u.d)
    ?@  u.d  ~  ::  can't find skin tone alt
    :-  ~
    ?-  c
      %1  n.u.d
      %2  a.u.d
      %3  b.u.d
      %4  c.u.d
      %5  d.u.d
      %6  e.u.d
    ==
  |^  ;~(plug nom sin)
  ++  nom
    ;~  pose
      (ifix [. .]:col (cook (cury rap 3) (plus ;~(less col next))))
      (ifix [. .]:;~(plug col col) (cook (cury rap 3) (plus ;~(less col next))))
    ==
  ++  sin
    ;~  pose
      (cold %1 (jest ':skin-tone-1:'))
      (cold %2 (jest ':skin-tone-2:'))
      (cold %3 (jest ':skin-tone-3:'))
      (cold %4 (jest ':skin-tone-4:'))
      (cold %5 (jest ':skin-tone-5:'))
      (cold %6 (jest ':skin-tone-6:'))
      (easy ~)
    ==
  --
::  +rave: emoji unicode to shortcode
::
++  rave
  |=  u=@  ~+
  ^-  (unit @t)
  (~(get by mode) u)
::
+$  mote
  $@  @                      ::  simple emoji
  [n=@ a=@ b=@ c=@ d=@ e=@]  ::  neutral & with skin tones
::  +mode: unicode emoji to known shortcode map
::
++  mode
  ^-  (map @t @t)  ^~
  %-  ~(gas by *(map @t @t))
  %-  ~(rep by data)
  |=  [[short=@t =mote] shots=(list [@t @t])]
  =+  soc=(rap 3 ~[':' short ':'])
  ?@  mote
    [[mote soc] shots]
  :*  [n.mote soc]
      [a.mote (cat 3 soc ':skin-tone-2:')]
      [b.mote (cat 3 soc ':skin-tone-3:')]
      [c.mote (cat 3 soc ':skin-tone-4:')]
      [d.mote (cat 3 soc ':skin-tone-5:')]
      [e.mote (cat 3 soc ':skin-tone-6:')]
      shots
  ==
::  +data: to regenerate this data, run the following command in the dojo:
::         *=groups=/lib/emojimart/emoji/jam _jam -build-file /=groups=/lib/emojimart/emoji/hoon
::
++  data  emoji-data
--