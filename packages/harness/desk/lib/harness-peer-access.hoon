::  Remote ships speak only for their own permissions. These are dated reports,
::  never local grants and never authority to bypass the receiver's live checks.
/-  h=harness
/+  policy=harness-peer-policy
|%
++  valid
  |=  grant=(unit peer-grant:h)
  ^-  ?
  ?~  grant  &
  =/  parsed  (mule |.((json-grants:policy [%a ~[(grant-json:policy ~zod u.grant)]])))
  ?=(%& -.parsed)
++  remember
  |=  [known=(map @p peer-access:h) who=@p grant=(unit peer-grant:h) now=@da]
  ^+  known
  ?.  (valid grant)  known
  =.  known  (~(put by known) who [grant now])
  ?:  (lte ~(wyt by known) 256)  known
  =/  ordered
    %+  sort  ~(tap by known)
    |=  [a=[p=@p q=peer-access:h] b=[p=@p q=peer-access:h]]
    (lth checked.q.a checked.q.b)
  ?~  ordered  known
  (~(del by known) p.i.ordered)
++  row-json
  |=  [who=@p entry=peer-access:h]
  ^-  json
  %-  pairs:enjs:format
  :~  ['ship' %s (scot %p who)]
      ['allowed' %b ?=(^ grant.entry)]
      ['checkedAt' %s (scot %da checked.entry)]
      ['grant' ?~(grant.entry ~ (grant-json:policy who u.grant.entry))]
  ==
++  list-json
  |=  known=(map @p peer-access:h)
  ^-  json
  %-  pairs:enjs:format
  :~  ['ships' %a (turn ~(tap by known) row-json)]
      :*  'note'  %s
          'Known permissions reported by remote ships, not a complete network directory. Reports may be stale; the remote ship checks current access and remaining budget on every ask. Use check_peer to refresh a specific ship. An unknown ship or an unavailable discovery protocol does not prove denial.'
      ==
  ==
++  changes
  |=  [before=(map @p peer-grant:h) after=(map @p peer-grant:h)]
  ^-  (list [ship=@p grant=(unit peer-grant:h)])
  %+  murn  ~(tap in (silt (weld ~(tap in ~(key by before)) ~(tap in ~(key by after)))))
  |=  ship=@p
  =/  old  (~(get by before) ship)
  =/  new  (~(get by after) ship)
  ?:(=(old new) ~ `[ship new])
--
