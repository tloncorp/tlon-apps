::  expose widget: rendering logic for the  public profile widget
::
/-  c=cite, d=channels
/+  u=channel-utils
::
/=  r  /app/expose/render
/*  style-widget  %css  /app/expose/style/widget/css
::
|%
++  render
  |=  [=bowl:gall open=(set cite:c)]
  ^-  marl
  :+  ;style:"{(trip style-widget)}"
    ;h2:"Published content"
  ::
  ?:  =(~ open)
    ;+  ;span.crickets:"Nothing yet..."
  ::
  =-  (snoc - time-script-node:r)
  %+  murn
    ::REVIEW  maybe limit to the latest n?
    ::TODO  if we don't limit, at least +turn into posts first, sort by their times
    %+  sort  ~(tap in open)
    ::  newest first (assumes id nr in path is a timestamp)
    ::
    |=  [a=cite:c b=cite:c]
    ?.  ?=([%chan * ?(%msg %note %curio) @ *] a)  |
    ?.  ?=([%chan * ?(%msg %note %curio) @ *] b)  &
    ?~  aa=(rush i.t.wer.a dum:ag)                |
    ?~  bb=(rush i.t.wer.b dum:ag)                &
    (gth u.aa u.bb)
  |=  ref=cite:c
  ^-  (unit manx)
  =/  pon=(unit [=nest:g:c =post:d])
    (grab-post:cite:u bowl ref)
  ?~  pon  ~
  %-  some
  =/  link=tape
    (spud (print:c ref))
  =,  post.u.pon
  ?-  -.kind-data.post.u.pon
      %chat
    ;div.exposed
      ;div.content
        ;a.chat/"/expose{link}"
          ;*  %.  content
              =<(story(anchors |) en-manx:u)
        ==
      ==
      ;div.author-row
        ;+  (author:r bowl author)
        ;+  (datetime:r sent)
      ==
    ==
  ::
      %diary
    ;div.exposed
      ;*  ?:  =('' image.kind-data)  ~
          :_  ~
          ;a.diary/"/expose{link}"
            ;img@"{(trip image.kind-data)}";
          ==
      ;a.diary/"/expose{link}"
        ;h3:"{(trip title.kind-data)}"
      ==
      ;div.author-row
        ;+  (author:r bowl author)
        ;+  (datetime:r sent)
      ==
    ==
  ::
      %heap
    ::TODO  for the kinds of children the div.content gets for heap posts,
    ::      having an %a (grand)parent breaks the html rendering,
    ::      putting the inner divs outside/after the a.exposed
    ;div.exposed
      ;div.content
        ;a.heap/"/expose{link}"
          ;*  %.  content
              =<(story(anchors |) en-manx:u)
        ==
      ==
      ;div.author-row
        ;+  (author:r bowl author)
        ;+  (datetime:r sent)
      ==
    ==
  ==
--
