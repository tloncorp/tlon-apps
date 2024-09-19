::  exposé: clearweb content rendering
::
::    copy a reference to a notebook post, then:
::    :expose [%show /that/reference/with/id/numbers/quoted/'123456789']
::    then visit in the browser:
::    /expose/that/reference/as/copied/123456789
::
/-  c=cite, d=channels, co=contacts
/+  sigil, u=channel-utils,
    dbug, verb
::
/*  style-shared  %css  /app/expose/style/shared/css
/*  style-widget  %css  /app/expose/style/widget/css
/*  style-page    %css  /app/expose/style/page/css
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
++  r  ::  generic-ish rendering utils
  |%
  ++  author-node
    |=  [[our=@p now=@da] author=ship]
    ^-  manx
    =/  aco=(unit contact:co)
      (get-contact [our now] author)
    ;div.author
      ;div.avatar
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
      ;+
      =*  nom  ;span:"{(scow %p author)}"
      ?~  aco  nom
      ?:  =('' nickname.u.aco)  nom
      ;span(title "{(scow %p author)}"):"{(trip nickname.u.aco)}"
    ==
  ::
  ++  render-datetime  ::TODO  date-only mode
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
::
++  e  ::  expose rendering
  |%
  ++  render-post
    |=  [our=@p now=@da]
    |=  [=nest:g:c msg=post:d]
    ^-  (unit manx)
    =/  aco=(unit contact:co)
      (get-contact [our now] author.msg)
    ::
    ::TODO  if we render replies then we can "unroll" whole chat threads too (:
    ::TODO  just key off the kind-data, no?
    |^  ?+  p.nest  ~
            %chat
          ?>  ?=(%chat -.kind-data.msg)
          =/  title=tape
            (trip (rap 3 (turn (first-inline:u content.msg) flatten-inline:u)))
          %-  some
          %:  build  "chat"
            (heads title ~)
            [chat-prelude]~
            (story:en-manx:u content.msg)
          ==
        ::
            %diary
          ?>  ?=(%diary -.kind-data.msg)
          =*  kd  kind-data.msg
          =/  title=tape  (trip title.kd)
          %-  some
          %:  build  "diary"
            (heads title ?:(=('' image.kd) ~ `image.kd))
          ::
            ?:  =('' image.kd)  (diary-prelude title)
            :-  ;img.cover@"{(trip image.kd)}"(alt "Cover image");
            (diary-prelude title)
          ::
            (story:en-manx:u content.msg)
          ==
        ::
            %heap
          ?>  ?=(%heap -.kind-data.msg)
          =/  title=tape
            ?:  &(?=(^ title.kind-data.msg) !=('' u.title.kind-data.msg))
              (trip u.title.kind-data.msg)
            ::NOTE  could flatten the first-inline, but we don't. showing that
            ::      as both h1 and content is strange
            ""
          %-  some
          %:  build  "chat"
            (heads ?:(=("" title) "Gallery item" title) ~)
            (heap-prelude title)
            (story:en-manx:u content.msg)
          ==
        ==
    ::
    ++  build
      |=  [tag=tape hes=manx pre=marl bod=marl]
      ^-  manx
      ;html
        ;+  hes
        ;body(class tag)
          ;article.expose-content
            ;header
              ;*  pre
            ==
            ;*  bod
          ==
          ;+  badge
        ==
        ;+  time-script-node:r
      ==
    ::
    ++  heads
      |=  [title=tape img=(unit @t)]
      ;head
        ;title:"{title}"
        ;link(rel "stylesheet", href "/expose/style/shared.css");
        ;style:"{(trip style-page)}"
      ::
        ;meta(charset "utf-8");
        ;meta(name "viewport", content "width=device-width, initial-scale=1");
      ::
        ;meta(name "robots", content "noindex, nofollow, noimageindex");
      ::
        ::REVIEW  make sure this is the right/new app id
        ;meta(property "apple-itunes-app", content "app-id=6451392109");
        ::NOTE  at the time of writing, android supports no such thing
      ::
        ::TODO  could get even smarter about description, preview image, etc
        ;meta(property "og:title", content title);
        ;meta(property "twitter:title", content title);
        ;meta(property "og:site_name", content "Tlon");
        ;meta(property "og:type", content "article");
        ;meta(property "og:article:author:username", content (scow %p author.msg));
      ::
        ;*  ?~  img
            :_  ~
            ;meta(property "twitter:card", content "summary");
        =/  img=tape  (trip u.img)
        :~  ;meta(property "twitter:card", content "summary_large_image");
            ;meta(property "og:image", content img);
            ;meta(property "twitter:image", content img);
        ==
      ::
        ;*  ?~  aco  ~
            ?:  =('' nickname.u.aco)  ~
            :_  ~
        ;meta(property "og:article:author:first_name", content (trip nickname.u.aco));
      ==
    ::
    ++  badge
      ;div.tlon-badge
        ;a(href "https://tlon.io")
          ;img@"https://tlon.io/icon.svg"(alt "Tlon logo", width "18");
          ;span
            ; Powered by Tlon
          ==
        ==
      ==
    ::
    ++  chat-prelude
      ^-  manx
      ;div.author-row
        ;+  (author-node:r [our now] author.msg)
        ;+  (render-datetime:r sent.msg)
      ==
    ::
    ++  diary-prelude
      |=  title=tape
      ^-  marl
      :~  ;h1:"{title}"
          ;div.author-row
            ;+  (author-node:r [our now] author.msg)
            ;+  (render-datetime:r sent.msg)
          ==
      ==
    ::
    ++  heap-prelude
      |=  title=tape
      ^-  marl
      =-  ?:  =("" title)  [-]~
          :-  ;h1:"{title}"
          [-]~
      ;div.author-row
        ;+  (author-node:r [our now] author.msg)
        ;+  (render-datetime:r sent.msg)
      ==
    --
  ::
  ++  post-from-cite
    |=  [our=@p now=@da ref=cite:c]
    ^-  (unit [=nest:g:c =post:d])
    ?.  ?=(%chan -.ref)
      ~
    ::TODO  the whole "deconstruct the ref path" situation is horrendous
    ?.  ?=([?(%msg %note %curio) @ ~] wer.ref)
      ~
    =,  ref
    =/  base=path
      %+  weld
        /(scot %p our)/channels/(scot %da now)
      /v2/[p.nest]/(scot %p p.q.nest)/[q.q.nest]
    ?.  .^(? %gu base)  ~
    :+  ~  nest
    .^  post:d  %gx
      %+  weld  base
      /posts/post/(scot %ud (rash i.t.wer dum:ag))/channel-post-2
    ==
  ::
  ++  update-widget
    |=  [[our=@p now=@da] open=(set cite:c)]
    ^-  (list card)
    ?.  .^(? %gu /(scot %p our)/profile/(scot %da now)/$)
      ~
    ~>  %bout.[0 'updating expose widget']
    =;  widget=[%0 desc=@t %marl marl]
      =/  =cage  noun+!>([%command %update-widget %groups %expose-all widget])
      [%pass /profile/widget/all %agent [our %profile] %poke cage]~
    :^  %0  'Publicized content'  %marl
    ^-  marl
    ::
    =/  cis=(list cite:c)
      ::REVIEW  maybe limit to the latest n?
      %+  sort  ~(tap in open)
      ::  newest first (assumes id nr in path is a timestamp)
      ::
      |=  [a=cite:c b=cite:c]
      ?.  ?=([%chan * ?(%msg %note %curio) @ *] a)  |
      ?.  ?=([%chan * ?(%msg %note %curio) @ *] b)  &
      ?~  aa=(rush i.t.wer.a dum:ag)                |
      ?~  bb=(rush i.t.wer.b dum:ag)                &
      (gth u.aa u.bb)
    :-  ;style:"{(trip style-widget)}"
    =-  (snoc - time-script-node:r)
    %+  murn  cis
    |=  ref=cite:c
    ^-  (unit manx)
    =/  pon=(unit [=nest:g:c =post:d])
      (post-from-cite our now ref)
    ?~  pon  ~
    %-  some
    =/  link=tape
      (spud (print:c ref))
    =,  post.u.pon
    ?-  -.kind-data.post.u.pon
        %chat
      ;a.exposed.chat/"/expose{link}"
        ;div.meta
          ;+  (author-node:r [our now] author)
          ;+  (render-datetime:r sent)
        ==
        ;div.content
          ;*  (story:en-manx:u content)
        ==
      ==
    ::
        %diary
      ;a.exposed.diary/"/expose{link}"
        ;*  ?:  =('' image.kind-data)  ~
            :_  ~
            ;img@"{(trip image.kind-data)}";
        ;h3:"{(trip title.kind-data)}"
        ;+  (render-datetime:r sent)
        ;+  (author-node:r [our now] author)
      ==
    ::
        %heap
      ::TODO  for the kinds of children the div.content gets for heap posts,
      ::      having an %a (grand)parent breaks the html rendering,
      ::      putting the inner divs outside/after the a.exposed
      ;a.exposed.heap/"/expose{link}"
        ;div.content
          ;*  (story:en-manx:u content)
        ==
        ;div.meta
          ;+  (render-datetime:r sent)
          ;+  (author-node:r [our now] author)
        ==
      ==
    ==
  --
::
++  get-contact
  |=  [[our=@p now=@da] who=@p]
  =>  [+< co=co ..zuse]  ::  memoization aid
  ^-  (unit contact:co)  ~+
  =/  base=path  /(scot %p our)/contacts/(scot %da now)
  ?.  ~+  .^(? %gu (weld base /$))
    ~
  =+  ~+  .^(rol=rolodex:co %gx (weld base /all/contact-rolodex))
  ?~  for=(~(get by rol) who)
    ~
  ?.  ?=([[@ ^] *] u.for)
    ~
  `con.for.u.for
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
  ::
  ++  store  ::  set cache entry
    |=  [url=@t entry=(unit cache-entry:eyre)]
    ^-  card
    [%pass /eyre/cache %arvo %e %set-response url entry]
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
  =.  state  !<(state-0 ole)
  :_  this
  ::  we must defer refreshing the cache because rendering scries
  ::
  [%pass /refresh %arvo %b %wait now.bowl]~
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  !!
      %noun
    ?+  q.vase  !!
        [?(%show %hide) *]
      =+  !<(act=action vase)
      ?-  -.act
          %show
        =/  ref=cite:c
          (parse:c path.act)
        =/  msg=(unit [=nest:g:c =post:d])
          (post-from-cite:e our.bowl now.bowl ref)
        ?>  ?=(^ msg)
        =/  pag=(unit manx)
          ((render-post:e [our now]:bowl) u.msg)
        ?>  ?=(^ pag)
        =.  open    (~(put in open) ref)
        :_  this
        :_  (update-widget:e [our now]:bowl open)
        %+  store:hutils
          (cat 3 '/expose' (spat path.act))
        `[| %payload (paint:hutils %page u.pag)]
      ::
          %hide
        =/  ref=cite:c
          (parse:c path.act)
        ?.  (~(has in open) ref)
          [~ this]
        =.  open    (~(del in open) ref)
        :_  this
        :_  (update-widget:e [our now]:bowl open)
        %+  store:hutils
          (cat 3 '/expose' (spat path.act))
        :^  ~  |  %payload
        [[404 ~] `(as-octs:mimes:html 'not found')]
      ==
    ==
  ::
      %json
    ::  we intentionally slum it with in-agent conversions for now
    ::
    =+  !<(=json vase)
    =-  $(mark %noun, vase !>(`action`-))
    %.  json
    (of show+pa hide+pa ~):dejs:format
  ::
      %handle-http-request
    =+  !<([rid=@ta inbound-request:eyre] vase)
    :_  this
    =;  payload=simple-payload:http
      :_  (spout:hutils rid payload)
      ::  if we handled a request here, make sure it's cached for next time
      ::
      [%pass /eyre/cache %arvo %e %set-response url.request `[| %payload payload]]
    ?:  =('/expose/style/shared.css' url.request)
      :-  [200 ['content-type' 'text/css']~]
      `(as-octs:mimes:html style-shared)
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
    %+  biff
      (post-from-cite:e our.bowl now.bowl u.ref)
    (render-post:e [our now]:bowl)
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
  ::
      [%refresh ~]
    :_  this
    :-  %+  store:hutils  '/expose/style/shared.css'
        =/  bod=(unit octs)
          `(as-octs:mimes:html style-shared)
        `[| %payload [200 ['content-type' 'text/css'] ~] bod]
    %+  weld
      (update-widget:e [our now]:bowl open)
    %+  murn  ~(tap in open)
    |=  ref=cite:c
    ^-  (unit card)  ::TODO  or should this remove from cache also?
    ::TODO  maybe find a way to dedupe with logic in %show and %handle-http-req
    ::TODO  reconsider. if we just remove the cache entry, we'll re-render
    ::      on-demand instead of all-at-once, which may be slow.
    =/  msg=(unit [=nest:g:c =post:d])
      (post-from-cite:e our.bowl now.bowl ref)
    ?~  msg  ~
    =/  pag=(unit manx)
      ((render-post:e [our now]:bowl) u.msg)
    ?~  pag  ~
    %-  some
    %+  store:hutils
      (cat 3 '/expose' (spat (print:c ref)))
    `[| %payload (paint:hutils %page u.pag)]
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [?(%x %u) %show *]
    ``loob+!>((~(has in open) (parse:c t.t.path)))
  ==
::
++  on-leave  |=(* [~ this])
++  on-agent  |=(* [~ this])
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %.  [~ this]
  (slog dap.bowl 'on-fail' term tang)
--
