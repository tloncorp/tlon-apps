::  -groups!auto-content: groups activity simulator
::
::    argument cell consists of:
::    -
::
/-  spider, c=channels, g=groups
/+  s=strandio
::
=*  strand  strand:spider
^-  thread:spider
::
|^  |=  arg=vase
    =+  !<([~ =config] arg)
    (run config)
::
+$  config
  $:  actions=(list action)
      targets=(list nest:c)
      authors=(list @p)
      spacing=@dr
      repeats=@ud
  ==
::
+$  action
  ?(%post %reply)
::
++  run
  |=  =config
  =/  m  (strand ,vase)
  ^-  form:m
  =/  actions=(list action)
    ?:  =(~ actions.config)  ~[%post]
    actions.config
  ::TODO  clean up
  ;<  scry-res=channels:c  bind:m
    (scry:s channels:c /gx/channels/v2/channels/channels-2)
  =/  targets=(list nest:c)
    ?.  =(~ targets.config)
      targets.config
    ~(tap in ~(key by scry-res))
  =/  authors=(list @p)
    ?.  =(~ authors.config)
      authors.config
    [~sampel-palnet]~
  =|  i=@ud
  |-
  ?.  |(=(0 repeats.config) (lth i repeats.config))
    (pure:m !>(~))
  ;<  ~  bind:m
    %:  act  i
      (snag (mod i (lent actions)) actions)
      (snag (mod i (lent targets)) targets)
      (snag (mod i (lent authors)) authors)
    ==
  ;<  ~  bind:m  (sleep spacing.config)
  $(i +(i))
::
++  sleep
  |=  for=@dr
  =/  m  (strand ,~)
  ^-  form:m
  ?:  =(~s0 for)  (pure:m ~)
  (sleep:s for)
::
++  act
  |=  [i=@ud =action =nest:c author=@p]
  =/  m  (strand ,~)
  ^-  form:m
  ;<  =bowl:strand  bind:m  get-bowl:s
  =/  id=time  (add now.bowl (div ~s1 (bex 16)))
  =;  =cage  (raw-poke-our:s %channels cage)
  :-  %noun  !>
  :+  %pretend-agent
    /[kind.nest]/(scot %p ship.nest)/[name.nest]/updates
  ^-  sign:agent:gall
  :+  %fact  %channel-update
  !>  ^-  update:c
  :-  id
  :+  %post  id
  :+  %set  ~
  ^-  v-post:c
  :-  [id ~ ~]
  :-  0
  ^-  essay:c
  :_  ^-  kind-data:c
      ?-  kind.nest
        %diary  [%diary (word i) '']
        %heap   [%heap `(word i)]
        %chat   [%chat ~]
      ==
  ^-  memo:c
  [[%inline [(word i)]~]~ author id]
::
++  word
  |=  i=@ud
  ^-  @t
  =-  (cat 3 - (scot %ud i))
  =.  i  (mod i 23)
  ~+
  %+  snag  i
  ^-  (list @t)
  :~  'first'
      'second'
      'third'
      'accismus'
      'acumen'
      'bastion'
      'conundrum'
      'credulity'
      'impetus'
      'interlocutor'
      'melange'
      'metanoia'
      'myriad'
      'paucity'
      'philistine'
      'rapscallion'
      'serendipity'
      'solipsist'
      'synecdoche'
      'uhtceare'
      'ultracrepidarian'
      'verisimilitude'
      'zeugma'
  ==
--
