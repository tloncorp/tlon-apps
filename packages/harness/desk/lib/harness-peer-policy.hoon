::  Pure incoming-peer policy and its owner-facing projection. Explicit
::  overrides win; inherited trust is a live input, never duplicated state.
/-  h=harness
/+  hj=harness-json, ht=harness-tools
|%
::
++  can-send
  |=  [incoming=(unit peer-grant:h) tool=(unit @t)]
  ^-  ?
  ::  The sender trusts its destination; the receiver checks the other half
  ::  against its own live grant. Remote discovery reports grant no authority.
  ?~  incoming  |
  ?.  =(`'workspace' tool)  &
  (tool-granted:ht 'workspace' tools.u.incoming)
::
++  used
  |=  [total=@ud baseline=@ud]
  ^-  @ud
  (sub total (min total baseline))
::
++  effective
  |=  [explicit=(map @p peer-grant:h) trusted=(map @p peer-grant:h) limits=(map @p @ud)]
  ^-  (map @p peer-grant:h)
  =.  trusted
    %-  malt
    %+  turn  ~(tap by trusted)
    |=  [ship=@p grant=peer-grant:h]
    [ship grant(budget (fall (~(get by limits) ship) budget.grant))]
  (~(gas by trusted) ~(tap by explicit))
::
++  revision
  |=  $:  explicit=(map @p peer-grant:h)  trusted=(map @p peer-grant:h)  config=(unit config:h)
          limits=(map @p @ud)
      ==
  ^-  @t
  (scot %uv (sham [explicit trusted config limits]))
::
++  grant-json
  |=  [ship=@p grant=peer-grant:h]
  ^-  json
  %-  pairs:enjs:format
  :~  ['ship' %s (scot %p ship)]
      ['tools' %a (turn tools.grant grant-json:hj)]
      ['model' ?~(model.grant ~ [%s u.model.grant])]
      ['budget' (numb:enjs:format budget.grant)]
      ['inflows' %a (turn ~(tap in inflows.grant) |=(name=@t `json`[%s name]))]
  ==
::
++  settings-json
  |=  $:  our=@p
          explicit=(map @p peer-grant:h)
          trusted=(map @p peer-grant:h)
          config=(unit config:h)
          limits=(map @p @ud)
      ==
  ^-  json
  %-  pairs:enjs:format
  :~  ['ship' %s (scot %p our)]
      ['revision' %s (revision explicit trusted config limits)]
      ['grants' %a (turn ~(tap by explicit) grant-json)]
      ['trusted' %a (turn ~(tap by trusted) grant-json)]
      ['config' ?~(config ~ (config-json:hj u.config))]
      :-  'limits'
      :-  %a
      %+  turn  ~(tap by limits)
      |=  [ship=@p budget=@ud]
      %-  pairs:enjs:format
      :~  ['ship' %s (scot %p ship)]
          ['budget' (numb:enjs:format budget)]
      ==
  ==
::
++  json-grants
  |=  value=json
  ^-  (map @p peer-grant:h)
  =,  dejs:format
  =/  rows=(list [ship=@p grant=peer-grant:h])
    %.  value
    %-  ar
    %-  ot
    :~  ship+(se %p)
        tools+(ar json-grant:hj)
        model+(mu so)
        budget+ni
        inflows+(cu silt (ar so))
    ==
  ?>  (lte (lent rows) 64)
  =/  grants=(map @p peer-grant:h)  (malt rows)
  ::  Every row names a distinct ship; map construction must not hide duplicates.
  ?>  =(~(wyt by grants) (lent rows))
  ?>  %+  levy  rows
      |=  [ship=@p grant=peer-grant:h]
      ?&  (lte budget.grant 9.007.199.254.740.991)
          ?~  model.grant  &
          &(!=('' u.model.grant) (lte (met 3 u.model.grant) 512))
          (lte (lent tools.grant) 64)
          %+  levy  tools.grant
          |=  tool=tool-grant:h
          ?:  ?=(^ tool)  &
          (lien configurable-tools:ht |=(known=term =(tool known)))
          (lte ~(wyt in inflows.grant) 256)
          %+  levy  ~(tap in inflows.grant)
          |=(name=@t &(!=('' name) (lte (met 3 name) 128)))
      ==
  grants
::
++  json-limits
  |=  value=json
  ^-  (map @p @ud)
  =/  rows=(list [ship=@p budget=@ud])
    %.  value
    %-  ar:dejs:format
    (ot:dejs:format ~[ship+(se:dejs:format %p) budget+ni:dejs:format])
  ?>  (lte (lent rows) 256)
  ?>  (levy rows |=([ship=@p budget=@ud] (lte budget 9.007.199.254.740.991)))
  =/  limits=(map @p @ud)  (malt rows)
  ?>  =(~(wyt by limits) (lent rows))
  limits
::
++  json-config
  |=  value=json
  ^-  (unit config:h)
  ?~  value  ~
  ?>  ?=(%o -.value)
  =/  config  (json-config:hj [%o (~(put by p.value) 'key' [%s ''])])
  ?>  ?&  !=('' model.config)
          (lte (met 3 model.config) 512)
          (gth max-context.config 0)
      ==
  ?>  ?|  =('http://' (end [3 7] url.config))
          =('https://' (end [3 8] url.config))
      ==
  `config(key '', tools ~)
--
