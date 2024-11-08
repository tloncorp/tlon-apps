/-  c=chat  
/-  hark=hark-store
|%
++  hark-dm
  |_  [now=@da =ship]
  ++  bin  `bin:hark`[/ [%groups /dm/(scot %p ship)]]
  ++  invited
    ^-  cage
    :-  %hark-action
    !>  ^-  action:hark
    :+  %add-note  bin
    :*  [ship/ship text/' invited you to a DM' ~]
        ~
        now
        /
        `path`/dm/(scot %p ship)/invite
    ==
  ::
  ++  story
    |=  [=id:c =story:c]
    ^-  cage
    :-  %hark-action
    !>  ^-  action:hark
    :+  %add-note  bin
    :*  [ship/ship text/' messaged you' ~]
        (flatten-stories q.story)
        now
        `path`/
        `path`/dm/(scot %p ship)/id/(scot %p p.id)/(scot %da q.id)
    ==
  --
++  flatten-story
  |=  i=inline:c
  ^-  (list content:hark)
  ?@  i  ~[text/i]
  ?+  -.i   ~
    ?(%italics %bold %strike)  (flatten-stories p.i)
    ?(%inline-code %code %tag)  ~[text/p.i]
  ==
++  flatten-stories  
  |=  is=(list inline:c)
  ^-  (list content:hark)
  (zing (turn is flatten-story))
  
--
