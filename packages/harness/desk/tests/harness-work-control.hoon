/-  h=harness, c=harness-work-control, w=harness-workspace
/+  *test, control=harness-work-control, view=harness-work-view, j=harness-workspace-json
|%
++  source
  ^-  [%hand binding=@t hand=@t address=@t event=@t actor=@t]
  [%hand 'binding' 'fixture' 'dm/alice' 'request-message' 'alice']
++  request
  ^-  request:c
  ['conversation' 0v1 source ~ 'artifact-save' [%o ~] 0v2 ~2026.9.13 %pending ~]
++  prepared
  ^-  state:c
  =/  out  (prepare:control *state:c 0v3 request ~2026.9.13)
  ?>  ?=(%& -.out)
  p.out
++  test-prepare-retains-exact-payload-with-fifteen-minute-expiry
  =/  db  prepared
  =/  r  (~(got by requests.db) 0v3)
  =/  original  request
  (expect-eq !>(original(expires (add ~2026.9.13 ~m15))) !>(r))
++  test-reply-deduplication-ignores-task-version-and-extra-arguments
  =/  args
    %-  pairs:enjs:format
    :~  ['id' %s 'task']  ['artifact' %s 'result']  ['revision' %n '1']  ['binding' %s 'binding']
        ['actor' %s 'alice']
    ==
  =/  r  request
  =.  r  r(action 'task-reply', args args, status %done)
  =/  db=state:c  [~ (my ~[[0v3 r]])]
  ?>  ?=(%o -.args)
  =/  altered  [%o (~(put by p.args) 'version' [%n '99'])]
  =/  spelling  [%o (~(put by p.args) 'revision' [%s '01'])]
  =/  other  [%o (~(put by p.args) 'actor' [%s 'bob'])]
  ;:  weld
      (expect-eq !>(`0v3) !>((reply-request:control db altered)))
      (expect-eq !>(`0v3) !>((reply-request:control db spelling)))
      (expect-eq !>(~) !>((reply-request:control db other)))
  ==
++  test-confirm-accepts-another-message-only-from-the-same-hand-origin
  =/  s  source
  =.  s  s(event 'confirmation-message')
  =/  out  (confirm:control prepared 0v3 'conversation' 0v1 s ~ 0v2 (add ~2026.9.13 ~m1))
  ?>  ?=(%& -.out)
  (expect-eq !>(%running) !>(status:(~(got by requests.p.out) 0v3)))
++  test-cross-sender-binding-destination-and-incarnation-cannot-confirm
  =/  s  source
  =/  wrongs=(list input-source:h)
    :~  s(actor 'mallory')  s(binding 'other')  s(address 'public/channel')  s(hand 'other')
        [%acp 'owner']
    ==
  =/  denied
    %+  levy  wrongs
    |=  s=input-source:h
    =/  out  (confirm:control prepared 0v3 'conversation' 0v1 s ~ 0v2 ~2026.9.13)
    ?=(%| -.out)
  =/  incarnation  (confirm:control prepared 0v3 'conversation' 0v4 source ~ 0v2 ~2026.9.13)
  =/  conversation  (confirm:control prepared 0v3 'other' 0v1 source ~ 0v2 ~2026.9.13)
  ;:  weld
      (expect !>(denied))
      (expect !>(?=(%| -.incarnation)))
      (expect !>(?=(%| -.conversation)))
  ==
++  test-expired-and-changed-work-is-not-confirmed
  =/  expired  (confirm:control prepared 0v3 'conversation' 0v1 source ~ 0v2 (add ~2026.9.13 ~m15))
  =/  changed  (confirm:control prepared 0v3 'conversation' 0v1 source ~ 0v9 ~2026.9.13)
  (expect !>(&(?=(%| -.expired) ?=(%| -.changed))))
++  test-confirmation-is-one-shot-and-completion-is-idempotent
  =/  out  (confirm:control prepared 0v3 'conversation' 0v1 source ~ 0v2 ~2026.9.13)
  ?>  ?=(%& -.out)
  =/  done  (complete:control p.out 0v3 [%& [%s 'Recorded']])
  =/  duplicate  (confirm:control p.out 0v3 'conversation' 0v1 source ~ 0v2 ~2026.9.13)
  ;:  weld
      (expect !>(?=(%| -.duplicate)))
      (expect-eq !>(done) !>((complete:control done 0v3 [%| 'Late error'])))
      (expect-eq !>(%done) !>(status:(~(got by requests.done) 0v3)))
  ==
++  test-rejection-does-not-undo-submitted-work
  =/  out  (confirm:control prepared 0v3 'conversation' 0v1 source ~ 0v2 ~2026.9.13)
  ?>  ?=(%& -.out)
  =/  rejected  (reject:control p.out 0v3 'conversation' 0v1 source ~)
  (expect !>(?=(%| -.rejected)))
++  test-an-unsubmitted-request-cannot-acquire-a-result
  (expect-eq !>(prepared) !>((complete:control prepared 0v3 [%& [%s 'Forged completion']])))
++  test-unsupported-operations-and-duplicate-identities-are-rejected
  =/  r  request
  =/  duplicate  (prepare:control prepared 0v3 r ~2026.9.13)
  =/  unsupported  (prepare:control *state:c 0v4 r(action 'client-create') ~2026.9.13)
  (expect !>(&(?=(%| -.duplicate) ?=(%| -.unsupported))))
++  test-bookkeeping-does-not-enter-confirmation
  %+  roll
    ^-  (list @t)
    ~['project-create' 'task-create' 'task-claim' 'task-assign' 'task-update' 'task-delete']
  |=  [action=@t checks=tang]
  =/  r  request
  =.  r  r(action action)
  =/  prepared  (prepare:control *state:c 0v3 r ~2026.9.13)
  =/  db=state:c  [~ (my ~[[0v3 r]])]
  =/  confirmed  (confirm:control db 0v3 'conversation' 0v1 source ~ 0v2 ~2026.9.13)
  ;:  weld
      checks
      (expect !>((bookkeeping-action:j action)))
      (expect !>((model-action:j action)))
      (expect !>(!(permitted:control action)))
      (expect !>(?=(%| -.prepared)))
      (expect !>(?=(%| -.confirmed)))
  ==
++  test-native-document-changes-invalidate-document-approval
  =/  db  *state:w
  =/  art  *artifact:w
  =.  artifacts.db  (my ~[['doc' art]])
  =/  args  (pairs:enjs:format ~[['id' %s 'doc']])
  =/  before  (snapshot:control db 'artifact-save' args)
  =.  artifacts.db  (my ~[['doc' art(label 'Native title changed')]])
  (expect !>(!=(before (snapshot:control db 'artifact-save' args))))
++  test-only-a-head-command-preview-enables-confirmation
  =/  r  request
  =/  preview  (encode:control 0v3 r)
  =/  body  (receipt:view preview)
  =/  changed  (encode:control 0v3 r(args (pairs:enjs:format ~[['id' %s 'changed']])))
  =/  shown=(list event:h)  ~[[%command-completed 0v9 'work' body]]
  =/  prose=(list event:h)  ~[[%input-received [0v9 [%poke ~zod] `~zod ~ ~2026.9.13 [%user body]]]]
  ;:  weld
      (expect !>((previewed:control shown 0v3 preview)))
      (expect !>(!(previewed:control shown 0v4 preview)))
      (expect !>(!(previewed:control prose 0v3 preview)))
      (expect !>(!(previewed:control shown 0v3 changed)))
  ==
++  test-stored-request-content-obeys-current-project-access
  =/  db  *state:w
  =.  projects.db  (my ~[['project' ['Fixture' '' 1 (my ~[[0v1 %contributor]]) |]]])
  =/  r  request
  =.  r  r(action 'artifact-create', args (pairs:enjs:format ~[['project' %s 'project']]))
  =/  who=authority:w  [| [0v1 'Alice'] 0v1]
  ;:  weld
      (expect !>((visible:control db who r)))
      (expect !>(!(visible:control db(projects ~) who r)))
      (expect !>(!(visible:control db who r(action 'member'))))
  ==
--
