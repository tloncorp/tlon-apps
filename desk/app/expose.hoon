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
++  e
  |%
  ++  render-post
    |=  [our=@p now=@da]
    |=  [=nest:g:c msg=post:d]
    ^-  (unit manx)
    =/  aco=(unit contact:co)
      =/  base=path  /(scot %p our)/contacts/(scot %da now)
      ?.  .^(? %gu (weld base /$))
        ~
      =+  .^(rol=rolodex:co %gx (weld base /all/contact-rolodex))
      ?~  for=(~(get by rol) author.msg)
        ~
      ?.  ?=([[@ ^] *] u.for)
        ~
      `con.for.u.for
    ::
    ::TODO  if we render replies then we can "unroll" whole chat threads too (:
    |^  ?+  p.nest  ~
            %chat
          ?>  ?=(%chat -.kind-data.msg)
          =/  title=tape
            (trip (rap 3 (turn (first-inline content.msg) flatten-inline:u)))
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
          ;header
            ;*  pre
          ==
          ;article
            ;*  bod
          ==
          ;+  footer
        ==
        ;script(type "text/javascript"):"{(trip time-script)}"
      ==
    ::
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
    ::
    ++  style
      '''
      :root {
        --background-body: #ffffff;
        --background: #ffffff;
        --background-alt: #f5f5f5;
        --selection: rgba(24, 24, 24, 0.08);
        --text-main: #1a1818;
        --text-bright: #1a1818;
        --text-muted: #666666;
        --links: #008eff;
        --focus: #008eff;
        --border: #e5e5e5;
        --code: #1a1818;
        --animation-duration: 0.1s;
        --button-base: #f5f5f5;
        --button-hover: #e5e5e5;
        --scrollbar-thumb: rgb(244, 244, 244);
        --scrollbar-thumb-hover: var(--button-hover);
        --form-placeholder: #999999;
        --form-text: #1a1818;
        --variable: #2ad546;
        --highlight: #fade7a;
        --select-arrow: url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23161f27'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E");
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --background-body: #1a1818;
          --background: #1a1818;
          --background-alt: #322e2e;
          --selection: rgba(255, 255, 255, 0.08);
          --text-main: #ffffff;
          --text-bright: #fff;
          --text-muted: #b3b3b3;
          --links: #008eff;
          --focus: #008eff;
          --border: #333333;
          --code: #ffffff;
          --animation-duration: 0.1s;
          --button-base: #322e2e;
          --button-hover: #4c4c4c;
          --scrollbar-thumb: var(--button-hover);
          --scrollbar-thumb-hover: rgb(0, 0, 0);
          --form-placeholder: #808080;
          --form-text: #fff;
          --variable: #2ad546;
          --highlight: #fade7a;
          --select-arrow: url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23efefef'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E");
        }
      }

      html {
        scrollbar-color: rgb(244, 244, 244) #ffffff;
        scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        scrollbar-width: thin;
      }

      @media (prefers-color-scheme: dark) {
        html {
          scrollbar-color: #4c4c4c #1a1818;
          scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        }
      }

      @media (prefers-color-scheme: dark) {
        html {
          scrollbar-color: #4c4c4c #1a1818;
          scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        }
      }

      @media (prefers-color-scheme: dark) {
        html {
          scrollbar-color: #4c4c4c #1a1818;
          scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        }
      }

      @media (prefers-color-scheme: dark) {
        html {
          scrollbar-color: #4c4c4c #1a1818;
          scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        }
      }

      @media (prefers-color-scheme: dark) {
        html {
          scrollbar-color: #4c4c4c #1a1818;
          scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        }
      }

      @media (prefers-color-scheme: dark) {
        html {
          scrollbar-color: #4c4c4c #1a1818;
          scrollbar-color: var(--scrollbar-thumb) var(--background-body);
        }
      }

      body {
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans",
          "Helvetica Neue", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji",
          sans-serif;
        font-size: 16px;
        font-weight: 400;
        line-height: 1.6;
        margin: 1em 1em;
        padding: 0;
        word-wrap: break-word;
        color: #1a1818;
        color: var(--text-main);
        background: #ffffff;
        background: var(--background-body);
        text-rendering: optimizeLegibility;
      }

      @media (prefers-color-scheme: dark) {
        body {
          background: #1a1818;
          background: var(--background-body);
        }
      }

      @media (prefers-color-scheme: dark) {
        body {
          color: #ffffff;
          color: var(--text-main);
        }
      }

      body.chat {
        margin: 0;
      }

      body.chat article {
        margin: 0 1em;
      }

      body.chat header > h1 {
        padding: 1rem 1rem 0;
      }

      @media screen and (min-width: 40rem) {
        body {
          font-size: 20px;
          line-height: 1.8;
        }
        body:not(.chat) {
          max-width: 40rem;
          margin: 1em auto;
          padding: 0 1em;
        }
      }

      @media screen and (min-width: 960px) {
        body:not(.chat) {
          margin: 2em auto 2em 2em;
          padding: 0;
        }
        body.chat {
          max-width: 40rem;
          margin: 0 auto;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: auto;
        }
      }

      button {
        transition: background-color 0.1s linear, border-color 0.1s linear,
          color 0.1s linear, box-shadow 0.1s linear, transform 0.1s ease;
        transition: background-color var(--animation-duration) linear,
          border-color var(--animation-duration) linear,
          color var(--animation-duration) linear,
          box-shadow var(--animation-duration) linear,
          transform var(--animation-duration) ease;
      }

      @media (prefers-color-scheme: dark) {
        button {
          transition: background-color 0.1s linear, border-color 0.1s linear,
            color 0.1s linear, box-shadow 0.1s linear, transform 0.1s ease;
          transition: background-color var(--animation-duration) linear,
            border-color var(--animation-duration) linear,
            color var(--animation-duration) linear,
            box-shadow var(--animation-duration) linear,
            transform var(--animation-duration) ease;
        }
      }

      input {
        transition: background-color 0.1s linear, border-color 0.1s linear,
          color 0.1s linear, box-shadow 0.1s linear, transform 0.1s ease;
        transition: background-color var(--animation-duration) linear,
          border-color var(--animation-duration) linear,
          color var(--animation-duration) linear,
          box-shadow var(--animation-duration) linear,
          transform var(--animation-duration) ease;
      }

      @media (prefers-color-scheme: dark) {
        input {
          transition: background-color 0.1s linear, border-color 0.1s linear,
            color 0.1s linear, box-shadow 0.1s linear, transform 0.1s ease;
          transition: background-color var(--animation-duration) linear,
            border-color var(--animation-duration) linear,
            color var(--animation-duration) linear,
            box-shadow var(--animation-duration) linear,
            transform var(--animation-duration) ease;
        }
      }

      textarea {
        transition: background-color 0.1s linear, border-color 0.1s linear,
          color 0.1s linear, box-shadow 0.1s linear, transform 0.1s ease;
        transition: background-color var(--animation-duration) linear,
          border-color var(--animation-duration) linear,
          color var(--animation-duration) linear,
          box-shadow var(--animation-duration) linear,
          transform var(--animation-duration) ease;
      }

      @media (prefers-color-scheme: dark) {
        textarea {
          transition: background-color 0.1s linear, border-color 0.1s linear,
            color 0.1s linear, box-shadow 0.1s linear, transform 0.1s ease;
          transition: background-color var(--animation-duration) linear,
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
        line-height: 1;
        margin-top: 0;
        margin-bottom: 0.6em;
      }

      h2,
      h3,
      h4,
      h5,
      h6 {
        margin-bottom: 0.6em;
        margin-top: 1.25em;
        font-size: 1em;
      }

      h1 {
        color: #1a1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {
        h1 {
          color: #fff;
          color: var(--text-bright);
        }
      }

      h2 {
        color: #1a1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {
        h2 {
          color: #fff;
          color: var(--text-bright);
        }
      }

      h3 {
        color: #1a1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {
        h3 {
          color: #fff;
          color: var(--text-bright);
        }
      }

      h4 {
        color: #1a1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {
        h4 {
          color: #fff;
          color: var(--text-bright);
        }
      }

      h5 {
        color: #1a1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {
        h5 {
          color: #fff;
          color: var(--text-bright);
        }
      }

      h6 {
        color: #1a1818;
        color: var(--text-bright);
      }

      @media (prefers-color-scheme: dark) {
        h6 {
          color: #fff;
          color: var(--text-bright);
        }
      }

      strong {
        color: #1a1818;
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
        border-left: 0.25em solid #008eff;
        border-left: 0.25em solid var(--focus);
        margin: 1.5em 0;
        padding: 0.5em 1em;
        font-style: italic;
      }

      @media (prefers-color-scheme: dark) {
        blockquote {
          border-left: 0.25em solid #008eff;
          border-left: 0.25em solid var(--focus);
        }
      }

      q {
        border-left: 0.25em solid #008eff;
        border-left: 0.25em solid var(--focus);
        margin: 1.5em 0;
        padding: 0.5em 1em;
        font-style: italic;
      }

      @media (prefers-color-scheme: dark) {
        q {
          border-left: 0.25em solid #008eff;
          border-left: 0.25em solid var(--focus);
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

      a[href^="mailto\:"]::before {
        content: "📧 ";
      }

      a[href^="tel\:"]::before {
        content: "📞 ";
      }

      a[href^="sms\:"]::before {
        content: "💬 ";
      }

      mark {
        background-color: #fade7a;
        background-color: var(--highlight);
        border-radius: 0.125em;
        padding: 0 0.125em 0 0.125em;
        color: #000;
      }

      @media (prefers-color-scheme: dark) {
        mark {
          background-color: #fade7a;
          background-color: var(--highlight);
        }
      }

      a > code,
      a > strong {
        color: inherit;
      }

      button,
      select,
      input[type="submit"],
      input[type="reset"],
      input[type="button"],
      input[type="checkbox"],
      input[type="range"],
      input[type="radio"] {
        cursor: pointer;
      }

      input,
      select {
        display: block;
      }

      [type="checkbox"],
      [type="radio"] {
        display: initial;
      }

      input {
        color: #1a1818;
        color: var(--form-text);
        background-color: #ffffff;
        background-color: var(--background);
        font-family: inherit;
        font-size: inherit;
        margin-right: 0.25em;
        margin-bottom: 0.25em;
        padding: 0.5em;
        border: none;
        border-radius: 0.25em;
        outline: none;
      }

      @media (prefers-color-scheme: dark) {
        input {
          background-color: #1a1818;
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
        color: #1a1818;
        color: var(--form-text);
        background-color: #ffffff;
        background-color: var(--background);
        font-family: inherit;
        font-size: inherit;
        margin-right: 0.25em;
        margin-bottom: 0.25em;
        padding: 0.5em;
        border: none;
        border-radius: 0.25em;
        outline: none;
      }

      @media (prefers-color-scheme: dark) {
        button {
          background-color: #1a1818;
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
        color: #1a1818;
        color: var(--form-text);
        background-color: #ffffff;
        background-color: var(--background);
        font-family: inherit;
        font-size: inherit;
        margin-right: 0.25em;
        margin-bottom: 0.25em;
        padding: 0.5em;
        border: none;
        border-radius: 0.25em;
        outline: none;
      }

      @media (prefers-color-scheme: dark) {
        textarea {
          background-color: #1a1818;
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
        color: #1a1818;
        color: var(--form-text);
        background-color: #ffffff;
        background-color: var(--background);
        font-family: inherit;
        font-size: inherit;
        margin-right: 0.25em;
        margin-bottom: 0.25em;
        padding: 0.5em;
        border: none;
        border-radius: 0.25em;
        outline: none;
      }

      @media (prefers-color-scheme: dark) {
        select {
          background-color: #1a1818;
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
        background-color: #f5f5f5;
        background-color: var(--button-base);
        padding-right: 1.5em;
        padding-left: 1.5em;
      }

      @media (prefers-color-scheme: dark) {
        button {
          background-color: #322e2e;
          background-color: var(--button-base);
        }
      }

      input[type="submit"] {
        background-color: #f5f5f5;
        background-color: var(--button-base);
        padding-right: 1.5em;
        padding-left: 1.5em;
      }

      @media (prefers-color-scheme: dark) {
        input[type="submit"] {
          background-color: #322e2e;
          background-color: var(--button-base);
        }
      }

      input[type="reset"] {
        background-color: #f5f5f5;
        background-color: var(--button-base);
        padding-right: 1.5em;
        padding-left: 1.5em;
      }

      @media (prefers-color-scheme: dark) {
        input[type="reset"] {
          background-color: #322e2e;
          background-color: var(--button-base);
        }
      }

      input[type="button"] {
        background-color: #f5f5f5;
        background-color: var(--button-base);
        padding-right: 1.5em;
        padding-left: 1.5em;
      }

      @media (prefers-color-scheme: dark) {
        input[type="button"] {
          background-color: #322e2e;
          background-color: var(--button-base);
        }
      }

      button:hover {
        background: #e5e5e5;
        background: var(--button-hover);
      }

      @media (prefers-color-scheme: dark) {
        button:hover {
          background: #4c4c4c;
          background: var(--button-hover);
        }
      }

      input[type="submit"]:hover {
        background: #e5e5e5;
        background: var(--button-hover);
      }

      @media (prefers-color-scheme: dark) {
        input[type="submit"]:hover {
          background: #4c4c4c;
          background: var(--button-hover);
        }
      }

      input[type="reset"]:hover {
        background: #e5e5e5;
        background: var(--button-hover);
      }

      @media (prefers-color-scheme: dark) {
        input[type="reset"]:hover {
          background: #4c4c4c;
          background: var(--button-hover);
        }
      }

      input[type="button"]:hover {
        background: #e5e5e5;
        background: var(--button-hover);
      }

      @media (prefers-color-scheme: dark) {
        input[type="button"]:hover {
          background: #4c4c4c;
          background: var(--button-hover);
        }
      }

      input[type="color"] {
        min-height: 2rem;
        padding: 0.4em;
        cursor: pointer;
      }

      input[type="checkbox"],
      input[type="radio"] {
        height: 1em;
        width: 1em;
      }

      input[type="radio"] {
        border-radius: 100%;
      }

      input {
        vertical-align: top;
      }

      label {
        vertical-align: middle;
        margin-bottom: 0.25em;
        display: inline-block;
      }

      input:not([type="checkbox"]):not([type="radio"]),
      input[type="range"],
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
        min-height: 2em;
        height: 12em;
      }

      select {
        background: #ffffff
          url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23161f27'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E")
          calc(100% - 10.125em) 50% / 10.125em no-repeat;
        background: var(--background) var(--select-arrow) calc(100% - 10.125em) 50% / 10.125em
          no-repeat;
        padding-right: 1.75em;
      }

      @media (prefers-color-scheme: dark) {
        select {
          background: #1a1818
            url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23efefef'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E")
            calc(100% - 10.125em) 50% / 10.125em no-repeat;
          background: var(--background) var(--select-arrow) calc(100% - 10.125em) 50% /
            10.125em no-repeat;
        }
      }

      @media (prefers-color-scheme: dark) {
        select {
          background: #1a1818
            url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23efefef'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E")
            calc(100% - 10.125em) 50% / 10.125em no-repeat;
          background: var(--background) var(--select-arrow) calc(100% - 10.125em) 50% /
            10.125em no-repeat;
        }
      }

      @media (prefers-color-scheme: dark) {
        select {
          background: #1a1818
            url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23efefef'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E")
            calc(100% - 10.125em) 50% / 10.125em no-repeat;
          background: var(--background) var(--select-arrow) calc(100% - 10.125em) 50% /
            10.125em no-repeat;
        }
      }

      @media (prefers-color-scheme: dark) {
        select {
          background: #1a1818
            url("data:image/svg+xml;charset=utf-8,%3C?xml version='1.0' encoding='utf-8'?%3E %3Csvg version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' height='62.5' width='116.9' fill='%23efefef'%3E %3Cpath d='M115.3,1.6 C113.7,0 111.1,0 109.5,1.6 L58.5,52.7 L7.4,1.6 C5.8,0 3.2,0 1.6,1.6 C0,3.2 0,5.8 1.6,7.4 L55.5,61.3 C56.3,62.1 57.3,62.5 58.4,62.5 C59.4,62.5 60.5,62.1 61.3,61.3 L115.2,7.4 C116.9,5.8 116.9,3.2 115.3,1.6Z'/%3E %3C/svg%3E")
            calc(100% - 10.125em) 50% / 10.125em no-repeat;
          background: var(--background) var(--select-arrow) calc(100% - 10.125em) 50% /
            10.125em no-repeat;
        }
      }

      select::-ms-expand {
        display: none;
      }

      select[multiple] {
        padding-right: 0.5em;
        background-image: none;
        overflow-y: auto;
      }

      input:focus {
        box-shadow: 0 0 0 0.125em #008eff;
        box-shadow: 0 0 0 0.125em var(--focus);
      }

      @media (prefers-color-scheme: dark) {
        input:focus {
          box-shadow: 0 0 0 0.125em #008eff;
          box-shadow: 0 0 0 0.125em var(--focus);
        }
      }

      select:focus {
        box-shadow: 0 0 0 0.125em #008eff;
        box-shadow: 0 0 0 0.125em var(--focus);
      }

      @media (prefers-color-scheme: dark) {
        select:focus {
          box-shadow: 0 0 0 0.125em #008eff;
          box-shadow: 0 0 0 0.125em var(--focus);
        }
      }

      button:focus {
        box-shadow: 0 0 0 0.125em #008eff;
        box-shadow: 0 0 0 0.125em var(--focus);
      }

      @media (prefers-color-scheme: dark) {
        button:focus {
          box-shadow: 0 0 0 0.125em #008eff;
          box-shadow: 0 0 0 0.125em var(--focus);
        }
      }

      textarea:focus {
        box-shadow: 0 0 0 0.125em #008eff;
        box-shadow: 0 0 0 0.125em var(--focus);
      }

      @media (prefers-color-scheme: dark) {
        textarea:focus {
          box-shadow: 0 0 0 0.125em #008eff;
          box-shadow: 0 0 0 0.125em var(--focus);
        }
      }

      input[type="checkbox"]:active,
      input[type="radio"]:active,
      input[type="submit"]:active,
      input[type="reset"]:active,
      input[type="button"]:active,
      input[type="range"]:active,
      button:active {
        transform: translateY(0.125em);
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
        border: 0.125em #008eff solid;
        border: 0.125em var(--focus) solid;
        border-radius: 0.25em;
        margin: 0;
        margin-bottom: 10.125em;
        padding: 0.5em;
      }

      @media (prefers-color-scheme: dark) {
        fieldset {
          border: 0.125em #008eff solid;
          border: 0.125em var(--focus) solid;
        }
      }

      legend {
        font-size: 0.9em;
        font-weight: 600;
      }

      input[type="range"] {
        margin: 0.5em 0;
        padding: 0.5em 0;
        background: transparent;
      }

      input[type="range"]:focus {
        outline: none;
      }

      input[type="range"]::-webkit-slider-runnable-track {
        width: 100%;
        height: 0.5em;
        -webkit-transition: 0.2s;
        transition: 0.2s;
        background: #ffffff;
        background: var(--background);
        border-radius: 0.25em;
      }

      @media (prefers-color-scheme: dark) {
        input[type="range"]::-webkit-slider-runnable-track {
          background: #1a1818;
          background: var(--background);
        }
      }

      input[type="range"]::-webkit-slider-thumb {
        box-shadow: 0 0.125em 0.125em #000, 0 0 0.125em #0d0d0d;
        height: 1em;
        width: 1em;
        border-radius: 50%;
        background: #e5e5e5;
        background: var(--border);
        -webkit-appearance: none;
        margin-top: -0.3em;
      }

      @media (prefers-color-scheme: dark) {
        input[type="range"]::-webkit-slider-thumb {
          background: #333333;
          background: var(--border);
        }
      }

      input[type="range"]:focus::-webkit-slider-runnable-track {
        background: #ffffff;
        background: var(--background);
      }

      @media (prefers-color-scheme: dark) {
        input[type="range"]:focus::-webkit-slider-runnable-track {
          background: #1a1818;
          background: var(--background);
        }
      }

      input[type="range"]::-moz-range-track {
        width: 100%;
        height: 1em;
        -moz-transition: 0.2s;
        transition: 0.2s;
        background: #ffffff;
        background: var(--background);
        border-radius: 0.25em;
      }

      @media (prefers-color-scheme: dark) {
        input[type="range"]::-moz-range-track {
          background: #1a1818;
          background: var(--background);
        }
      }

      input[type="range"]::-moz-range-thumb {
        box-shadow: 0.125em 0.125em 0.125em #000, 0 0 0.125em #0d0d0d;
        height: 1em;
        width: 1em;
        border-radius: 50%;
        background: #e5e5e5;
        background: var(--border);
      }

      @media (prefers-color-scheme: dark) {
        input[type="range"]::-moz-range-thumb {
          background: #333333;
          background: var(--border);
        }
      }

      input[type="range"]::-ms-track {
        width: 100%;
        height: 0.5em;
        background: transparent;
        border-color: transparent;
        border-width: 10.25em 0;
        color: transparent;
      }

      input[type="range"]::-ms-fill-lower {
        background: #ffffff;
        background: var(--background);
        border: 0.0.125em solid #010101;
        border-radius: 0.25em;
        box-shadow: 0.125em 0.125em 0.125em #000, 0 0 0.125em #0d0d0d;
      }

      @media (prefers-color-scheme: dark) {
        input[type="range"]::-ms-fill-lower {
          background: #1a1818;
          background: var(--background);
        }
      }

      input[type="range"]::-ms-fill-upper {
        background: #ffffff;
        background: var(--background);
        border: 0.0.125em solid #010101;
        border-radius: 0.25em;
        box-shadow: 0.125em 0.125em 0.125em #000, 0 0 0.125em #0d0d0d;
      }

      @media (prefers-color-scheme: dark) {
        input[type="range"]::-ms-fill-upper {
          background: #1a1818;
          background: var(--background);
        }
      }

      input[type="range"]::-ms-thumb {
        box-shadow: 0.125em 0.125em 0.125em #000, 0 0 0.125em #0d0d0d;
        border: 0.125em solid #000;
        height: 1em;
        width: 1em;
        border-radius: 50%;
        background: #e5e5e5;
        background: var(--border);
      }

      @media (prefers-color-scheme: dark) {
        input[type="range"]::-ms-thumb {
          background: #333333;
          background: var(--border);
        }
      }

      input[type="range"]:focus::-ms-fill-lower {
        background: #ffffff;
        background: var(--background);
      }

      @media (prefers-color-scheme: dark) {
        input[type="range"]:focus::-ms-fill-lower {
          background: #1a1818;
          background: var(--background);
        }
      }

      input[type="range"]:focus::-ms-fill-upper {
        background: #ffffff;
        background: var(--background);
      }

      @media (prefers-color-scheme: dark) {
        input[type="range"]:focus::-ms-fill-upper {
          background: #1a1818;
          background: var(--background);
        }
      }

      a {
        text-decoration: underline;
        color: #008eff;
        color: var(--links);
      }

      @media (prefers-color-scheme: dark) {
        a {
          color: #008eff;
          color: var(--links);
        }
      }

      a:hover {
        text-decoration: underline;
      }

      code {
        background: #ffffff;
        background: var(--background);
        color: #1a1818;
        color: var(--code);
        padding: 0.125em 0.25em;
        border-radius: 0.25em;
        font-size: 1em;
      }

      @media (prefers-color-scheme: dark) {
        code {
          color: #ffffff;
          color: var(--code);
        }
      }

      @media (prefers-color-scheme: dark) {
        code {
          background: #1a1818;
          background: var(--background);
        }
      }

      samp {
        background: #ffffff;
        background: var(--background);
        color: #1a1818;
        color: var(--code);
        padding: 0.125em 0.25em;
        border-radius: 0.25em;
        font-size: 1em;
      }

      @media (prefers-color-scheme: dark) {
        samp {
          color: #ffffff;
          color: var(--code);
        }
      }

      @media (prefers-color-scheme: dark) {
        samp {
          background: #1a1818;
          background: var(--background);
        }
      }

      time {
        background: #ffffff;
        background: var(--background);
        color: #1a1818;
        color: var(--code);
        padding: 0.125em 0.25em;
        border-radius: 0.25em;
        font-size: 1em;
      }

      @media (prefers-color-scheme: dark) {
        time {
          color: #ffffff;
          color: var(--code);
        }
      }

      @media (prefers-color-scheme: dark) {
        time {
          background: #1a1818;
          background: var(--background);
        }
      }

      pre > code {
        padding: 0.5em;
        display: block;
        overflow-x: auto;
      }

      var {
        color: #2ad546;
        color: var(--variable);
        font-style: normal;
        font-family: monospace;
      }

      @media (prefers-color-scheme: dark) {
        var {
          color: #2ad546;
          color: var(--variable);
        }
      }

      kbd {
        background: #ffffff;
        background: var(--background);
        border: 0.125em solid #e5e5e5;
        border: 0.125em solid var(--border);
        border-radius: 0.125em;
        color: #1a1818;
        color: var(--text-main);
        padding: 0.125em 0.25em 0.125em 0.25em;
      }

      @media (prefers-color-scheme: dark) {
        kbd {
          color: #ffffff;
          color: var(--text-main);
        }
      }

      @media (prefers-color-scheme: dark) {
        kbd {
          border: 0.125em solid #333333;
          border: 0.125em solid var(--border);
        }
      }

      @media (prefers-color-scheme: dark) {
        kbd {
          background: #1a1818;
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
        border-top: 0.125em solid #e5e5e5;
        border-top: 0.125em solid var(--border);
      }

      @media (prefers-color-scheme: dark) {
        hr {
          border-top: 0.125em solid #333333;
          border-top: 0.125em solid var(--border);
        }
      }

      table {
        border-collapse: collapse;
        margin-bottom: 0.5em;
        width: 100%;
        table-layout: fixed;
      }

      table caption {
        text-align: left;
      }

      td,
      th {
        padding: 0.25em;
        text-align: left;
        vertical-align: top;
        word-wrap: break-word;
      }

      thead {
        border-bottom: 0.125em solid #e5e5e5;
        border-bottom: 0.125em solid var(--border);
      }

      @media (prefers-color-scheme: dark) {
        thead {
          border-bottom: 0.125em solid #333333;
          border-bottom: 0.125em solid var(--border);
        }
      }

      tfoot {
        border-top: 0.125em solid #e5e5e5;
        border-top: 0.125em solid var(--border);
      }

      @media (prefers-color-scheme: dark) {
        tfoot {
          border-top: 0.125em solid #333333;
          border-top: 0.125em solid var(--border);
        }
      }

      tbody tr:nth-child(even) {
        background-color: #ffffff;
        background-color: var(--background);
      }

      @media (prefers-color-scheme: dark) {
        tbody tr:nth-child(even) {
          background-color: #1a1818;
          background-color: var(--background);
        }
      }

      tbody tr:nth-child(even) button {
        background-color: #f5f5f5;
        background-color: var(--background-alt);
      }

      @media (prefers-color-scheme: dark) {
        tbody tr:nth-child(even) button {
          background-color: #322e2e;
          background-color: var(--background-alt);
        }
      }

      tbody tr:nth-child(even) button:hover {
        background-color: #ffffff;
        background-color: var(--background-body);
      }

      @media (prefers-color-scheme: dark) {
        tbody tr:nth-child(even) button:hover {
          background-color: #1a1818;
          background-color: var(--background-body);
        }
      }

      ::-webkit-scrollbar {
        height: 0.5em;
        width: 0.5em;
      }

      ::-webkit-scrollbar-track {
        background: #ffffff;
        background: var(--background);
        border-radius: 0.25em;
      }

      @media (prefers-color-scheme: dark) {
        ::-webkit-scrollbar-track {
          background: #1a1818;
          background: var(--background);
        }
      }

      ::-webkit-scrollbar-thumb {
        background: rgb(244, 244, 244);
        background: var(--scrollbar-thumb);
        border-radius: 0.25em;
      }

      @media (prefers-color-scheme: dark) {
        ::-webkit-scrollbar-thumb {
          background: #4c4c4c;
          background: var(--scrollbar-thumb);
        }
      }

      @media (prefers-color-scheme: dark) {
        ::-webkit-scrollbar-thumb {
          background: #4c4c4c;
          background: var(--scrollbar-thumb);
        }
      }

      ::-webkit-scrollbar-thumb:hover {
        background: #e5e5e5;
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
        color: #1a1818;
        color: var(--text-bright);
      }

      ::selection {
        background-color: rgba(24, 24, 24, 0.08);
        background-color: var(--selection);
        color: #1a1818;
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
        background-color: #f5f5f5;
        background-color: var(--background-alt);
        padding: 0.5em 0.5em 0;
        margin: 1em 0;
        border-radius: 0.25em;
        overflow: hidden;
      }

      @media (prefers-color-scheme: dark) {
        details {
          background-color: #322e2e;
          background-color: var(--background-alt);
        }
      }

      details[open] {
        padding: 0.5em;
      }

      details > :last-child {
        margin-bottom: 0;
      }

      details[open] summary {
        margin-bottom: 0.5em;
      }

      summary {
        display: list-item;
        background-color: #ffffff;
        background-color: var(--background);
        padding: 0.5em;
        margin: -0.5em -0.5em 0;
        cursor: pointer;
        outline: none;
      }

      @media (prefers-color-scheme: dark) {
        summary {
          background-color: #1a1818;
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
        color: #1a1818;
        color: var(--text-main);
      }

      @media (prefers-color-scheme: dark) {
        summary::-webkit-details-marker {
          color: #ffffff;
          color: var(--text-main);
        }
      }

      dialog {
        background-color: #f5f5f5;
        background-color: var(--background-alt);
        color: #1a1818;
        color: var(--text-main);
        border: none;
        border-radius: 0.25em;
        border-color: #e5e5e5;
        border-color: var(--border);
        padding: 0.5em 1.5em;
      }

      @media (prefers-color-scheme: dark) {
        dialog {
          border-color: #333333;
          border-color: var(--border);
        }
      }

      @media (prefers-color-scheme: dark) {
        dialog {
          color: #ffffff;
          color: var(--text-main);
        }
      }

      @media (prefers-color-scheme: dark) {
        dialog {
          background-color: #322e2e;
          background-color: var(--background-alt);
        }
      }

      dialog > header:first-child {
        background-color: #ffffff;
        background-color: var(--background);
        border-radius: 0.25em 0.25em 0 0;
        margin: -0.5em -1.5em 0.5em;
        padding: 0.5em;
        text-align: center;
      }

      @media (prefers-color-scheme: dark) {
        dialog > header:first-child {
          background-color: #1a1818;
          background-color: var(--background);
        }
      }

      dialog::-webkit-backdrop {
        background: #0000009c;
        -webkit-backdrop-filter: blur(0.25em);
        backdrop-filter: blur(0.25em);
      }

      dialog::backdrop {
        background: #0000009c;
        -webkit-backdrop-filter: blur(0.25em);
        backdrop-filter: blur(0.25em);
      }

      footer {
        position: fixed;
        bottom: 1em;
        right: 1em;
        background: var(--background);
        font-size: 0.75em;
        padding: 0.5em 0.75em;
        border-radius: 0.5em;
        border: 0.125em solid var(--border);
        box-shadow: 0 0.125em 0.25em var(--selection), 0 0 1em var(--selection);
      }

      @media screen and (min-width: 960px) {
        footer {
          bottom: 2em;
          right: 2em;
        }
      }

      footer a {
        display: flex;
        gap: 0.5em;
        align-items: center;
        text-decoration: none;
        color: var(--text-main);
      }

      @media (prefers-color-scheme: dark) {
        footer {
          border-top: 0.125em solid #333333;
          border-top: 0.125em solid var(--border);
        }
      }

      body > footer {
        margin-top: 2em;
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
          border: 0.125em solid #000;
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

      .cover {
        border-radius: 1em;
        margin-bottom: 1em;
      }

      .prelude {
        font-size: 0.75em;
        display: flex;
        flex-direction: column;
        gap: 0.4em;
        border-bottom: 0.125em solid var(--border);
        padding-bottom: 1em;
        margin-bottom: 1em;
      }

      body.chat .prelude {
        padding: 1em;
        flex-direction: row-reverse;
        justify-content: space-between;
        align-items: center;
      }

      @media screen and (min-width: 960px) {
        body.chat .prelude {
          margin: 0;
          position: fixed;
          bottom: 2em;
          left: 2em;
          border: 0;
          background: var(--background);
          font-size: 0.75em;
          padding: 0.5em 0.75em;
          border-radius: 0.5em;
          gap: 1em;
        }
      }

      .prelude .author {
        display: flex;
        align-items: center;
        gap: 0.5em;
        font-weight: 500;
        color: var(--text-muted);
      }

      .prelude .author .avatar {
        border-radius: 0.25em;
        overflow: hidden;
      }

      .prelude .author .avatar img {
        width: 1.5625em;
        height: 1.5625em;
        object-fit: cover;
      }

      .prelude time {
        color: var(--text-muted);
        padding: 0;
      }

      article p:empty {
        display: none;
      }

      article img {
        max-width: 100%;
        border-radius: 0.5em;
      }
      '''
    ::
    ++  heads
      |=  [title=tape img=(unit @t)]
      ;head
        ;title:"{title}"
        ;style:"{(trip style)}"
        ;link(rel "preconnect", href "https://rsms.me");
        ;link(rel "stylesheet", href "https://rsms.me/inter/inter.css");
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
    ++  footer
      ;footer
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
      ;div.prelude
        ;div.published
          ;+  (render-datetime sent.msg)
        ==
        ;+  author-node
      ==
    ::
    ++  diary-prelude
      |=  title=tape
      ^-  marl
      :~  ;h1:"{title}"
          ;div.prelude
            ;div.published
              ;+  (render-datetime sent.msg)
            ==
            ;+  author-node
          ==
      ==
    ::
    ++  heap-prelude
      |=  title=tape
      ^-  marl
      =-  ?:  =("" title)  [-]~
          :-  ;h1:"{title}"
          [-]~
      ;div.prelude
        ;div.published
          ;+  (render-datetime sent.msg)
        ==
        ;+  author-node
      ==
    ::
    ++  author-node
      ^-  manx
      =*  author  author.msg
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
    ++  render-datetime
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
    ++  first-inline
      |=  content=story:d
      ^-  (list inline:d)
      ?~  content  ~
      ?:  ?=(%inline -.i.content)
        p.i.content
      ?+  -.p.i.content  $(content t.content)
        %header   q.p.i.content  ::REVIEW  questionable
      ::
          %listing
        |-
        ?-  -.p.p.i.content
          %list  ::TODO  or check listing first?
                 ?.  =(~ r.p.p.i.content)
                   r.p.p.i.content
                 ?~  q.p.p.i.content  ~
                 =/  r  $(p.p.i.content i.q.p.p.i.content)
                 ?.  =(~ r)  r
                 $(q.p.p.i.content t.q.p.p.i.content)
          %item  p.p.p.i.content
        ==
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
  --
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
  [~ this(state !<(state-0 ole))]
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+  mark  !!  ::TODO  support json pokes
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
        =/  url=@t  (cat 3 '/expose' (spat path.act))
        :_  this  :_  ~
        %+  store:hutils  url
        `[| %payload (paint:hutils %page u.pag)]
      ::
          %hide
        =/  ref=cite:c
          (parse:c path.act)
        ?.  (~(has in open) ref)
          [~ this]
        =.  open    (~(del in open) ref)
        =/  url=@t  (cat 3 '/expose' (spat path.act))
        :_  this  :_  ~
        %+  store:hutils  url
        :^  ~  |  %payload
        [[404 ~] `(as-octs:mimes:html 'not found')]
      ==
    ==
  ::
      %handle-http-request
    =+  !<([rid=@ta inbound-request:eyre] vase)
    :_  this
    =;  payload=simple-payload:http
      :_  (spout:hutils rid payload)
      ::  if we handled a request here, make sure it's cached for next time
      ::
      [%pass /eyre/cache %arvo %e %set-response url.request `[| %payload payload]]
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
  ==
::
++  on-leave  |=(* [~ this])
++  on-agent  |=(* [~ this])
++  on-peek   |=(* ~)  ::TODO  support scrying to see if it's published
::
++  on-fail
  |=  [=term =tang]
  ^-  (quip card _this)
  %.  [~ this]
  (slog dap.bowl 'on-fail' term tang)
--
