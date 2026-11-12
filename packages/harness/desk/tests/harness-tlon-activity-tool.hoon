/-  a=activity-ver
/+  *test, activity=harness-tlon-activity-tool
|%
++  lib  ~(. activity *bowl:gall)
++  args
  |=  fields=(list [@t json])
  (pairs:enjs:format fields)
++  test-presets-round-trip
  =/  presets=(list level:activity)  ~[%loud %medium %soft %hush]
  %+  expect-eq  !>(presets)
  !>((turn presets |=(l=level:activity (named:lib (volumes:lib l)))))
++  test-medium-and-soft-follow-the-app
  =/  medium  (volumes:lib %medium)
  =/  soft  (volumes:lib %soft)
  %-  expect
  !>  ?&  =([& &] (~(got by medium) %post))
          =([& |] (~(got by medium) %reply))
          ::  Reactions notify like posts but never count as unread.
          =([| &] (~(got by medium) %react))
          =([& |] (~(got by soft) %post))
          =([& &] (~(got by soft) %post-mention))
          =([& &] (~(got by soft) %dm-post))
          =([& |] (~(got by soft) %note-create))
      ==
++  test-mark-everything-read
  %+  expect-eq
    !>(`action:v10:a`[%read [%base ~] [%all ~ &]])
  !>(-:(command:lib (args ~[['action' %s 'mark_read'] ['scope' %s 'all']]) 'mark_read'))
++  test-mute-and-unmute-a-dm
  =/  dm  ~[['ship' %s '~nec']]
  %-  expect
  !>  ?&  .=  `action:v10:a`[%adjust [%dm %ship ~nec] `(volumes:lib %hush)]
          -:(command:lib (args dm) 'mute')
          .=  `action:v10:a`[%adjust [%dm %ship ~nec] ~]
          -:(command:lib (args dm) 'unmute')
      ==
++  test-levels-the-app-offers
  =/  dm-loud  (args ~[['ship' %s '~nec'] ['level' %s 'loud']])
  =/  dm-medium  (args ~[['ship' %s '~nec'] ['level' %s 'medium']])
  =/  base-loud  (args ~[['scope' %s 'base'] ['level' %s 'loud']])
  =/  base-soft  (args ~[['scope' %s 'base'] ['level' %s 'soft']])
  =/  set  'set_notification_level'
  %-  expect
  !>  ?&  =(~ (mole |.((command:lib dm-loud set))))
          ?=(^ (mole |.((command:lib dm-medium set))))
          =(~ (mole |.((command:lib base-loud set))))
          .=  `action:v10:a`[%adjust [%base ~] `(volumes:lib %soft)]
          -:(command:lib base-soft set)
          =(~ (mole |.((command:lib (args ~[['ship' %s '~nec'] ['level' %s 'quiet']]) set))))
      ==
++  test-exactly-one-target
  =/  both  (args ~[['ship' %s '~nec'] ['club' %s '0v1']])
  %-  expect
  !>  ?&  =(~ (mole |.((command:lib both 'mute'))))
          =(~ (mole |.((command:lib (args ~) 'mute'))))
      ==
--
