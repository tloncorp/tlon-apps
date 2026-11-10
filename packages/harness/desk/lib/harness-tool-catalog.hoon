::  Tool discovery is a bounded index; exact definitions are read by name.
/+  w=harness-provider-wire
|%
++  select
  |=  [input=json tools=json upstream=@t]
  ^-  json
  ?>  ?=([%a *] tools)
  =/  name  (str:w input 'name')
  =/  cursor  (str:w input 'cursor')
  =/  offset-text  (str:w input 'offset')
  =/  offset=@ud  ?:(=('' offset-text) 0 (need (rush offset-text dem)))
  ?>  (lte offset (lent p.tools))
  =/  selected=(list json)
    ?:  =('' name)  (page (slag offset p.tools))
    (skim p.tools |=(tool=json =(name (str:w tool 'name'))))
  =/  next=json  ~
  =/  following  (add offset (lent selected))
  =?  next  &(=('' name) (lth following (lent p.tools)))
    (put:w input 'offset' [%s (crip (a-co:co following))])
  =?  next  &(=(~ next) !=('' upstream) |(=('' name) =(~ selected)))
    (put:w (put:w input 'cursor' [%s upstream]) 'offset' [%s '0'])
  =?  next  &(!=('' name) ?=([%o *] next))
    (put:w next 'name' [%s name])
  =/  hint
    ?:  =('' name)
      'Use the discovery tool with name and this cursor for the full description and inputSchema before calling. Use next as arguments for another page.'
    ?:  =(~ selected)
      'No matching tool on this page; follow next if present.'
    'Use this inputSchema with the tool call.'
  %-  pairs:enjs:format
  :~  ['tools' %a selected]
      ['cursor' %s cursor]
      ['next' next]
      ['hint' %s hint]
  ==
::  Count and byte bounds keep JSON intact, including unusually long names.
++  page
  |=  tools=(list json)
  ^-  (list json)
  =/  reversed-rows=(list json)  ~
  =/  size=@ud  0
  =/  count=@ud  0
  |-  ^-  (list json)
      ?~  tools  (flop reversed-rows)
      ?:  =(50 count)  (flop reversed-rows)
      =/  name  (str:w i.tools 'name')
      ?>  !=('' name)
      =/  row
        %-  pairs:enjs:format
        :~  ['name' %s name]
            ['description' %s (brief (str:w i.tools 'description'))]
        ==
      =/  bytes  (add 1 (met 3 (en:json:html row)))
      ?:  (gth (add size bytes) 12.000)
        ?>  ?=(^ reversed-rows)
        (flop reversed-rows)
      %=  $
        tools  t.tools
        reversed-rows  [row reversed-rows]
        size  (add size bytes)
        count  +(count)
      ==
++  brief
  |=  text=@t
  ^-  @t
  ?:  (lte (met 3 text) 160)  text
  =/  cap=@ud  160
  |-  ^-  @t
      =/  next  (cut 3 [cap 1] text)
      ::  Stop before an incomplete UTF-8 character, not inside its bytes.
      ?:  &((gte next 128) (lth next 192) (gth cap 0))  $(cap (dec cap))
      (cat 3 (end [3 cap] text) '...')
--
