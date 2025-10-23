/-  reel
|%
++  flag  ;~((glue fas) ;~(pfix sig fed:ag) sym)
++  enjs-metadata
  |=  =metadata:reel
  ^-  json
  =/  fields
    %+  turn  ~(tap by fields.metadata)
    |=  [key=cord value=cord]
    ^-  [cord json]
    [key s+value]
  %-  pairs:enjs:format
  :~  ['tag' s+tag.metadata]
      ['fields' (pairs:enjs:format fields)]
  ==
++  dejs-metadata
  %-  ot:dejs:format
  :~  tag+so:dejs:format
      fields+(om so):dejs:format
  ==
++  conv
  |%
  ++  v0
    |%
    ++  metadata
      |%
      ++  v1
        |^  
        |=  meta=metadata:v0:reel
        ^-  metadata:v1:reel
        =*  fields  fields.meta
        ::  migrate group fields
        ::
        =.  fields  (migrate fields 'group' %'invitedGroupId')
        =.  fields  (migrate fields 'title' %'invitedGroupTitle')
        =.  fields  (migrate fields 'description' %'invitedGroupDescription')
        =.  fields  (migrate fields 'image' %'invitedGroupIconImageUrl')
        ::  enforce type on metadata fields
        ::
        :-  %groups-0
        %-  ~(gas by *(map field:v1:reel cord))
        %+  murn  ~(tap by fields.meta)
        |=  [key=cord value=cord]
        ^-  (unit [field:reel cord])
        ?.  ?=(field:v1:reel key)  ~
        `[key value]
        ::  +migrate: migrate metadata keys
        ::
        ::  if no value is stored in the .field, we lookup
        ::  the value in .old-field and move it under the new .field, if present.
        ::
        ++  migrate
          |=  [fields=(map cord cord) old-field=cord =field:v1:reel]
          ^+  fields
          =+  val=(~(get by fields) `cord`field)
          ?:  &(?=(^ val) !=('' u.val))  fields
          ?~  vol=(~(get by fields) old-field)  fields
          %+  ~(put by (~(del by fields) old-field))
            `cord`field
          u.vol
        --
      --
    --
  --
--
