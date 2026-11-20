/+  *test, pages=harness-pages, w=harness-provider-wire, tlon=harness-tlon-tool
|%
++  large
  (rap 3 (reap 5.000 'hello 🙂 '))
++  test-text-pages-cover-the-complete-utf-eight-body
  =/  body  large
  =/  offset=@ud  0
  =/  rebuilt=@t  ''
  |-  ^-  tang
      =/  page  (text:pages body offset)
      =.  rebuilt  (cat 3 rebuilt (str:w page 'text'))
      =/  next  (need (get:w page 'nextOffset'))
      ?:  =(~ next)  (expect-eq !>(body) !>(rebuilt))
      $(offset (number:pages page 'nextOffset'))
++  test-directory-pages-and-help-keep-discovery-light
  =/  rows  (turn (gulf 0 149) |=(n=@ud (scot %ud n)))
  =/  first  (directory:pages rows 0)
  =/  second  (directory:pages rows (number:pages first 'nextOffset'))
  =/  items  (need (get:w second 'items'))
  ?>  ?=(%a -.items)
  =/  fun  (need (get:w schema:tlon 'function'))
  ;:  weld
      (expect-eq !>(50) !>((lent p.items)))
      (expect-eq !>(`json`~) !>((need (get:w second 'nextOffset'))))
      (expect !>((lth (met 3 (str:w fun 'description')) 1.000)))
      (expect !>((lth (met 3 (help:tlon '')) 1.000)))
      (expect !>((lth (met 3 (help:tlon 'messages')) (met 3 (help:tlon 'notes')))))
  ==
--
