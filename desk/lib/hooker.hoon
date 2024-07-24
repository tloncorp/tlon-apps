/-  h=hooker, c=channels
/+  cj=channel-json
=*  z  ..zuse
|%
++  enjs
  =,  enjs:format
  |%
  ::
  +|  %primitives
  ++  ship
    |=  s=ship:z
    s+(scot %p s)
  ::
  :: +|  %basics
  ::
  :: +|  %action
  ::
  :: +|  %updates
  ::
  --
::
++  dejs
  =,  dejs:format
  |%
  +|  %primitives
  ++  ship  `$-(json ship:z)`(su ship-rule)
  ++  ship-rule  ;~(pfix sig fed:ag)
  ++  transformer
    %-  su
    %-  perk
    :~  %direct
        %github
        %linear
    ==
  +|  %action
  ++  orders  (ar command)
  ++  command
    ^-  $-(json command:h)
    %-  of
    :~  message/message
        store/store
        poke/poke
    ==
  ::
  ::
  ++  message
    %-  ot
    :~  nest/nest:dejs:cj
        story/story:dejs:cj
    ==
  ::
  ++  store
    %-  ot
    :~  key/so
        data/(om so)
    ==
  ::
  ++  poke
    %-  ot
    :~  wire/pa
      ::
        :-  %dock
        %-  ot
        :~  ship/ship
            app/(se %tas)
        ==
      ::
        cask/cask
    ==
  ++  cask
    |=  j=json
    ^-  (^cask *)
    =/  atom  ((se %uw) j)
    ;;((^cask *) (cue atom))
  --
--
