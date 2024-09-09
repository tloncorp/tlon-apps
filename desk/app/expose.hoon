::  exposé: clearweb content rendering
::
::    copy a reference to a notebook post, then:
::    :expose [%show /that/reference/with/id/numbers/quoted/'123456789']
::    then visit in the browser:
::    /expose/that/reference/as/copied/123456789
::
/-  c=cite, d=channels
/+  sigil, u=channel-utils,
    dbug, verb
::
|%
+$  state-0
  $:  %0
      open=(set cite:c)  ::TODO  could support ranges of msgs?
  ==
::
+$  action
  $%  [%show =path]
      [%hide =path]
  ==
::
+$  card  card:agent:gall
::
++  hutils  ::  http request utils
  ::NOTE  most of the below are also available in /lib/server, but we
  ::      reimplement them here for independence's sake
  |%
  +$  order  [id=@ta inbound-request:eyre]
  +$  query  [trail args=(list [key=@t value=@t])]
  +$  trail  [ext=(unit @ta) site=(list @t)]
  +$  reply
    $%  [%page bod=manx]                                  ::  html page
        [%xtra hed=header-list:http bod=manx]             ::  html page w/ heads
    ==
  ::
  ++  purse  ::  url cord to query
    |=  url=@t
    ^-  query
    (fall (rush url ;~(plug apat:de-purl:html yque:de-purl:html)) [[~ ~] ~])
  ::
  ++  press  ::  manx to octs
    (cork en-xml:html as-octt:mimes:html)
  ::
  ++  paint  ::  render response into payload
    |=  =reply
    ^-  simple-payload:http
    ?-  -.reply
      %page  [[200 ['content-type' 'text/html']~] `(press bod.reply)]
      %xtra  =?  hed.reply  ?=(~ (get-header:http 'content-type' hed.reply))
               ['content-type'^'text/html' hed.reply]
             [[200 hed.reply] `(press bod.reply)]
    ==
  ::
  ++  spout  ::  build full response cards
    |=  [eyre-id=@ta simple-payload:http]
    ^-  (list card)
    =/  =path  /http-response/[eyre-id]
    :~  [%give %fact ~[path] [%http-response-header !>(response-header)]]
        [%give %fact ~[path] [%http-response-data !>(data)]]
        [%give %kick ~[path] ~]
    ==
  --
--
::
%-  agent:dbug
%+  verb  |
^-  agent:gall
::
=|  state-0
=*  state  -
|_  =bowl:gall
+*  this  .
++  on-init
  ^-  (quip card _this)
  :_  this
  [%pass /eyre/connect %arvo %e %connect [~ /expose] dap.bowl]~
::
++  on-save  !>(state)
++  on-load
  |=  ole=vase
  ^-  (quip card _this)
  [~ this(state !<(state-0 ole))]
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  !!
      %noun
    ?+  q.vase  !!
        [?(%show %hide) *]
      =+  !<(act=action vase)
      =.  open
        ?-  -.act
          %show  (~(put in open) (parse:c path.act))  ::TODO  populate cache
          %hide  (~(del in open) (parse:c path.act))  ::TODO  update the cache w/ 404
        ==
      [~ this]
    ==
  ::
      %handle-http-request
    =+  !<([rid=@ta inbound-request:eyre] vase)
    :_  this
    =;  payload=simple-payload:http
      ::TODO  re-enable caching
      :: :_
        (spout:hutils rid payload)
      ::  if we handled a request here, make sure it's cached for next time
      ::
      :: [%pass /eyre/cache %arvo %e %set-response url.request `[| %payload payload]]
    =/  ref=(unit cite:c)
      (rush url.request (sear purse:c ;~(pfix (jest '/expose') stap)))
    ?~  ref
      [[400 ~] `(as-octs:mimes:html 'bad request')]
    ::
    =;  bod=(unit manx)
      ?~  bod  [[404 ~] `(as-octs:mimes:html 'not found')]
      (paint:hutils %page u.bod)
    ::
    ?.  (~(has in open) u.ref)
      ~
    ?.  ?=(%chan -.u.ref)
      ~
    ::TODO  the whole "deconstruct the ref path" situation is horrendous
    ?.  ?=([?(%msg %note) @ ~] wer.u.ref)  ::TODO  support chat msgs, replies
      ~
    ::  /1/chan/chat/~bolbex-fogdys/watercooler-4926/msg/170141184506984515746528913634457812992
    ::  /v2/chat/~bolbex-fogdys/watercooler-4926/posts/post/[id]
    ::  /v2/chat/~bolbex-fogdys/watercooler-4926/posts/post/id/[id]/replies/[id]
    =/  msg=(unit post:d)
      :-  ~  ::TODO  we want to do existence checks first though...
      .^  post:d
        %gx
        (scot %p our.bowl)
        %channels
        (scot %da now.bowl)
      ::
        =,  u.ref
        /v2/[p.nest]/(scot %p p.q.nest)/[q.q.nest]/posts/post/(scot %ud (rash i.t.wer dum:ag))/channel-post-2
      ==
    ?~  msg
      ~
    ::TODO  if we render replies then we can "unroll" whole chat threads too (:
    |^  ?+  p.nest.u.ref  ~  ::TODO  support rendering others
            %diary
          ?>  ?=(%diary -.kind-data.u.msg)
          =/  title=tape  (trip title.kind-data.u.msg)
          %-  some
          ^-  manx
          ;html
            ;+  (heads title (scow %p author.u.msg))
            ;body
              ;*  (diary-prelude title author.u.msg sent.u.msg)
              ;*  (story:en-manx:u content.u.msg)
            ==
          ==
        ==
    ::
    ++  style
      '''
      TODO
      '''
    ::
    ++  heads
      |=  [title=tape author=tape]
      ;head
        ;title:"{title}"
        ;style:"{(trip style)}"
        ;meta(charset "utf-8");
        ;meta(name "viewport", content "width=device-width, initial-scale=1");
      ::
        ;meta(name "robots", content "noindex, nofollow, noimageindex");
      ::
        ::TODO  could get smarter about description, preview image, etc
        ;meta(property "og:title", content title);
        ;meta(property "twitter:title", content title);
        ;meta(property "og:site_name", content "Tlon");
        ;meta(property "og:type", content "article");
        ;meta(property "twitter:card", content "summary");
        ;meta(property "og:article:author:username", content author);
      ==
    ::
    ++  diary-prelude
      |=  [title=tape author=ship sent=@da]
      ^-  marl
      :~  ;h1:"{title}"
          ;div.prelude
            ;+  (sigil(size 25, icon &) author)
            ; {(scow %p author)}
            ;em:"{(scow %da (sub sent (mod sent ~s1)))}"
          ==
      ==
    --
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?>  ?=([%http-response @ ~] path)
  [~ this]
::
++  on-arvo
  |=  [=wire sign=sign-arvo]
  ^-  (quip card _this)
  ~|  wire
  ?+  wire  !!
      [%eyre %connect ~]
    [~ this]  ::TODO  print if not successful
  ==
::
++  on-leave  |=(* [~ this])
++  on-agent  |=(* [~ this])
++  on-peek   |=(* ~)
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %.  [~ this]
  (slog dap.bowl 'on-fail' term tang)
--
