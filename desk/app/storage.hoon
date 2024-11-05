::  storage:
::
::  stores s3 keys for uploading and sharing images and objects
::
/-  *storage
/+  storage-json, default-agent, verb, dbug
~%  %s3-top  ..part  ~
|%
+$  card  card:agent:gall
+$  versioned-state
  $%  state-zero
      state-one
      state-two
      state-three
  ==
::
+$  state-zero    [%0 =credentials:zero:past =configuration:zero:past]
+$  state-one     [%1 =credentials:one:past =configuration:one:past]
+$  state-two     [%2 =credentials:two:past =configuration:two:past]
+$  state-three   [%3 =credentials =configuration]
--
::
=|  state-three
=*  state  -
::
%-  agent:dbug
%+  verb  |
^-  agent:gall
~%  %s3-agent-core  ..card  ~
|_  =bowl:gall
+*  this       .
    def        ~(. (default-agent this %|) bowl)
::
++  on-init
  ::  XX: deprecated; migration code
  ^-  (quip card _this)
  :_  this
  :~  :*  %pass
          /migrate
          %agent
          [our dap]:bowl
          %poke
          noun+!>(%migrate)
  ==  ==
++  on-save  !>(state)
++  on-load
  |=  =vase
  |^
  =/  old  ((soft versioned-state) q.vase)
  ?~  old  on-init
  =/  old  u.old
  |-
  ?-  -.old
    %3  `this(state old)
    %2  $(old (state-2-to-3 old))
    %1  $(old (state-1-to-2 old))
    %0  $(old (state-0-to-1 old))
  ==
  ++  state-0-to-1
    |=  zer=state-zero
    ^-  state-one
    :*  %1
        credentials.zer
        (configuration-0-to-1 configuration.zer)
    ==
  ::
  ++  configuration-0-to-1
    |=  conf=configuration:zero:past
    ^-  configuration:one:past
    :*  buckets.conf
        current-bucket.conf
        ''
    ==
  ::
  ++  state-1-to-2
    |=  one=state-one
    ^-  state-two
    :*  %2
        credentials.one
        (configuration-1-to-2 configuration.one)
    ==
  ::
  ++  configuration-1-to-2
    |=  conf=configuration:one:past
    ^-  configuration:two:past
    :*  buckets.conf
        current-bucket.conf
        region.conf
        ''
        %credentials
    ==
  ++  state-2-to-3
    |=  two=state-two
    ^-  state-three
    :*  %3
        credentials.two
        (configuration-2-to-3 configuration.two)
    ==
  ++  configuration-2-to-3
    |=  conf=configuration:two:past
    ^-  ^configuration
    :*  buckets.conf
        current-bucket.conf
        region.conf
        presigned-url.conf
        service.conf
        ''
    ==
  --
::
++  on-poke
  ~/  %s3-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  |^
  ?>  (team:title our.bowl src.bowl)
  =^  cards  state
    ?+  mark  (on-poke:def mark vase)
        %storage-action
      (poke-action !<(action vase))
    ::
      ::  XX: deprecated; migration code
        %noun
      ?>  ?=(%migrate !<(%migrate vase))
      =/  bas  /(scot %p our.bowl)/s3-store/(scot %da now.bowl)
      :-  ~
      ?.  .^(? %gu (weld bas /$))
        state
      =:
          credentials
        =/  ful  .^(update %gx (weld bas /credentials/noun))
        ?+  -.ful  (on-poke:def mark vase)
          %credentials  +.ful
        ==
      ::
          configuration
        =/  ful  .^(update %gx (weld bas /configuration/noun))
        ?+  -.ful  (on-poke:def mark vase)
          %configuration  +.ful
        ==  ==
      state
    ==
  [cards this]
  ::
  ++  poke-action
    |=  act=action
    ^-  (quip card _state)
    :-  [%give %fact [/all]~ %storage-update !>(act)]~
    ?-  -.act
        %set-endpoint
      state(endpoint.credentials endpoint.act)
    ::
        %set-access-key-id
      state(access-key-id.credentials access-key-id.act)
    ::
        %set-secret-access-key
      state(secret-access-key.credentials secret-access-key.act)
    ::
        %set-region
      state(region.configuration region.act)
    ::
        %set-public-url-base
      state(public-url-base.configuration public-url-base.act)
    ::
        %set-current-bucket
      %_  state
          current-bucket.configuration  bucket.act
          buckets.configuration  (~(put in buckets.configuration) bucket.act)
      ==
    ::
        %add-bucket
      state(buckets.configuration (~(put in buckets.configuration) bucket.act))
    ::
        %remove-bucket
      state(buckets.configuration (~(del in buckets.configuration) bucket.act))
    ::
        %set-presigned-url
      state(presigned-url.configuration url.act)
    ::
        %toggle-service
      state(service.configuration service.act)
    ==
  --
::
++  on-watch
  ~/  %s3-watch
  |=  =path
  ^-  (quip card _this)
  |^
  ?>  (team:title our.bowl src.bowl)
  =/  cards=(list card)
    ?+  path      (on-watch:def path)
        [%all ~]
      :~  (give %storage-update !>([%credentials credentials]))
          (give %storage-update !>([%configuration configuration]))
      ==
    ==
  [cards this]
  ::
  ++  give
    |=  =cage
    ^-  card
    [%give %fact ~ cage]
  --
::
++  on-leave  on-leave:def
++  on-peek
  ~/  %s3-peek
  |=  =path
  ^-  (unit (unit cage))
  ?.  (team:title our.bowl src.bowl)  ~
  ?+    path  [~ ~]
      [%x %credentials ~]
    [~ ~ %storage-update !>(`update`[%credentials credentials])]
  ::
      [%x %configuration ~]
    [~ ~ %storage-update !>(`update`[%configuration configuration])]
  ==
++  on-agent  on-agent:def
++  on-arvo   on-arvo:def
++  on-fail   on-fail:def
--
