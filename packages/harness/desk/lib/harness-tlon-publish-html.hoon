::  Notes serves publications on the ship's authenticated origin. Never pass
::  arbitrary HTML through: parse, allow only inert markup, then serialize.
|%
++  text
  |=  value=@t
  ^-  manx
  [[%$ ~[[%$ (trip value)]]] ~]
++  safe-url
  |=  value=tape
  ^-  ?
  =/  raw  (crip value)
  ?&  |(=('https://' (end [3 8] raw)) =('http://' (end [3 7] raw)))
      !(lien value |=(c=@t |((lte c 32) =(c 127) =(c 92))))
      ?=(^ (de-purl:html raw))
  ==
++  validate
  |=  [node=manx depth=@ud]
  ^-  ?
  ?.  (lth depth 32)  |
  ?:  ?=([%$ [[%$ *] ~]] g.node)  =(~ c.node)
  ?.  ?=  $?  %article
              %section
              %div
              %p
              %h1
              %h2
              %h3
              %h4
              %h5
              %h6
              %ul
              %ol
              %li
              %blockquote
              %pre
              %code
              %strong
              %em
              %b
              %i
              %s
              %del
              %hr
              %br
              %a
              %img
              %table
              %thead
              %tbody
              %tr
              %th
              %td  %caption  %figure  %figcaption
          ==
      n.g.node
    |
  ?&  (levy c.node |=(child=manx (validate child +(depth))))
      %+  levy  a.g.node
      |=  attr=[n=mane v=tape]
      ?:  =(%title n.attr)  &
      ?:  &(=(%a n.g.node) =(%href n.attr))  (safe-url v.attr)
      ?:  &(=(%img n.g.node) =(%src n.attr))  (safe-url v.attr)
      &(=(%img n.g.node) =(%alt n.attr))
  ==
++  page
  |=  [title=@t body=@t raw=(unit @t)]
  ^-  @t
  ?>  (lte (met 3 body) 262.144)
  =/  content=manx
    ?~  raw  [[%pre ~] ~[(text body)]]
    =/  parsed  (need (de-xml:html (rap 3 '<article>' u.raw '</article>' ~)))
    ?>  (validate parsed 0)
    parsed
  =/  head=manx
    :-  [%head ~]
    :~  [[%meta ~[[%charset "utf-8"]]] ~]
        [[%meta ~[[%name "viewport"] [%content "width=device-width, initial-scale=1"]]] ~]
        :*  :*  %meta
                :~  [%http-equiv "Content-Security-Policy"]
                    :*  %content
                        "default-src 'none'; img-src https: http:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
                    ==
                ==
            ==
            ~
        ==
        [[%meta ~[[%name "referrer"] [%content "no-referrer"]]] ~]
        [[%title ~] ~[(text title)]]
    ==
  =/  main=manx
    [[%main ~] ~[[[%h1 ~] ~[(text title)]] content]]
  =/  doc=manx  [[%html ~[[%lang "en"]]] ~[head [[%body ~] ~[main]]]]
  (cat 3 '<!doctype html>\0a' (crip (en-xml:html doc)))
--
