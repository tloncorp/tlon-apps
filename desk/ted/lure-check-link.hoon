/-  spider
/+  *strandio
=,  strand=strand:spider
=,  strand-fail=strand-fail:libstrand:spider
^-  thread:spider
=/  m  (strand ,vase)
|^  ted
++  ted
  |=  arg=vase
  ^-  form:m
  ;<  our=@p   bind:m  get-our
  =/  arguments  !<((unit [cord ship cord path]) arg)
  =/  [baseurl=cord target=ship group=cord =path]  (need arguments)
  =/  target-tape  (trip (scot %p target))
  ?~  target-tape  !!
  ;<  ~  bind:m  (send-request %'GET' (url baseurl target group) ~ ~)
  ;<  rep=client-response:iris  bind:m
    take-client-response
  ?>  ?=(%finished -.rep)
  =/  result  =(200 status-code.response-header.rep)
  ;<  ~  bind:m  (poke [our %grouper] grouper-link-checked+!>([result path]))
  (pure:m !>(~))
++  url
  |=  [baseurl=cord target=ship group=cord]
  ^-  cord
  ?.  =(baseurl 'https://tlon.network/lure/')
    (crip "{(trip baseurl)}{(trip (scot %p target))}/{(trip group)}")
  =/  target-tape  (trip (scot %p target))
  ?~  target-tape  !!
  ::  it really is necessary to double-encode this
  =/  end  (en-urlt:html "%7E{t.target-tape}%2F{(trip group)}")
  (crip "https://tlon.network/v1/policies/lure/{end}")
--
