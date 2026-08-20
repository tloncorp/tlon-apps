::  tests for %kits
::
::    verifies the package library, the install orchestration (group +
::    places + blob config + ledger), setup completion, uninstall, and
::    the ship-to-ship fetch subscription.
::
/-  k=kits, g=groups, c=channels, n=notes, meta
/+  *test-agent, j=kits-json
/=  agent  /app/kits
|%
++  dap  %kits
++  our-ship  ~dev
++  pub-ship  ~bus
::  a small fixture kit: one place, one ambient binding, one schedule
::
++  fix-manifest
  ^-  manifest:k
  :*  %test-kit
      'Test Kit'
      [0 1 0]
      our-ship
      'A test kit'
      ~
      %group
      ~[[%discussion %chat 'Discussion' 'Talk about it']]
      ~[['instructions/runner.md' %group ~ %ambient]]
      ~[[%daily '0 17 * * *' 'Daily thing']]
      ~[['scaffolds/Profile.md' 'Test/Profile.md']]
      ~
  ==
::  a kit whose durable place is served by %notes rather than %channels
::
++  notes-manifest
  ^-  manifest:k
  :*  %notes-kit
      'Notes Kit'
      [0 1 0]
      our-ship
      'A kit with a notes place'
      ~
      %group
      :~  [%talk %chat 'Talk' 'Chat about it']
          [%plans %notes 'Plans' 'The durable record']
      ==
      ~[['instructions/runner.md' %group ~ %ambient]]
      ~
      ~
      ~
  ==
++  notes-kit
  ^-  kit:k
  [notes-manifest (malt ~[['instructions/runner.md' '# Runner']])]
++  fix-kit
  ^-  kit:k
  [fix-manifest (malt ~[['instructions/runner.md' '# Runner']])]
++  group-meta
  ^-  data:meta
  ['Summer Club' '' '' '']
++  club-flag  `flag:g`[our-ship %summer-club]
++  club-nest  `nest:v1:k`[%chat our-ship %discussion-summer-club]
++  fix-install
  ^-  install:k
  :*  %test-kit
      [0 1 0]
      our-ship
      (malt ~[[%discussion club-nest]])
      %pending
      ~2024.1.1
  ==
++  config-cord
  |=  i=install:k
  ^-  @t
  %-  en:json:html
  (config:enjs:j our-ship i ~[[%daily '0 17 * * *' 'Daily thing']])
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our our-ship, src our-ship)))
  ;<  *  bind:m  (do-init dap agent)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2024.1.1)))
  (pure:m ~)
++  do-add
  =/  m  (mare ,(list card))
  ^-  form:m
  (do-poke %kits-action-1 !>(`action:v1:k`[%add fix-kit]))
++  do-install
  =/  m  (mare ,(list card))
  ^-  form:m
  (do-poke %kits-action-1 !>(`action:v1:k`[%install %test-kit %summer-club group-meta]))
::
::  %add puts the kit in the library and echoes it on /v1/updates
::
++  test-add-gives-kit-fact
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m  do-add
  %+  ex-cards  caz
  ~[(ex-fact ~[/v1/updates] %kits-update-1 !>(`update:v1:k`[%kit fix-kit]))]
::
::  %install creates the group, each place, writes the blob config,
::  and gives the ledger fact
::
++  test-install-orchestration
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  ;<  caz=(list card)  bind:m  do-install
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /install/group/summer-club
          [our-ship %groups]
          %group-command
          !>(`c-groups:g`[%create [%summer-club group-meta %private [~ ~] ~]])
      ==
      %-  ex-poke
      :*  /install/place/summer-club/discussion
          [our-ship %channels]
          %channel-action-2
          !>  ^-  a-channels:c
          [%create [%chat %discussion-summer-club club-flag 'Discussion' 'Talk about it' ~ ~ ~]]
      ==
      %-  ex-poke
      :*  /install/blob/summer-club
          [our-ship %groups]
          %group-action-5
          !>(`a-groups:g`[%group club-flag %blob `(config-cord fix-install)])
      ==
      %-  ex-fact
      :*  ~[/v1/updates]
          %kits-update-1
          !>(`update:v1:k`[%installed club-flag fix-install])
      ==
  ==
::
::  %setup-done flips the ledger and rewrites the blob
::
++  test-setup-done
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  ;<  *  bind:m  do-install
  ;<  caz=(list card)  bind:m
    (do-poke %kits-action-1 !>(`action:v1:k`[%setup-done club-flag]))
  =/  done=install:k  fix-install
  =.  setup.done  %done
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /install/blob/summer-club
          [our-ship %groups]
          %group-action-5
          !>(`a-groups:g`[%group club-flag %blob `(config-cord done)])
      ==
      %-  ex-fact
      :*  ~[/v1/updates]
          %kits-update-1
          !>(`update:v1:k`[%installed club-flag done])
      ==
  ==
::
::  %uninstall clears the blob and drops the ledger entry
::
++  test-uninstall
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  ;<  *  bind:m  do-install
  ;<  caz=(list card)  bind:m
    (do-poke %kits-action-1 !>(`action:v1:k`[%uninstall club-flag]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /uninstall/summer-club
          [our-ship %groups]
          %group-action-5
          !>(`a-groups:g`[%group club-flag %blob ~])
      ==
      %-  ex-fact
      :*  ~[/v1/updates]
          %kits-update-1
          !>(`update:v1:k`[%uninstalled club-flag])
      ==
  ==
::
::  %fetch opens a one-shot subscription to the publisher's %kits
::
++  test-fetch-watches-publisher
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke %kits-action-1 !>(`action:v1:k`[%fetch pub-ship %test-kit]))
  %+  ex-cards  caz
  :~  %^    ex-task
          /fetch/(scot %p pub-ship)/test-kit
        [pub-ship %kits]
      [%watch /v1/full/test-kit]
  ==
::
::  a fetched kit lands in the library and is echoed locally
::
++  test-fetch-fact-stores-kit
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    (do-poke %kits-action-1 !>(`action:v1:k`[%fetch pub-ship %test-kit]))
  ;<  caz=(list card)  bind:m
    %^    do-agent
        /fetch/(scot %p pub-ship)/test-kit
      [pub-ship %kits]
    [%fact %kits-update-1 !>(`update:v1:k`[%kit fix-kit])]
  %+  ex-cards  caz
  ~[(ex-fact ~[/v1/updates] %kits-update-1 !>(`update:v1:k`[%kit fix-kit]))]
::
::  the distribution paths: any ship may fetch a kit, one shot then kick
::
++  test-full-serves-any-ship
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  ;<  caz=(list card)  bind:m
    ((do-as pub-ship) (do-watch /v1/full/test-kit))
  %+  ex-cards  caz
  :~  (ex-fact ~ %kits-update-1 !>(`update:v1:k`[%kit fix-kit]))
      (ex-card %give %kick ~ ~)
  ==
::
++  test-preview-serves-manifest-only
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  ;<  caz=(list card)  bind:m
    ((do-as pub-ship) (do-watch /v1/preview/test-kit))
  %+  ex-cards  caz
  :~  (ex-fact ~ %kits-update-1 !>(`update:v1:k`[%preview fix-manifest]))
      (ex-card %give %kick ~ ~)
  ==
::
::  an unknown id nacks the watch rather than crashing the arm; these
::  paths are reachable by any ship, so a bare +got would make a typo a
::  remotely triggerable crash
::
++  test-full-nacks-unknown-kit
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  ((do-as pub-ship) (do-watch /v1/full/no-such-kit))
::
++  test-preview-nacks-unknown-kit
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  ((do-as pub-ship) (do-watch /v1/preview/no-such-kit))
::
::  the update stream stays local even though the fetch paths are public
::
++  test-updates-is-local-only
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  ((do-as pub-ship) (do-watch /v1/updates))
::
::  scries
::
++  test-peek-kits-lists-manifests
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  %+  ex-scry-result  /x/v1/kits
  !>(`update:v1:k`[%kits ~[fix-manifest]])
::
++  test-peek-installs-lists-ledger
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %+  ex-scry-result  /x/v1/installs
  !>(`update:v1:k`[%installs ~])
::
::  a place served by %notes is created through %notes, not %channels, and
::  its nest is recorded in the blob just like a %channels-backed one. the
::  installer supplies the name so it can write that nest in the same event
::  it pokes the host — %notes would otherwise slug its own flag off an
::  internal counter no caller can predict.
::
++  test-install-notes-place-goes-to-notes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-poke %kits-action-1 !>(`action:v1:k`[%add notes-kit]))
  ;<  caz=(list card)  bind:m
    %-  do-poke
    :-  %kits-action-1
    !>(`action:v1:k`[%install %notes-kit %house group-meta])
  =/  house  `flag:g`[our-ship %house]
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /install/group/house
          [our-ship %groups]
          %group-command
          !>(`c-groups:g`[%create [%house group-meta %private [~ ~] ~]])
      ==
      %-  ex-poke
      :*  /install/place/house/talk
          [our-ship %channels]
          %channel-action-2
          !>  ^-  a-channels:c
          [%create [%chat %talk-house house 'Talk' 'Chat about it' ~ ~ ~]]
      ==
      %-  ex-poke
      :*  /install/place/house/plans
          [our-ship %notes]
          %notes-action-1
          !>  ^-  a-notes:n
          [%create-group-notebook 'Plans' house ~ `%plans-house]
      ==
      %-  ex-poke-wire  /install/blob/house
      %-  ex-fact-paths  ~[/v1/updates]
  ==
::
::  the blob records the notes nest under the kit's abstract place name, so
::  a reader resolves `plans` to a notes channel without knowing the kind
::
++  test-notes-place-recorded-in-ledger
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-poke %kits-action-1 !>(`action:v1:k`[%add notes-kit]))
  ;<  *  bind:m
    %-  do-poke
    :-  %kits-action-1
    !>(`action:v1:k`[%install %notes-kit %house group-meta])
  =/  house  `flag:g`[our-ship %house]
  =/  =install:k
    :*  %notes-kit
        [0 1 0]
        our-ship
        %-  malt
        ^-  (list [@tas nest:v1:k])
        :~  [%talk [%chat our-ship %talk-house]]
            [%plans [%notes our-ship %plans-house]]
        ==
        %pending
        ~2024.1.1
    ==
  %+  ex-scry-result  /x/v1/installs
  !>(`update:v1:k`[%installs (malt ~[[house install]])])
::
::  the same kit installed into two groups does not collide. place names are
::  scoped by the group, so the second install's channel creation is a
::  distinct nest rather than a nack against an existing one — +install logs
::  nacks rather than unwinding, so a collision left a group whose blob named
::  channels that were never made.
::
++  test-two-installs-do-not-collide
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  ;<  *  bind:m  do-install
  ;<  caz=(list card)  bind:m
    %-  do-poke
    :-  %kits-action-1
    !>(`action:v1:k`[%install %test-kit %winter-club group-meta])
  =/  winter  `flag:g`[our-ship %winter-club]
  %+  ex-cards  caz
  :~  %-  ex-poke-wire  /install/group/winter-club
      %-  ex-poke
      :*  /install/place/winter-club/discussion
          [our-ship %channels]
          %channel-action-2
          !>  ^-  a-channels:c
          [%create [%chat %discussion-winter-club winter 'Discussion' 'Talk about it' ~ ~ ~]]
      ==
      %-  ex-poke-wire  /install/blob/winter-club
      %-  ex-fact-paths  ~[/v1/updates]
  ==
--
