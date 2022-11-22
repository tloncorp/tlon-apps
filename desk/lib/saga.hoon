/-  g=groups, e=epic
|%
+$  card  card:agent:gall
++  dedupe-paths
  |=  a=(list path)
  ^+  a
  =-  ~(tap in -)
  (~(gas in *(set path)) a)
--
|_  [=bowl:gall upd=mark okay=epic:e]
++  load
  ^-  (unit card)
  =;  matches=(list path)
    ?:  =(~ matches)
      ~
    `[%give %fact matches epic+!>(okay)]
  %-  dedupe-paths
  %+  murn  ~(val by sup.bowl)
  |=  [=ship =path]
  ^-  (unit _path)
  ?:  =(our.bowl ship)  ~
  `path
++  is-old
  |=  =mark
  =(upd (end [3 (met 3 upd)] mark))
--
  


