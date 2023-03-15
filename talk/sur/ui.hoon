/-  g=groups, c=chat
|%
+$  init
  $:  =groups:g
      =gangs:g
      talk
  ==
::
+$  talk
  $:  =briefs:c
      chats=(map flag:c chat:c)
      clubs=(map id:club:c crew:club:c)
      dms=(set ship)
      invited=(set ship)
      pins=(list whom:c)
  ==
::
+$  vita-enabled  ?
--