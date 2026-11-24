::  Convert text and a small Markdown subset to native Story, and back to text.
::
/-  d=story, cite
|%
::
::  +story-to-text: extract plain text from a story
::    handles both inline and block verses (code, citations, headers)
::
++  story-to-text
  |=  =story:d
  ^-  @t
  =/  parts=(list @t)
    %+  murn  story
    |=  =verse:d
    ?:  ?=([%inline *] verse)
      =/  text=@t  (inlines-to-text p.verse)
      ?:  =('' text)  ~
      `text
    ::  block verse handling
    =/  block  p.verse
    ?-  -.block
      %code  `(rap 3 '```' lang.block '\0a' code.block '\0a```' ~)
      %header  `(inlines-to-text q.block)
      %listing  `(listing-to-text p.block)
      %rule  `'---'
      %cite  `(rap 3 '[citation: ' (spat (print:cite cite.block)) ']' ~)
        %image
      ?:  =('' alt.block)
        `(rap 3 '[Image: ' src.block ']' ~)
      `(rap 3 '[Image: ' alt.block ' - ' src.block ']' ~)
      %link  `(rap 3 '[Link: ' url.block ']' ~)
    ==
  ?~  parts  ''
  =/  text=@t  i.parts
  =/  remaining=(list @t)  t.parts
  |-
  ?~  remaining  text
  $(remaining t.remaining, text (rap 3 text '\0a' i.remaining ~))
::
++  inlines-to-text
  |=  inlines=(list inline:d)
  ^-  @t
  ?~  inlines  ''
  =/  text=@t
    ?@  i.inlines  i.inlines
    ?+  -.i.inlines  ''
      %bold  $(inlines p.i.inlines)
      %italics  $(inlines p.i.inlines)
      %strike  $(inlines p.i.inlines)
      %blockquote  $(inlines p.i.inlines)
      %inline-code  p.i.inlines
      %code  p.i.inlines
      %ship  (scot %p p.i.inlines)
      %link  (rap 3 q.i.inlines ' (' p.i.inlines ')' ~)
      %break  '\0a'
    ==
  =/  rest=@t  $(inlines t.inlines)
  ?:  =('' text)  rest
  ?:  =('' rest)  text
  (rap 3 text rest ~)
::
++  listing-to-text
  |=  node=listing:d
  ^-  @t
  ?:  ?=(%item -.node)  (inlines-to-text p.node)
  =/  children
    %+  turn  q.node
    |=  child=listing:d
    (cat 3 (listing-to-text child) '\0a')
  (rap 3 (inlines-to-text r.node) '\0a' (rap 3 children) ~)
::  Fenced code is parsed before prose: blank lines and Markdown delimiters
::  inside it must remain literal. Everything else uses the small inline codec.
++  text-to-story
  |=  text=@t
  ^-  story:d
  =/  lines  (split-lines (trip text))
  =/  language=(unit @t)  ~
  =/  buffer=@t  ''
  =/  verses=story:d  ~
  |-  ^-  story:d
      ?~  lines
        (weld verses ?~(language (prose-to-story buffer) ~[[%block %code buffer u.language]]))
      =/  line=@t  i.lines
      ?:  =('```' (end 3^3 line))
        ?~  language
          %=  $
            lines  t.lines
            language  `(rsh 3^3 line)
            buffer  ''
            verses  (weld verses (prose-to-story buffer))
          ==
        %=  $
          lines  t.lines
          language  ~
          buffer  ''
          verses  (snoc verses [%block %code buffer u.language])
        ==
      =/  picture  ?~(language (image-line line) ~)
      ?^  picture
        %=  $
          lines  t.lines
          buffer  ''
          verses  (snoc (weld verses (prose-to-story buffer)) u.picture)
        ==
      $(lines t.lines, buffer (rap 3 buffer line ?~(t.lines '' '\0a') ~))
::  Only standalone image syntax becomes a native block. Fenced examples,
::  inline mentions and malformed destinations remain ordinary prose.
++  image-line
  |=  line=@t
  ^-  (unit verse:d)
  ?.  =('![' (end 3^2 line))  ~
  =/  label  (try-delimited "](" (trip (rsh 3^2 line)))
  ?~  label  ~
  =/  target  (try-delimited ")" +.u.label)
  ?~  target  ~
  ?.  =(~ +.u.target)  ~
  =/  url=@t  (crip -.u.target)
  ?.  &((lte (met 3 url) 2.048) |(=('https://' (end 3^8 url)) =('http://' (end 3^7 url))))  ~
  ?.  (gth (met 3 url) ?:(=('https://' (end 3^8 url)) 8 7))  ~
  ?:  (lien -.u.target |=(c=@t (lte c 32)))  ~
  ?~  (de-purl:html url)  ~
  `[%block %image url 0 0 (crip -.u.label)]
++  split-lines
  |=  chars=tape
  ^-  (list @t)
  =/  reversed-line=tape  ~
  =/  reversed-lines=(list @t)  ~
  |-
  ?~  chars  (flop [(crip (flop reversed-line)) reversed-lines])
  ?:  =(10 i.chars)
    %=  $
      chars  t.chars
      reversed-line  ~
      reversed-lines  [(crip (flop reversed-line)) reversed-lines]
    ==
  $(chars t.chars, reversed-line [i.chars reversed-line])
::
::  +prose-to-story: paragraph order is preserved; empty verses are omitted.
::
++  prose-to-story
  |=  text=@t
  ^-  story:d
  (murn (split-paragraphs text) paragraph-to-verse)
::
++  paragraph-to-verse
  |=  text=@t
  ^-  (unit verse:d)
  =/  paragraph  (trip text)
  ::  Headers consume at most six leading hashes and one optional space.
  ?:  &(?=(^ paragraph) =(i.paragraph '#'))
    =/  level=@ud  1
    =/  rest  t.paragraph
    |-
    ?~  rest  ~
    ?:  &(=(i.rest '#') (lth level 6))
      $(rest t.rest, level +(level))
    =/  content  ?:(=(i.rest ' ') t.rest rest)
    =/  inlines  (parse-inlines (crip content))
    ?~  inlines  ~
    =/  tag=?(%h1 %h2 %h3 %h4 %h5 %h6)
      ?:  =(1 level)  %h1
      ?:  =(2 level)  %h2
      ?:  =(3 level)  %h3
      ?:  =(4 level)  %h4
      ?:  =(5 level)  %h5
      %h6
    `[%block %header tag inlines]
  ?:  &(?=(^ paragraph) =(i.paragraph '>'))
    =/  rest  t.paragraph
    =?  rest  &(?=(^ rest) =(i.rest ' '))  t.rest
    =/  inlines  (parse-inlines (crip rest))
    ?~  inlines  ~
    `[%inline `(list inline:d)`~[`inline:d`[%blockquote inlines]]]
  =/  inlines  (parse-inlines text)
  ?~  inlines  ~
  `[%inline inlines]
::
::  +split-paragraphs: split text on double-newlines
::
++  split-paragraphs
  |=  text=@t
  ^-  (list @t)
  =/  chars=tape  (trip text)
  =/  reversed-paragraphs=(list @t)  ~
  =/  reversed-paragraph=tape  ~
  |-
  ?~  chars
    ?~  reversed-paragraph  (flop reversed-paragraphs)
    (flop [(crip (flop reversed-paragraph)) reversed-paragraphs])
  ?:  &(=(i.chars 10) ?=(^ t.chars) =(i.t.chars 10))
    ::  double newline: emit paragraph, skip both newlines
    =/  rest=tape  t.t.chars
    ::  skip any additional newlines
    |-
    ?~  rest  ^$(chars ~)
    ?.  =(i.rest 10)
      ?~  reversed-paragraph  ^$(chars rest)
      %=  ^$  chars  rest  reversed-paragraphs
          [(crip (flop reversed-paragraph)) reversed-paragraphs]  reversed-paragraph  ~
      ==
    $(rest t.rest)
  $(chars t.chars, reversed-paragraph [i.chars reversed-paragraph])
::
::  +flush-buf: prepend buffered text to the reversed inline list
::
++  flush-buf
  |=  [reversed-text=tape reversed-inlines=(list inline:d)]
  ^-  (list inline:d)
  ?~  reversed-text  reversed-inlines
  [`inline:d`(crip (flop reversed-text)) reversed-inlines]
::
::  +try-delimited: try to match text between delimiters
::    returns (unit [matched=tape rest=tape]) or ~ if no closing delimiter
::
++  try-delimited
  |=  [delimiter=tape chars=tape]
  ^-  (unit [tape tape])
  =/  length=@ud  (lent delimiter)
  =/  reversed=tape  ~
  =/  rest=tape  chars
  |-
  ?~  rest  ~
  ::  check if rest starts with delimiter
  =/  prefix=tape  (scag length `(list @)`rest)
  ?:  =(prefix delimiter)
    `[(flop reversed) (slag length `(list @)`rest)]
  $(rest t.rest, reversed [i.rest reversed])
::
::  +try-ship: try to parse a ship mention starting after ~
::
++  try-ship
  |=  chars=tape
  ^-  (unit [@p tape])
  =/  reversed-name=tape  ~
  =/  rest=tape  chars
  |-
  ?~  rest
    ::  end of string, try to parse
    ?:  (lth (lent reversed-name) 3)  ~
    =/  name=@t  (crip (weld "~" (flop reversed-name)))
    (bind (slaw %p name) |=(p=@p [p ~]))
  =/  char=@tD  i.rest
  ?:  ?|  =(char '-')
          &((gte char 'a') (lte char 'z'))
          &((gte char '0') (lte char '9'))
      ==
    $(rest t.rest, reversed-name [char reversed-name])
  ::  non-ship char, try to parse what we have
  ?:  (lth (lent reversed-name) 3)  ~
  =/  name=@t  (crip (weld "~" (flop reversed-name)))
  =/  parsed=(unit @p)  (slaw %p name)
  ?~  parsed  ~
  `[u.parsed rest]
::
::  +parse-inlines: parse text into inlines with markdown support
::    handles: ~ship mentions, `inline-code`, **bold**, *italic*, ~~strike~~, \n breaks
::
++  parse-inlines
  |=  text=@t
  ^-  (list inline:d)
  =/  chars=tape  (trip text)
  =/  reversed-inlines=(list inline:d)  ~
  =/  reversed-text=tape  ~
  |-
  ?~  chars
    (flop (flush-buf reversed-text reversed-inlines))
  =/  parsed  (parse-inline chars)
  ?~  parsed
    $(chars t.chars, reversed-text [i.chars reversed-text])
  %=  $
    chars  rest.u.parsed
    reversed-text  ~
    reversed-inlines  [value.u.parsed (flush-buf reversed-text reversed-inlines)]
  ==
::  Recognize one inline at the cursor; failed delimiters remain plain text.
::
++  parse-inline
  |=  chars=tape
  ^-  (unit [value=inline:d rest=tape])
  ?~  chars  ~
  ?:  =(i.chars 10)  `[[%break ~] t.chars]
  ::  Links retain both their label and destination.
  ?:  =(i.chars '[')
    =/  label  (try-delimited "](" t.chars)
    ?~  label  ~
    =/  url  (try-delimited ")" +.u.label)
    ?~  url  ~
    `[[%link (crip -.u.url) (crip -.u.label)] +.u.url]
  ::  Paired markers take precedence over ship mentions and single asterisks.
  ?:  ?=([%'~' %'~' *] chars)
    (styled-inline %strike "~~" t.t.chars)
  ?:  =(i.chars '~')
    =/  result  (try-ship t.chars)
    ?~  result  ~
    `[[%ship -.u.result] +.u.result]
  ?:  =(i.chars '`')
    =/  result  (try-delimited "`" t.chars)
    ?~  result  ~
    `[[%inline-code (crip -.u.result)] +.u.result]
  ?:  ?=([%'*' %'*' *] chars)
    (styled-inline %bold "**" t.t.chars)
  ?:  =(i.chars '*')
    (styled-inline %italics "*" t.chars)
  ~
::
++  styled-inline
  |=  [style=?(%strike %bold %italics) delimiter=tape chars=tape]
  ^-  (unit [value=inline:d rest=tape])
  =/  result  (try-delimited delimiter chars)
  ?~  result  ~
  =/  body=(list inline:d)  ~[(crip -.u.result)]
  =/  value=inline:d
    ?-  style
      %strike  [%strike body]
      %bold  [%bold body]
      %italics  [%italics body]
    ==
  `[value +.u.result]
--
