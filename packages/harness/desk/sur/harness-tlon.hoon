::  Tlon-specific state belongs to a hand, never to the semantic head.
/-  c=channels, a=activity-ver, h=harness, ad=harness-adapter
|%
+$  response  ?(%off %mentions %all)
+$  channel-rule  [response=response everyone=?]
+$  policy
  $:  enabled=?
      owner=(unit @p)
      trusted=(map @p (list tool-grant:h))
      response=$~(%mentions response)
      allowed=(set @p)
      channels=(map nest:c channel-rule)
  ==
+$  peer-trust  [policy=policy siblings=?]
+$  destination
  $%  [%dm who=@p parent=(unit message-id:a)]
      [%channel nest=nest:c parent=(unit @da)]
  ==
+$  input  [actor=@p event=@t to=destination text=@t]
+$  lane  [actor=@p to=destination epoch=@ud tools=(list tool-grant:h)]
+$  job  [input=input sid=@t stage=?(%create %bind %observe %error) error=@t]
+$  delivery  $:  attempt=@ud
                  stage=?(%claim %send %receipt)
                  status=?(%delivered %failed %uncertain)
                  external=@t
              ==
+$  publication-proof  [to=destination sent=@da id=@da]
+$  notice  [sequence=@ud at=@da kind=@t actor=@p address=@t event=@t]
+$  presence-lease  [at=@da tools=(set @t)]
+$  tool-receipt
  [request=tool-request:ad stage=?(%sending %done %uncertain) body=@t at=@da]
+$  browser-result  $%([%form url=@t] [%payment id=@t])
+$  browser-phase
  $%  [%authorize ~]  [%prepare local=?]  [%payment ~]
      [%post result=browser-result]  [%wait result=browser-result]  [%check result=browser-result]
  ==
+$  browser-entry  [next=@da phase=browser-phase]
+$  upload
  $:  stage=?(%fetch %put %put-no-acl %grant %hosted-put)  storage=@uv  key=@t  mime=@t
      public-url=@t  bytes=octs
  ==
+$  route  [binding=@t phase=?(%ready %create %fence %config)]
+$  lens-record
  $:  sid=@t
      signature=@uvH
      publication=@uvH
      payload=json
      final=?
      stage=?(%sending %sent %failed)
      attempts=@ud
      next=(unit @da)
  ==
+$  lens-sync
  [enabled=$~(| ?) owner=(unit @p) after=@da records=(map input-id:h lens-record) error=@t]
+$  state-2
  $:  %2
      lens=lens-sync
      owner-initialized=@ud
      sibling-moon-owners=$~(| ?)
      sibling-owner-after=@da
      activity-through=@da
      catching-up=$~(| ?)
      identities=(map [actor=@p to=destination] @t)
      routes=(map @t route)
      cuts=(map @p @da)
      channel-after=@da
      channel-cuts=(map nest:c @da)
      uploads=(map @uv upload)
      last-sent=@da
      tool-receipts=(map @uv tool-receipt)
      computing=(map path presence-lease)
      policy=policy
      epoch=@ud
      after=@da
      lanes=(map @t lane)  ::  admitted authorization generations; head keeps history
      jobs=(map @uv job)
      deliveries=(map @uv delivery)
      notices=(list notice)
      next-notice=@ud
      listeners=(set @t)
      watching=?
      wake=(unit @da)
      error=@t
  ==
+$  state-3
  $:  %3
      browser-entries=(map @uv browser-entry)
      lens=lens-sync
      owner-initialized=@ud
      sibling-moon-owners=$~(| ?)
      sibling-owner-after=@da
      activity-through=@da
      catching-up=$~(| ?)
      identities=(map [actor=@p to=destination] @t)
      routes=(map @t route)
      cuts=(map @p @da)
      channel-after=@da
      channel-cuts=(map nest:c @da)
      uploads=(map @uv upload)
      last-sent=@da
      tool-receipts=(map @uv tool-receipt)
      computing=(map path presence-lease)
      policy=policy
      epoch=@ud
      after=@da
      lanes=(map @t lane)
      jobs=(map @uv job)
      deliveries=(map @uv delivery)
      notices=(list notice)
      next-notice=@ud
      listeners=(set @t)
      watching=?
      wake=(unit @da)
      error=@t
  ==
--
