::  Full head projection with synthetic Tlon authority, driven by test-agent;
::  no cards execute.
/-  h=harness, wc=harness-work-control, adapter=harness-adapter, t=harness-tlon,
    *harness-store
/+  *test-agent, policy=harness-defaults, control=harness-work-control,
    corpus=harness-corpus, view=harness-work-view, j=harness-workspace-json
/=  head  /app/harness
|%
::  Tlon is running, trusts ~zod, and grants the hand and admin authority
::  only when allowed.
::
++  tlon-scry
  |=  allowed=?
  |=  =path
  ^-  (unit vase)
  ?:  (lien path |=(part=@ta =(%peer-trust part)))
    `!>(`peer-trust:t`[[& `~zod ~ %mentions ~ ~] |])
  ?:  (lien path |=(part=@ta =(%authority part)))
    `!>(`hand-authority:adapter`[allowed ~])
  ?:  (lien path |=(part=@ta =(%admin part)))  `!>(allowed)
  ?:  =(%$ (rear path))  `!>(&)
  `!>(|)
::  Load saved as ~zod and read the work card for input 0v4.
::
++  read
  |=  [saved=state-0 allowed=?]
  =/  m  (mare ,(unit @t))
  ^-  form:m
  ;<  ~      bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod, now ~2026.9.13)))
  ;<  ~      bind:m  (set-scry-gate (tlon-scry allowed))
  ;<  *      bind:m  (do-load head `!>(saved))
  ;<  =cage  bind:m  (got-peek /x/work-card/0v4)
  (pure:m ;;((unit @t) q.q.cage))
::  The card is shown, or withheld, for this state and authority.
::
++  ex-shown
  |=  [saved=state-0 allowed=?]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  card=(unit @t)  bind:m  (read saved allowed)
  (ex-equal !>(?=(^ card)) !>(&))
::
++  ex-withheld
  |=  [saved=state-0 allowed=?]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  card=(unit @t)  bind:m  (read saved allowed)
  (ex-equal !>(card) !>(~))
::
++  test-card-needs-current-owner-binding-and-receipt
  =/  saved=state-0  *state-0
  =.  saved  saved(welcome-seen 1, defaults builtin-config:policy)
  =/  source=input-source:h  [%hand 'binding' 'tlon' 'dm/~zod' 'event' '~zod']
  =/  args  (pairs:enjs:format ~[['id' %s 'meeting'] ['title' %s 'Meeting']])
  =/  =request:wc
    :*  'social'  0v1  source  ~  'project-create'  args
        (snapshot:control workspace.saved 'project-create' args)  ~2026.9.13..00.15.00  %pending  ~
    ==
  =/  text  (receipt:view (encode:control 0v3 request))
  =/  input=admitted-input:h
    [0v4 source ~ `[%hand 'binding'] ~2026.9.13 [%user '/work project-create']]
  =.  sessions.saved
    %-  my
    :~  :*  'social'
            :*  :~  [%command-completed 0v4 'work' text]  [%input-received input]
                    [%config-replaced defaults.saved]
                ==
                0
            ==
        ==
    ==
  =.  corpus.saved  (sync:corpus corpus.saved sessions.saved)
  =.  requests.work-controls.saved  (my ~[[0v3 request]])
  =.  bindings.hands.saved  (my ~[['binding' ['tlon' 'dm/~zod' 'social' ~['~zod'] &]]])
  =.  observations.hands.saved
    %-  my
    ~[[0v4 ['binding' 'event' '~zod' '/work project-create' ~2026.9.13 %completed]]]
  =.  outbox.hands.saved
    %-  my
    ~[[0v4 [0v4 'binding' 'tlon' 'dm/~zod' 'social' %reply text %pending '' '' ~]]]
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (ex-shown saved &)
  ;<  ~  bind:m  (ex-withheld saved |)
  ;<  ~  bind:m  (ex-withheld saved(bindings.hands ~) &)
  ;<  ~  bind:m  (ex-withheld saved(requests.work-controls ~) &)
  (ex-withheld saved(observations.hands ~) &)
++  test-navigation-card-needs-no-approval-request
  =/  saved=state-0  *state-0
  =.  saved  saved(welcome-seen 1, defaults builtin-config:policy)
  =/  source=input-source:h  [%hand 'binding' 'tlon' 'dm/~zod' 'event' '~zod']
  =/  args  (need (arguments:view 'projects' ''))
  =/  text
    %^  render:view
      'projects'
      args
    (read:j workspace.saved [& [0v0 'Owner'] 0v0] 'projects' args)
  =/  input=admitted-input:h  [0v4 source ~ `[%hand 'binding'] ~2026.9.13 [%user '/work projects']]
  =.  sessions.saved
    %-  my
    :~  :*  'social'
            :*  :~  [%command-completed 0v4 'work' text]  [%input-received input]
                    [%config-replaced defaults.saved]
                ==
                0
            ==
        ==
    ==
  =.  corpus.saved  (sync:corpus corpus.saved sessions.saved)
  =.  bindings.hands.saved  (my ~[['binding' ['tlon' 'dm/~zod' 'social' ~['~zod'] &]]])
  =.  observations.hands.saved
    %-  my
    ~[[0v4 ['binding' 'event' '~zod' '/work projects' ~2026.9.13 %completed]]]
  =.  outbox.hands.saved
    %-  my
    ~[[0v4 [0v4 'binding' 'tlon' 'dm/~zod' 'social' %reply text %pending '' '' ~]]]
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (ex-shown saved &)
  ;<  ~  bind:m  (ex-withheld saved |)
  ;<  ~  bind:m  (ex-withheld saved(bindings.hands ~) &)
  ;<  ~  bind:m  (ex-withheld saved(observations.hands ~) &)
  %+  ex-withheld
    %=  saved  sessions
        %+  ~(put by sessions.saved)
          'social'
        [~[[%input-received input] [%config-replaced defaults.saved]] 0]
    ==
  &
--
