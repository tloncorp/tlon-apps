::  rudder: http request utils
::NOTE  most of the below are also available in /lib/server, but we
::      reimplement them here for independence's sake
|%
+$  order  [id=@ta inbound-request:eyre]
+$  query  [trail args=(list [key=@t value=@t])]
+$  trail  [ext=(unit @ta) site=(list @t)]
+$  reply
  $%  [%page bod=manx]                                  ::  html page
      [%xtra hed=header-list:http bod=manx]             ::  html page w/ heads
      [%next loc=@t msg=@t]                             ::  303, succeeded
      [%move loc=@t]                                    ::  308, use other
      [%auth loc=@t]                                    ::  307, please log in
  ==
::
++  purse  ::  url cord to query
  |=  url=@t
  ^-  query
  (fall (rush url ;~(plug apat:de-purl:html yque:de-purl:html)) [[~ ~] ~])
::
++  press  ::  manx to octs
  (cork en-xml:html as-octt:mimes:html)
::
++  paint  ::  render response into payload
  |=  =reply
  ^-  simple-payload:http
  ?-  -.reply
    %page  [[200 ['content-type' 'text/html']~] `(press bod.reply)]
    %xtra  =?  hed.reply  ?=(~ (get-header:http 'content-type' hed.reply))
              ['content-type'^'text/html' hed.reply]
            [[200 hed.reply] `(press bod.reply)]
    %next  =;  loc  [[303 ['location' loc]~] ~]
            ?~  msg.reply  loc.reply
            %+  rap  3
            :~  loc.reply
                ?:(?=(^ (find "?" (trip loc.reply))) '&' '?')
                'rmsg='
                (crip (en-urlt:html (trip msg.reply)))
            ==
    %move  [[308 ['location' loc.reply]~] ~]
    %auth  =/  loc  (crip (en-urlt:html (trip loc.reply)))
            [[307 ['location' (cat 3 '/~/login?redirect=' loc)]~] ~]
  ==
::
++  spout  ::  build full response cards
  |=  [eyre-id=@ta simple-payload:http]
  ^-  (list card:agent:gall)
  =/  =path  /http-response/[eyre-id]
  :~  [%give %fact ~[path] [%http-response-header !>(response-header)]]
      [%give %fact ~[path] [%http-response-data !>(data)]]
      [%give %kick ~[path] ~]
  ==
++  decap  ::  strip leading base from full site path
  |=  [base=(list @t) site=(list @t)]
  ^-  (unit (list @t))
  ?~  base  `site
  ?~  site  ~
  ?.  =(i.base i.site)  ~
  $(base t.base, site t.site)
::
--