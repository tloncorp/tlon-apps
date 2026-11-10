/-  n=notes, s=story, d=channels-ver
/+  *test, imports=harness-tlon-notes-import, md=harness-tlon-notes-markdown,
    migration=harness-tlon-notes-migration, notes=harness-tlon-notes-tool, spec=harness-tlon-tool
|%
++  args
  |=  raw=@t
  (pairs:enjs:format ~[['tree' %s raw]])
++  test-import-flat-and-tree
  =/  tree
    %-  tree:imports
    %-  args
    '[{"type":"note","title":"First","text":""},{"type":"folder","title":"Folder","children":[{"type":"note","title":"Nested","text":"Body"}]}]'
  (expect-eq !>([2 1 4]) !>((sizes:imports tree)))
++  test-import-rejects-malformed-or-lossy-payload
  =/  bad=(list @t)
    :~  '[]'  '{}'  '[{"type":"note","title":"A"}]'
        '[{"type":"note","title":"A","text":3}]'
        '[{"type":"note","title":"A","text":"body","typo":"lost"}]'
        '[{"type":"folder","title":"..","children":[]}]'
        '[{"type":"folder","title":"A","children":{}}]'
        '[{"type":"unknown","title":"A"}]'
    ==
  (expect !>((levy bad |=(raw=@t =(~ (mole |.((tree:imports (args raw)))))))))
++  test-import-node-cap
  =/  value=json  [%a (reap 101 (need (de:json:html '{"type":"note","title":"A","text":""}')))]
  (expect !>(=(~ (mole |.((tree:imports (args (en:json:html value))))))))
++  test-import-depth-cap
  =/  value=json  [%a ~[[%o (~(put by *(map @t json)) 'unused' ~)]]]
  (expect !>(=(~ (mole |.((nodes:imports value 9 0))))))
++  test-notes-role-parsing-is-strict
  =/  lib  ~(. notes *bowl:gall)
  =/  bad=(list @t)  ~['{}' '[3]' '["admin","admin"]' '["not a role"]']
  %-  expect
  !>((levy bad |=(raw=@t =(~ (mole |.((readers:lib (pairs:enjs:format ~[['readers' %s raw]]))))))))
++  test-group-nest-notes-is-not-a-message-destination
  =/  nest  (group-nest:spec 'notes/~lux/book')
  (expect !>(&(=(%notes kind.nest) =(~ (mole |.((nest:spec 'notes/~lux/book')))))))
++  test-migration-widening
  =/  lib  ~(. migration *bowl:gall)
  %-  expect
  !>  ?&  (widening:lib ~ (silt ~[%editors]) ~ |)  (widening:lib ~ ~ ~ &)
          (widening:lib (silt ~[%readers]) (silt ~[%editors]) ~ |)
          !(widening:lib (silt ~[%editors]) (silt ~[%editors]) ~ |)
          !(widening:lib (silt ~[%admins]) (silt ~[%editors]) (silt ~[%admins]) |)
          !(widening:lib ~ ~ ~ |)
      ==
++  test-markdown-preserves-rich-content
  =/  value=story:s
    :~  [%block %header %h2 ~['Heading']]
        :*  %inline
            :~  [%bold ~['bold']]  ' '  [%italics ~['italic']]  [%tag 'tag']  [%block 1 'reference']
                [%sect ~]  [%task & ~['task']]
            ==
        ==
        [%block %image 'https://example.com/a.png' 1 1 'alt']
        [%block %listing %list %ordered ~[[%item ~['one']] [%item ~['two']]] ~]
        [%block %code '```\0aexample' 'hoon']
    ==
  =/  out  (markdown:md value)
  =/  expected=(list @t)
    :~  '## Heading'  '**bold**'  '*italic*'  'reference'  'tag'  '@all'  '[x] task'
        '![alt](https://example.com/a.png)'  '1. one'  '````hoon'
    ==
  (expect !>((levy expected |=(part=@t ?=(^ (find (trip part) (trip out)))))))
++  test-markdown-escapes-prose-and-url-delimiters
  %-  expect
  !>  ?&  =('&lt;script&gt;' (escape:md '<script>'))
          =('https://example.com/a%28b%29' (url:md 'https://example.com/a(b)'))
          =(~ (mole |.((url:md 'https://example.com/\0abad'))))
      ==
++  test-migration-records-attribution-and-source
  =/  lib  ~(. migration *bowl:gall)
  =/  =post:v10:d  *post:v10:d
  =.  post  post(id ~2026.9.9, seq 1, sent ~2026.9.9, author ~lux, content ~[[%inline ~['Body']]])
  =/  note  (converted:lib 'diary/~lux/source' post)
  %-  expect
  !>  ?&  ?=(^ (find "Originally posted by ~lux" (trip body.note)))
          ?=(^ (find "/1/chan/diary/~lux/source/note/" (trip body.note)))
          ?=(^ (find (trip marker.note) (trip body.note)))
      ==
++  test-migration-rejects-unknown-payload
  =/  lib  ~(. migration *bowl:gall)
  =/  =post:v10:d  *post:v10:d
  =.  post  post(blob `'custom')
  (expect !>(=(~ (mole |.((converted:lib 'diary/~lux/source' post))))))
++  test-migration-provenance-is-a-complete-final-line
  =/  lib  ~(. migration *bowl:gall)
  =/  marker  '<!-- harness-notes-migrate: diary/~lux/source 123 -->'
  %-  expect
  !>  ?&  =(`marker (provenance:lib (cat 3 'body\0a' marker)))
          =(~ (provenance:lib (cat 3 marker '\0aunrelated')))
      ==
::
++  import-request
  |=  [args=json changed=?]
  ^-  [body=@t action=(unit action:v1:n)]
  =/  =bowl:gall  *bowl:gall
  =.  bowl  bowl(our ~lux, src ~lux, now ~2026.10.1)
  =/  folder  *folder:n
  =.  folder  folder(id 1, name 'Root')
  =/  note  *note:n
  =.  note  note(id 2, folder-id 1, title 'Existing')
  =/  attempt
    |.
    =/  result  (run:~(. notes bowl) args /tlon-tool/0v1)
    ?~  effect.result  [body.result ~]
    ?>  ?=([%pass * %agent [@ %notes] %poke %notes-action-1 *] u.effect.result)
    =/  [pass=* wire=* agent=* who=* poke=* mark=* data=vase]  u.effect.result
    [body.result `!<(action:v1:n data)]
  =/  checked
    %+  mink  [attempt %9 2 %0 1]
    |=  [ref=* raw=*]
    ^-  (unit (unit noun))
    =/  path  ;;(path raw)
    ?:  =(%$ (rear path))  ``&
    ?:  (lien path |=(part=@ta =(%folders part)))  ``~[folder]
    ?:  ?=([%gx @ %notes @ %v0 %notes *] path)
      ``?:(changed ~[note] `(list note:n)`~)
    ~
  ?>  ?=(%0 -.checked)
  ;;([body=@t action=(unit action:v1:n)] product.checked)
::
++  test-import-plan-binds-tree-and-current-destination
  =/  args
    %-  pairs:enjs:format
    :~  ['action' %s 'plan_notes_import']
        ['notebook' %s '~lux/book']
        ['folder_id' %s '1']
        ['tree' %s '[{"type":"note","title":"Title","text":"Body"}]']
    ==
  =/  planned  (import-request args |)
  =/  preview  (need (de:json:html body.planned))
  ?>  ?=(%o -.preview)
  ?>  ?=(%o -.args)
  =.  p.args  (~(put by p.args) 'action' [%s 'import_notes'])
  =.  p.args  (~(put by p.args) 'revision' (~(got by p.preview) 'revision'))
  =.  p.args  (~(put by p.args) 'confirm' (~(got by p.preview) 'confirm'))
  =/  applied  (import-request args |)
  =/  changed-tree
    args(p (~(put by p.args) 'tree' [%s '[{"type":"note","title":"Title","text":"Changed"}]']))
  =/  expected=action:v1:n
    [0v1 %notebook [~lux %book] %batch-import-tree 1 ~[[%note 'Title' 'Body']]]
  ;:  weld
      (expect-eq !>(~) !>(action.planned))
      (expect-eq !>(`expected) !>(action.applied))
      (expect-eq !>(~) !>((mole |.((import-request changed-tree |)))))
      (expect-eq !>(~) !>((mole |.((import-request args &)))))
  ==
--
