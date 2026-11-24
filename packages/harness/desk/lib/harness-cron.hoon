::  Strict five-field UTC cron. Pure calendar logic, no timers or inference.
/-  c=harness-cron
|%
::
++  split
  |=  [text=@t delimiter=@t]
  ^-  (list @t)
  =/  chars  (trip text)
  =/  reversed=(list @t)  ~
  =/  part-reversed=tape  ~
  |-
  ?~  chars  (flop [(crip (flop part-reversed)) reversed])
  ?:  =(i.chars delimiter)
    $(chars t.chars, part-reversed ~, reversed [(crip (flop part-reversed)) reversed])
  $(chars t.chars, part-reversed [i.chars part-reversed])
::
++  number
  |=  text=@t
  ^-  @ud
  ?>  &(!=('' text) (lte (met 3 text) 3))
  (need (rush text dem))
::
++  field
  |=  [text=@t lower=@ud upper=@ud]
  ^-  (set @ud)
  =/  entries  (split text ',')
  ?>  (lte (lent entries) 60)
  %+  roll  entries
  |=  [entry=@t values=(set @ud)]
  =/  steps  (split entry '/')
  ?>  ?=(^ steps)
  ?>  |(=(1 (lent steps)) =(2 (lent steps)))
  =/  step=@ud  ?~(t.steps 1 (number i.t.steps))
  ?>  &((gth step 0) (lte step (add 1 (sub upper lower))))
  =/  range=[first=@ud last=@ud]
    ?:  =('*' i.steps)  [lower upper]
    =/  parts  (split i.steps '-')
    ?>  ?=(^ parts)
    ?>  |(=(1 (lent parts)) =(2 (lent parts)))
    =/  first  (number i.parts)
    ::  A bare number selects one value. With a step, it starts a sequence
    ::  through the upper bound unless an explicit range supplies the end.
    =/  last  ?~(t.parts ?~(t.steps first upper) (number i.t.parts))
    [first last]
  ?>  ?&  (gte first.range lower)
          (lte last.range upper)
          (lte first.range last.range)
      ==
  =/  at  first.range
  |-
  ?:  (gth at last.range)  values
  $(at (add at step), values (~(put in values) at))
::
++  parse
  |=  expression=@t
  ^-  pattern:c
  ?>  (lte (met 3 expression) 128)
  =/  fields  (skip (split expression ' ') |=(field=@t =('' field)))
  ?>  =(5 (lent fields))
  :*  (field (snag 0 fields) 0 59)
      (field (snag 1 fields) 0 23)
      (field (snag 2 fields) 1 31)
      (field (snag 3 fields) 1 12)
      (field (snag 4 fields) 0 6)
      =('*' (snag 2 fields))
      =('*' (snag 4 fields))
  ==
::
++  day-matches
  |=  [pattern=pattern:c day=@da]
  ^-  ?
  ?.  (gte day ~2000.1.1)  |
  =/  date  (yore day)
  ?.  (~(has in months.pattern) m.date)  |
  =/  month-day  (~(has in days.pattern) d.t.date)
  =/  week-day  (~(has in weekdays.pattern) (mod (add 6 (div (sub day ~2000.1.1) ~d1)) 7))
  ::  Traditional cron: restricted day-of-month and day-of-week are ORed.
  ?:  any-day.pattern  week-day
  ?:  any-weekday.pattern  month-day
  |(month-day week-day)
::
++  next
  |=  [pattern=pattern:c after=@da]
  ^-  (unit @da)
  ?.  (gte after ~2000.1.1)  ~
  =/  date  (yore after)
  ::  Search eligible minutes from the beginning of each UTC day.
  =.  date
    %*  .  date
      h.t  0
      m.t  0
      s.t  0
      f.t  ~
    ==
  =/  day  (year date)
  =/  slots=(list @ud)
    %+  skim  (gulf 0 1.439)
    |=  minute=@ud
    &((~(has in hours.pattern) (div minute 60)) (~(has in minutes.pattern) (mod minute 60)))
  =/  days-searched  0
  |-
  ::  Day skipping bounds work even for impossible dates. Four years permit
  ::  ordinary leap-day schedules; no minute-by-minute year-long loop.
  ?:  =(1.461 days-searched)  ~
  =/  found=(unit @da)
    ?.  (day-matches pattern day)  ~
    =/  remaining  slots
    |-
    ?~  remaining  ~
    =/  at=@da  (add day (mul i.remaining ~m1))
    ?:  (gth at after)  `at
    $(remaining t.remaining)
  ?^  found  found
  $(days-searched +(days-searched), day (add day ~d1))
::
++  event
  |=  [id=@uv at=@da]
  ^-  @t
  (rap 3 'cron/' (scot %uv id) '/' (scot %da at) ~)
--
