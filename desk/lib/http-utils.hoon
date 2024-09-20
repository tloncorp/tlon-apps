::  http-utils: helpers
::
|%
+$  order  [id=@ta inbound-request:eyre]
+$  query  [trail args=(list [key=@t value=@t])]
+$  trail  [ext=(unit @ta) site=(list @t)]
+$  reply
  $%  [%page bod=manx]                                  ::  html page
      [%xtra hed=header-list:http bod=manx]             ::  html page w/ heads
      [%move loc=@t]                                    ::  308, use other
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
    %move  [[308 ['location' loc.reply]~] ~]
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
::
++  store  ::  set cache entry
  |=  [url=@t entry=(unit cache-entry:eyre)]
  ^-  card:agent:gall
  [%pass /eyre/cache %arvo %e %set-response url entry]
--
