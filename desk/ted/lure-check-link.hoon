/-  spider
/+  *strandio
=,  strand=strand:spider
=,  strand-fail=strand-fail:libstrand:spider
^-  thread:spider
=/  m  (strand ,vase)
|=  arg=vase
^-  form:m
;<  our=@p   bind:m  get-our
=+  !<(args=(unit [url=cord =path]) arg)
?~  args  (pure:m !>(~))
=/  [url=cord =path]  u.args
;<  ~  bind:m  (send-request %'GET' url ~ ~)
;<  rep=client-response:iris  bind:m
  take-client-response
?>  ?=(%finished -.rep)
=/  result  =(200 status-code.response-header.rep)
;<  ~  bind:m  (poke [our %grouper] grouper-link-checked+!>([result path]))
::TODO  make %grouper handle thread result
(pure:m !>(~))
