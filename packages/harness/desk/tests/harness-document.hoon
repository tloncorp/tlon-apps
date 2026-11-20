/+  *test, document=harness-document
|%
++  parse
  |=  body=@t
  (blocks:document (lines:document body))
++  test-block-boundaries-and-list-kinds
  =/  expected
    :~  (element:document %h1 ~[(text:document 'Head')])
        (element:document %p ~[(text:document 'first\0asecond')])
        %+  element:document
          %ul
        :~  (element:document %li ~[(text:document 'one')])
            (element:document %li ~[(text:document 'two')])
        ==
        %+  element:document
          %ol
        :~  (element:document %li ~[(text:document 'three')])
            (element:document %li ~[(text:document 'four')])
        ==
        (element:document %blockquote ~[(element:document %p ~[(text:document 'quote')])])
        (element:document %hr ~)
    ==
  %+  expect-eq
    !>(expected)
  !>((parse '# Head\0afirst\0asecond\0a- one\0a+ two\0a1. three\0a2. four\0a> quote\0a---'))
++  test-fences-keep-literal-content-and-consume-the-closing-line
  =/  code
    (element:document %pre ~[(element:document %code ~[(text:document '**literal**\0a<raw>\0a')])])
  ;:  weld
      %+  expect-eq
        !>(~[code (element:document %p ~[(text:document 'after')])])
      !>((parse '```hoon\0a**literal**\0a<raw>\0a```\0aafter'))
      (expect-eq !>(~[code]) !>((parse '~~~\0a**literal**\0a<raw>')))
  ==
++  test-table-stops-at-a-line-without-a-pipe
  =/  table
    %+  element:document  %table
    :~  %+  element:document
          %thead
        :~  %+  element:document
              %tr
            :~  (element:document %th ~[(text:document 'a')])
                (element:document %th ~[(text:document 'b')])
            ==
        ==
        %+  element:document
          %tbody
        :~  %+  element:document
              %tr
            :~  (element:document %td ~[(text:document 'c')])
                (element:document %td ~[(text:document 'd')])
            ==
        ==
    ==
  =/  expected
    :~  (element:document %p ~[(text:document 'before')])
        table
        (element:document %p ~[(text:document 'after')])
    ==
  (expect-eq !>(expected) !>((parse 'before\0a|a|b|\0a|---|:---:|\0a|c|d|\0aafter')))
++  test-inline-recursion-and-formatting-attempts-are-bounded
  =/  repeated  (rap 3 (reap 33 '**x**'))
  =/  expected
    (snoc (reap 32 (element:document %strong ~[(text:document 'x')])) (text:document '**x**'))
  =/  long  (cat 3 (crip (reap 16.001 'x')) '**y**')
  ;:  weld
      (expect-eq !>(~[(text:document '**x**')]) !>((inlines:document "**x**" 8)))
      (expect-eq !>(expected) !>((inline:document repeated)))
      (expect-eq !>(~[(text:document long)]) !>((inline:document long)))
  ==
++  test-unsafe-links-stay-literal
  %-  zing
  %+  turn
    ^-  (list @t)
    :~  'javascript:alert'  'data:text/plain,hello'  '//example.com'
        'https://example.com/has space'  'https://example.com/has\0apath'
        'https://example.com/has\\path'
    ==
  |=  url=@t
  =/  markup  (rap 3 '[link](' url ')' ~)
  (expect-eq !>(~[(text:document markup)]) !>((inline:document markup)))
++  test-publication-size-limits
  =/  title  (mule |.((page:document (crip (reap 257 'x')) 'body')))
  =/  body  (mule |.((page:document 'title' (crip (reap 262.145 'x')))))
  ;:  weld
      (expect !>(?=(%| -.title)))
      (expect !>(?=(%| -.body)))
  ==
--
