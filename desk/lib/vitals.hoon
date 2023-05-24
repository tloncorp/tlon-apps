/-  v=vitals
|%
++  simplify-qos
  |=  =ship-state
  ^-  qos:ames
  ?-  +.ship-state
    %alien  [%dead *@da]
    %known  ?+  +.qos.ship-state  qos.ship-state
              %unborn   [%dead last-contact.qos.ship-state]
  ==        ==
--
