/-  c=chat  
/-  hark=hark-store
|%
++  flatten-story
  |=  i=inline:c
  ^-  (list content:hark)
  ?@  i  ~[text/i]
  ?+  -.i   ~
    ?(%italics %bold %strike %inline-code)  (flatten-story p.i)
    ?(%code %tag)  ~[text/p.i]
  ==
++  flatten-stories  
  |=  is=(list inline:c)
  ^-  (list content:hark)
  (zing (turn is flatten-story))
  
++  dm-to-hark
  |=  [=ship now=@da =id:c =story:c]
  ^-  body:hark
  :*  [ship/ship text/' messaged you' ~]
      (flatten-stories q.story)
      now
      `path`/
      `path`/dm/(scot %p ship)/id/(scot %p p.id)/(scot %da q.id)
  ==
--
