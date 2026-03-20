/-  spider, h=hooks
/+  utils=channel-utils
=,  strand=strand:spider
^-  thread:spider
|^
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(input=thread-input:h arg)
=/  compiled=(each vase tang)
  (compile:utils src.hook.input)
?:  ?=(%| -.compiled)
  %-  pure:m
  !>(`hook-output:h`[[%error 'hook compilation failed' `p.compiled] state.input ~])
=/  gate  [p.p.compiled .*(q:subject:utils q.p.compiled)]
%-  pure:m
!>(!<(=hook-output:h (slam gate !>([event.input config.input state.input])))
)
--
