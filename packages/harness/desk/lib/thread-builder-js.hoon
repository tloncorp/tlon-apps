/-  spider
/-  channels-sur=channels, channels-ver-sur=channels-ver
/-  groups-ver-sur=groups-ver
/-  chat-ver-sur=chat-ver
/+  sio=strandio
/+  wasm=wasm-lia
/+  mp=mop-extensions
/+  cj=channel-json
/+  gj=groups-json
/+  sj=story-json
/*  quick-js-wasm  %wasm  /quick-js-emcc/wasm
::
=*  strand  strand:spider
=*  cw  coin-wasm:wasm-sur:wasm
=*  lv  lia-value:lia-sur:wasm
=*  script-form  script-raw-form:lia-sur:wasm
=*  strand-form  strand-form-raw:rand
=*  yield  script-yield:lia-sur:wasm
::  Types, interfaces
::
=>  |%
    ++  get-js-ctx
      |=  tor=vase
      ^-  [run-u=@ ctx-u=@ fil-u=@]
      =>  !<(acc tor)
      [run-u ctx-u fil-u]
    ::  actual accumulator type of a vase noun to be stored in lia accumulator
    ::
    +$  acc
      $:  run-u=@
          ctx-u=@
          fil-u=@
          :: state=json  XX  not necessary?
          bowl=(unit bowl:rand)
      ==
    ::
    +$  acc-mold  vase
    ++  arr  (arrows:wasm acc-mold)
    ::  table-entry:
    ::    head: JS part: name as a list of strings for namespacing
    ::                   lia arrow [@ @ @ @] => @
    ::    tail: strand part: strand id
    ::                       strand arrow (list lv) => (list lv)
    +$  js-import-func  $-([@ @ @ @] (script-form @ acc-mold))
    +$  table-entry
      $:  $=  js
          %-  unit
          $:  name=(list cord)
              js-func=js-import-func
          ==
      ::
          $=  ext
          %-  unit
          $:  id=@tas
              thread=$-((list lv) (strand-form (list lv)))
          ==  ==
    --
::
::  Thread builder helping functions
::
=>  |%
    ++  ease-discipline
      %-  slog
      :_  ~
      'This path is not covered with +discipline table in %groups, so \
      /the agent yaps at a "mismatching mark", ignore it'
    ::
    ::  +scry: scry thread with explicit path interpolation
    ::
    ++  scry
      |*  [=mold what=term whom=term pax=path]
      =/  m  (strand mold)
      ^-  form:m
      ;<  =bowl:spider  bind:m  get-bowl:sio
      %-  pure:m
      .^(mold what (scot %p our.bowl) whom (scot %da now.bowl) pax)
    ::  en:json:html with fixed escape logic for usage in doq JS string literals
    ::
    ++  en-json-fixed
      |^  |=  jon=json
          ^-  cord
          (rap 3 (flop (onto jon ~)))
      ::
      ++  onto
        |=  [val=json out=(list @t)]
        ^+  out
        ?~  val  ['null' out]
        ?-  -.val
            %a
          ?~  p.val  ['[]' out]
          =.  out  ['[' out]
          !.
          |-  ^+  out
              =.  out  ^$(val i.p.val)
              ?~(t.p.val [']' out] $(p.val t.p.val, out [',' out]))
        ::
            %b
          [?:(p.val 'true' 'false') out]
        ::
            %n
          [p.val out]
        ::
            %s
          [(scap p.val) out]
        ::
            %o
          =/  viz  ~(tap by p.val)
          ?~  viz  ['{}' out]
          =.  out  ['{' out]
          !.
          |-  ^+  out
              =.  out  ^$(val q.i.viz, out [':' [(scap p.i.viz) out]])
              ?~(t.viz ['}' out] $(viz t.viz, out [',' out]))
        ==
      ::
      ++  scap
        |=  val=@t
        ^-  @t
        =/  out=(list @t)  ['"' ~]
        =/  len  (met 3 val)
        =|  [i=@ud pos=@ud]
        |-  ^-  @t
            ?:  =(len i)
              (rap 3 (flop ['"' (rsh [3 pos] val) out]))
            =/  car  (cut 3 [i 1] val)
            ?:  ?&  (gte car 0x20)
                    (lte car 0x7e)
                    !=(car '"')
                    !=(car '\\')
                ==
              $(i +(i))
            =/  cap
              ?+  car  (crip '\\' 'u' ((x-co 4):co car))
                %0xa  '\\n'
                %'"'  '\\"'
                %'\\'  '\\\\'
              ==
            $(i +(i), pos +(i), out [cap (cut 3 [pos (sub i pos)] val) out])
      --
    ::    
    ++  function-table
      ^-  (list table-entry)
      =*  v-sur-channels  v9:channels-ver-sur
      =*  flag  =>  v-sur-channels  flag
      =*  nest  =>  v-sur-channels  nest
      =*  channels  =>  v-sur-channels  channels
      =*  channel  =>  v-sur-channels  channel
      =*  post  =>  v-sur-channels  post
      =*  posts  =>  v-sur-channels  posts
      =*  memo  =>  v-sur-channels  memo
      =*  on-posts  =>  v-sur-channels  on-posts
      =*  reply-chan  =>  v-sur-channels  reply
      =*  replies-chan  =>  v-sur-channels  replies
      =*  on-replies-chan  =>  v-sur-channels  on-replies
      =*  story  =>  v-sur-channels  story
      =*  action-c  =>  v-sur-channels  a-channels
      =*  tomb-channels  =>  v-sur-channels  tombstone
      =*  mo-posts  ((mp time (each post tomb-channels)) lte)
      ::
      =*  v-sur-chat  v6:chat-ver-sur
      =*  dm  =>  v-sur-chat  dm
      =*  writ  =>  v-sur-chat  writ
      =*  writs  =>  v-sur-chat  writs
      =*  reply-dm  =>  v-sur-chat  reply
      =*  replies-dm  =>  v-sur-chat  replies
      =*  club  =>  v-sur-chat  club
      =*  id-club  =>  v-sur-chat  id:club
      =*  action-club  =>  v-sur-chat  action:club
      =*  action-dm  =>  v-sur-chat  action:dm
      =*  tomb-chat  =>  v-sur-chat  tombstone
      =*  mo-writs  ((mp time (each writ tomb-chat)) lte)
      ::
      =*  v-sur-groups  v9:groups-ver-sur
      =*  flag  =>  v-sur-groups  flag
      =*  groups  =>  v-sur-groups  groups
      =*  seat  =>  v-sur-groups  seat
      =*  role-groups  =>  v-sur-groups  role-id
      =*  action-g  =>  v-sur-groups  a-groups
      ::
      =/  m-js  (script:lia-sur:wasm @ acc-mold)
      =/  m-rand  (strand (list lv))
      |^
        :~  console-log
            console-error
            console-warn
            console-info
            load-txt-file
            store-txt-file
            fetch-sync
            tlon-get-channels
            tlon-get-channel-messages
            tlon-get-dm-messages
            tlon-get-dm-replies
            tlon-get-channel-replies
            tlon-get-channel-members
            tlon-get-roles
            tlon-invite-user-channel
            tlon-invite-user-groupchat
            tlon-kick-user-channel
            tlon-give-role
            tlon-remove-role
            tlon-post-channel
            tlon-send-dm
            tlon-reply-channel
            tlon-get-groupchat-members
            sleep
            restart
            pals-get-leeches
            pals-get-targets
            tlon-get-groups
            get-bowl
        ==
      ++  console-log
        ^-  table-entry
        ::
        :_  ~
        :-  ~
        :-  /console/log
        |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
        =/  m  m-js
        ^-  form:m
        =,  arr
        =|  strs=(list cord)
        |-  ^-  form:m
            ?:  =(argc-w 0)
              ~&  `@t`(rap 3 (join ' ' strs))
              return-undefined
            =.  argc-w  (dec argc-w)
            ;<  str=cord  try:m  (get-js-string (add (mul 8 argc-w) argv-u))
            $(strs [str strs])
      ++  console-error
        ^-  table-entry
        ::
        :_  ~
        :-  ~
        :-  /console/error
        |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
        =/  m  m-js
        ^-  form:m
        =,  arr
        =|  strs=(list cord)
        |-  ^-  form:m
            ?:  =(argc-w 0)
              ~&  >>>  `@t`(rap 3 (join ' ' strs))
              return-undefined
            =.  argc-w  (dec argc-w)
            ;<  str=cord  try:m  (get-js-string (add (mul 8 argc-w) argv-u))
            $(strs [str strs])
      ++  console-warn
        ^-  table-entry
        ::
        :_  ~
        :-  ~
        :-  /console/warn
        |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
        =/  m  m-js
        ^-  form:m
        =,  arr
        =|  strs=(list cord)
        |-  ^-  form:m
            ?:  =(argc-w 0)
              ~&  >>  `@t`(rap 3 (join ' ' strs))
              return-undefined
            =.  argc-w  (dec argc-w)
            ;<  str=cord  try:m  (get-js-string (add (mul 8 argc-w) argv-u))
            $(strs [str strs])
      ++  console-info
        ^-  table-entry
        ::
        :_  ~
        :-  ~
        :-  /console/info
        |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
        =/  m  m-js
        ^-  form:m
        =,  arr
        =|  strs=(list cord)
        |-  ^-  form:m
            ?:  =(argc-w 0)
              ~&  >>  `@t`(rap 3 (join ' ' strs))
              return-undefined
            =.  argc-w  (dec argc-w)
            ;<  str=cord  try:m  (get-js-string (add (mul 8 argc-w) argv-u))
            $(strs [str strs])
      ++  load-txt-file
        ^-  table-entry
        ::
        =/  id=term  %get-txt-file
        =/  get-txt-file-ext
          |=  pax=path
          =/  m  (script:lia-sur:wasm (unit octs) acc-mold)
          ^-  form:m
          ;<  res=(pole lv)  try:m  (call-ext:arr id [vase+!>(pax) ~])
          ?~  res  (return:m ~)
          ?>  ?=([[%octs p=octs] ~] res)
          (return:m `p.res)
        ::
        =/  get-txt-file-ted
          |=  pax=(pole knot)
          =/  m  m-rand
          ^-  form:m
          ?.  ?=([desk=@tas rest=*] pax)  (pure:m ~)
          ;<  bol=bowl:rand  bind:m  get-bowl:sio
          =/  bek=beak  [our.bol desk.pax %da now.bol]
          ;<  =riot:clay  bind:m
            (warp:sio p.bek q.bek ~ %sing %x r.bek rest.pax)
          ::
          ?~  riot  (pure:m ~)
          ?.  =(%txt p.r.u.riot)
            ~&  >>>  [%not-a-txt pax]
            (pure:m ~)
          ?~  wan=(mole |.(!<(wain q.r.u.riot)))
            ~&  >>>  [%weird-txt pax]
            (pure:m ~)
          =/  str=cord  (of-wain:format u.wan)
          (pure:m octs+[(met 3 str) str] ~)
        ::
        :-  :-  ~
            :-  'urbit_thread'^'load_txt_file'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 1)  (throw-args 'load_txt_file' argc-w 1)
            ;<  xap=cord  try:m  (get-js-string argv-u)
            ?~  pax=(parse-path xap)  (throw-path xap)
            ;<  res=(unit octs)  try:m  (get-txt-file-ext u.pax)
            ?~  res  (throw-error (rap 3 'No .txt file at path ' xap ~))
            (ding 'QTS_NewString' ctx-u (malloc-cord q.u.res) ~)
        :-  ~
        :-  id
        |=  l=(pole lv)
        ^-  form:m-rand
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(pax=path p.l)
        (get-txt-file-ted pax)
      ++  store-txt-file
        ^-  table-entry
        ::
        =/  id=term  %set-txt-file
        =/  set-txt-file-ext
          |=  [pax=path txt=cord]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm ,~ acc-mold)
          ^-  form:m
          ;<  res=(pole lv)  try:m  (call-ext:arr id [vase+!>(sam) ~])
          (return:m ~)
        ::
        =/  set-txt-file-ted
          |=  [pax=(pole knot) txt=cord]
          =/  m  (strand ,~)
          ^-  form:m
          ?.  ?=([desk=@tas rest=*] pax)  (pure:m ~)
          =/  wan=wain  (to-wain:format txt)
          =/  not=note-arvo
            [%c [%info desk.pax %& [rest.pax %ins %txt !>(wan)]~]]
          ::
          (send-raw-card:sio [%pass / %arvo not])
        ::
        :-  :-  ~
            :-  'urbit_thread'^'store_txt_file'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 2)  (throw-args 'store_txt_file' argc-w 2)
            ;<  xap=cord  try:m  (get-js-string argv-u)
            ::  sizeof JSValue == 8 in Wasm build of QuickJS
            ::
            ;<  txt=cord  try:m  (get-js-string (add argv-u 8))
            ?~  pax=(parse-path xap)  (throw-path xap)
            =/  las=@ta  (rear u.pax)
            ?.  =(%txt las)
              (throw-error (rap 3 'Invalid path extension: want txt, got ' las ~))
            ;<  *  try:m  (set-txt-file-ext u.pax txt)
            return-undefined
        :-  ~
        :-  id
        |=  l=(pole lv)
        ^-  form:m-rand
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[path cord] p.l)
        (set-txt-file-ted sam)
      ++  fetch-sync
        ^-  table-entry
        ::
        =/  id=term  %fetch-url
        =/  fetch-url-ext
          |=  =hiss:eyre
          =/  m  (script:lia-sur:wasm (unit httr:eyre) acc-mold)
          ^-  form:m
          ;<  res=(pole lv)  try:m  (call-ext:arr id [vase+!>(hiss) ~])
          ?~  res  (return:m ~)
          ?>  ?=([[%vase p=*] ~] res)
          (return:m `!<(httr:eyre p.res))
        ::
        =/  fetch-url-ted
          hiss-request:sio
        ::
        :-  :-  ~
            :-  'fetch_sync'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 1)  (throw-args 'fetch_sync' argc-w 1)
            ::  (either a string or URL object)
            ::
            ;<  url-jon=json  try:m  (load-json argv-u)
            =/  lur=(unit @t)
              ?~  url-jon  ~
              ?+  -.url-jon  ~
                %s  `p.url-jon
                  %o
                ?~  href=(~(get by p.url-jon) %href)  ~
                ?.  ?=(%s -.u.href)  ~
                `p.u.href
              ==
            ::
            ?~  lur  (throw-error 'Unrecognized type in fetch_sync')
            ;<  tom=json  try:m
              =/  m  (script:lia-sur:wasm json acc-mold)
              ^-  form:m
              ?:  =(1 argc-w)  (return:m o+~)
              (load-json (add argv-u 8))
            ::
            ?~  purl=(parse-url u.lur)  (throw-url u.lur)
            ?.  ?=([%o *] tom)  (throw-methods tom)
            ?~  moth=(parse-methods p.tom)  (throw-methods tom)
            ;<  res=(unit httr:eyre)  try:m  (fetch-url-ext u.purl u.moth)
            ?~  res  (throw-error (rap 3 'Failed http request: ' u.lur ~))
            =/  =httr:eyre  u.res
            =/  jon=json
              =,  enjs:format
              %-  pairs
              =-  ?~(r.httr - [body+s+q.u.r.httr -])
              :~  status+(numb p.httr)
                  :-  'statusText'
                  `json`s+(crip "Code {<p.httr>}")  ::  XX proper statusText
              ::
                  headers+`json`(pairs (turn q.httr |=([p=@t q=@t] [p s+q])))
              ==
            ::
            (store-json jon)
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m-rand
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=hiss:eyre p.l)
        ;<  res=(unit httr:eyre)  bind:m  (fetch-url-ted sam)
        ?~  res  (pure:m ~)
        (pure:m vase+!>(u.res) ~)
      ++  tlon-get-channels
        ^-  table-entry
        ::
        =/  id=term  %get-channels
        =/  get-channels-ext
          =/  m  (script:lia-sur:wasm (list nest) acc-mold)
          ^-  form:m
          ;<  res=(pole lv)  try:m  (call-ext:arr id ~)
          ?>  ?=([[%vase p=*] ~] res)
          (return:m !<((list nest) p.res))
        ::
        =/  get-channels-ted
          =/  m  (strand (list nest))
          ^-  form:m
          ;<  =channels  bind:m
            (scry channels %gx %channels /v4/channels/channels-4)
          ::
          (pure:m ~(tap in ~(key by channels)))
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'get_channels'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ;<  nests=(list nest)  try:m  get-channels-ext
            (store-json a+(turn nests nest:enjs:cj))
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ;<  res=(list nest)  bind:m  get-channels-ted
        (pure:m vase+!>(res) ~)
      ++  tlon-get-channel-messages
        ^-  table-entry
        ::
        =/  id=term  %get-chan-messages
        =/  get-channel-messages-ext
          |=  [=nest num=@]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm (list (pair time memo)) acc-mold)
          ^-  form:m
          ;<  res=(pole lv)  try:m  (call-ext:arr id vase+!>(sam) ~)
          ?>  ?=([[%vase p=*] ~] res)
          (return:m !<((list (pair time memo)) p.res))
        ::
        =/  get-channel-messages-ted
          |=  [=nest num=@]
          =/  m  (strand (list (pair time memo)))
          ^-  form:m
          ;<  =channels  bind:m
            (scry channels %gx %channels /v4/channels/full/channels-4)
          ::
          ?~  channel=(~(get by channels) nest)  (pure:m ~)
          =/  =posts  posts.u.channel
          %-  pure:m
          %+  murn  (top:mo-posts posts num)
          |=  [t=time p=(each post *)]
          ^-  (unit [time memo])
          ?:  ?=(%| -.p)  ~
          `[t [content author sent]:p.p]
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'get_channel_messages'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 2)  (throw-args 'get_channel_messages' argc-w 2)
            ;<  nest-str=cord  try:m  (get-js-string argv-u)
            ?~  nest=(mole |.((rash nest-str nest-rule:dejs:cj)))
              %-  throw-error
              (rap 3 'SyntaxError: ' nest-str ' is not a valid Nest' ~)
            ;<  acc=acc-mold  try:m  get-acc
            =+  (get-js-ctx acc)
            ::
            ;<  float=@rd  try:m  (call-1 'QTS_GetFloat64' ctx-u (add 8 argv-u) ~)
            ?~  n=(bind (toi:rd float) abs:si)  (throw-integer float)
            ;<  l=(list [time memo:channels-sur])  try:m
              (get-channel-messages-ext u.nest u.n)
            ::
            %-  store-json
            :-  %a
            %+  turn  l
            |=  [t=time m=memo:channels-sur]
            ^-  json
            =,  enjs:format
            %-  pairs
            :~  key+(time:enjs t)
                message+(memo:enjs m)
            ==
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[nest @] p.l)
        ;<  res=(list (pair time memo))  bind:m  (get-channel-messages-ted sam)
        (pure:m vase+!>(res) ~)
      ++  tlon-get-dm-messages
        ^-  table-entry
        ::
        =/  id=term  %get-dm-messages
        =/  get-dm-messages-ext
          |=  [who=(each @p id-club) num=@]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm (list (pair time memo)) acc-mold)
          ;<  res=(pole lv)  try:m  (call-ext:arr id vase+!>(sam) ~)
          ?>  ?=([[%vase p=*] ~] res)
          (return:m !<((list (pair time memo)) p.res))
        ::
        =/  get-dm-messages-ted
          |=  [who=(each @p id-club) num=@]
          =/  m  (strand (list (pair time memo)))
          ^-  form:m
          ;<  [dms=(map ship dm) clubs=(map id-club club)]  bind:m
            (scry ,[(map ship dm) (map id-club club)] %gx %chat /full/noun)
          ::
          =/  wits
            ?:  ?=(%& -.who)
              ?~  dm=(~(get by dms) p.who)
                ~
              (some wit.pact.u.dm)
            ?~  club=(~(get by clubs) p.who)
              ~
            (some wit.pact.u.club)
          ::
          ?~  wits  (pure:m ~)
          %-  pure:m
          %+  murn  (top:mo-writs u.wits num)
          |=  [t=time w=(each writ *)]
          ^-  (unit [time memo])
          ?-  -.w
            %&  `[t [content author sent]:p.w]
            %|  ~
          ==
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'get_dm_messages'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 2)  (throw-args 'get_dm_messages' argc-w 2)
            ;<  dm-id-str=cord  try:m  (get-js-string argv-u)
            ?~  who=(mole |.((rash dm-id-str rule-ship-club)))
              %-  throw-error
              (rap 3 'SyntaxError: ' dm-id-str ' is not a valid DM id' ~)
            ;<  float=@rd  try:m
              (call-1 'QTS_GetFloat64' ctx-u (add 8 argv-u) ~)
            ?~  n=(bind (toi:rd float) abs:si)  (throw-integer float)
            ;<  l=(list (pair time memo))  try:m
              (get-dm-messages-ext u.who u.n)
            ::
            %-  store-json
            :-  %a
            %+  turn  l
            |=  [t=time m=memo:channels-sur]
            ^-  json
            =,  enjs:format
            %-  pairs
            :~  key+(time:enjs t)
                message+(memo:enjs m)
            ==
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[(each @p id-club) @] p.l)
        ;<  res=(list (pair time memo))  bind:m  (get-dm-messages-ted sam)
        (pure:m vase+!>(res) ~)
      ++  tlon-get-dm-replies
        ^-  table-entry
        ::
        =/  id=term  %get-dm-replies
        =/  get-dm-replies-ext
          |=  [who=(each @p id-club) key=time]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm (list memo) acc-mold)
          ^-  form:m
          ;<  res=(pole lv)  try:m  (call-ext:arr id vase+!>(sam) ~)
          ?>  ?=([[%vase p=*] ~] res)
          (return:m !<((list memo) p.res))
        ::
        =/  get-dm-replies-ted
          |=  [who=(each @p id-club) key=time]
          =/  m  (strand (list memo))
          ^-  form:m
          ;<  [dms=(map ship dm) clubs=(map id-club club)]  bind:m
            (scry ,[(map ship dm) (map id-club club)] %gx %chat /full/noun)
          ::
          =/  wits
            ?:  ?=(%& -.who)
              ?~  dm=(~(get by dms) p.who)
                ~
              (some wit.pact.u.dm)
            ?~  club=(~(get by clubs) p.who)
              ~
            (some wit.pact.u.club)
          ::
          ?~  wits  (pure:m ~)
          ?~  writ=(get:on:writs u.wits key)  (pure:m ~)
          ?:  ?=(%| -.u.writ)  (pure:m ~)
          =/  reps=replies-dm  replies.u.writ
          %-  pure:m
          %+  murn  (tap:on:replies-dm reps)
          |=  [time r=(each reply-dm *)]
          ^-  (unit memo)
          ?:  ?=(%| -.r)  ~
          `[content author sent]:p.r
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'get_dm_replies'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 2)  (throw-args 'get_dm_replies' argc-w 2)
            ;<  dm-id-str=cord  try:m  (get-js-string argv-u)
            ?~  who=(mole |.((rash dm-id-str rule-ship-club)))
              %-  throw-error
              (rap 3 'SyntaxError: ' dm-id-str ' is not a valid DM id' ~)
            ;<  key-str=cord  try:m  (get-js-string (add 8 argv-u))
            ?~  key=(rush key-str dim:ag)
              %-  throw-error
              (rap 3 'SyntaxError: ' key-str ' is not a valid message identifier' ~)
            ;<  l=(list memo)  try:m  (get-dm-replies-ext u.who u.key)
            (store-json a+(turn l memo:enjs))
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[(each @p id-club) time] p.l)
        ;<  res=(list memo)  bind:m  (get-dm-replies-ted sam)
        (pure:m vase+!>(res) ~)
      ++  tlon-get-channel-replies
        ^-  table-entry
        ::
        =/  id  %get-chan-replies
        =/  get-channel-replies-ext
          |=  [=nest key=time]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm (list memo) acc-mold)
          ^-  form:m
          ;<  res=(pole lv)  try:m  (call-ext:arr id vase+!>(sam) ~)
          ?>  ?=([[%vase p=*] ~] res)
          (return:m !<((list memo) p.res))
        ::
        =/  get-channel-replies-ted
          |=  [=nest key=time]
          =/  m  (strand (list memo))
          ^-  form:m
          ;<  =channels  bind:m
            (scry channels %gx %channels /v4/channels/full/channels-4)
          ::
          ?~  channel=(~(get by channels) nest)  (pure:m ~)
          =/  =posts  posts.u.channel
          ?~  pot=(get:on-posts posts key)  (pure:m ~)
          ?:  ?=(%| -.u.pot)  (pure:m ~)
          =/  reps=replies-chan  replies.u.pot
          %-  pure:m
          %+  murn  (tap:on-replies-chan reps)
          |=  [time r=(each reply-chan *)]
          ^-  (unit memo)
          ?:  ?=(%| -.r)  ~
          `[content author sent]:p.r
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'get_channel_replies'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 2)  (throw-args 'get_channel_replies' argc-w 2)
            ;<  nest-str=cord  try:m  (get-js-string argv-u)
            ?~  nest=(mole |.((rash nest-str nest-rule:dejs:cj)))
              %-  throw-error
              (rap 3 'SyntaxError: ' nest-str ' is not a valid Nest' ~)
            ;<  key-str=cord  try:m  (get-js-string (add 8 argv-u))
            ?~  key=(rush key-str dim:ag)
              %-  throw-error
              (rap 3 'SyntaxError: ' key-str ' is not a valid message identifier' ~)
            ;<  l=(list memo)  try:m  (get-channel-replies-ext u.nest u.key)
            (store-json a+(turn l memo:enjs))
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[nest time] p.l)
        ;<  res=(list memo)  bind:m  (get-channel-replies-ted sam)
        (pure:m vase+!>(res) ~)
      ++  tlon-get-channel-members
        ^-  table-entry
        ::
        =/  id  %get-chan-members
        =/  get-channel-members-ext
          |=  =nest
          =/  m  (script:lia-sur:wasm (set ship) acc-mold)
          ^-  form:m
          ;<  res=(pole lv)  try:m  (call-ext:arr id vase+!>(nest) ~)
          ?>  ?=([[%vase p=*] ~] res)
          (return:m !<((set ship) p.res))
        ::
        =/  get-channel-members-ted
          |=  =nest
          =/  m  (strand (set ship))
          ^-  form:m
          ;<  =channels  bind:m
            (scry channels %gx %channels /v4/channels/channels-4)
          ::
          ?~  channel=(~(get by channels) nest)  (pure:m ~)
          =/  group=flag  group.perm.u.channel
          %-  ease-discipline
          %:  scry  (set ship)  %gx  %groups
            /v2/groups/(scot %p p.group)/[q.group]/seats/ships/noun
          ==
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'get_channel_members'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 1)  (throw-args 'get_channel_members' argc-w 1)
            ;<  nest-str=cord  try:m  (get-js-string argv-u)
            ?~  nest=(mole |.((rash nest-str nest-rule:dejs:cj)))
              %-  throw-error
              (rap 3 'SyntaxError: ' nest-str ' is not a valid Nest' ~)
            ;<  s=(set @p)  try:m  (get-channel-members-ext u.nest)
            (store-json a+(turn ~(tap in s) ship:enjs))
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=nest p.l)
        ;<  res=(set ship)  bind:m  (get-channel-members-ted sam)
        (pure:m vase+!>(res) ~)
      ++  tlon-get-roles
        ^-  table-entry
        ::
        =/  id  %get-roles
        =/  get-roles-ted
          |=  [=nest her=@p]
          =/  m  (strand (set role-groups))
          ^-  form:m
          ;<  =channels  bind:m
            (scry channels %gx %channels /v4/channels/channels-4)
          ::
          ?~  channel=(~(get by channels) nest)  (pure:m ~)
          =/  group=flag  group.perm.u.channel
          %-  ease-discipline
          ;<  vessel=(unit seat)  bind:m
            %:  scry  (unit seat)  %gx  %groups
              /v2/groups/(scot %p p.group)/[q.group]/seats/(scot %p her)/noun
            ==
          ::
          ?~  vessel  (pure:m ~)
          (pure:m roles.u.vessel)
        ::
        =/  get-roles-ext
          |=  [=nest her=@p]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm (set role-groups) acc-mold)
          ^-  form:m
          ;<  res=(pole lv)  try:m  (call-ext:arr id vase+!>(sam) ~)
          ?>  ?=([[%vase p=*] ~] res)
          (return:m !<((set role-groups) p.res))
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'get_roles'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 2)  (throw-args 'get_roles' argc-w 2)
            ;<  nest-str=cord  try:m  (get-js-string argv-u)
            ?~  nest=(mole |.((rash nest-str nest-rule:dejs:cj)))
              %-  throw-error
              (rap 3 'SyntaxError: ' nest-str ' is not a valid Nest' ~)
            ;<  ship-str=cord  try:m  (get-js-string (add 8 argv-u))
            ?~  ship=(slaw %p ship-str)
              %-  throw-error
              (rap 3 'SyntaxError: ' ship-str ' is not a valid ship' ~)
            ;<  s=(set role-groups)  try:m  (get-roles-ext u.nest u.ship)
            (store-json a+(turn ~(tap in s) (lead %s)))
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[nest @p] p.l)
        ;<  res=(set role-groups)  bind:m  (get-roles-ted sam)
        (pure:m vase+!>(res) ~)
      ++  tlon-invite-user-channel
        ^-  table-entry
        ::
        =/  id  %invite-user-channel
        =/  invite-user-channel-ted
          |=  [=nest her=@p]
          =/  m  (strand ,~)
          ^-  form:m
          ;<  =channels  bind:m
            (scry channels %gx %channels /v4/channels/channels-4)
          ::
          ?~  channel=(~(get by channels) nest)  (pure:m ~)
          =/  group=flag  group.perm.u.channel
          ;<  members=(set ship)  bind:m
            %-  ease-discipline
            %:  scry  (set ship)  %gx  %groups
              /v2/groups/(scot %p p.group)/[q.group]/seats/ships/ships
            ==
          ::
          ?:  (~(has in members) her)  (pure:m ~)
          ;<  bol=bowl:rand  bind:m  get-bowl:sio
          =/  act=action-g  [%group group seat+[[her ~ ~] add+~]]
          (poke:sio [our.bol %groups] group-action-4+!>(act))
        ::
        =/  invite-user-channel-ext
          |=  [=nest her=@p]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm ,~ acc-mold)
          ^-  form:m
          ;<  *  try:m  (call-ext:arr id vase+!>(sam) ~)
          (return:m ~)
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'invite_user_channel'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  (script:lia-sur:wasm @ acc-mold)
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 2)  (throw-args 'invite_user_channel' argc-w 2)
            ;<  nest-str=cord  try:m  (get-js-string argv-u)
            ?~  nest=(mole |.((rash nest-str nest-rule:dejs:cj)))
              %-  throw-error
              (rap 3 'SyntaxError: ' nest-str ' is not a valid Nest' ~)
            ;<  ship-str=cord  try:m  (get-js-string (add 8 argv-u))
            ?~  ship=(slaw %p ship-str)
              %-  throw-error
              (rap 3 'SyntaxError: ' ship-str ' is not a valid ship' ~)
            ;<  *  try:m  (invite-user-channel-ext u.nest u.ship)
            return-undefined
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[nest @p] p.l)
        ;<  *  bind:m  (invite-user-channel-ted sam)
        (pure:m ~)
      ++  tlon-invite-user-groupchat
        ^-  table-entry
        ::
        =/  id  %invite-user-groupchat
        =/  invite-user-groupchat-ted
          |=  [zem=id-club her=@p]
          =/  m  (strand ,~)
          ^-  form:m
          ;<  [* clubs=(map id-club club)]  bind:m
            (scry ,[* (map id-club club)] %gx %chat /full/noun)
          ::
          ?~  club=(~(get by clubs) zem)  (pure:m ~)
          =/  herd=(set @uv)  heard.u.club
          ;<  bol=bowl:rand  bind:m  get-bowl:sio
          =/  unique=@uv
            ::  ++  cu-uid generates SHA-256 hash, we produce the same length
            ::
            =/  eny=@uv  (cut 8 [0 1] eny.bol)
            |-  ^-  @uv
                ?.  (~(has in herd) eny)  eny
                $(eny +(eny))
          ::
          =/  act=action-club  [zem unique %hive our.bol her &]
          (poke:sio [our.bol %chat] chat-club-action-1+!>(act))
        ::
        =/  invite-user-groupchat-ext
          |=  [zem=id-club her=@p]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm ,~ acc-mold)
          ^-  form:m
          ;<  *  try:m  (call-ext:arr id vase+!>(sam) ~)
          (return:m ~)
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'invite_user_groupchat'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 2)  (throw-args 'invite_user_groupchat' argc-w 2)
            ;<  id-str=cord  try:m  (get-js-string argv-u)
            ?~  id=(rush id-str sym)
              %-  throw-error
              (rap 3 'SyntaxError: ' id-str ' is not a valid groupchat ID' ~)
            ;<  ship-str=cord  try:m  (get-js-string (add 8 argv-u))
            ?~  ship=(slaw %p ship-str)
              %-  throw-error
              (rap 3 'SyntaxError: ' ship-str ' is not a valid ship' ~)
            ;<  *  try:m  (invite-user-groupchat-ext u.id u.ship)
            return-undefined
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[id-club @p] p.l)
        ;<  *  bind:m  (invite-user-groupchat-ted sam)
        (pure:m ~)
      ++  tlon-kick-user-channel
        ^-  table-entry
        ::
        =/  id  %kick-user-chan
        =/  kick-user-channel-ted
          |=  [=nest her=@p]
          =/  m  (strand ,~)
          ^-  form:m
          ;<  =channels  bind:m
            (scry channels %gx %channels /v4/channels/channels-4)
          ::
          ?~  channel=(~(get by channels) nest)  (pure:m ~)
          =/  group=flag  group.perm.u.channel
          ;<  members=(set ship)  bind:m
            %-  ease-discipline
            %:  scry  (set ship)  %gx  %groups
              /v2/groups/(scot %p p.group)/[q.group]/seats/ships/ships
            ==
          ::
          ?.  (~(has in members) her)  (pure:m ~)
          ;<  bol=bowl:rand  bind:m  get-bowl:sio
          =/  act=action-g  [%group group seat+[[her ~ ~] del+~]]
          (poke:sio [our.bol %groups] group-action-4+!>(act))
        ::
        =/  kick-user-channel-ext
          |=  [=nest her=@p]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm ,~ acc-mold)
          ^-  form:m
          ;<  *  try:m  (call-ext:arr id vase+!>(sam) ~)
          (return:m ~)
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'kick_user_channel'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  (script:lia-sur:wasm @ acc-mold)
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 2)  (throw-args 'kick_user_channel' argc-w 2)
            ;<  nest-str=cord  try:m  (get-js-string argv-u)
            ?~  nest=(mole |.((rash nest-str nest-rule:dejs:cj)))
              %-  throw-error
              (rap 3 'SyntaxError: ' nest-str ' is not a valid Nest' ~)
            ;<  ship-str=cord  try:m  (get-js-string (add 8 argv-u))
            ?~  ship=(slaw %p ship-str)
              %-  throw-error
              (rap 3 'SyntaxError: ' ship-str ' is not a valid ship' ~)
            ;<  *  try:m  (kick-user-channel-ext u.nest u.ship)
            return-undefined
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[nest @p] p.l)
        ;<  *  bind:m  (kick-user-channel-ted sam)
        (pure:m ~)
      ++  tlon-give-role
        ^-  table-entry
        ::
        =/  id  %give-role
        =/  give-role-ted
          |=  [=nest her=@p role=@tas]
          =/  m  (strand ,~)
          ^-  form:m
          ;<  =channels  bind:m
            (scry channels %gx %channels /v4/channels/channels-4)
          ::
          ?~  channel=(~(get by channels) nest)  (pure:m ~)
          =/  group=flag  group.perm.u.channel
          ;<  members=(set ship)  bind:m
            %-  ease-discipline
            %:  scry  (set ship)  %gx  %groups
              /v2/groups/(scot %p p.group)/[q.group]/seats/ships/ships
            ==
          ::
          ?.  (~(has in members) her)  (pure:m ~)
          ;<  bol=bowl:rand  bind:m  get-bowl:sio
          =/  act=action-g  [%group group seat+[[her ~ ~] add-roles+[role ~ ~]]]
          (poke:sio [our.bol %groups] group-action-4+!>(act))
        ::
        =/  give-role-ext
          |=  [=nest her=@p role=@tas]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm ,~ acc-mold)
          ^-  form:m
          ;<  *  try:m  (call-ext:arr id vase+!>(sam) ~)
          (return:m ~)
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'give_role'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  (script:lia-sur:wasm @ acc-mold)
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 3)  (throw-args 'give_role' argc-w 3)
            ;<  nest-str=cord  try:m  (get-js-string argv-u)
            ?~  nest=(mole |.((rash nest-str nest-rule:dejs:cj)))
              %-  throw-error
              (rap 3 'SyntaxError: ' nest-str ' is not a valid Nest' ~)
            ;<  ship-str=cord  try:m  (get-js-string (add 8 argv-u))
            ?~  ship=(slaw %p ship-str)
              %-  throw-error
              (rap 3 'SyntaxError: ' ship-str ' is not a valid ship' ~)
            ;<  role-str=cord  try:m  (get-js-string (add 16 argv-u))
            ?~  role=(slaw %tas role-str)
              %-  throw-error
              (rap 3 'SyntaxError: ' role-str ' is not a valid role' ~)
            ;<  *  try:m  (give-role-ext u.nest u.ship u.role)
            return-undefined
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[nest @p @tas] p.l)
        ;<  *  bind:m  (give-role-ted sam)
        (pure:m ~)
      ++  tlon-remove-role
        ^-  table-entry
        ::
        =/  id=@tas  %remove-role
        =/  remove-role-ted
          |=  [=nest her=@p role=@tas]
          =/  m  (strand ,~)
          ^-  form:m
          ;<  =channels  bind:m
            (scry channels %gx %channels /v4/channels/channels-4)
          ::
          ?~  channel=(~(get by channels) nest)  (pure:m ~)
          =/  group=flag  group.perm.u.channel
          ;<  members=(set ship)  bind:m
            %-  ease-discipline
            %:  scry  (set ship)  %gx  %groups
              /v2/groups/(scot %p p.group)/[q.group]/seats/ships/ships
            ==
          ::
          ?.  (~(has in members) her)  (pure:m ~)
          ;<  bol=bowl:rand  bind:m  get-bowl:sio
          =/  act=action-g  [%group group seat+[[her ~ ~] del-roles+[role ~ ~]]]
          (poke:sio [our.bol %groups] group-action-4+!>(act))
        ::
        =/  remove-role-ext
          |=  [=nest her=@p role=@tas]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm ,~ acc-mold)
          ^-  form:m
          ;<  *  try:m  (call-ext:arr id vase+!>(sam) ~)
          (return:m ~)
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'remove_role'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 3)  (throw-args 'remove_role' argc-w 3)
            ;<  nest-str=cord  try:m  (get-js-string argv-u)
            ?~  nest=(mole |.((rash nest-str nest-rule:dejs:cj)))
              %-  throw-error
              (rap 3 'SyntaxError: ' nest-str ' is not a valid Nest' ~)
            ;<  ship-str=cord  try:m  (get-js-string (add 8 argv-u))
            ?~  ship=(slaw %p ship-str)
              %-  throw-error
              (rap 3 'SyntaxError: ' ship-str ' is not a valid ship' ~)
            ;<  role-str=cord  try:m  (get-js-string (add 16 argv-u))
            ?~  role=(slaw %tas role-str)
              %-  throw-error
              (rap 3 'SyntaxError: ' role-str ' is not a valid role' ~)
            ;<  *  try:m  (remove-role-ext u.nest u.ship u.role)
            return-undefined
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[nest @p @tas] p.l)
        ;<  *  bind:m  (remove-role-ted sam)
        (pure:m ~)
      ++  tlon-post-channel
        ^-  table-entry
        ::
        =/  id=@tas  %post-channel
        =/  post-channel-ted
          |=  [=nest post=story]
          =/  m  (strand ,~)
          ^-  form:m
          ;<  =channels  bind:m
            (scry channels %gx %channels /v4/channels/channels-4)
          ::
          ?~  channel=(~(get by channels) nest)  (pure:m ~)
          ;<  bol=bowl:rand  bind:m  get-bowl:sio
          =/  act=action-c
            [%channel nest %post %add [post [our now]:bol] /chat ~ ~]
          (poke:sio [our.bol %channels] channel-action-1+!>(act))
        ::
        =/  post-channel-ext
          |=  [=nest post=story]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm ,~ acc-mold)
          ^-  form:m
          ;<  *  try:m  (call-ext:arr id vase+!>(sam) ~)
          (return:m ~)
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'post_channel'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 2)  (throw-args 'post_channel' argc-w 2)
            ;<  nest-str=cord  try:m  (get-js-string argv-u)
            ?~  nest=(mole |.((rash nest-str nest-rule:dejs:cj)))
              %-  throw-error
              (rap 3 'SyntaxError: ' nest-str ' is not a valid Nest' ~)
            ;<  story-str=cord  try:m  (get-js-string (add 8 argv-u))
            =/  =story:channels-sur  [inline+[story-str]~]~
            ;<  *  try:m  (post-channel-ext u.nest story)
            return-undefined
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[nest story] p.l)
        ;<  *  bind:m  (post-channel-ted sam)
        (pure:m ~)
      ++  tlon-send-dm
        ^-  table-entry
        ::
        =/  id  %send-dm
        =/  send-dm-ted
          |=  [who=(each @p id-club) post=story]
          =/  m  (strand ,~)
          ^-  form:m
          ?:  ?=(%& -.who)
            ;<  bol=bowl:rand  bind:m  get-bowl:sio
            =/  act=action-dm
              [p.who [[our now]:bol %add [[post [our now]:bol] chat+/ ~ ~] `now.bol]]
            ::
            (poke:sio [our.bol %chat] chat-dm-action-1+!>(act))
          ;<  [* clubs=(map id-club club)]  bind:m
            (scry ,[* (map id-club club)] %gx %chat /full/noun)
          ::
          ?~  club=(~(get by clubs) p.who)  (pure:m ~)
          =/  herd=(set @uv)  heard.u.club
          ;<  bol=bowl:rand  bind:m  get-bowl:sio
          =/  unique=@uv
            ::  ++  cu-uid generates SHA-256 hash, we produce the same length
            ::
            =/  eny=@uv  (cut 8 [0 1] eny.bol)
            |-  ^-  @uv
                ?.  (~(has in herd) eny)  eny
                $(eny +(eny))
          ::
          =/  act=action-club
            :*  p.who
                unique
                %writ
                [our now]:bol
                %add
                [[post [our now]:bol] chat+/ ~ ~]
                `now.bol
            ==
          ::
          (poke:sio [our.bol %chat] chat-club-action-1+!>(act))
        ::
        =/  send-dm-ext
          |=  [who=(each @p id-club) post=story]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm ,~ acc-mold)
          ^-  form:m
          ;<  *  try:m  (call-ext:arr id vase+!>(sam) ~)
          (return:m ~)
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'send_dm'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 2)  (throw-args 'send_dm' argc-w 2)
            ;<  dm-id-str=cord  try:m  (get-js-string argv-u)
            ?~  who=(mole |.((rash dm-id-str rule-ship-club)))
              %-  throw-error
              (rap 3 'SyntaxError: ' dm-id-str ' is not a valid DM id' ~)
            ;<  story-str=cord  try:m  (get-js-string (add 8 argv-u))
            =/  =story:channels-sur  [inline+[story-str]~]~
            ;<  *  try:m  (send-dm-ext u.who story)
            return-undefined
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[(each @p id-club) story] p.l)
        ;<  *  bind:m  (send-dm-ted sam)
        (pure:m ~)
      ++  tlon-reply-channel
        ^-  table-entry
        ::
        =/  id=@tas  %reply-channel
        =/  reply-channel-ted
          |=  [=nest key=time post=story]
          =/  m  (strand ,~)
          ^-  form:m
          ;<  =channels  bind:m
            (scry channels %gx %channels /v4/channels/channels-4)
          ::
          ?~  channel=(~(get by channels) nest)  (pure:m ~)
          ;<  bol=bowl:rand  bind:m  get-bowl:sio
          =/  act=action-c
            [%channel nest %post %reply key %add post [our now]:bol]
          ::
          (poke:sio [our.bol %channels] channel-action-1+!>(act))
        ::
        =/  reply-channel-ext
          |=  [=nest key=time post=story]
          =*  sam  +<
          =/  m  (script:lia-sur:wasm ,~ acc-mold)
          ^-  form:m
          ;<  *  try:m  (call-ext:arr id vase+!>(sam) ~)
          (return:m ~)
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'reply_channel'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  (script:lia-sur:wasm @ acc-mold)
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 3)  (throw-args 'post_reply' argc-w 3)
            ;<  nest-str=cord  try:m  (get-js-string argv-u)
            ?~  nest=(mole |.((rash nest-str nest-rule:dejs:cj)))
              %-  throw-error
              (rap 3 'SyntaxError: ' nest-str ' is not a valid Nest' ~)
            ;<  key-str=cord  try:m  (get-js-string (add 8 argv-u))
            ?~  key=(rush key-str dim:ag)
              %-  throw-error
              (rap 3 'SyntaxError: ' key-str ' is not a valid message identifier' ~)
            ;<  story-str=cord  try:m  (get-js-string (add 16 argv-u))
            =/  =story:channels-sur  [inline+[story-str]~]~
            ;<  *  try:m  (reply-channel-ext u.nest u.key story)
            return-undefined
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=[nest time story] p.l)
        ;<  *  bind:m  (reply-channel-ted sam)
        (pure:m ~)
      ++  tlon-get-groupchat-members
        ^-  table-entry
        ::
        =/  id  %get-groupchat-members
        =/  get-groupchat-members-ted
          |=  zem=id-club
          =/  m  (strand (set ship))
          ^-  form:m
          ;<  [* clubs=(map id-club club)]  bind:m
            (scry ,[* (map id-club club)] %gx %chat /full/noun)
          ::
          ?~  club=(~(get by clubs) zem)  (pure:m ~)
          (pure:m team.crew.u.club)
        ::
        =/  get-groupchat-members-ext
          |=  zem=id-club
          =/  m  (script:lia-sur:wasm (set ship) acc-mold)
          ^-  form:m
          ;<  res=(pole lv)  try:m  (call-ext:arr id vase+!>(zem) ~)
          ?>  ?=([[%vase p=*] ~] res)
          (return:m !<((set ship) p.res))
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'get_groupchat_members'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 1)  (throw-args 'get_groupchat_members' argc-w 1)
            ;<  id-str=cord  try:m  (get-js-string argv-u)
            ?~  id=(rush id-str sym)
              %-  throw-error
              (rap 3 'SyntaxError: ' id-str ' is not a valid groupchat ID' ~)
            ;<  s=(set @p)  try:m  (get-groupchat-members-ext u.id)
            (store-json a+(turn ~(tap in s) ship:enjs))
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=id-club p.l)
        ;<  res=(set ship)  bind:m  (get-groupchat-members-ted sam)
        (pure:m vase+!>(res) ~)
      ++  sleep
        ^-  table-entry
        ::
        =/  id=@tas  %sleep
        =/  sleep-ted  sleep:sio
        =/  sleep-ext
          |=  for=@dr
          =/  m  (script:lia-sur:wasm ,~ acc-mold)
          ^-  form:m
          ;<  *  try:m  (call-ext:arr id vase+!>(for) ~)
          (return:m ~)
        ::
        :-  :-  ~
            :-  'urbit_thread'^'sleep'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ?.  (gte argc-w 1)  (throw-args 'sleep' argc-w 1)
            ;<  float=@rd  try:m  (call-1 'QTS_GetFloat64' ctx-u argv-u ~)
            ?~  n=(bind (toi:rd float) abs:si)  (throw-integer float)
            ;<  *  try:m  (sleep-ext (mul u.n ~s1))
            return-undefined
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=@dr p.l)
        ;<  *  bind:m  (sleep-ted sam)
        (pure:m ~)
      ++  restart
        ^-  table-entry
        ::
        :-  :-  ~
            :-  'urbit_thread'^'restart'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ::  signal to the host that the upcoming Wasm crash is
            ::  part of freeing the state
            ::
            ;<  *  try:m  (call-ext %restart ~)
            ~&  >  'Freeing Wasm VM by crashing it'
            fail:m
        ~
      ++  pals-get-leeches
        ^-  table-entry
        ::
        =/  id  %get-leeches
        =/  get-leeches-ted
          =/  m  (strand (set ship))
          ^-  form:m
          ;<  pals-exist=?  bind:m  (scry ? %gu %pals /$)
          ?.  pals-exist
            ~>  %slog.[2 '%pals missing, "|install ~paldev %pals"']
            (pure:m ~)
          (scry (set @p) %gx %pals /leeches/noun)
        ::
        =/  get-leeches-ext
          =/  m  (script:lia-sur:wasm (set ship) acc-mold)
          ^-  form:m
          ;<  res=(pole lv)  try:m  (call-ext:arr id ~)
          ?>  ?=([[%vase p=*] ~] res)
          (return:m !<((set ship) p.res))
        ::
        :-  :-  ~
            :-  'urbit_thread'^'pals'^'get_leeches'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  (script:lia-sur:wasm @ acc-mold)
            ^-  form:m
            =,  arr
            ;<  s=(set @p)  try:m  get-leeches-ext
            (store-json a+(turn ~(tap in s) ship:enjs))
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ;<  res=(set ship)  bind:m  get-leeches-ted
        (pure:m vase+!>(res) ~)
      ++  pals-get-targets
        ^-  table-entry
        ::
        =/  id  %get-targets
        =/  get-targets-ted
          |=  tag=(unit knot)
          =/  m  (strand (set ship))
          ^-  form:m
          ;<  pals-exist=?  bind:m  (scry ? %gu %pals /$)
          ?.  pals-exist
            ~>  %slog.[2 '%pals missing, "|install ~paldev %pals"']
            (pure:m ~)
          ?~  tag  (scry (set @p) %gx %pals /targets/noun)
          (scry (set @p) %gx %pals /targets/[u.tag]/noun)
        ::
        =/  get-targets-ext
          |=  tag=(unit knot)
          =/  m  (script:lia-sur:wasm (set ship) acc-mold)
          ^-  form:m
          ;<  res=(pole lv)  try:m  (call-ext:arr id vase+!>(tag) ~)
          ?>  ?=([[%vase p=*] ~] res)
          (return:m !<((set ship) p.res))
        ::
        :-  :-  ~
            :-  'urbit_thread'^'pals'^'get_targets'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  (script:lia-sur:wasm @ acc-mold)
            ^-  form:m
            =,  arr
            ;<  s=(set ship)  try:m
              =/  m  (script:lia-sur:wasm (set ship) acc-mold)
              ^-  form:m
              ?:  =(argc-w 0)
                (get-targets-ext ~)
              ;<  tag-str=cord  try:m  (get-js-string argv-u)
              ?:  =(~ tag-str)
                (get-targets-ext ~)
              ?.  ((sane %ta) tag-str)
                ~&  >>  "Insane tag: {(trip tag-str)}"
                (return:m ~)
              (get-targets-ext ~ `@ta`tag-str)
            ::
            (store-json a+(turn ~(tap in s) ship:enjs))

        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ?>  ?=([[%vase p=*] ~] l)
        =+  !<(sam=(unit knot) p.l)
        ;<  res=(set ship)  bind:m  (get-targets-ted sam)
        (pure:m vase+!>(res) ~)
      ++  tlon-get-groups
        ^-  table-entry
        ::
        =/  id  %get-groups
        =/  get-groups-ted
          =/  m  (strand (list flag))
          ^-  form:m
          ;<  =groups  bind:m
            (scry groups %gx %groups /v2/groups/groups-2)
          ::
          (pure:m ~(tap in ~(key by groups)))
        ::
        =/  get-groups-ext
          =/  m  (script:lia-sur:wasm (list flag) acc-mold)
          ^-  form:m
          ;<  res=(pole lv)  try:m  (call-ext:arr id ~)
          ?>  ?=([[%vase p=*] ~] res)
          (return:m !<((list flag) p.res))
        ::
        :-  :-  ~
            :-  'urbit_thread'^'tlon'^'get_groups'^~
            |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
            =/  m  m-js
            ^-  form:m
            =,  arr
            ;<  l=(list flag)  try:m  get-groups-ext
            (store-json a+(turn l flag:enjs:gj))
        :-  ~
        :-  id
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ;<  res=(list flag)  bind:m  get-groups-ted
        (pure:m vase+!>(res) ~)
      ++  get-bowl
        ^-  table-entry
        ::    Lia-only imports
        ::  %get-bowl
        ::
        :-  ~
        :-  ~
        :-  %get-bowl
        |=  l=(pole lv)
        =/  m  m-rand
        ^-  form:m
        ;<  bol=bowl:rand  bind:m  get-bowl:sio
        (pure:m vase+!>(bol) ~)
      --
    ::
    ::  +malloc-write: allocate and immediately write `p` bytes of `q` atom
    ::
    ++  malloc-write
      |=  data=octs
      =/  m  (script:lia-sur:wasm @ acc-mold)
      ^-  form:m
      =,  arr
      ;<  ptr-u=@  try:m  (call-1 'malloc' p.data ~)
      ;<  ~  try:m  (memwrite ptr-u data)
      (return:m ptr-u)
    ::  +malloc-cord: allocate and write a null-terminated cord
    ::
    ++  malloc-cord
      |=  str=cord
      =/  m  (script:lia-sur:wasm @ acc-mold)
      ^-  form:m
      (malloc-write +((met 3 str)) str)
    ::  +ring: complex call, with other calls inlined
    ::
    ++  ring
      |=  [func=cord args=(list $@(@ (script-form @ acc-mold)))]
      =/  m  (script:lia-sur:wasm (list @) acc-mold)
      ^-  form:m
      =,  arr
      =|  args-atoms=(list @)
      |-  ^-  form:m
          ?~  args  (call func (flop args-atoms))
          ?@  i.args  $(args t.args, args-atoms [i.args args-atoms])
          ;<  atom=@  try:m  i.args
          $(args t.args, args-atoms [atom args-atoms])
    ::  +ding: complex call-1
    ::
    ++  ding
      |=  [func=cord args=(list $@(@ (script-form @ acc-mold)))]
      =/  m  (script:lia-sur:wasm @ acc-mold)
      ;<  out=(list @)  try:m  (ring func args)
      ?>  =(~ |1.out)
      (return:m -.out)
    ::  +js-eval: run JS code
    ::
    ++  js-eval
      |=  code=cord
      =/  m  (script:lia-sur:wasm @ acc-mold)
      ^-  form:m
      =,  arr
      ;<  acc=acc-mold  try:m  get-acc
      ::  [run-u=@ ctx-u=@ fil-u=@]
      ::
      =+  (get-js-ctx acc)
      ::
      =/  code-len  (met 3 code)
      ;<  code-u=@  try:m  (malloc-write +(code-len) code)
      ;<  res-u=@  try:m  (call-1 'QTS_Eval' ctx-u code-u code-len fil-u 0 0 ~)
      ;<  *  try:m  (call 'free' code-u ~)
      (return:m res-u)
    ::  +mayb-error: check is JSValue* is an exception
    ::
    ++  mayb-error
      |=  res-u=@
      =/  m  (script:lia-sur:wasm (unit cord) acc-mold)
      ^-  form:m
      =,  arr
      ;<  acc=acc-mold  try:m  get-acc
      =+  (get-js-ctx acc)
      ::
      ;<  err-u=@  try:m  (call-1 'QTS_ResolveException' ctx-u res-u ~)
      ?:  =(0 err-u)  (return:m ~)
      ;<  str-u=@  try:m  (call-1 'QTS_GetString' ctx-u err-u ~)
      ;<  str=cord  try:m  (get-c-string str-u)
      (return:m `str)
    ::  +get-c-string: load a null-terminated string
    ::
    ++  get-c-string
      |=  ptr=@
      =/  m  (script:lia-sur:wasm cord acc-mold)
      ^-  form:m
      =,  arr
      =/  len=@  0
      =/  cursor=@  ptr
      |-  ^-  form:m
          ;<  char=octs  try:m  (memread cursor 1)
          ?.  =(0 q.char)
            $(len +(len), cursor +(cursor))
          ;<  =octs  try:m  (memread ptr len)
          (return:m q.octs)
    ::  +get-js-string: load a JSValue-represented string
    ::
    ++  get-js-string
      |=  val-u=@
      =/  m  (script:lia-sur:wasm cord acc-mold)
      ^-  form:m
      =,  arr
      ;<  acc=acc-mold  try:m  get-acc
      =+  (get-js-ctx acc)
      ::
      ;<  str-u=@  try:m  (call-1 'QTS_GetString' ctx-u val-u ~)
      (get-c-string str-u)
    ::  +tem: cord to octs
    ::
    ++  tem
      |=  c=cord
      ^-  octs
      [(met 3 c) c]
    ::  +ret: render result type to (list lv)
    ::
    ++  ret
      =/  m  runnable:wasm
      |=  out=(each cord (pair cord cord))
      ^-  form:m
      %-  return:m
      ?-  -.out
        %&  ~[i32+& octs+(tem p.out)]
        %|  ~[i32+| octs+(tem p.p.out) octs+(tem q.p.out)]
      ==
    ::  +register-function: associate a function name with a magic number.
    ::  The magic number must be recognized by +qts-host-call-function.
    ::
    ++  register-function
      |=  [name=cord mag-w=@ obj-u=@]
      ::  return: (unit error=cord)
      ::
      =/  m  (script:lia-sur:wasm (unit cord) acc-mold)
      ^-  form:m
      =,  arr
      ;<  acc=acc-mold  try:m  get-acc
      =+  (get-js-ctx acc)
      ;<  nam-u=@  try:m  (malloc-cord name)
      ;<  res-u=@  try:m  (call-1 'QTS_NewFunction' ctx-u mag-w nam-u ~)
      ::
      ;<  err=(unit cord)  try:m  (mayb-error res-u)
      ?^  err  (return:m err)
      ::
      ;<  nam-val-u=@  try:m  (call-1 'QTS_NewString' ctx-u nam-u ~)  ::  free string value?
      ;<  undef-u=@  try:m  (call-1 'QTS_GetUndefined' ~)
      ;<  *  try:m
        %:  call  'QTS_DefineProp'
          ctx-u
          obj-u
          nam-val-u
          res-u
          undef-u  ::  get
          undef-u  ::  set
          0        ::  configurable
          1        ::  enumerable
          1        ::  has_value
          ~
        ==
      ::
      (return:m ~)
    ::  +get-result: parse (list lv) to get result type.
    ::  Must roundtrip with +ret.
    ::
    ++  get-result
      |=  res=(pole lv)
      ^-  (each cord (pair cord cord))
      ?+  res  !!
        [[%i32 %&] [%octs o=octs] ~]  &+q.o.res
        [[%i32 %|] [%octs p=octs] [%octs q=octs] ~]  |+[q.p.res q.q.res]
      ==
    ::  +js-val-cord-compare: compare a JSValue* with a string from cord
    ::
    ++  js-val-cord-compare
      |=  [val-u=@ =cord]
      =/  m  (script:lia-sur:wasm ? acc-mold)
      ^-  form:m
      =,  arr
      ;<  acc=acc-mold  try:m  get-acc
      =+  (get-js-ctx acc)
      ::
      ;<  crd-u=@  try:m  (malloc-cord cord)
      ;<  str-u=@  try:m  (call-1 'QTS_NewString' ctx-u crd-u ~)
      ;<  is-eq=@  try:m  (call-1 'QTS_IsEqual' ctx-u val-u str-u 0 ~)  :: QTS_EqualOp_SameValue
      ;<  *  try:m  (call 'QTS_FreeValuePointer' ctx-u str-u ~)
      ;<  *  try:m  (call 'free' crd-u ~)
      (return:m !=(is-eq 0))
    ::  +make-error: create an Exception object with a custom message
    ::
    ++  make-error
      |=  txt=cord
      =/  m  (script:lia-sur:wasm @ acc-mold)
      ^-  form:m
      =,  arr
      ;<  acc=acc-mold  try:m  get-acc
      =+  (get-js-ctx acc)
      ::
      ;<  err-u=@  try:m  (call-1 'QTS_NewError' ctx-u ~)
      =/  field=cord  'message'
      ;<  *  try:m
        %:  ring  'QTS_SetProp'
          ctx-u
          err-u
          (ding 'QTS_NewString' ctx-u (malloc-cord field) ~)
          (ding 'QTS_NewString' ctx-u (malloc-cord txt) ~)
          ~
        ==
      ::
      (return:m err-u)
    ::  +throw-error: returns a pointer to JSException
    ::
    ++  throw-error
      |=  err=cord
      =/  m  (script:lia-sur:wasm @ acc-mold)
      ^-  form:m
      =,  arr
      ;<  acc=acc-mold  try:m  get-acc
      =+  (get-js-ctx acc)
      (ding 'QTS_Throw' ctx-u (make-error err) ~)
    ::
    ++  rule-ship-club
      %+  cook  |=((each @p id:club:v6:chat-ver-sur) +<)
      ;~  pose
          (stag %& ;~(pfix sig fed:ag))
          (stag %| ;~(pfix (jest '0v') viz:ag))  ::  XX review
      ==
    ::  +parse-path: friendly path parser, replaces .ext with /ext
    :: 
    ++  parse-path
      |=  xap=cord
      |^  ^-  (unit path)
          (rush xap path-rule)
      ::  path element sans `.`
      ::
      ++  urs-ab-dotless
        %+  cook
          |=(a=tape (rap 3 ^-((list @) a)))
        (star ;~(pose nud low hep sig cab))
      ::
      ++  path-rule
        %+  sear
          |=  p=path
          ^-  (unit path)
          ?:  ?=([~ ~] p)  `~
          ?.  =(~ (rear p))  `p
          ~
        ;~  pfix
            ::  optional starting /
            ::
            (punt fas)
          ::::
            ::  foo/bar/baz.abc
            ::
            |-
            =*  this  $
            %+  knee  *path
            |.  ~+
                ;~  pose
                    ::  done
                    ::
                    (full (easy ~))
                  ::::
                    ::  foo.bar
                    ::
                    %+  cook  |=([a=@ta b=@ta] ~[a b])
                    (full ;~(plug urs-ab-dotless ;~(pfix dot urs:ab)))
                  ::::
                    ::  foo | foo/...
                    ::
                    ;~(plug urs:ab ;~(pose (full (easy ~)) ;~(pfix fas this)))
                ==
        ==
      --
    ::  +return-undefined: return a pointer to a copy of `undefined` constant
    :: 
    ::    apparently QuickJS crashes when it tries to free a constant pointer
    ::    return by QTS_GetUndefined and friends, so we duplicate a value
    ::    for safe return
    :: 
    ++  return-undefined
      =/  m  (script:lia-sur:wasm @ acc-mold)
      ^-  form:m
      =,  arr
      ;<  acc=acc-mold  try:m  get-acc
      =+  (get-js-ctx acc)
      ;<  undef-const-u=@  try:m  (call-1 'QTS_GetUndefined' ~)
      (call-1 'QTS_DupValuePointer' ctx-u undef-const-u ~)
    ::  +load-json: return a JSON noun from QuickJS
    :: 
    ++  load-json
      |=  ptr-u=@
      =/  m  (script:lia-sur:wasm json acc-mold)
      ^-  form:m
      =,  arr
      ;<  acc=acc-mold  try:m  get-acc
      =+  (get-js-ctx acc)
      ::
      |^
        ;<  type-u=@  try:m  (call-1 'QTS_Typeof' ctx-u ptr-u ~)
        ;<  type=cord  try:m  (get-c-string type-u)
        ?+  type  ~&(json-unsupported-type+type (return:m ~))
            ?(%'number' %'bigint')
          ;<  float=@rd  try:m  (call-1 'QTS_GetFloat64' ctx-u ptr-u ~)
          (return:m n+(rsh 3^2 (scot %rd float)))
        ::
            %'string'
          ;<  str=cord  try:m  (get-js-string ptr-u)
          (return:m s+str)
        ::
            %'boolean'
          ;<  float=@rd  try:m  (call-1 'QTS_GetFloat64' ctx-u ptr-u ~)
          (return:m b+!=(float 0))
        ::
            %'object'
          ::  %a, %o or ~
          ::  test for ~
          ::
          ;<  null-u=@  try:m  (call-1 'QTS_GetNull' ~)
          ;<  is-eq=@  try:m  (call-1 'QTS_IsEqual' ctx-u ptr-u null-u 0 ~)
          ?:  !=(0 is-eq)
            (return:m ~)
          ::  test for %a
          ::
          =/  name  'length'
          ;<  len-u=@  try:m
            %:  ding  'QTS_GetProp'
              ctx-u
              ptr-u
              (ding 'QTS_NewString' ctx-u (malloc-write +((met 3 name)) name) ~)
              ~
            ==
          ::
          ;<  err=(unit cord)  try:m  (mayb-error len-u)
          ;<  undef-u=@  try:m  (call-1 'QTS_GetUndefined' ~)
          ::
          ;<  is-undef=@  try:m  (call-1 'QTS_IsEqual' ctx-u len-u undef-u 0 ~)
          ?:  |(?=(^ err) !=(is-undef 0))  ::  obj.length either failed or undefined
            load-fields
          ::  array
          ::
          ;<  len-d=@rd  try:m  (call-1 'QTS_GetFloat64' ctx-u len-u ~)
          =/  len=@  (abs:si (need (toi:rd len-d)))
          =|  vals=(list json)
          |-  ^-  form:m
              ?:  =(len 0)  (return:m a+vals)
              =/  idx=@  (dec len)
              ;<  val-u=@  try:m
                %:  ding  'QTS_GetProp'
                  ctx-u
                  ptr-u
                  (call-1 'QTS_NewFloat64' ctx-u (sun:rd idx) ~)
                  ~
                ==
              ::
              ;<  jon-child=json  try:m  (load-json val-u)
              $(len (dec len), vals [jon-child vals])
        ==
      ++  load-fields
        ::  object
        ::
        ;<  out-ptrs-u=@  try:m  (call-1 'malloc' 4 ~)
        ;<  out-len-u=@  try:m  (call-1 'malloc' 4 ~)
        ::  1 selects JS_GPN_STRING_MASK.
        ;<  err-u=@  try:m
          (call-1 'QTS_GetOwnPropertyNames' ctx-u out-ptrs-u out-len-u ptr-u 1 ~)
        ::
        ?:  !=(err-u 0)
          ;<  str=cord  try:m  (get-js-string err-u)
          ~&('GetOwnPropertyNames error'^str (return:m ~))
        ::
        ;<  len-octs=octs  try:m  (memread out-len-u 4)
        =/  len-w=@  q.len-octs
        ;<  arr-octs=octs  try:m  (memread out-ptrs-u 4)
        =/  arr-u=@  q.arr-octs
        =|  pairs=(list (pair @t json))
        ;<  *  try:m  (call 'free' out-len-u ~)
        ;<  *  try:m  (call 'free' out-ptrs-u ~)
        |-  ^-  form:m
            ?:  =(len-w 0)  (return:m o+(molt pairs))
            =/  idx=@  (dec len-w)
            ;<  nam-val-octs=octs  try:m  (memread (add arr-u (mul 4 idx)) 4)
            =/  nam-val-u=@  q.nam-val-octs
            ;<  name=cord  try:m  (get-js-string nam-val-u)
            ;<  val-u=@  try:m
              %:  call-1  'QTS_GetProp'
                ctx-u
                ptr-u
                nam-val-u
                ~
              ==
            ::
            ;<  jon-child=json  try:m  (load-json val-u)
            $(len-w (dec len-w), pairs [[name jon-child] pairs])
      --
    ::  +store-json-name: create a global object from JSON noun
    ::
    ++  store-json-name
      |=  [name=cord =json]
      =/  m  (script:lia-sur:wasm ,~ acc-mold)
      ^-  form:m
      =,  arr
      ;<  acc=acc-mold  try:m  get-acc
      =+  (get-js-ctx acc)
      ::
      ;<  undef-u=@  try:m  (call-1 'QTS_GetUndefined' ~)
      ::
      ;<  *  try:m
        %:  ring  'QTS_DefineProp'
          ctx-u
          (call-1 'QTS_GetGlobalObject' ctx-u ~)
          (ding 'QTS_NewString' ctx-u (malloc-write +((met 3 name)) name) ~)
          (store-json json)
          undef-u  ::  get
          undef-u  ::  set
          1        ::  configurable
          1        ::  enumerable
          1        ::  has_value
          ~
        ==
      ::
      (return:m ~)
    ::  +store-json: put JSON noun into QuickJS context
    ::  and return JSValue pointer to it
    :: 
    ++  store-json
      |=  jon=json
      =/  m  (script:lia-sur:wasm @ acc-mold)
      ^-  form:m
      =,  arr
      ;<  acc=acc-mold  try:m  get-acc
      =+  (get-js-ctx acc)
      ::  string of JSON
      ::
      =/  jon-cod=cord  (en-json-fixed jon)
      ::  string of string of JSON
      ::
      =.  jon-cod  (scap:en-json-fixed jon-cod)
      =/  code=cord
        (rap 3 'JSON.parse(' jon-cod ')' ~)
      ::
      ;<  res-u=@  try:m
        %:  ding  'QTS_Eval'
          ctx-u
          (malloc-write +((met 3 code)) code)
          (met 3 code)
          fil-u
          1
          0
          ~
        ==
      ::
      ;<  err=(unit cord)  try:m  (mayb-error res-u)
      ?^  err  ~|  u.err  (return:m res-u)
      (return:m res-u)
    ::  +parse-url: friendly url parsing. Falls back to https
    ::
    ++  parse-url
      |=  lur=cord
      ^-  (unit purl:eyre)
      ?^  pur=(de-purl:html lur)  pur
      (de-purl:html (rap 3 'https://' lur ~))
    ::  +parse-methods: parse JSON to $moth:eyre
    ::
    ++  parse-methods
      |=  obj=(map @t json)
      ^-  (unit moth:eyre)
      =/  met=(unit meth:eyre)
        ?~  tod=(~(get by obj) %method)  `%get
        ::  handle null value
        ::
        ?~  u.tod  ~
        ?.  ?=(%s -.u.tod)  ~
        ?+  p.u.tod  ~
          %'CONNECT'  `%conn
          %'DELETE'  `%delt
          %'GET'  `%get
          %'HEAD'  `%head
          %'OPTIONS'  `%opts
          %'POST'  `%post
          %'PUT'  `%put
          %'TRACE'  `%trac
        ==
      ::
      ?~  met  ~
      =/  mat=(unit math:eyre)
        ?~  tod=(~(get by obj) %headers)  `~
        ?~  u.tod  ~
        ::  array of key-value pairs
        ::
        ?:  ?=(%a -.u.tod)
          =/  l=(unit (list [@t @t]))
            |-  ^-  (unit (list [@t @t]))
                ?~  p.u.tod  `~
                ?.  ?=([%a [[%s *] [%s *] ~]] i.p.u.tod)  ~
                =/  tel=(unit (list [@t @t]))  $(p.u.tod t.p.u.tod)
                ?~  tel  ~
                =*  arr  p.i.p.u.tod
                `[[p.i.arr p.i.t.arr] u.tel]
          ::
          ?~  l  ~
          :-  ~
          =<  q
          %^  spin  u.l  *math:eyre
          |=  [[k=@t v=@t] j=(jar @t @t)]
          ^-  [* math:eyre]
          `(~(add ja j) k v)
        ::  plain object
        ::
        ?.  ?=(%o -.u.tod)  ~
        %-  ~(rep by p.u.tod)
        |:  [[k=*@t v=*json] acc=`(unit math:eyre)`[~ *math:eyre]]
        ^-  (unit math:eyre)
        ?~  acc  ~
        ?.  ?=([%s *] v)  ~
        acc(u (~(put by u.acc) k ~[p.v]))
      ::
      ?~  mat  ~
      =/  bod=(unit (unit octs))
        ?~  dob=(~(get by obj) %body)  `~
        ?.  ?=([%s *] u.dob)  ~
        ``(tem p.u.dob)
      ::
      ?~  bod  ~
      `[u.met u.mat u.bod]
    ::
    ++  throw-args
      |=  [name=cord got=@ need=@]
      %-  throw-error
      %:  rap  3
        'Not enough arguments for function "'  name  '", got '
        (scot %ud got)  ', need at least '  (scot %ud need)
        ~
      ==
    ::
    ++  throw-path
      |=  xap=cord
      %-  throw-error
      %:  rap  3
        'Invalid path: "'  xap
        ~
      ==
    ::
    ++  throw-url
      |=  lur=cord
      %-  throw-error
      %:  rap  3
        'Invalid URL: "'  lur
        ~
      ==
    ::
    ++  throw-methods
      |=  *
      (throw-error 'Failed parsing `fetch` methods')
    ::
    ++  throw-integer
      |=  float=@rd
      %-  throw-error
      %:  rap  3
        'Type error: '  (rsh [3 2] (scot %rd float))  ' cannot be an integer'
        ~
      ==
    ::
    ::  +clock-time-get: WASI import to get time
    ::
    ++  clock-time-get
      |=  args=(pole cw)
      =/  m  (script:lia-sur:wasm (list cw) acc-mold)
      ^-  form:m
      ?>  ?=([[%i32 @] [%i64 @] [%i32 time-u=@] ~] args)
      =,  arr
      =,  args
      ;<  l=(pole lv)  try:m  (call-ext %get-bowl ~)
      ?>  ?=([[%vase owl=*] ~] l)
      =+  !<(bol=bowl:rand owl.l)
      ;<  tor=acc-mold  try:m  get-acc
      =+  !<(=acc tor)
      =.  acc  acc(bowl `bol)
      ;<  ~  try:m  (set-acc !>(acc))
      ::
      =/  time=@da  now.bol
      ::  WASI time is in ns
      ::
      =/  ntime  (mul 1.000.000 (unm:chrono:userlib time))
      ;<  ~  try:m  (memwrite time-u 8 ntime)
      (return:m i32+0 ~)
    ::  ++enjs: encode to JSON. We roll our own en/decodings to ensure
    ::  roundtripping
    :: 
    ++  enjs
      =,  enjs:format
      |%
      ::  replaces ++ship:enjs:format and is different from Tlon def
      ::
      ++  ship
        |=  a=@p
        ^-  json
        s+(scot %p a)
      ::  time is used as a unique key, we need to preserve it
      ::
      ++  time
        |=  t=@
        ^-  json
        s+(rap 3 +>:(scow %ui t))
      ::
      ++  memo
        |=  m=memo:channels-sur
        ^-  json
        %-  pairs
        :~  content/(story:enjs:sj content.m)
            author/(ship ?@(a=author.m a ship.a))
            sent/(time sent.m)
        ==
      --
    ::  ++dejs: decode from JSON
    ::
    ++  dejs
      =,  dejs:format
      |%
      ++  ship
        |=  jon=json
        ^-  @p
        ?>  ?=(%s -.jon)
        (slav %p p.jon)
      ::
      ++  memo
        ^-  $-(json memo:channels-sur)
        %-  ot
        :~  content+story:dejs:sj
            author+ship
            sent+di
        ==
      ::
      ++  time
        ^-  $-(json @da)
        (su dim:ag)
      --
    --
=/  table=(list table-entry)  function-table
=/  js-imports=(map @ [name=(list cord) js-func=js-import-func])
  =<  -
  %+  roll  table
  |=  $:  i=table-entry
          ::  mag-w 0 is reserved for `require`
          ::
          acc=[m=(map @ [name=(list cord) js-func=js-import-func]) mag-w=_1]
      ==
  ^+  acc
  ?~  js.i  acc
  %=  acc
    m  (~(put by m.acc) mag-w.acc u.js.i)
    mag-w  +(mag-w.acc)
  ==
::
=/  list-js-imports=(list [mag-w=@ name=(list cord) *])
  ~(tap by js-imports)
::
=/  lia-imports=(map @tas $-((list lv) (strand-form (list lv))))
  %+  roll  table
  |=  [i=table-entry acc=(map @tas $-((list lv) (strand-form (list lv))))]
  ^+  acc
  ?~  ext.i  acc
  (~(put by acc) id.u.ext.i thread.u.ext.i)
::
::  JS runtime and library construction
::
=>  |%
    ::  +urbit-thread-make-object: construct a JS object to be imported with
    ::  `require`. Returns a pointer to that object.
    ::  Every registered functions' magic number must be recognized by
    ::  +qts-host-call-function
    ::
    ++  urbit-thread-make-object
      =/  m  (script:lia-sur:wasm @ acc-mold)
      ^-  form:m
      =,  arr
      ;<  acc=acc-mold  try:m  get-acc
      =+  (get-js-ctx acc)
      ::
      ;<  undef-u=@  try:m  (call-1 'QTS_GetUndefined' ~)
      ;<  urb-u=@  try:m  (call-1 'QTS_NewObject' ctx-u ~)
      |^
        ;<  *  try:m
          =/  m  (script:lia-sur:wasm * acc-mold)
          |-  ^-  form:m
              ?~  list-js-imports  (return:m ~)
              =/  i  i.list-js-imports
              ?.  ?=([%'urbit_thread' @ ~] name.i)
                $(list-js-imports t.list-js-imports)
              ;<  *  try:m  (register-function i.t.name.i mag-w.i urb-u)
              $(list-js-imports t.list-js-imports)
        ::
        ;<  *  try:m  tlon-object
        ;<  *  try:m  pals-object
        (return:m urb-u)
      ++  tlon-object
        ::  add urbit.tlon object for Tlon API
        ::
        ;<  tlon-str-u=@  try:m
          %:  ding  'QTS_NewString'
            ctx-u
            (malloc-cord 'tlon')
            ~
          ==
        ::
        ;<  *  try:m
          %:  ring  'QTS_DefineProp'
            ctx-u
            urb-u
            tlon-str-u
            (call-1 'QTS_NewObject' ctx-u ~)                ::  init value
            undef-u                                         ::  getter
            undef-u                                         ::  setter
            1                                               ::  configurable
            1                                               ::  enumerable
            1                                               ::  has value
            ~
          ==
        ::
        ;<  tlon-u=@  try:m
          (call-1 'QTS_GetProp' ctx-u urb-u tlon-str-u ~)
        ::
        ;<  *  try:m
          =/  m  (script:lia-sur:wasm * acc-mold)
          |-  ^-  form:m
              ?~  list-js-imports  (return:m ~)
              =/  i  i.list-js-imports
              ?.  ?=([%'urbit_thread' %'tlon' @ ~] name.i)
                $(list-js-imports t.list-js-imports)
              ;<  *  try:m  (register-function i.t.t.name.i mag-w.i tlon-u)
              $(list-js-imports t.list-js-imports)
        ::
        (return:m 0)
      ++  pals-object
        ::  add urbit.pals object for Pals API
        ::
        ;<  pals-str-u=@  try:m
          %:  ding  'QTS_NewString'
            ctx-u
            (malloc-cord 'pals')
            ~
          ==
        ::
        ;<  *  try:m
          %:  ring  'QTS_DefineProp'
            ctx-u
            urb-u
            pals-str-u
            (call-1 'QTS_NewObject' ctx-u ~)                ::  init value
            undef-u                                         ::  getter
            undef-u                                         ::  setter
            1                                               ::  configurable
            1                                               ::  enumerable
            1                                               ::  has value
            ~
          ==
        ::
        ;<  pals-u=@  try:m
          (call-1 'QTS_GetProp' ctx-u urb-u pals-str-u ~)
        ::
        ;<  *  try:m
          =/  m  (script:lia-sur:wasm * acc-mold)
          |-  ^-  form:m
              ?~  list-js-imports  (return:m ~)
              =/  i  i.list-js-imports
              ?.  ?=([%'urbit_thread' %'pals' @ ~] name.i)
                $(list-js-imports t.list-js-imports)
              ;<  *  try:m  (register-function i.t.t.name.i mag-w.i pals-u)
              $(list-js-imports t.list-js-imports)
        ::
        (return:m 0)
      --
    ::
    ++  require
      |=  [ctx-u=@ this-u=@ argc-w=@ argv-u=@]
      =/  m  (script:lia-sur:wasm @ acc-mold)
      ^-  form:m
      =,  arr
      ?.  (gte argc-w 1)  (throw-args 'require' argc-w 1)
      ;<  is-urbit-thread=?  try:m
        (js-val-cord-compare argv-u 'urbit_thread')
      ::
      ?:  is-urbit-thread  urbit-thread-make-object
      ::
      ::  ;<  is-foo-bar=?  try:m  (js-val-cord-compare argv-u 'foo_bar')
      ::  ?:  is-foo-bar  foo-bar-make-object
      ::  ...
      ::
      ::  If the string is not matched: throw error
      ::
      ;<  str=cord  try:m  (get-js-string argv-u)
      (throw-error (rap 3 'Module "' str '" not available' ~))
    ::  +main: JS code -> main script to run
    ::
    ++  main
      |=  code=cord
      =/  m  runnable:wasm
      ^-  form:m
      =,  arr
      =/  filename=cord  'script-eval.js'
      ;<  run-u=@  try:m  (call-1 'QTS_NewRuntime' ~)
      ;<  ctx-u=@  try:m  (call-1 'QTS_NewContext' run-u 0 ~)
      ;<  fil-u=@  try:m  (malloc-cord filename)
      =|  tor=acc
      =.  tor  tor(run-u run-u, ctx-u ctx-u, fil-u fil-u)
      ;<  ~  try:m  (set-acc !>(tor))
      ;<  global-this-u=@  try:m  (call-1 'QTS_GetGlobalObject' ctx-u ~)
      ;<  undef-u=@  try:m  (call-1 'QTS_GetUndefined' ~)
      |^
        ::  `require` registration is special-cased
        ::
        ;<  *  try:m  (register-function 'require' 0 global-this-u)
        ;<  *  try:m
          =/  m  (script:lia-sur:wasm * acc-mold)
          |-  ^-  form:m
              ?~  list-js-imports  (return:m ~)
              =/  i  i.list-js-imports
              ?.  ?=([@ ~] name.i)
                $(list-js-imports t.list-js-imports)
              ;<  *  try:m  (register-function i.name.i mag-w.i global-this-u)
              $(list-js-imports t.list-js-imports)
        ::
        ;<  *  try:m  install-module
        ;<  *  try:m  install-console
        ;<  *  try:m  install-fetch
        :: imports the interface library via require, exports a function to module.exports
        ::
        ;<  res-u=@  try:m  (js-eval code)
        ;<  err=(unit cord)  try:m  (mayb-error res-u)
        ?^  err  (ret |+[u.err 'failed to export the script function'])
        ;<  res-u=@  try:m
          %-  js-eval
          '''
          globalThis.__result = undefined;
          Promise.resolve(module.exports()).then(result => {
            globalThis.__result = result;
          });
          '''
        ::
        ;<  dump-u=@  try:m  (call-1 'malloc' 4 ~)  ::  XX use scratch arena for things like that
        ;<  *  try:m
          (call 'QTS_ExecutePendingJob' run-u ^~((sub (bex 32) 1)) dump-u ~)
        ::
        ;<  err=(unit cord)  try:m  (mayb-error res-u)
        ?^  err  (ret |+[u.err 'failed to call the exported function'])
        ;<  pro-u=@  try:m  (js-eval 'globalThis.__result')
        ;<  str=cord  try:m  (get-js-string pro-u)
        (ret &+str)
      ::
      ++  install-module
        ::  define `module` object
        ::
        %:  ring  'QTS_DefineProp'
          ctx-u
          global-this-u
        ::
          %:  ding  'QTS_NewString'                       ::  property name
            ctx-u
            (malloc-cord 'module')
            ~
          ==
        ::
          (call-1 'QTS_NewObject' ctx-u ~)                ::  init value
          undef-u                                         ::  getter
          undef-u                                         ::  setter
          1                                               ::  configurable
          1                                               ::  enumerable
          1                                               ::  has value
          ~
        ==
      ++  install-console
        =/  m  (script:lia-sur:wasm * acc-mold)
        ::  define `console` object
        ::
        ;<  console-str-u=@  try:m
          %:  ding  'QTS_NewString'
            ctx-u
            (malloc-cord 'console')
            ~
          ==
        ::
        ;<  *  try:m
          %:  ring  'QTS_DefineProp'
            ctx-u
            global-this-u
            console-str-u
            (call-1 'QTS_NewObject' ctx-u ~)                ::  init value
            undef-u                                         ::  getter
            undef-u                                         ::  setter
            1                                               ::  configurable
            1                                               ::  enumerable
            1                                               ::  has value
            ~
          ==
        ::
        ;<  console-u=@  try:m
          (call-1 'QTS_GetProp' ctx-u global-this-u console-str-u ~)
        ::
        |-  ^-  form:m
            ?~  list-js-imports  (return:m ~)
            =/  i  i.list-js-imports
            ?.  ?=([%console @ ~] name.i)
              $(list-js-imports t.list-js-imports)
            ;<  *  try:m  (register-function i.t.name.i mag-w.i console-u)
            $(list-js-imports t.list-js-imports)
      ::
      ++  install-fetch
        =/  m  (script:lia-sur:wasm * acc-mold)
        ;<  fun-u=@  try:m
          %-  js-eval
          '''
          var _fetch = function(url, options = { method: "GET" }) {
            return new Promise((resolve, reject) => {
              const res = globalThis.fetch_sync(url, options);
              resolve(res);
            });
          };
          _fetch
          '''
        ::
        %:  ring  'QTS_DefineProp'
          ctx-u
          global-this-u
          (ding 'QTS_NewString' ctx-u (malloc-cord 'fetch') ~)
          fun-u
          undef-u  ::  get
          undef-u  ::  set
          0        ::  configurable
          1        ::  enumerable
          1        ::  has_value
          ~
        ==
      ::
      ::
      --
    ::  +qts-host-call-function: Wasm import to resolve JS imports
    ::
    ++  qts-host-call-function
      |=  args=(pole cw)
      =/  m  (script:lia-sur:wasm (list cw) acc-mold)
      ^-  form:m
      ?>  ?=  $:  [%i32 ctx-u=@]
                  [%i32 this-u=@]
                  [%i32 argc-w=@]
                  [%i32 argv-u=@]
                  [%i32 magic-w=@]
                  ~
              ==
          args
      ::
      =,  arr
      =,  args
      ;<  acc=acc-mold  try:m  get-acc
      =/  arrow=$-([@ @ @ @] (script-form @ acc-mold))
        ?:  =(0 magic-w.args)  require
        js-func:(~(got by js-imports) magic-w.args)
      ::
      ;<  val-u=@  try:m  (arrow ctx-u this-u argc-w argv-u)
      (return:m i32+val-u ~)
    ::  +emscripten-notify-memory-growth: ES-generated Wasm import to let
    ::  the host update its memory view. Urwasm memory model is not affected
    ::  by reallocations, so we do nothing.
    ::
    ++  emscripten-notify-memory-growth
      |=  *
      =/  m  (script:lia-sur:wasm (list cw) acc-mold)
      (return:m ~)
    ::
    --
::
=/  imports=(import:lia-sur:wasm acc-mold)
  :-  !>(*acc)
  =/  m  (script:lia-sur:wasm (list cw) acc-mold)
  %-  ~(gas by *(map (pair cord cord) $-((list cw) form:m)))
  :~
    ['wasi_snapshot_preview1'^'clock_time_get' clock-time-get]
    ['env'^'qts_host_call_function' qts-host-call-function]
    ['env'^'emscripten_notify_memory_growth' emscripten-notify-memory-growth]
  ==
::
::  Thread builder
::  (JS code => _!>(*[%0 ?([%& p=result=cord] [%| p=how=cord q=where=cord])]))
::
=/  hint  %rand
|=  [code=cord gap=@dr]
^-  shed:khan
=/  m  (strand vase)
;<  res=(each cord (pair cord cord))  bind:m
  =/  m  (strand (each cord (pair cord cord)))
  ;<  *  bind:m  (pure:m &+%$)
  |-  ^-  form:m
      =*  restart-loop  $
      =/  =seed:lia-sur:wasm  [quick-js-wasm (return:runnable:wasm ~) ~ imports]
      ::  A %jinx hint arms a CPU-time timer around each wasm engine step.
      ::  urwasm interprets Wasm as one uninterrupted Nock computation between
      ::  host yields, so a non-terminating JS loop would otherwise wedge the
      ::  ship's event for the whole thread; jinx bails it after `gap` of CPU
      ::  time, failing the Spider thread cleanly. gap 0 means unbounded (no
      ::  hint). See urbit/vere pkg/noun/nock.c _n_hint_fore.
      =^  [yil=(yield (list lv)) *]  seed
        ?:  =(`@dr`0 gap)  (run:wasm &+(main code) seed hint)
        ~>(%jinx.gap (run:wasm &+(main code) seed hint))
      |-  ^-  form:m
          =*  block-loop  $
          ?-  -.yil
              %0
            (pure:m (get-result p.yil))
          ::
              %1
            ?:  ?=(%restart name.yil)
              ::  free state, run anew
              ::
              =^  *  seed
            ?:  =(`@dr`0 gap)  (run:wasm |+~ seed hint)
            ~>(%jinx.gap (run:wasm |+~ seed hint))
              restart-loop
            ::  resolve block, continue
            ::
            ;<  res=(list lv)  bind:m  ((~(got by lia-imports) name.yil) args.yil)
            =^  [yil1=(yield (list lv)) *]  seed
              ?:  =(`@dr`0 gap)  (run:wasm |+res seed hint)
              ~>(%jinx.gap (run:wasm |+res seed hint))
            block-loop(yil yil1)
          ::
              %2
            (strand-fail:rand %thread-js ~['Wasm VM crashed'])
          ==
::  ;<  res
(pure:m !>(0+res))
