::  Bounded, lossless native Notes import payloads. No file-system reads.
/-  n=notes
/+  spec=harness-tlon-tool
|%
::
++  keys
  |=  [value=json allowed=(list @t)]
  ?>  ?=(%o -.value)
  ?>  %+  levy  ~(tap in ~(key by p.value))
      |=  key=@t
      (lien allowed |=(item=@t =(item key)))
  ~
::
++  tree
  |=  args=json
  ^-  (list import-node:n)
  =/  value  (need (de:json:html (required:spec args 'tree' 65.536)))
  =/  parsed  (nodes value 0 0)
  ?>  (gth count.parsed 0)
  items.parsed
::
++  nodes
  |=  [value=json depth=@ud count=@ud]
  ^-  [items=(list import-node:n) count=@ud]
  ?>  &(?=(%a -.value) (lte depth 8))
  =/  rows  p.value
  =/  reversed=(list import-node:n)  ~
  |-
  ?~  rows  [(flop reversed) count]
  ?>  (lth count 100)
  =/  row  i.rows
  ?>  ?=(%o -.row)
  =/  kind  (required:spec row 'type' 16)
  ?:  =('note' kind)
    ?>  =(~ (keys row ~['type' 'title' 'text']))
    ?>  (has:spec row 'text')
    =/  node=import-node:n
      [%note (required:spec row 'title' 128) (string:spec row 'text' '' 16.384)]
    $(rows t.rows, count +(count), reversed [node reversed])
  ?>  =('folder' kind)
  ?>  =(~ (keys row ~['type' 'title' 'children']))
  =/  title  (required:spec row 'title' 128)
  ?>  &(!=('.' title) !=('..' title) !=('/' title))
  ::  Carry the shared node budget through nested folders.
  =/  child  (nodes (~(got by p.row) 'children') +(depth) +(count))
  $(rows t.rows, count count.child, reversed [[%folder title items.child] reversed])
::
++  sizes
  |=  items=(list import-node:n)
  ^-  [notes=@ud folders=@ud bytes=@ud]
  ?~  items  [0 0 0]
  =/  rest  $(items t.items)
  ?:  ?=(%note -.i.items)
    [+(notes.rest) folders.rest (add bytes.rest (met 3 body-md.i.items))]
  =/  child  $(items children.i.items)
  :*  (add notes.rest notes.child)
      +((add folders.rest folders.child))
      (add bytes.rest bytes.child)
  ==
--
