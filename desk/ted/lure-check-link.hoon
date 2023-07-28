/-  spider
/+  *strandio
=,  strand=strand:spider
=,  strand-fail=strand-fail:libstrand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  our=@p   bind:m  get-our
=/  arguments  !<((unit [cord ship cord path]) arg)
=/  [baseurl=cord target=ship group=cord =path]  (need arguments)
=/  url  (crip "{(trip baseurl)}{(trip (scot %p target))}/{(trip group)}")
;<  ~  bind:m  (send-request %'GET' url ~ ~)
;<  rep=client-response:iris  bind:m
  take-client-response
?>  ?=(%finished -.rep)
=/  result  =(200 status-code.response-header.rep)
;<  ~  bind:m  (poke [our %grouper] grouper-link-checked+!>([result path]))
(pure:m !>(~))
