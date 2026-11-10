::  Explicit ship-wide destinations; callers must hold the broad Tlon grant.
/-  t=harness-tlon
/+  spec=harness-tlon-tool, hp=harness-tlon-history-page, reader=harness-tlon-history-read,
    paths=harness-tlon-paths
|_  bowl=bowl:gall
+*  read-path  ~(. paths [our now]:bowl)
++  available
  |=  to=destination:t
  ^-  ?
  ?-  -.to
      %dm
    ?.  .^(? %gu /(scot %p our.bowl)/chat/(scot %da now.bowl)/$)  |
    .^(? %gu /(scot %p our.bowl)/chat/(scot %da now.bowl)/dm/(scot %p who.to))
      %channel
    ?.  .^(? %gu /(scot %p our.bowl)/channels/(scot %da now.bowl)/$)  |
    .^  ?  %gu
      (channel:read-path %v4 nest.to)
    ==
  ==
++  history
  |=  [args=json search=?]
  ^-  json
  =/  to  (destination:spec args)
  ?>  (available to)
  =/  needle  ?:(search (query:hp args) '')
  =/  scope  (sham [%tlon our.bowl to needle])
  =/  before  (position:hp scope (string:spec args 'cursor' '' 256))
  =/  snapshot  (load:~(. reader bowl) to before ?:(search 65 21))
  (encode:hp scope (scan:hp rows.snapshot needle) parent.snapshot needle)
++  dms
  |=  args=json
  ^-  json
  ?>  .^(? %gu /(scot %p our.bowl)/chat/(scot %da now.bowl)/$)
  =/  accepted=(set @p)
    .^((set @p) %gx /(scot %p our.bowl)/chat/(scot %da now.bowl)/dm/ships)
  =/  invited=(set @p)
    .^((set @p) %gx /(scot %p our.bowl)/chat/(scot %da now.bowl)/dm/invited/ships)
  =/  rows  ~(tap in (~(uni in accepted) invited))
  =/  items
    %+  turn  rows
    |=  who=@p
    (pairs:enjs:format ~[['ship' %s (scot %p who)] ['invited' %b (~(has in invited) who)]])
  (directory:spec args items)
--
