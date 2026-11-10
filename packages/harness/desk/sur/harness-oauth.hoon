::  Transport bookkeeping, not conversation state. Waiting HTTP requests have
::  no credentials; one refresh serves all clients and holds at most 64 requests.
|%
+$  http-card
  [%pass =wire %arvo %i %request =request:http =outbound-config:iris]
+$  state
  $:  identity=@uvH
      serial=@ud
      active=(unit [serial=@ud deadline=@da])
      expires=(unit @da)
      retry-at=@da
      error=@t
      terminal=?
      waiting=(map wire http-card)
  ==
--
