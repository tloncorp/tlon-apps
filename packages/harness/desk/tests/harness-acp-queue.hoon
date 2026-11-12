/-  ac=acp
/+  *test, q=harness-acp-queue
|%
++  con
  ^-  connection:v1:ac
  [& ~2026.9.6 ~ 1 1 ~ ~]
++  queue
  |=  count=@ud
  ^-  (map @ud message:v1:ac)
  %+  roll  (gulf 1 count)
  |=  [n=@ud out=(map @ud message:v1:ac)]
  (~(put by out) n [n ~2026.9.6 ''])
++  test-peer-count-bound-does-not-trim-existing-messages
  =/  con  con
  =.  to-client.con  (queue 1.024)
  =/  db  (my ~[['client' con]])
  %-  expect
  !>  ?&  =([1.024 0] (usage:q to-client.con))  !(room:q db 'client' %client '')
          (room:q db 'client' %agent '')
      ==
++  test-peer-byte-bound
  =/  body  (crip (reap 4.194.304 'a'))
  =/  con  con
  =.  to-client.con  (my ~[[1 [1 ~2026.9.6 body]]])
  =/  db  (my ~[['client' con]])
  %-  expect
  !>  ?&  =(1 ~(wyt by to-client.con))  !(room:q db 'client' %client 'a')
          (room:q db 'client' %agent 'a')
      ==
++  test-global-count-bound-includes-both-directions
  =/  full  con
  =.  to-client.full  (queue 1.024)
  =.  to-agent.full  (queue 1.024)
  =/  db  (my ~[['one' full] ['two' full] ['three' full] ['four' full] ['empty' con]])
  (expect !>(!(room:q db 'empty' %client '')))
++  test-global-byte-bound-includes-other-connections
  =/  body  (crip (reap 4.194.304 'a'))
  =/  full  con
  =.  to-client.full  (my ~[[1 [1 ~2026.9.6 body]]])
  =/  db  (my ~[['one' full] ['two' full] ['three' full] ['four' full] ['empty' con]])
  %-  expect
  !>  ?&  =(1 ~(wyt by to-client.full))  !(room:q db 'empty' %client 'a')
          (room:q db 'empty' %client '')
      ==
++  test-acknowledged-space-is-reusable-without-a-state-migration
  =/  full  con
  =.  to-client.full  (queue 1.024)
  =/  next  full(to-client (~(del by to-client.full) 1))
  (expect !>((room:q (my ~[['client' next]]) 'client' %client 'a')))
--
