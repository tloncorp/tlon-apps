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
              ;+  diary-coda
            ==
          ==
        ==
    ::
    ++  style
      '''
      :root {
        --background-body: #FFFFFF;
        --background: #FFFFFF;
        --background-alt: #F5F5F5;
        --selection: rgba(24, 24, 24, 0.08);
        --text-main: #1A1818;
        --text-bright: #1A1818;
        --text-muted: #666666;
        --links: #008EFF;
        --focus: #008EFF;
        --border: #E5E5E5;
        --code: #1A1818;
        --animation-duration: 0.1s;
        --button-base: #F5F5F5;
        --button-hover: #E5E5E5;
        --scrollbar-thumb: rgb(244, 244, 244);
        --scrollbar-thumb-hover: var(--button-hover);
        --form-placeholder: #999999;
        --form-text: #1A1818;
        --variable: #2AD546;
        --highlight: #FADE7A;
        --select-arrow: url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23161f27'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E");
      }

      @media (prefers-color-scheme: dark) {
      :root {
        --background-body: #1A1818;
        --background: #1A1818;
        --background-alt: #322E2E;
        --selection: rgba(255, 255, 255, 0.08);
        --text-main: #FFFFFF;
        --text-bright: #fff;
        --text-muted: #B3B3B3;
        --links: #008EFF;
        --focus: #008EFF;
        --border: #333333;
        --code: #FFFFFF;
        --animation-duration: 0.1s;
        --button-base: #322E2E;
        --button-hover: #4C4C4C;
        --scrollbar-thumb: var(--button-hover);
        --scrollbar-thumb-hover: rgb(0, 0, 0);
        --form-placeholder: #808080;
        --form-text: #fff;
        --variable: #2AD546;
        --highlight: #FADE7A;
        --select-arrow: url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23efefef'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E");
      }
      }

      html {
        scrollbar-color: rgb(244, 244, 244) #FFFFFF;
        scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        scrollbar-width: thin;
      }

      @media (prefers-color-scheme: dark) {
        html {
        scrollbar-color: #4C4C4C #1A1818;
        scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        }
      }

      @media (prefers-color-scheme: dark) {
        html {
        scrollbar-color: #4C4C4C #1A1818;
        scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        }
      }

      @media (prefers-color-scheme: dark) {
        html {
        scrollbar-color: #4C4C4C #1A1818;
        scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        }
      }

      @media (prefers-color-scheme: dark) {
        html {
        scrollbar-color: #4C4C4C #1A1818;
        scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        }
      }

      @media (prefers-color-scheme: dark) {
        html {
        scrollbar-color: #4C4C4C #1A1818;
        scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        }
      }

      @media (prefers-color-scheme: dark) {
        html {
        scrollbar-color: #4C4C4C #1A1818;
        scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        }
      }

      body {
        font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
        font-size: 20px;
        font-weight: 400;
        line-height: 1.8;
        max-width: 800px;
        margin: 20px auto;
        padding: 0 10px;
        word-wrap: break-word;
        color: #1A1818;
        color: var(--text-main);
        background: #FFFFFF;
        background: var(--background-body);
        text-rendering: optimizeLegibility;
      }

      @media (prefers-color-scheme: dark) {
        body {
        background: #1A1818;
        background: var(--background-body);
        }
      }

      @media (prefers-color-scheme: dark) {

        body {
        color: #FFFFFF;
        color: var(--text-main);
        }
      }

      button {
        transition:
          background-color 0.1s linear,
          border-color 0.1s linear,
          color 0.1s linear,
          box-shadow 0.1s linear,
          transform 0.1s ease;
        transition:
          background-color var(--animation-duration) linear,
          border-color var(--animation-duration) linear,
          color var(--animation-duration) linear,
          box-shadow var(--animation-duration) linear,
          transform var(--animation-duration) ease;
      }

      @media (prefers-color-scheme: dark) {
        button {
        transition:
          background-color 0.1s linear,
          border-color 0.1s linear,
          color 0.1s linear,
          box-shadow 0.1s linear,
          transform 0.1s ease;
        transition:
          background-color var(--animation-duration) linear,
          border-color var(--animation-duration) linear,
          color var(--animation-duration) linear,
          box-shadow var(--animation-duration) linear,
          transform var(--animation-duration) ease;
        }
      }

      input {
        transition:
          background-color 0.1s linear,
          border-color 0.1s linear,
          color 0.1s linear,
          box-shadow 0.1s linear,
          transform 0.1s ease;
        transition:
          background-color var(--animation-duration) linear,
          border-color var(--animation-duration) linear,
          color var(--animation-duration) linear,
          box-shadow var(--animation-duration) linear,
          transform var(--animation-duration) ease;
      }

      @media (prefers-color-scheme: dark) {
        input {
        transition:
          background-color 0.1s linear,
          border-color 0.1s linear,
          color 0.1s linear,
          box-shadow 0.1s linear,
          transform 0.1s ease;
        transition:
          background-color var(--animation-duration) linear,
          border-color var(--animation-duration) linear,
          color var(--animation-duration) linear,
          box-shadow var(--animation-duration) linear,
          transform var(--animation-duration) ease;
        }
      }

      textarea {
        transition:
          background-color 0.1s linear,
          border-color 0.1s linear,
          color 0.1s linear,
          box-shadow 0.1s linear,
          transform 0.1s ease;
        transition:
          background-color var(--animation-duration) linear,
          border-color var(--animation-duration) linear,
          color var(--animation-duration) linear,
          box-shadow var(--animation-duration) linear,
          transform var(--animation-duration) ease;
      }

      @media (prefers-color-scheme: dark) {
        textarea {
        transition:
          background-color 0.1s linear,
          border-color 0.1s linear,
          color 0.1s linear,
          box-shadow 0.1s linear,
          transform 0.1s ease;
        transition:
          background-color var(--animation-duration) linear,
          border-color var(--animation-duration) linear,
          color var(--animation-duration) linear,
          box-shadow var(--animation-duration) linear,
          transform var(--animation-duration) ease;
        }
      }

      h1 {
        margin-top: 0;
        font-size: 2em;
        font-weight: 400;
        letter-spacing: -0.025em;
        margin-top: 0;
        margin-bottom: 12px;
      }

      h2,
      h3,
      h4,
      h5,
      h6 {
        margin-bottom: 12px;
        margin-top: 24px;
        font-size: 1em;
      }

      h1 {
        color: #1A1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {
        h1 {
        color: #fff;
        color: var(--text-bright);
        }
      }

      h2 {
        color: #1A1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {
        h2 {
        color: #fff;
        color: var(--text-bright);
        }
      }

      h3 {
        color: #1A1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {
        h3 {
        color: #fff;
        color: var(--text-bright);
        }
      }

      h4 {
        color: #1A1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {
        h4 {
        color: #fff;
        color: var(--text-bright);
        }
      }

      h5 {
        color: #1A1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {
        h5 {
        color: #fff;
        color: var(--text-bright);
        }
      }

      h6 {
        color: #1A1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {
        h6 {
        color: #fff;
        color: var(--text-bright);
        }
      }

      strong {
        color: #1A1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {
        strong {
        color: #fff;
        color: var(--text-bright);
        }
      }

      h2,
      h3,
      h4,
      h5,
      h6,
      b,
      strong,
      th {
        font-weight: 600;
      }

      q::before {
        content: none;
      }

      q::after {
        content: none;
      }

      blockquote {
        border-left: 4px solid #008EFF;
        border-left: 4px solid var(--focus);
        margin: 1.5em 0;
        padding: 0.5em 1em;
        font-style: italic;
      }

      @media (prefers-color-scheme: dark) {
        blockquote {
        border-left: 4px solid #008EFF;
        border-left: 4px solid var(--focus);
        }
      }

      q {
        border-left: 4px solid #008EFF;
        border-left: 4px solid var(--focus);
        margin: 1.5em 0;
        padding: 0.5em 1em;
        font-style: italic;
      }

      @media (prefers-color-scheme: dark) {

        q {
        border-left: 4px solid #008EFF;
        border-left: 4px solid var(--focus);
        }
      }

      blockquote > footer {
        font-style: normal;
        border: 0;
      }

      blockquote cite {
        font-style: normal;
      }

      address {
        font-style: normal;
      }

      a[href^='mailto\:']::before {
        content: '📧 ';
      }

      a[href^='tel\:']::before {
        content: '📞 ';
      }

      a[href^='sms\:']::before {
        content: '💬 ';
      }

      mark {
        background-color: #FADE7A;
        background-color: var(--highlight);
        border-radius: 2px;
        padding: 0 2px 0 2px;
        color: #000;
      }

      @media (prefers-color-scheme: dark) {

        mark {
        background-color: #FADE7A;
        background-color: var(--highlight);
        }
      }

      a > code,
      a > strong {
        color: inherit;
      }

      button,
      select,
      input[type='submit'],
      input[type='reset'],
      input[type='button'],
      input[type='checkbox'],
      input[type='range'],
      input[type='radio'] {
        cursor: pointer;
      }

      input,
      select {
        display: block;
      }

      [type='checkbox'],
      [type='radio'] {
        display: initial;
      }

      input {
        color: #1A1818;
        color: var(--form-text);
        background-color: #FFFFFF;
        background-color: var(--background);
        font-family: inherit;
        font-size: inherit;
        margin-right: 6px;
        margin-bottom: 6px;
        padding: 10px;
        border: none;
        border-radius: 6px;
        outline: none;
      }

      @media (prefers-color-scheme: dark) {
        input {
        background-color: #1A1818;
        background-color: var(--background);
        }
      }

      @media (prefers-color-scheme: dark) {
        input {
        color: #fff;
        color: var(--form-text);
        }
      }

      button {
        color: #1A1818;
        color: var(--form-text);
        background-color: #FFFFFF;
        background-color: var(--background);
        font-family: inherit;
        font-size: inherit;
        margin-right: 6px;
        margin-bottom: 6px;
        padding: 10px;
        border: none;
        border-radius: 6px;
        outline: none;
      }

      @media (prefers-color-scheme: dark) {
        button {
        background-color: #1A1818;
        background-color: var(--background);
        }
      }

      @media (prefers-color-scheme: dark) {
        button {
        color: #fff;
        color: var(--form-text);
        }
      }

      textarea {
        color: #1A1818;
        color: var(--form-text);
        background-color: #FFFFFF;
        background-color: var(--background);
        font-family: inherit;
        font-size: inherit;
        margin-right: 6px;
        margin-bottom: 6px;
        padding: 10px;
        border: none;
        border-radius: 6px;
        outline: none;
      }

      @media (prefers-color-scheme: dark) {
        textarea {
        background-color: #1A1818;
        background-color: var(--background);
        }
      }

      @media (prefers-color-scheme: dark) {
        textarea {
        color: #fff;
        color: var(--form-text);
        }
      }

      select {
        color: #1A1818;
        color: var(--form-text);
        background-color: #FFFFFF;
        background-color: var(--background);
        font-family: inherit;
        font-size: inherit;
        margin-right: 6px;
        margin-bottom: 6px;
        padding: 10px;
        border: none;
        border-radius: 6px;
        outline: none;
      }

      @media (prefers-color-scheme: dark) {
        select {
        background-color: #1A1818;
        background-color: var(--background);
        }
      }

      @media (prefers-color-scheme: dark) {
        select {
        color: #fff;
        color: var(--form-text);
        }
      }

      button {
        background-color: #F5F5F5;
        background-color: var(--button-base);
        padding-right: 30px;
        padding-left: 30px;
      }

      @media (prefers-color-scheme: dark) {
        button {
        background-color: #322E2E;
        background-color: var(--button-base);
        }
      }

      input[type='submit'] {
        background-color: #F5F5F5;
        background-color: var(--button-base);
        padding-right: 30px;
        padding-left: 30px;
      }

      @media (prefers-color-scheme: dark) {
        input[type='submit'] {
        background-color: #322E2E;
        background-color: var(--button-base);
        }
      }

      input[type='reset'] {
        background-color: #F5F5F5;
        background-color: var(--button-base);
        padding-right: 30px;
        padding-left: 30px;
      }

      @media (prefers-color-scheme: dark) {
        input[type='reset'] {
        background-color: #322E2E;
        background-color: var(--button-base);
        }
      }

      input[type='button'] {
        background-color: #F5F5F5;
        background-color: var(--button-base);
        padding-right: 30px;
        padding-left: 30px;
      }

      @media (prefers-color-scheme: dark) {
        input[type='button'] {
        background-color: #322E2E;
        background-color: var(--button-base);
        }
      }

      button:hover {
        background: #E5E5E5;
        background: var(--button-hover);
      }

      @media (prefers-color-scheme: dark) {
        button:hover {
        background: #4C4C4C;
        background: var(--button-hover);
        }
      }

      input[type='submit']:hover {
        background: #E5E5E5;
        background: var(--button-hover);
      }

      @media (prefers-color-scheme: dark) {
        input[type='submit']:hover {
        background: #4C4C4C;
        background: var(--button-hover);
        }
      }

      input[type='reset']:hover {
        background: #E5E5E5;
        background: var(--button-hover);
      }

      @media (prefers-color-scheme: dark) {
        input[type='reset']:hover {
        background: #4C4C4C;
        background: var(--button-hover);
        }
      }

      input[type='button']:hover {
        background: #E5E5E5;
        background: var(--button-hover);
      }

      @media (prefers-color-scheme: dark) {
        input[type='button']:hover {
        background: #4C4C4C;
        background: var(--button-hover);
        }
      }

      input[type='color'] {
        min-height: 2rem;
        padding: 8px;
        cursor: pointer;
      }

      input[type='checkbox'],
      input[type='radio'] {
        height: 1em;
        width: 1em;
      }

      input[type='radio'] {
        border-radius: 100%;
      }

      input {
        vertical-align: top;
      }

      label {
        vertical-align: middle;
        margin-bottom: 4px;
        display: inline-block;
      }

      input:not([type='checkbox']):not([type='radio']),
      input[type='range'],
      select,
      button,
      textarea {
        -webkit-appearance: none;
      }

      textarea {
        display: block;
        margin-right: 0;
        box-sizing: border-box;
        resize: vertical;
      }

      textarea:not([cols]) {
        width: 100%;
      }

      textarea:not([rows]) {
        min-height: 40px;
        height: 140px;
      }

      select {
        background: #FFFFFF url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23161f27'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E") calc(100% - 12px) 50% / 12px no-repeat;
        background: var(--background) var(--select-arrow) calc(100% - 12px) 50% / 12px no-repeat;
        padding-right: 35px;
      }

      @media (prefers-color-scheme: dark) {
        select {
        background: #1A1818 url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23efefef'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E") calc(100% - 12px) 50% / 12px no-repeat;
        background: var(--background) var(--select-arrow) calc(100% - 12px) 50% / 12px no-repeat;
        }
      }

      @media (prefers-color-scheme: dark) {
        select {
        background: #1A1818 url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23efefef'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E") calc(100% - 12px) 50% / 12px no-repeat;
        background: var(--background) var(--select-arrow) calc(100% - 12px) 50% / 12px no-repeat;
        }
      }

      @media (prefers-color-scheme: dark) {
        select {
        background: #1A1818 url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23efefef'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E") calc(100% - 12px) 50% / 12px no-repeat;
        background: var(--background) var(--select-arrow) calc(100% - 12px) 50% / 12px no-repeat;
        }
      }

      @media (prefers-color-scheme: dark) {
        select {
        background: #1A1818 url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23efefef'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E") calc(100% - 12px) 50% / 12px no-repeat;
        background: var(--background) var(--select-arrow) calc(100% - 12px) 50% / 12px no-repeat;
        }
      }

      select::-ms-expand {
        display: none;
      }

      select[multiple] {
        padding-right: 10px;
        background-image: none;
        overflow-y: auto;
      }

      input:focus {
        box-shadow: 0 0 0 2px #008EFF;
        box-shadow: 0 0 0 2px var(--focus);
      }

      @media (prefers-color-scheme: dark) {
        input:focus {
        box-shadow: 0 0 0 2px #008EFF;
        box-shadow: 0 0 0 2px var(--focus);
        }
      }

      select:focus {
        box-shadow: 0 0 0 2px #008EFF;
        box-shadow: 0 0 0 2px var(--focus);
      }

      @media (prefers-color-scheme: dark) {

        select:focus {
        box-shadow: 0 0 0 2px #008EFF;
        box-shadow: 0 0 0 2px var(--focus);
        }
      }

      button:focus {
        box-shadow: 0 0 0 2px #008EFF;
        box-shadow: 0 0 0 2px var(--focus);
      }

      @media (prefers-color-scheme: dark) {

        button:focus {
        box-shadow: 0 0 0 2px #008EFF;
        box-shadow: 0 0 0 2px var(--focus);
        }
      }

      textarea:focus {
        box-shadow: 0 0 0 2px #008EFF;
        box-shadow: 0 0 0 2px var(--focus);
      }

      @media (prefers-color-scheme: dark) {

        textarea:focus {
        box-shadow: 0 0 0 2px #008EFF;
        box-shadow: 0 0 0 2px var(--focus);
        }
      }

      input[type='checkbox']:active,
      input[type='radio']:active,
      input[type='submit']:active,
      input[type='reset']:active,
      input[type='button']:active,
      input[type='range']:active,
      button:active {
        transform: translateY(2px);
      }

      input:disabled,
      select:disabled,
      button:disabled,
      textarea:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      ::-moz-placeholder {
        color: #999999;
        color: var(--form-placeholder);
      }

      :-ms-input-placeholder {
        color: #999999;
        color: var(--form-placeholder);
      }

      ::-ms-input-placeholder {
        color: #999999;
        color: var(--form-placeholder);
      }

      ::placeholder {
        color: #999999;
        color: var(--form-placeholder);
      }

      @media (prefers-color-scheme: dark) {
        ::-moz-placeholder {
        color: #808080;
        color: var(--form-placeholder);
        }

        :-ms-input-placeholder {
        color: #808080;
        color: var(--form-placeholder);
        }

        ::-ms-input-placeholder {
        color: #808080;
        color: var(--form-placeholder);
        }

        ::placeholder {
        color: #808080;
        color: var(--form-placeholder);
        }
      }

      fieldset {
        border: 1px #008EFF solid;
        border: 1px var(--focus) solid;
        border-radius: 6px;
        margin: 0;
        margin-bottom: 12px;
        padding: 10px;
      }

      @media (prefers-color-scheme: dark) {

        fieldset {
        border: 1px #008EFF solid;
        border: 1px var(--focus) solid;
        }
      }

      legend {
        font-size: 0.9em;
        font-weight: 600;
      }

      input[type='range'] {
        margin: 10px 0;
        padding: 10px 0;
        background: transparent;
      }

      input[type='range']:focus {
        outline: none;
      }

      input[type='range']::-webkit-slider-runnable-track {
        width: 100%;
        height: 9.5px;
        -webkit-transition: 0.2s;
        transition: 0.2s;
        background: #FFFFFF;
        background: var(--background);
        border-radius: 3px;
      }

      @media (prefers-color-scheme: dark) {
        input[type='range']::-webkit-slider-runnable-track {
        background: #1A1818;
        background: var(--background);
        }
      }

      input[type='range']::-webkit-slider-thumb {
        box-shadow: 0 1px 1px #000, 0 0 1px #0d0d0d;
        height: 20px;
        width: 20px;
        border-radius: 50%;
        background: #E5E5E5;
        background: var(--border);
        -webkit-appearance: none;
        margin-top: -7px;
      }

      @media (prefers-color-scheme: dark) {
        input[type='range']::-webkit-slider-thumb {
        background: #333333;
        background: var(--border);
        }
      }

      input[type='range']:focus::-webkit-slider-runnable-track {
        background: #FFFFFF;
        background: var(--background);
      }

      @media (prefers-color-scheme: dark) {
        input[type='range']:focus::-webkit-slider-runnable-track {
        background: #1A1818;
        background: var(--background);
        }
      }

      input[type='range']::-moz-range-track {
        width: 100%;
        height: 9.5px;
        -moz-transition: 0.2s;
        transition: 0.2s;
        background: #FFFFFF;
        background: var(--background);
        border-radius: 3px;
      }

      @media (prefers-color-scheme: dark) {
        input[type='range']::-moz-range-track {
        background: #1A1818;
        background: var(--background);
        }
      }

      input[type='range']::-moz-range-thumb {
        box-shadow: 1px 1px 1px #000, 0 0 1px #0d0d0d;
        height: 20px;
        width: 20px;
        border-radius: 50%;
        background: #E5E5E5;
        background: var(--border);
      }

      @media (prefers-color-scheme: dark) {
        input[type='range']::-moz-range-thumb {
        background: #333333;
        background: var(--border);
        }
      }

      input[type='range']::-ms-track {
        width: 100%;
        height: 9.5px;
        background: transparent;
        border-color: transparent;
        border-width: 16px 0;
        color: transparent;
      }

      input[type='range']::-ms-fill-lower {
        background: #FFFFFF;
        background: var(--background);
        border: 0.2px solid #010101;
        border-radius: 3px;
        box-shadow: 1px 1px 1px #000, 0 0 1px #0d0d0d;
      }

      @media (prefers-color-scheme: dark) {
        input[type='range']::-ms-fill-lower {
        background: #1A1818;
        background: var(--background);
        }
      }

      input[type='range']::-ms-fill-upper {
        background: #FFFFFF;
        background: var(--background);
        border: 0.2px solid #010101;
        border-radius: 3px;
        box-shadow: 1px 1px 1px #000, 0 0 1px #0d0d0d;
      }

      @media (prefers-color-scheme: dark) {
        input[type='range']::-ms-fill-upper {
        background: #1A1818;
        background: var(--background);
        }
      }

      input[type='range']::-ms-thumb {
        box-shadow: 1px 1px 1px #000, 0 0 1px #0d0d0d;
        border: 1px solid #000;
        height: 20px;
        width: 20px;
        border-radius: 50%;
        background: #E5E5E5;
        background: var(--border);
      }

      @media (prefers-color-scheme: dark) {
        input[type='range']::-ms-thumb {
        background: #333333;
        background: var(--border);
        }
      }

      input[type='range']:focus::-ms-fill-lower {
        background: #FFFFFF;
        background: var(--background);
      }

      @media (prefers-color-scheme: dark) {

        input[type='range']:focus::-ms-fill-lower {
        background: #1A1818;
        background: var(--background);
        }
      }

      input[type='range']:focus::-ms-fill-upper {
        background: #FFFFFF;
        background: var(--background);
      }

      @media (prefers-color-scheme: dark) {

        input[type='range']:focus::-ms-fill-upper {
        background: #1A1818;
        background: var(--background);
        }
      }

      a {
        text-decoration: underline;
        color: #008EFF;
        color: var(--links);
      }

      @media (prefers-color-scheme: dark) {

        a {
        color: #008EFF;
        color: var(--links);
        }
      }

      a:hover {
        text-decoration: underline;
      }

      code {
        background: #FFFFFF;
        background: var(--background);
        color: #1A1818;
        color: var(--code);
        padding: 2.5px 5px;
        border-radius: 6px;
        font-size: 1em;
      }

      @media (prefers-color-scheme: dark) {

        code {
        color: #FFFFFF;
        color: var(--code);
        }
      }

      @media (prefers-color-scheme: dark) {

        code {
        background: #1A1818;
        background: var(--background);
        }
      }

      samp {
        background: #FFFFFF;
        background: var(--background);
        color: #1A1818;
        color: var(--code);
        padding: 2.5px 5px;
        border-radius: 6px;
        font-size: 1em;
      }

      @media (prefers-color-scheme: dark) {

        samp {
        color: #FFFFFF;
        color: var(--code);
        }
      }

      @media (prefers-color-scheme: dark) {

        samp {
        background: #1A1818;
        background: var(--background);
        }
      }

      time {
        background: #FFFFFF;
        background: var(--background);
        color: #1A1818;
        color: var(--code);
        padding: 2.5px 5px;
        border-radius: 6px;
        font-size: 1em;
      }

      @media (prefers-color-scheme: dark) {

        time {
        color: #FFFFFF;
        color: var(--code);
        }
      }

      @media (prefers-color-scheme: dark) {

        time {
        background: #1A1818;
        background: var(--background);
        }
      }

      pre > code {
        padding: 10px;
        display: block;
        overflow-x: auto;
      }

      var {
        color: #2AD546;
        color: var(--variable);
        font-style: normal;
        font-family: monospace;
      }

      @media (prefers-color-scheme: dark) {

        var {
        color: #2AD546;
        color: var(--variable);
        }
      }

      kbd {
        background: #FFFFFF;
        background: var(--background);
        border: 1px solid #E5E5E5;
        border: 1px solid var(--border);
        border-radius: 2px;
        color: #1A1818;
        color: var(--text-main);
        padding: 2px 4px 2px 4px;
      }

      @media (prefers-color-scheme: dark) {

        kbd {
        color: #FFFFFF;
        color: var(--text-main);
        }
      }

      @media (prefers-color-scheme: dark) {

        kbd {
        border: 1px solid #333333;
        border: 1px solid var(--border);
        }
      }

      @media (prefers-color-scheme: dark) {

        kbd {
        background: #1A1818;
        background: var(--background);
        }
      }

      img,
      video {
        max-width: 100%;
        height: auto;
      }

      hr {
        border: none;
        border-top: 1px solid #E5E5E5;
        border-top: 1px solid var(--border);
      }

      @media (prefers-color-scheme: dark) {

        hr {
        border-top: 1px solid #333333;
        border-top: 1px solid var(--border);
        }
      }

      table {
        border-collapse: collapse;
        margin-bottom: 10px;
        width: 100%;
        table-layout: fixed;
      }

      table caption {
        text-align: left;
      }

      td,
      th {
        padding: 6px;
        text-align: left;
        vertical-align: top;
        word-wrap: break-word;
      }

      thead {
        border-bottom: 1px solid #E5E5E5;
        border-bottom: 1px solid var(--border);
      }

      @media (prefers-color-scheme: dark) {

        thead {
        border-bottom: 1px solid #333333;
        border-bottom: 1px solid var(--border);
        }
      }

      tfoot {
        border-top: 1px solid #E5E5E5;
        border-top: 1px solid var(--border);
      }

      @media (prefers-color-scheme: dark) {

        tfoot {
        border-top: 1px solid #333333;
        border-top: 1px solid var(--border);
        }
      }

      tbody tr:nth-child(even) {
        background-color: #FFFFFF;
        background-color: var(--background);
      }

      @media (prefers-color-scheme: dark) {

        tbody tr:nth-child(even) {
        background-color: #1A1818;
        background-color: var(--background);
        }
      }

      tbody tr:nth-child(even) button {
        background-color: #F5F5F5;
        background-color: var(--background-alt);
      }

      @media (prefers-color-scheme: dark) {

        tbody tr:nth-child(even) button {
        background-color: #322E2E;
        background-color: var(--background-alt);
        }
      }

      tbody tr:nth-child(even) button:hover {
        background-color: #FFFFFF;
        background-color: var(--background-body);
      }

      @media (prefers-color-scheme: dark) {

        tbody tr:nth-child(even) button:hover {
        background-color: #1A1818;
        background-color: var(--background-body);
        }
      }

      ::-webkit-scrollbar {
        height: 10px;
        width: 10px;
      }

      ::-webkit-scrollbar-track {
        background: #FFFFFF;
        background: var(--background);
        border-radius: 6px;
      }

      @media (prefers-color-scheme: dark) {

        ::-webkit-scrollbar-track {
        background: #1A1818;
        background: var(--background);
        }
      }

      ::-webkit-scrollbar-thumb {
        background: rgb(244, 244, 244);
        background: var(--scrollbar-thumb);
        border-radius: 6px;
      }

      @media (prefers-color-scheme: dark) {

        ::-webkit-scrollbar-thumb {
        background: #4C4C4C;
        background: var(--scrollbar-thumb);
        }
      }

      @media (prefers-color-scheme: dark) {

        ::-webkit-scrollbar-thumb {
        background: #4C4C4C;
        background: var(--scrollbar-thumb);
        }
      }

      ::-webkit-scrollbar-thumb:hover {
        background: #E5E5E5;
        background: var(--scrollbar-thumb-hover);
      }

      @media (prefers-color-scheme: dark) {

        ::-webkit-scrollbar-thumb:hover {
        background: rgb(0, 0, 0);
        background: var(--scrollbar-thumb-hover);
        }
      }

      @media (prefers-color-scheme: dark) {

        ::-webkit-scrollbar-thumb:hover {
        background: rgb(0, 0, 0);
        background: var(--scrollbar-thumb-hover);
        }
      }

      ::-moz-selection {
        background-color: rgba(24, 24, 24, 0.08);
        background-color: var(--selection);
        color: #1A1818;
        color: var(--text-bright);
      }

      ::selection {
        background-color: rgba(24, 24, 24, 0.08);
        background-color: var(--selection);
        color: #1A1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {

        ::-moz-selection {
        color: #fff;
        color: var(--text-bright);
        }

        ::selection {
        color: #fff;
        color: var(--text-bright);
        }
      }

      @media (prefers-color-scheme: dark) {

        ::-moz-selection {
        background-color: rgba(255, 255, 255, 0.08);
        background-color: var(--selection);
        }

        ::selection {
        background-color: rgba(255, 255, 255, 0.08);
        background-color: var(--selection);
        }
      }

      details {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        background-color: #F5F5F5;
        background-color: var(--background-alt);
        padding: 10px 10px 0;
        margin: 1em 0;
        border-radius: 6px;
        overflow: hidden;
      }

      @media (prefers-color-scheme: dark) {

        details {
        background-color: #322E2E;
        background-color: var(--background-alt);
        }
      }

      details[open] {
        padding: 10px;
      }

      details > :last-child {
        margin-bottom: 0;
      }

      details[open] summary {
        margin-bottom: 10px;
      }

      summary {
        display: list-item;
        background-color: #FFFFFF;
        background-color: var(--background);
        padding: 10px;
        margin: -10px -10px 0;
        cursor: pointer;
        outline: none;
      }

      @media (prefers-color-scheme: dark) {

        summary {
        background-color: #1A1818;
        background-color: var(--background);
        }
      }

      summary:hover,
      summary:focus {
        text-decoration: underline;
      }

      details > :not(summary) {
        margin-top: 0;
      }

      summary::-webkit-details-marker {
        color: #1A1818;
        color: var(--text-main);
      }

      @media (prefers-color-scheme: dark) {

        summary::-webkit-details-marker {
        color: #FFFFFF;
        color: var(--text-main);
        }
      }

      dialog {
        background-color: #F5F5F5;
        background-color: var(--background-alt);
        color: #1A1818;
        color: var(--text-main);
        border: none;
        border-radius: 6px;
        border-color: #E5E5E5;
        border-color: var(--border);
        padding: 10px 30px;
      }

      @media (prefers-color-scheme: dark) {

        dialog {
        border-color: #333333;
        border-color: var(--border);
        }
      }

      @media (prefers-color-scheme: dark) {

        dialog {
        color: #FFFFFF;
        color: var(--text-main);
        }
      }

      @media (prefers-color-scheme: dark) {

        dialog {
        background-color: #322E2E;
        background-color: var(--background-alt);
        }
      }

      dialog > header:first-child {
        background-color: #FFFFFF;
        background-color: var(--background);
        border-radius: 6px 6px 0 0;
        margin: -10px -30px 10px;
        padding: 10px;
        text-align: center;
      }

      @media (prefers-color-scheme: dark) {

        dialog > header:first-child {
        background-color: #1A1818;
        background-color: var(--background);
        }
      }

      dialog::-webkit-backdrop {
        background: #0000009c;
        -webkit-backdrop-filter: blur(4px);
                backdrop-filter: blur(4px);
      }

      dialog::backdrop {
        background: #0000009c;
        -webkit-backdrop-filter: blur(4px);
                backdrop-filter: blur(4px);
      }

      footer {
        border-top: 1px solid #E5E5E5;
        border-top: 1px solid var(--border);
        padding-top: 10px;
        color: #666666;
        color: var(--text-muted);
      }

      @media (prefers-color-scheme: dark) {

        footer {
        color: #B3B3B3;
        color: var(--text-muted);
        }
      }

      @media (prefers-color-scheme: dark) {

        footer {
        border-top: 1px solid #333333;
        border-top: 1px solid var(--border);
        }
      }

      body > footer {
        margin-top: 40px;
      }

      @media print {
        body,
        pre,
        code,
        summary,
        details,
        button,
        input,
        textarea {
          background-color: #fff;
        }

        button,
        input,
        textarea {
          border: 1px solid #000;
        }

        body,
        h1,
        h2,
        h3,
        h4,
        h5,
        h6,
        pre,
        code,
        button,
        input,
        textarea,
        footer,
        summary,
        strong {
          color: #000;
        }

        summary::marker {
          color: #000;
        }

        summary::-webkit-details-marker {
          color: #000;
        }

        tbody tr:nth-child(even) {
          background-color: #f2f2f2;
        }

        a {
          color: #00f;
          text-decoration: underline;
        }
      }
      .prelude {
        display: flex;
        flex-direction: column;
        gap: 8px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 1em;
      }
      .prelude .author {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.8em;
        font-weight: 500;
        color: var(--text-muted);
      }
      .prelude .author .avatar {
        border-radius: 4px;
        overflow: hidden;
      }
      .prelude time {
        color: var(--text-muted);
        font-size: 0.8em;
      }
      footer p {
        font-size: 0.8em;
      }
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
        ;link(rel "preconnect", href "https://rsms.me");
        ;link(rel "stylesheet", href "https://rsms.me/inter/inter.css");
      ==
    ::
    ++  diary-coda
      ;footer
        ;p
          ; Powered by
          ;a/"https://tlon.io":"Tlon"
          ; , a messenger you can trust.
        ==
      ==
    ::
    ++  diary-prelude
      |=  [title=tape author=ship sent=@da]
      ^-  marl
      :~  ;h1:"{title}"
          ;div.prelude
            ;div.published
              ;time:"{(scow %da (sub sent (mod sent ~s1)))}"
            ==
            ;div.author
              ;div.avatar
                ;+  (sigil(size 20, icon &) author)
              ==
              ; {(scow %p author)}
            ==
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
