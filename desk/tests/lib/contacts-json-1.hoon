/-  *contacts, g=groups
/+  *test
/+  c=contacts, j=contacts-json-1, mark-warmer
::
/=  c0  /mar/contact-0
/=  c1  /mar/contact
/~  mar  *  /mar/contact
::
|%
::
++  ex-equal
  |=  [a=vase b=vase]
  (expect-eq b a)
::
++  enjs-equal
  |=  [jon=json txt=@t]
  %+  ex-equal
  !>  (en:json:html jon)
  !>  txt
::
++  dejs-equal
  |*  [saf=$-(json *) txt=@t data=*]
  %+  ex-equal
  !>  (saf (need (de:json:html txt)))
  !>  data
::
++  test-ship
  ;:  weld
    %+  enjs-equal
      (ship:enjs:j ~sampel-palnet)
    '"~sampel-palnet"'
    ::
    %^  dejs-equal  ship:dejs:j
      '"~sampel-palnet"'
    ~sampel-palnet
  ==
++  test-cid
  ;:  weld
    %+  enjs-equal
    (cid:enjs:j 0v11abc)
    '"0v11abc"'
    ::
    %^  dejs-equal  cid:dejs:j
      '"0v11abc"'
    0v11abc
  ==
++  test-kip
  ;:  weld
    %+  enjs-equal
    (kip:enjs:j ~sampel-palnet)
    '"~sampel-palnet"'
    ::
    %+  enjs-equal
    (kip:enjs:j id+0v11abc)
    '"0v11abc"'
    ::
    %^  dejs-equal  kip:dejs:j
      '"~sampel-palnet"'
    ~sampel-palnet
    ::
    %^  dejs-equal  kip:dejs:j
      '"0v11abc"'
    id+0v11abc
  ==
++  test-value
  ;:  weld
    ::  submit null value to delete entry in contacts
    ::
    %^  dejs-equal  value:dejs:j
      'null'
    ~
    ::
    %+  enjs-equal
      (value:enjs:j text+'the lazy fox')
    '{"type":"text","value":"the lazy fox"}'
    ::
    %^  dejs-equal  value:dejs:j
      '{"type":"text","value":"the lazy fox"}'
    text+'the lazy fox'
    ::
    %+  enjs-equal
      (value:enjs:j numb+42)
    '{"type":"numb","value":42}'
    ::
    %^  dejs-equal  value:dejs:j
      '{"type":"numb","value":42}'
    numb+42
    ::
    %+  enjs-equal
    (value:enjs:j date+~2024.9.11)
    '{"type":"date","value":"~2024.9.11"}'
    ::
    %^  dejs-equal  value:dejs:j
      '{"type":"date","value":"~2024.9.11"}'
    date+~2024.9.11
    ::
    %+  enjs-equal
    (value:enjs:j tint+0xcafe.babe)
    '{"type":"tint","value":"cafe.babe"}'
    ::
    %^  dejs-equal  value:dejs:j
      '{"type":"tint","value":"cafe.babe"}'
    tint+0xcafe.babe
    ::
    %+  enjs-equal
    (value:enjs:j ship+~sampel-palnet)
    '{"type":"ship","value":"~sampel-palnet"}'
    ::
    %^  dejs-equal  value:dejs:j
      '{"type":"ship","value":"~sampel-palnet"}'
    ship+~sampel-palnet
    ::
    %+  enjs-equal
    (value:enjs:j look+'https://ship.io/avatar.png')
    '{"type":"look","value":"https://ship.io/avatar.png"}'
    ::
    %^  dejs-equal  value:dejs:j
      '{"type":"look","value":"https://ship.io/avatar.png"}'
    look+'https://ship.io/avatar.png'
    ::
    %+  enjs-equal
    (value:enjs:j flag+[~sampel-palnet %circle])
    '{"type":"flag","value":"~sampel-palnet/circle"}'
    ::
    %^  dejs-equal  value:dejs:j
      '{"type":"flag","value":"~sampel-palnet/circle"}'
    flag+[~sampel-palnet %circle]
    ::
    %+  enjs-equal
    %-  value:enjs:j
      set+(silt `(list value)`~[flag/[~sampel-palnet %circle] flag/[~sampel-pardux %square]])
    '{"type":"set","value":[{"type":"flag","value":"~sampel-palnet/circle"},{"type":"flag","value":"~sampel-pardux/square"}]}'
    ::
    %^  dejs-equal  value:dejs:j
      '{"type":"set","value":[{"type":"flag","value":"~sampel-palnet/circle"},{"type":"flag","value":"~sampel-pardux/square"}]}'
    set+(silt `(list value)`~[flag/[~sampel-palnet %circle] flag/[~sampel-pardux %square]])
  ==
++  test-contact
  ;:  weld
    %+  enjs-equal
    %-  contact:enjs:j
      %-  malt
      ^-  (list [@tas value])
      :~  name+text/'Sampel'
          surname+text/'Palnet'
      ==
    '{"name":{"type":"text","value":"Sampel"},"surname":{"type":"text","value":"Palnet"}}'
    ::
    %^  dejs-equal  contact:dejs:j
      '{"name":{"type":"text","value":"Sampel"},"surname":{"type":"text","value":"Palnet"}}'
    ^-  contact:c
    %-  malt
    ^-  (list [@tas value])
    :~  name+text/'Sampel'
        surname+text/'Palnet'
    ==
  ==
++  test-action
  =/  con=contact:c
    %-  malt
    ^-  (list [@tas value])
    :~  name+text/'Sampel'
    ==
  =/  mod=contact:c
    %-  malt
    ^-  (list [@tas value])
    :~  surname+text/'Palnet'
    ==
  ::
  ;:  weld
    %^  dejs-equal  action:dejs:j
      '{"anon":null}'
    [%anon ~]
    ::
    %^  dejs-equal  action:dejs:j
      '{"self":{"name":{"type":"text","value":"Sampel"}}}'
    [%self con]
    ::
    %^  dejs-equal  action:dejs:j
      '{"page":{"kip":"0v1","contact":{"surname":{"type":"text","value":"Palnet"}}}}'
    [%page id+0v1 mod]
    ::
    %^  dejs-equal  action:dejs:j
      '{"page":{"kip":"~sampel-palnet","contact":{"surname":{"type":"text","value":"Palnet"}}}}'
    [%page ~sampel-palnet mod]
    ::
    %^  dejs-equal  action:dejs:j
      '{"wipe":["0v1", "0v2", "~sampel-palnet"]}'
    [%wipe id+0v1 id+0v2 ~sampel-palnet ~]
    ::
    %^  dejs-equal  action:dejs:j
      '{"meet":["~sampel-palnet", "~master-botnet"]}'
    [%meet ~sampel-palnet ~master-botnet ~]
    ::
    %^  dejs-equal  action:dejs:j
      '{"drop":["~sampel-palnet", "~master-botnet"]}'
    [%drop ~sampel-palnet ~master-botnet ~]
    ::
    %^  dejs-equal  action:dejs:j
      '{"snub":["~sampel-palnet", "~master-botnet"]}'
    [%snub ~sampel-palnet ~master-botnet ~]
  ==
++  test-response
  =/  con=contact:c
    %-  malt
    ^-  (list [@tas value])
    :~  name+text/'Sampel'
    ==
  =/  mod=contact:c
    %-  malt
    ^-  (list [@tas value])
    :~  surname+text/'Palnet'
    ==
  ;:  weld
    %+  enjs-equal
      (response:enjs:j [%self con])
    '{"self":{"contact":{"name":{"type":"text","value":"Sampel"}}}}'
    ::
    %+  enjs-equal
      (response:enjs:j [%page id+0v1 con mod])
    ^~  %-  en:json:html  %-  need  %-  de:json:html
    '''
    {
      "page": {
        "mod":{"surname":{"type":"text","value":"Palnet"}},
        "kip":"0v1",
        "contact":{"name":{"type":"text","value":"Sampel"}}
      }
    }
    '''
    ::
    %+  enjs-equal
      (response:enjs:j [%wipe id+0v1])
    '{"wipe":{"kip":"0v1"}}'
    ::
    %+  enjs-equal
      (response:enjs:j [%wipe ~sampel-palnet])
    '{"wipe":{"kip":"~sampel-palnet"}}'
    ::
    %+  enjs-equal
      (response:enjs:j [%peer ~sampel-palnet con])
    ^~  %-  en:json:html  %-  need  %-  de:json:html
    '''
    {
      "peer": {
        "who":"~sampel-palnet",
        "contact":{"name":{"type":"text","value":"Sampel"}}
      }
    }
    '''
  ==
--
