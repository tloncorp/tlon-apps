/-  d=story
/+  *test, story=harness-tlon-story
|%
++  test-inline-parser-preserves-plain-text-and-empty-input
  ;:  weld
      (expect-eq !>(`(list inline:d)`~) !>((parse-inlines:story '')))
      (expect-eq !>(`(list inline:d)`~['Plain text.']) !>((parse-inlines:story 'Plain text.')))
  ==
++  test-inline-parser-flushes-text-around-each-kind
  =/  expected=(list inline:d)
    :~  'a '  [%ship ~zod]  ' '  [%bold ~['b']]  ' '  [%italics ~['i']]  ' '
        [%strike ~['s']]  ' '  [%inline-code 'c']  ' '  [%link 'https://example.com' 'l']
        [%break ~]  'z'
    ==
  %+  expect-eq
    !>(expected)
  !>((parse-inlines:story 'a ~zod **b** *i* ~~s~~ `c` [l](https://example.com)\0az'))
++  test-inline-parser-preserves-unclosed-markers-as-text
  =/  examples=(list @t)
    :~  '[label'  '[label](url'  '**open'  '*open'  '~~open'  '`open'  '~notaship'
    ==
  %-  zing
  %+  turn  examples
  |=  text=@t
  (expect-eq !>(`(list inline:d)`~[text]) !>((parse-inlines:story text)))
++  test-inline-parser-retains-paired-marker-precedence
  =/  cases=(list [text=@t expected=(list inline:d)])
    :~  ['**open*' ~['*' [%italics ~['open']]]]
        ['~~zod' ~['~' [%ship ~zod]]]
        ['***bold***' ~[[%bold ~['*bold']] '*']]
    ==
  %-  zing
  %+  turn  cases
  |=  [text=@t expected=(list inline:d)]
  (expect-eq !>(expected) !>((parse-inlines:story text)))
++  test-inline-parser-keeps-styled-and-code-bodies-literal
  =/  expected=(list inline:d)
    ~[[%bold ~['a *b* ~zod']] ' ' [%inline-code '**bold** ~zod']]
  %+  expect-eq
    !>(expected)
  !>((parse-inlines:story '**a *b* ~zod** `**bold** ~zod`'))
++  test-inline-parser-retains-empty-delimited-values-and-breaks
  =/  expected=(list inline:d)
    :~  [%bold ~['']]  [%strike ~['']]  [%inline-code '']  [%link '' '']
        [%break ~]  [%break ~]
    ==
  (expect-eq !>(expected) !>((parse-inlines:story '****~~~~``[]()\0a\0a')))
++  test-inline-recognizer-returns-the-unconsumed-tail
  =/  expected=(unit [value=inline:d rest=tape])  `[[%bold ~['b']] "tail"]
  ;:  weld
      (expect-eq !>(expected) !>((parse-inline:story "**b**tail")))
      (expect-eq !>(`(unit [inline:d tape])`~) !>((parse-inline:story "plain")))
      (expect-eq !>(`(unit [inline:d tape])`~) !>((parse-inline:story "")))
  ==
--
