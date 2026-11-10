::  Connected-agent transport state. Credentials grant one runner's queue only.
/-  h=harness
|%
+$  request
  [runner=@t sid=session-id:h req=@ud kind=request-kind:h attempt=@t checkpoint=@uvH body=json]
+$  job  [request=request created=@da claimed=? parked=?]
+$  runner
  $:  label=@t
      digest=@ux
      revoked=?
      created=@da
      seen=@da
      stream=(unit @ta)
      next=@ud
      acknowledged=@ud
      events=(map @ud json)
      sequence=@ud
      receipt=@uvH
  ==
+$  state
  $:  registry=(map @t runner)
      jobs=(map @t job)
      wake=(unit @da)
  ==
--
