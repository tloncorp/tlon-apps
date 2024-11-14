/-  h=hooks, c=channels
:-  %say
|=  $:  [now=@da eny=@uvJ =beak]
        [[=event:h ~] ~]
    ==
:-  %noun
^-  outcome:h
=|  count=@ud
=/  max  140
=/  new-content=story:c  ~
=*  no-op  &+[[[%allowed event] ~] !>(~)]
?.  ?=(%on-post -.event)  no-op
=*  on-post  +.event
?.  ?=(?(%add %edit) -.on-post)  no-op
=/  verses
  ?-  -.on-post
    %add  content.essay.on-post
    %edit  content.essay.on-post
  ==
|^
::  made it to the end
=*  return
  =-  &+[[[%allowed -] ~] !>(~)]
  ?-  event
    [%on-post %add *]  event(content.essay new-content)
    [%on-post %edit *]  event(content.essay new-content)
  ==
?~  verses  return
?:  (gte count max)  return
=*  next   $(verses t.verses)
=/  verse  i.verses
::  remove blocks
?:  ?=(%block -.verse)  next
=/  [new-inlines=(list inline:c) new-count=@ud]
  (run-list p.verse count)
$(new-content (snoc new-content [%inline new-inlines]), verses t.verses, count new-count)
++  run-list
  |=  [inlines=(list inline:c) count=@ud]
  ^-  [(list inline:c) @ud]
  =/  new-inlines=(list inline:c)  ~
  |-
  ?~  inlines
    ::  made it all the way through
    [new-inlines count]
  =*  next  $(inlines t.inlines)
  =/  inline  i.inlines
  ?:  (gte count max)
    [new-inlines count]
  ?@  inline
    =/  new-string  (trim-cord inline count)
    ?~  new-string  $(inlines ~)  ::done
    $(new-inlines (snoc new-inlines u.new-string), inlines t.inlines, count (add count (met 3 u.new-string)))
  =/  [new-inline=(unit inline:c) new-count=@ud]
    (run-special-inlines inline count)
  ?~  new-inline  $(inlines ~)  ::done
  $(new-inlines (snoc new-inlines u.new-inline), inlines t.inlines, count new-count)
++  run-special-inlines
  |=  [=inline:c count=@ud]
  ^-  [(unit inline:c) @ud]
  ?+  -.inline  [~ count]
      %break  [`inline +(count)]
  ::
      %ship
    ?:  (gth (add count 14) max)  [~ count]
    [`inline (add count 14)]
  ::
      %link
    =/  new-string=(unit cord)  (trim-cord q.inline count)
    ?~  new-string  [~ count]
    =/  new-inline=inline:c  inline(q u.new-string)
    [(some new-inline) (add count (met 3 u.new-string))]
  ::
      %inline-code
    =/  new-string=(unit cord)  (trim-cord p.inline count)
    ?~  new-string  [~ count]
    [(some inline(p u.new-string)) (add count (met 3 u.new-string))]
  ::
      ?(%italics %bold %strike %blockquote)
    =/  [new-inlines=(list inline:c) new-count=@ud]  (run-list p.inline count)
    ?~  new-inlines  [~ count]
    [(some inline(p new-inlines)) new-count]
  ==
++  trim-cord
  |=  [=cord count=@ud]
  ^-  (unit ^cord)
  =/  string  (trip cord)
  =/  length  (lent string)
  =/  total  (add length count)
  ?:  (gth total max)
    :: truncate
    =/  remainder  (sub total max)
    ::  no room for anything
    ?:  =(length remainder)  ~
    =/  new-length  (sub length remainder)
    `(crip (scag new-length string))
  `cord
--