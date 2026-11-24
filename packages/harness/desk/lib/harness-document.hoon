::  Inert Markdown publication. No raw HTML, scripts, embedded resources, or
::  private metadata. Rendering happens once at explicit publication, not GET.
|%
++  text
  |=  value=@t
  ^-  manx
  [[%$ ~[[%$ (trip value)]]] ~]
++  element
  |=  [tag=@ta children=(list manx)]
  ^-  manx
  [[tag ~] children]
++  split
  |=  [delimiter=tape value=tape]
  ^-  (unit [before=tape after=tape])
  =|  reversed-prefix=tape
  =/  width  (lent delimiter)
  |-  ^-  (unit [before=tape after=tape])
      ?:  =(delimiter (scag width value))  `[(flop reversed-prefix) (slag width value)]
      ?~  value  ~
      $(value t.value, reversed-prefix [i.value reversed-prefix])
++  safe-url
  |=  value=@t
  ^-  ?
  ?&  |(=('https://' (end [3 8] value)) =('http://' (end [3 7] value)))
      !(lien (trip value) |=(c=@t |((lte c 32) =(c 127) =(c 92))))
      ?=(^ (de-purl:html value))
  ==
++  inlines
  |=  [value=tape depth=@ud]
  ^-  (list manx)
  ?:  (gte depth 8)  ~[(text (crip value))]
  =/  attempts=@ud  0
  =|  reversed-nodes=(list manx)
  =|  reversed-text=tape
  |-  ^-  (list manx)
      ::  Text and nodes accumulate backward; flush text before a parsed span.
      =/  flush
        |.  ^-  (list manx)
            ?~(reversed-text reversed-nodes [(text (crip (flop reversed-text))) reversed-nodes])
      ?~  value  (flop (flush))
      ?:  (gte attempts 32)  (flop [(text (crip value)) (flush)])
      =?  attempts  ?=(?(%'*' %'~' %'`' %'[') i.value)  +(attempts)
      =/  span=(unit [node=manx tail=tape])
        ?:  =("**" (scag 2 `tape`value))
          =/  part  (split "**" (slag 2 `tape`value))
          ?~  part  ~
          `[(element %strong (inlines before.u.part +(depth))) after.u.part]
        ?:  =("~~" (scag 2 `tape`value))
          =/  part  (split "~~" (slag 2 `tape`value))
          ?~  part  ~
          `[(element %del (inlines before.u.part +(depth))) after.u.part]
        ?:  =(i.value '`')
          =/  part  (split "`" t.value)
          ?~  part  ~
          `[(element %code ~[(text (crip before.u.part))]) after.u.part]
        ?:  =(i.value '*')
          =/  part  (split "*" t.value)
          ?~  part  ~
          `[(element %em (inlines before.u.part +(depth))) after.u.part]
        ?:  =(i.value '[')
          =/  label  (split "](" t.value)
          ?~  label  ~
          =/  link  (split ")" after.u.label)
          ?~  link  ~
          ?.  (safe-url (crip before.u.link))  ~
          =/  node=manx
            :*  [%a ~[[%href before.u.link] [%rel "noopener noreferrer"]]]
                (inlines before.u.label +(depth))
            ==
          `[node after.u.link]
        ~
      ?^  span
        %=  $
          value  tail.u.span
          reversed-nodes  [node.u.span (flush)]
          reversed-text  ~
        ==
      $(value t.value, reversed-text [i.value reversed-text])
++  inline
  |=  value=@t
  ::  Huge unbroken paragraphs stay literal; formatting never makes a public
  ::  document an unbounded parser workload on the ship event loop.
  ?:  (gth (met 3 value) 16.000)  ~[(text value)]
  (inlines (trip value) 0)
++  lines
  |=  value=@t
  ^-  (list @t)
  =/  chars  (trip value)
  =|  reversed-line=tape
  =|  reversed-lines=(list @t)
  |-  ^-  (list @t)
      ?~  chars  (flop [(crip (flop reversed-line)) reversed-lines])
      ?:  =(i.chars '\0d')  $(chars t.chars)
      ?:  =(i.chars '\0a')
        %=  $
          chars  t.chars
          reversed-line  ~
          reversed-lines  [(crip (flop reversed-line)) reversed-lines]
        ==
      $(chars t.chars, reversed-line [i.chars reversed-line])
++  heading
  |=  line=@t
  ^-  (unit [tag=@ta body=@t])
  =/  chars  (trip line)
  =|  count=@ud
  |-  ^-  (unit [tag=@ta body=@t])
      ?~  chars  ~
      ?:  &((lth count 6) =(i.chars '#'))  $(chars t.chars, count +(count))
      ?.  &((gth count 0) =(i.chars ' '))  ~
      `[(cat 3 'h' (scot %ud count)) (crip t.chars)]
++  list-item
  |=  line=@t
  ^-  (unit [tag=@ta body=@t])
  ?:  (lien `(list @t)`~['- ' '* ' '+ '] |=(p=@t =(p (end [3 2] line))))
    `[%ul (rsh [3 2] line)]
  =/  chars  (trip line)
  =|  count=@ud
  |-  ^-  (unit [tag=@ta body=@t])
      ?~  chars  ~
      ?:  &((lth count 9) (gte i.chars '0') (lte i.chars '9'))
        $(chars t.chars, count +(count))
      ?.  &((gth count 0) =(". " (scag 2 `tape`chars)))  ~
      `[%ol (crip (slag 2 `tape`chars))]
++  cells
  |=  line=@t
  ^-  (list @t)
  =/  chars  (trip line)
  =?  chars  ?=([%'|' *] chars)  t.chars
  =|  reversed-cells=(list @t)
  |-  ^-  (list @t)
      ?~  chars  (flop reversed-cells)
      =/  part  (split "|" chars)
      ?~  part  (flop [(crip chars) reversed-cells])
      $(chars after.u.part, reversed-cells [(crip before.u.part) reversed-cells])
++  table-rule
  |=  line=@t
  ^-  ?
  =/  parts  (cells line)
  ?&  ?=(^ parts)
      %+  levy  `(list @t)`parts
      |=  part=@t
      ?&  (gte (lent (skim (trip part) |=(c=@t =(c '-')))) 3)
          (levy (trip part) |=(c=@t ?=(?(%'-' %':' %' ') c)))
      ==
  ==
++  special
  |=  line=@t
  ^-  ?
  ?|  =(line '')
      ?=(^ (heading line))
      ?=(^ (list-item line))
      =('> ' (end [3 2] line))
      =('```' (end [3 3] line))
      =('~~~' (end [3 3] line))
      =(line '---')
  ==
++  blocks
  |=  input=(list @t)
  ^-  (list manx)
  =|  reversed-blocks=(list manx)
  |-  ^-  (list manx)
      ?~  input  (flop reversed-blocks)
      =/  line  i.input
      ?:  =(line '')  $(input t.input)
      =/  title  (heading line)
      ?^  title
        =/  node  (element tag.u.title (inline body.u.title))
        $(input t.input, reversed-blocks [node reversed-blocks])
      ?:  |(=('```' (end [3 3] line)) =('~~~' (end [3 3] line)))
        =/  fence  (end [3 3] line)
        =/  collected  (collect-fence fence t.input)
        =/  node  (element %pre ~[(element %code ~[(text body.collected)])])
        $(input tail.collected, reversed-blocks [node reversed-blocks])
      ?:  =(line '---')  $(input t.input, reversed-blocks [(element %hr ~) reversed-blocks])
      ?:  =('> ' (end [3 2] line))
        =/  node  (element %blockquote ~[(element %p (inline (rsh [3 2] line)))])
        $(input t.input, reversed-blocks [node reversed-blocks])
      =/  item  (list-item line)
      ?^  item
        =/  collected  (collect-list tag.u.item input)
        =/  node  (element tag.u.item items.collected)
        $(input tail.collected, reversed-blocks [node reversed-blocks])
      ?:  &(?=(^ t.input) (table-rule i.t.input) (lien (trip line) |=(c=@t =(c '|'))))
        =/  collected  (collect-table t.t.input)
        =/  table
          %+  element  %table
          :~  (element %thead ~[(table-row line %th)])
              (element %tbody rows.collected)
          ==
        $(input tail.collected, reversed-blocks [table reversed-blocks])
      =/  collected  (collect-paragraph line t.input)
      =/  node  (element %p (inline body.collected))
      $(input tail.collected, reversed-blocks [node reversed-blocks])
::
::  Collectors return both the block content and the first unconsumed line.
++  collect-fence
  |=  [fence=@t tail=(list @t)]
  ^-  [tail=(list @t) body=@t]
  =|  reversed-lines=(list @t)
  |-  ^-  [tail=(list @t) body=@t]
      ?:  |(?=(~ tail) =(fence (end [3 3] i.tail)))
        [?~(tail ~ t.tail) (rap 3 (flop reversed-lines))]
      $(tail t.tail, reversed-lines ['\0a' i.tail reversed-lines])
::
++  collect-list
  |=  [tag=@ta tail=(list @t)]
  ^-  [tail=(list @t) items=(list manx)]
  =|  reversed-items=(list manx)
  |-  ^-  [tail=(list @t) items=(list manx)]
      ?~  tail  [tail (flop reversed-items)]
      =/  next  (list-item i.tail)
      ?.  &(?=(^ next) =(tag tag.u.next))  [tail (flop reversed-items)]
      $(tail t.tail, reversed-items [(element %li (inline body.u.next)) reversed-items])
::
++  table-row
  |=  [line=@t tag=@ta]
  ^-  manx
  %+  element  %tr
  %+  turn  (cells line)
  |=  cell=@t
  (element tag (inline cell))
::
++  collect-table
  |=  tail=(list @t)
  ^-  [tail=(list @t) rows=(list manx)]
  =|  reversed-rows=(list manx)
  |-  ^-  [tail=(list @t) rows=(list manx)]
      ?.  &(?=(^ tail) (lien (trip i.tail) |=(c=@t =(c '|'))))  [tail (flop reversed-rows)]
      $(tail t.tail, reversed-rows [(table-row i.tail %td) reversed-rows])
::
++  collect-paragraph
  |=  [line=@t tail=(list @t)]
  ^-  [tail=(list @t) body=@t]
  =/  reversed-lines=(list @t)  ~[line]
  |-  ^-  [tail=(list @t) body=@t]
      ?:  |(?=(~ tail) (special i.tail))  [tail (rap 3 (flop reversed-lines))]
      ?:  &(?=(^ t.tail) (table-rule i.t.tail) (lien (trip i.tail) |=(c=@t =(c '|'))))
        [tail (rap 3 (flop reversed-lines))]
      $(tail t.tail, reversed-lines [i.tail '\0a' reversed-lines])
++  css
  ^-  @t
  %+  rap  3
  :~  ':root{color-scheme:light dark}*{box-sizing:border-box}'
      'body{margin:0;background:#fff;color:#171917;font:17px/1.7 system-ui,-apple-system,sans-serif}'
      'main{max-width:780px;margin:0 auto;padding:64px 28px 96px;overflow-wrap:anywhere}'
      'h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.6em 0 .65em;letter-spacing:-.02em}'
      'h1{font-size:2.25rem;margin-top:0}h2{font-size:1.6rem}h3{font-size:1.25rem}'
      'p,ul,ol,blockquote,pre,table{margin:0 0 1.25em}a{color:#0969da;text-underline-offset:3px}'
      'code{font: .9em ui-monospace,monospace;background:#f1f3f1;padding:.12em .3em;border-radius:4px}'
      'pre{background:#f1f3f1;padding:18px;overflow:auto;border-radius:8px}pre code{padding:0;background:none}'
      'blockquote{border-left:3px solid #d0d7de;padding-left:20px;color:#626862}'
      'table{display:block;max-width:100%;overflow:auto;border-collapse:collapse}th,td{border:1px solid #d0d7de;padding:8px 12px;text-align:left}'
      'hr{border:0;border-top:1px solid #d0d7de;margin:2em 0}'
      '@media(max-width:600px){body{font-size:16px}main{padding:32px 20px 64px}h1{font-size:1.8rem}}'
      '@media(prefers-color-scheme:dark){body{background:#111310;color:#eef0eb}a{color:#6ea4ff}code,pre{background:#20231f}th,td,hr,blockquote{border-color:#454c43}blockquote{color:#bbc2b7}}'
  ==
++  page
  |=  [title=@t body=@t]
  ^-  @t
  ?>  &((lte (met 3 title) 256) (lte (met 3 body) 262.144))
  =/  head=manx
    :-  [%head ~]
    :~  [[%meta ~[[%charset "utf-8"]]] ~]
        :*  :*  %meta
                :~  [%http-equiv "Content-Security-Policy"]
                    :*  %content
                        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
                    ==
                ==
            ==
            ~
        ==
        [[%meta ~[[%name "viewport"] [%content "width=device-width, initial-scale=1"]]] ~]
        [[%meta ~[[%name "referrer"] [%content "no-referrer"]]] ~]
        (element %title ~[(text title)])
        (element %style ~[(text css)])
    ==
  =/  main  (element %main [(element %h1 ~[(text title)]) (blocks (lines body))])
  =/  doc=manx  [[%html ~[[%lang "en"]]] ~[head (element %body ~[main])]]
  (cat 3 '<!doctype html>\0a' (crip (en-xml:html doc)))
--
