/-  h=harness
/+  *test, text=harness-text, ht=harness-tools, curl=harness-curl, hp=harness-provider,
    hj=harness-json
|%
++  test-unicode-survives-and-clips-at-complete-characters
  ;:  weld
      (expect-eq !>('ASCII\0aé中🐛') !>((clean:text 'ASCII\0aé中🐛')))
      (expect-eq !>('é ...(truncated)') !>((clip:ht 'é🐛end' 5)))
      (expect-eq !>('é🐛 ...(truncated)') !>((clip:ht 'é🐛end' 6)))
      (expect-eq !>(' ...(truncated)') !>((clip:ht '🐛' 0)))
      (expect-eq !>('🐛') !>((clip:ht '🐛' 4)))
  ==
++  broken
  (rap 3 'prefix ' (end [3 2] '🐛') ' ...(truncated)' ~)
++  test-page-cut-through-flag-at-http-limit
  =/  prefix=@t  (rap 3 (reap 7.994 'a'))
  =/  page  (rap 3 prefix '🇷🇺' ' rest of page' ~)
  =/  result  (clip:ht page 8.000)
  ;:  weld
      (expect-eq !>((rap 3 prefix '🇷' ' ...(truncated)' ~)) !>(result))
      (expect !>((sune:de:json:html result)))
      (expect-eq !>(result) !>((bounded:curl page)))
  ==
++  test-arbitrary-http-bytes-are-safe-text
  ;:  weld
      (expect-eq !>('prefix �� ...(truncated)') !>((clean:text broken)))
      (expect-eq !>('�x') !>((clean:text (cat 3 `@t`0xff 'x'))))
      (expect-eq !>('���') !>((clean:text `@t`0x80.a0ed)))
      (expect-eq !>('����') !>((clean:text `@t`0x8080.90f4)))
      (expect-eq !>((clean:text broken)) !>((bounded:curl broken)))
  ==
++  test-tool-projections-keep-recorded-bytes-and-emit-safe-json
  =/  =item:h  [%tool 'call' 'http_fetch' broken]
  =/  expected  (clean:text broken)
  =/  response  (need (de:json:html (en:json:html (snag 0 (responses-item:hp item)))))
  =/  chat  (item-json:hp item)
  =/  ui  (item-ui-json:hj item)
  ?>  &(?=(%o -.response) ?=(%o -.chat) ?=(%o -.ui) ?=(%tool -.item))
  ;:  weld
      (expect-eq !>(`[%s expected]) !>((~(get by p.response) 'output')))
      (expect-eq !>(`[%s expected]) !>((~(get by p.chat) 'content')))
      (expect-eq !>(`[%s expected]) !>((~(get by p.ui) 'body')))
      (expect-eq !>(broken) !>(body.item))
  ==
--
