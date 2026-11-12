/-  h=harness, t=harness-tlon, *harness-store
/+  *test, ht=harness-tools, hj=harness-json, hl=harness, storage=harness-store,
    policy=harness-defaults, tp=harness-tlon-policy, effects=harness-effects,
    w=harness-provider-wire
|%
++  test-read-pages-beyond-the-first-fifty-kilobytes-and-fences-edits
  =/  body  (rap 3 (reap 60.000 'x'))
  =/  run  ~(. effects [*bowl:gall ~])
  =/  attempt
    |.
    =/  first  (need (de:json:html (read-desk-file:run '{"path":"/harness/example/hoon"}')))
    =/  revision  (str:w first 'revision')
    =/  args
      %-  en:json:html
      %-  pairs:enjs:format
      ~[['path' %s '/harness/example/hoon'] ['offset' %s '54000'] ['revision' %s revision]]
    =/  last  (need (de:json:html (read-desk-file:run args)))
    =/  changed
      %-  read-desk-file:run
      '{"path":"/harness/example/hoon","offset":"6000","revision":"wrong"}'
    ;:  weld
        (expect-eq !>(6.000) !>((met 3 (str:w last 'text'))))
        (expect-eq !>(`json`~) !>((need (get:w last 'nextOffset'))))
        (expect !>((find-sub:ht 'file changed' changed)))
    ==
  =/  out
    %+  mink  [attempt %9 2 %0 1]
    |=  [ref=* raw=*]
    ^-  (unit (unit noun))
    =/  path  ;;(path raw)
    ?:  (lien path |=(part=@ta |(=(%u part) =(%cu part))))  ``&
    ``body
  ?>  ?=(%0 -.out)
  ;;(tang product.out)
++  test-tool-path-parses-string-arguments
  =/  run  ~(. effects [*bowl:gall *(map mcp-server-id:h mcp-server:h)])
  %+  expect-eq
    !>(`(unit path)`[~ /harness/lib/harness/hoon])
  !>((tool-path:run '{"path":"/harness/lib/harness/hoon"}'))
++  test-tool-path-rejects-malformed-arguments
  =/  run  ~(. effects [*bowl:gall *(map mcp-server-id:h mcp-server:h)])
  %-  expect
  !>  %+  levy
        `(list @t)`~['not json' '[]' '{}' '{"path":7}' '{"path":null}' '{"path":"not a path"}']
      |=(args=@t =(~ (tool-path:run args)))
++  test-raw-source-does-not-require-desk-converters
  %+  expect-eq
    !>(':: fixture\0a|=  a=@ud\0a+(a)')
  !>((clay-text:ht %hoon ':: fixture\0a|=  a=@ud\0a+(a)'))
++  test-raw-json-is-rendered-locally
  (expect-eq !>('["fixture"]') !>((clay-text:ht %json [%a ~[[%s 'fixture']]])))
++  test-unknown-formats-do-not-execute-converters
  %+  expect-eq
    !>('error: unsupported Clay data format; desk-defined converters are not executed')
  !>((clay-text:ht %custom ~))
++  test-malformed-source-data-fails-closed
  (expect-eq !>('error: invalid Hoon source data') !>((clay-text:ht %hoon [1 2])))
++  test-path-grants-compare-components-not-text-prefixes
  =/  grants=(list tool-grant:h)  ~[[%clay /harness/lib]]
  %-  expect
  !>  ?&  (clay-granted:ht /harness/lib/harness/hoon grants)  (clay-granted:ht /harness/lib grants)
          !(clay-granted:ht /harness/library grants)  !(clay-granted:ht /harness grants)
          !(clay-granted:ht /base/lib grants)
      ==
++  test-file-grants-do-not-grant-parent-listing
  =/  grants=(list tool-grant:h)  ~[[%clay /harness/lib/harness/hoon]]
  %-  expect
  !>(&((clay-granted:ht /harness/lib/harness/hoon grants) !(clay-granted:ht /harness/lib grants)))
++  test-path-and-legacy-root-grants-roundtrip
  =/  scoped=tool-grant:h  [%clay /harness/lib]
  =/  broad=tool-grant:h  [%clay ~]
  %-  expect
  !>  ?&  =(scoped (json-grant:hj (grant-json:hj scoped)))
          =(broad (json-grant:hj (grant-json:hj broad)))
      ==
++  test-bare-clay-grants-are-inactive-and-rejected-on-write
  =/  legacy  (mule |.((json-grant:hj [%s 'clay'])))
  %-  expect
  !>  ?&  ?=(%| -.legacy)  !(tool-granted:ht 'read_desk_file' ~[%clay])
          !(clay-granted:ht /base ~[%clay])
      ==
++  test-forged-path-is-denied-before-any-scry
  =/  run  ~(. effects [*bowl:gall *(map mcp-server-id:h mcp-server:h)])
  =/  out
    %^  run-tool:run
      ['call' 'read_desk_file' '{"path":"/base/private/hoon"}']
      ~
    ~[[%clay /harness/lib]]
  ?>  ?=(%tool-completed -.out)
  (expect-eq !>('rejected: tool or path is not granted for this session') !>(body.out))
++  test-rehearsal-preserves-only-inherited-clay-prefixes
  =/  out  (rehearsal-tools:ht ~[%web [%clay /harness/lib] %skills [%mcp 'a']])
  (expect-eq !>(`(list tool-grant:h)`~[[%clay /harness/lib] %skills]) !>(out))
--
