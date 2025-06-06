::  expose render: rendering utilities for pages & the widget
::
/-  c=channels, co=contacts-0
/+  u=channel-utils, sigil
::
|%
::  +author-contact: turn a post author into a contact profile
::
::    if the author is a bot, replaces nickname and avatar fields,
::    when those are specified.
::
++  get-author-contact
  |=  [=bowl:gall =author:c]
  ^-  (unit contact-0:co)
  =/  aco=(unit contact-0:co)
    (get-contact:co bowl (get-author-ship:u author))
  ?@  author  aco
  %-  some
  ?~  aco
    %*  .  *contact-0:co
      nickname  (fall nickname.author '')
      avatar    avatar.author
    ==
  %_  u.aco
    nickname  (fall nickname.author nickname.u.aco)
    avatar    (hunt |=(* &) avatar.author avatar.u.aco)
  ==
::
++  author
  =/  link=(unit @t)  ~
  |=  [=bowl:gall post-author=author:c]
  ^-  manx
  =/  author=@p
    (get-author-ship:u post-author)
  =/  aco=(unit contact-0:co)
    (get-author-contact bowl post-author)
  |^  ::TODO  we should just have a bunch of manx construction helpers
      ::      for stuff like this
      ?~  link
        ;div.author
          ;*  inner
        ==
      ;div.author  ;a(href (trip u.link))
        ;*  inner
      ==  ==
  ::
  ++  inner  ~[avatar name]
  ::
  ++  avatar
    ;span.avatar
      ;+
      ?:  &(?=(^ aco) ?=(^ avatar.u.aco) !=('' u.avatar.u.aco))
        ;img@"{(trip u.avatar.u.aco)}"(alt "Author's avatar");
      =/  val=@ux   ?~(aco 0x0 color.u.aco)
      =/  col=tape  ((x-co:^co 6) val)
      %.  author
      %_  sigil
        size  25
        icon  &
        bg    '#'^col
        fg    ?:((gth (div (roll (rip 3 val) add) 3) 180) "black" "white")  ::REVIEW
      ==
    ==
  ::
  ++  name
    =*  nom  ;span:"{(scow %p author)}"
    ?~  aco  nom
    ?:  =('' nickname.u.aco)  nom
    ;span(title "{(scow %p author)}"):"{(trip nickname.u.aco)}"
  --
::
++  datetime  ::TODO  date-only mode
  |=  =time
  ^-  manx
  =,  chrono:userlib
  =;  utc=tape
    ::NOTE  timestamp-utc class and ms attr used by +time-script,
    ::      which replaces this rendering with the local time
    ;time.timestamp-utc(ms (a-co:^co (unm time)))
      ; {utc}
    ==
  =/  =date  (yore time)
  |^  "{(snag (dec m.date) mon:yu)} ".
      "{(num d.t.date)}{(ith d.t.date)}, ".
      "{(num y.date)}, ".
      "{(dum h.t.date)}:{(dum m.t.date)} (UTC)"
  ++  num  a-co:^co
  ++  dum  (d-co:^co 2)
  ++  ith
    |=  n=@ud
    ?-  n
      %1  "st"
      %2  "nd"
      %3  "rd"
      ?(%11 %12 %13)  "th"
    ::
        @
      ?:  (lth n 10)  "th"
      $(n (mod n 10))
    ==
  --
::
++  time-script-node
  ;script(type "text/javascript"):"{(trip time-script)}"
++  time-script
  '''
  const a = document.getElementsByClassName('timestamp-utc');
  for (const e of a) {
    const t = new Date(Number(e.attributes['ms'].value));
    e.innerText = t.toLocaleString('en-US', {month: 'long'}) + ' '
                + (a=>a+=[,"st","nd","rd"][a.match`1?.$`]||"th")(''+t.getDate()) + ', '
                + t.getFullYear() + ', '
                + t.toLocaleString('en-US', {hour: '2-digit', minute: '2-digit', hour12: false});
  };
  '''
--
