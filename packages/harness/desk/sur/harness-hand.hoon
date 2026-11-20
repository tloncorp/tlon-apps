::  Versioned, transport-independent conversation hand boundary.
/-  h=harness
|%
+$  binding
  $:  hand=@t
      address=@t
      sid=session-id:h
      actors=(list @t)
      enabled=?
  ==
+$  phase  ?(%queued %running %completed %failed %cancelled)
+$  observation
  $:  binding=@t
      event=@t
      actor=@t
      text=@t
      at=@da
      phase=phase
  ==
+$  delivery-state  ?(%pending %claimed %delivered %failed %uncertain %abandoned)
+$  receipt  [at=@da status=delivery-state worker=@t external=@t]
+$  publication
  $:  input=input-id:h
      binding=@t
      hand=@t
      address=@t
      sid=session-id:h
      kind=?(%reply %failure %cancelled)
      body=@t
      status=delivery-state
      worker=@t
      external=@t
      receipts=(list receipt)
  ==
+$  resolution  [at=@da attempt=@ud outcome=delivery-state reason=@t]
+$  control  [attempt=@ud resolutions=(list resolution)]
+$  retirement  [binding=@t digest=@uvH location=@t at=@da]
+$  state
  $:  bindings=(map @t binding)
      observations=(map input-id:h observation)
      queue=(list input-id:h)
      active=(map session-id:h input-id:h)
      outbox=(map input-id:h publication)
      controls=(map input-id:h control)
      retired=(set @t)
      next-binding=@ud
      retirements=(list retirement)
  ==
+$  action
  $%  [%bind id=@t config=binding]
      [%register config=binding]
      [%enable id=@t enabled=?]
      [%remove id=@t]
      [%observe binding=@t event=@t actor=@t text=@t]
      ::  Literal hand-owned output, with the same admission/delivery ledger
      ::  but no model turn and no interpretation of its text as a command.
      [%notify binding=@t event=@t actor=@t text=@t]
      [%claim hand=@t effect=input-id:h worker=@t]
      $:  %receipt  hand=@t  effect=input-id:h  worker=@t  status=?(%delivered %failed %uncertain)
          external=@t
      ==
      $:  %receipt-at  hand=@t  effect=input-id:h  worker=@t  attempt=@ud
          status=?(%delivered %failed %uncertain)  external=@t
      ==
      $:  %resolve  hand=@t  effect=input-id:h  attempt=@ud
          status=?(%delivered %failed %uncertain %abandoned)  external=@t  reason=@t
      ==
      [%retry hand=@t effect=input-id:h]
      [%status binding=@t]
      [%outbox hand=@t]
      [%publications hand=@t after=(unit input-id:h) limit=@ud]
      [%effect hand=@t effect=input-id:h]
      [%health hand=@t]
      [%archive binding=@t]
      [%records binding=@t after=(unit input-id:h) limit=@ud]
      [%retire binding=@t digest=@uvH location=@t]
  ==
+$  request  [id=@t act=action]
--
