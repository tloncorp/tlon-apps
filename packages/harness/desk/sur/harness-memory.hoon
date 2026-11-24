::  Shared knowledge and bounded background extraction owned by the head.
/-  h=harness
|%
+$  source  [sid=@t input=@uv event=@ud at=@da actor=@t]
+$  value
  [body=(unit @t) aliases=(set @t) general=? explicit=? =source]
+$  record
  [revision=@ud =value terms=(set @t) history=(list [revision=@ud =value])]
+$  posting  ((mop @ud @t) lte)
+$  bucket  [count=@ud rows=posting]
+$  selection  [input=@uv parent=(unit @t) actor=@t names=(list @t)]
+$  evidence  [=source role=@t text=@t]
+$  job
  $:  sid=@t
      input=@uv
      log=(list event:h)
      stop=(list event:h)
      at=@ud
      sent=@da
      barrier=@ud
      config=config:h
      evidence=(list evidence)
      bytes=@ud
      attempts=@ud
  ==
+$  pending
  [id=@ud =job config=config:h barrier=@ud deadline=@da bases=(map @t @ud)]
+$  dreaming
  [enabled=$~(| ?) due=(unit @da) buffered=(map @t job) last=(unit @da) changes=@ud]
+$  state
  $:  maintenance=[dreaming=dreaming compactions=(map @t pending)]
      records=(map @t record)
      index=(map @t bucket)
      general=(map @t (list @t))
      revision=@ud
      barrier=@ud
      disabled=(set @t)
      turns=(map @t selection)
      cursors=(map @t (list event:h))
      jobs=(map @ud job)
      queued=(map @t @ud)
      head=@ud
      next=@ud
      pending=(unit pending)
      wake=(unit @da)
      usage=usage:h
      status=@t
  ==
--
