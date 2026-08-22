::  tests for %kits
::
::    verifies the package library, the install orchestration (group +
::    places + blob config + ledger), setup completion (local, foreign,
::    and relayed), uninstall, and the ship-to-ship fetch subscription.
::
/-  k=kits, g=groups, c=channels, n=notes, meta
/+  *test-agent, j=kits-json
/=  agent  /app/kits
|%
++  dap  %kits
++  our-ship  ~dev
++  pub-ship  ~bus
++  fix-eny  `@uvJ`0xdead.beef
::  a small fixture kit: a chat place and a notebook place, one ambient
::  binding, one schedule
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
      :~  [%discussion %chat 'Discussion' 'Talk about it']
          [%log %notebook 'Reading Log' 'The record']
      ==
      ~[['instructions/runner.md' %group ~ %ambient]]
      ~[[%daily '0 17 * * *' 'Daily thing']]
      ~[['scaffolds/Profile.md' 'Test/Profile.md']]
      ~
  ==
++  fix-kit
  ^-  kit:k
  [fix-manifest (malt ~[['instructions/runner.md' '# Runner']])]
++  group-meta
  ^-  data:meta
  ['Summer Club' '' '' '']
++  club-flag  `flag:g`[our-ship %summer-club]
::  the notebook place is created via %notes and never enters the
::  places map, so the ledger only records the chat place
::
++  club-nest  `nest:g`[%chat our-ship %discussion]
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
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our our-ship, src our-ship, eny fix-eny)))
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
          [%create [%chat %discussion club-flag 'Discussion' 'Talk about it' ~ ~ ~]]
      ==
      %-  ex-poke
      :*  /install/place/summer-club/log
          [our-ship %notes]
          %notes-action-1
          !>  ^-  action:v1:n
          [`@uv`0 %create-group-notebook 'Reading Log' club-flag ~]
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
::  %setup-done from a foreign ship is accepted when an install exists
::  (v1 trusts any src once the ledger entry is there)
::
++  test-setup-done-foreign
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-add
  ;<  *  bind:m  do-install
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(src pub-ship)))
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
::  %setup-done from a foreign ship with no install is a no-op
::
++  test-setup-done-foreign-no-install
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(src pub-ship)))
  ;<  caz=(list card)  bind:m
    (do-poke %kits-action-1 !>(`action:v1:k`[%setup-done club-flag]))
  (ex-cards caz ~)
::
::  %relay-setup-done (local-only) forwards %setup-done to the group host
::
++  test-relay-setup-done
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  =/  host-flag=flag:g  [pub-ship %summer-club]
  ;<  caz=(list card)  bind:m
    (do-poke %kits-action-1 !>(`action:v1:k`[%relay-setup-done host-flag]))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /relay/setup-done/summer-club
          [pub-ship %kits]
          %kits-action-1
          !>(`action:v1:k`[%setup-done host-flag])
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
--
