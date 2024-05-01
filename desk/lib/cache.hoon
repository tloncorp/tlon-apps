=<  cache
|%
+$  pending  (map path update)
+$  update  [=wire fires-at=@da payload=*]
+$  return  [(list card:agent:gall) pending]
++  verb  |
++  base-path  /tlon/v1
++  base-wire  /~/cache
++  interval  ~s5
++  cache
  |_  [=pending bowl:gall]
  ++  get-url
    |=  =path
    %-  spat
    ;:(weld base-path path /noun)
  ++  update
    |=  [=path payload=*]
    ^-  return
    =/  wire  ;:(welp base-wire /wakeup path)
    =/  fires-at  (add now interval)
    :_  (~(put by pending) path [wire fires-at payload])
    =/  wait  [%pass wire %arvo %b %wait fires-at]
    ?~  update=(~(get by pending) path)  ~[wait]
    :~  [%pass wire %arvo %b %rest fires-at.u.update]
        wait
    ==
  ::
  ++  set-entry
    |=  =path
    ^-  return
    =/  update  (~(get by pending) path)
    ?~  update  [~ pending]
    =/  [=wire fires-at=@da payload=*]  u.update
    =/  data=(unit octs)  `(as-octs:mimes:html (jam payload))
    =/  =response-header:http
      [200 ['Content-Type' 'application/x-urb-jam'] ~]
    =/  =simple-payload:http  [response-header data]
    =/  =task:eyre
      [%set-response (get-url path) `[& %payload simple-payload]]
    :_  (~(del by pending) path)
    ~[[%pass (welp base-wire /eyre/cache) %arvo %e task]]
  ++  clear
    |=  =path
    ^-  return
    =/  =task:eyre  [%set-response (get-url path) ~]
    =/  update  (~(get by pending) path)
    =/  clear-entry  [%pass (welp base-wire /eyre/cache) %arvo %e task]
    :_  pending
    ?~  update  ~[clear-entry]
    :~  clear-entry
        [%pass wire.u.update %arvo %b %rest fires-at.u.update]
    ==
  ++  on-arvo
    |=  [=(pole knot) sign=sign-arvo]
    ^-  return
    ?+  pole  ~|(bad-cache-arvo-take/pole !!)
      [%eyre %cache ~]  [~ pending]
      [%wakeup rest=*]  (set-entry rest.pole)
    ==
  --
--