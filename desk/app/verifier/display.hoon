::  verifier: display: render clearweb attestation page
::
/-  verifier
/+  hu=http-utils
=,  (verifier)
::
|=  [invite=(unit @t) full=? tat=attestation]
^-  octs
%-  press:hu
^-  manx
|^  ;html
      ;+  head
      ;+  body
    ==
::
::  building blocks
::
++  attest-date
  =*  when  when.dat.half.tat
  (scow %da when)
::
++  nice-date
  =*  when  when.dat.half.tat
  =,  chrono:userlib
  =/  =date  (yore when)
  "{(snag (dec m.date) mon:yu)} {(a-co:co d.t.date)}, {(a-co:co y.date)}"
::
++  owner
  (scow %p for.dat.half.tat)
::
++  registration-kind
  (trip kind.dat.half.tat)
::
++  text-id
  %-  trip
  ?.  full
    ?-  kind.dat.half.tat
      %dummy    '*******'
      %urbit    '~••••••-••••••'
      %phone    '+(•••) ••• ••••'
      %twitter  '@???????'
      %website  '?????.???'
    ==
  =*  id  id.dat.full.tat
  ?-  -.id.dat.full.tat
    %dummy    (rap 3 '"' +.id '"' ~)
    %urbit    (scot %p +.id)
    %phone    +.id  ::NOTE  no formatting...
    %twitter  (cat 3 '@' +.id)
    %website  (en-turf:html +.id)
  ==
::
++  text-description
  %-  trip
  ?.  full
    ?-  kind.dat.half.tat
      %dummy    'a dummy identifier'
      %urbit    'another urbit'
      %phone    'a phone number'
      %twitter  'an x.com account'
      %website  'a website'
    ==
  =*  id  id.dat.full.tat
  ?-  -.id.dat.full.tat
    %dummy    (cat 3 'dummy id ' +.id)
    %urbit    (cat 3 'control over ' (scot %p +.id))
    %phone    (cat 3 'phone nr ' +.id)
    %twitter  (cat 3 'x.com account @' +.id)
    %website  (cat 3 'control over ' (en-turf:html +.id))
  ==
::
++  id-link
  ?.  full  "#"
  =*  id  id.dat.full.tat
  ?-  -.id.dat.full.tat
    %dummy    "#"
    %urbit    "#"  ::TODO  dm link?
    %phone    "#"
    %twitter  "https://x.com/{(trip +.id)}"
    %website  "https://{(trip (en-turf:html +.id))}"
  ==
::
++  current-sig
  ?:(full sig.full.tat sig.half.tat)
::
::  head: meta and styling
::
++  head
  |^  ;head
        ;meta(charset "utf-8");
        ;title:"{title}"
        ;*  preview-meta
        ;style:"{style}"
      ==
  ::
  ++  title
    "{registration-kind} attestation"
  ::
  ++  image  "https://i.imgur.com/LHKlBuY.png"
  ++  preview-meta
    ^-  marl
    :*  ;meta(property "og:title", content title);
        ;meta(property "og:description", content text-description);
        ;meta(property "og:image", content image);
      ::
        ::REVIEW  twitter docs say these are optional if you have the
        ::        corresponding opengraph tag...
        ;meta(name "twitter:title", content title);
        ;meta(name "twitter:description", content text-description);
        ;meta(name "twitter:image", content image);
        ;meta(name "twitter:site", content "@tloncorporation");
        ;meta(name "twitter:card", content "summary_large_image");
      ::
        ?.  &(full ?=(%twitter -.id.dat.full.tat))  ~
        :_  ~
        ;meta(name "twitter:author", content text-id);
    ==
  ::
  ++  style
    %-  trip
    '''
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #1A1818;
      max-width: 600px;
      margin: 0 auto;
      padding: 2rem;
      background-color: #F5F5F5;
    }

    #owner {
      font-size: 1.5rem;
      font-weight: 600;
      color: #1A1818;
      margin-bottom: 1rem;
    }

    #timestamp {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 2rem;
      font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace;
      text-transform: uppercase;
    }

    #full-details {
      margin-top: 1rem;
      background-color: white;
      padding: 1.5rem;
      border-radius: 1rem 1rem;
      font-size: 1.25rem;
    }

    #full-details h3 {
      font-size: 0.75rem;
      font-weight: 500;
      font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 1rem;
    }

    #full-details dl {
      display: flex;
      flex-direction: row;
      gap: 1rem;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 0.5rem;
    }

    @media (max-width: 600px) {
      #full-details dl {
        flex-direction: column;
      }
    }

    #full-details dt {
      font-weight: 500;
      font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace;
      text-transform: uppercase;
      color: #666;
      font-size: 0.75rem;
    }

    #full-details dd {
      margin: 0;
      font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace;
      font-size: 0.875rem;
      color: #1A1818;
    }

    .signature-hex {
      font-family: Menlo, Consolas, Monaco, Liberation Mono, Lucida Console, monospace;
      width: 30ch;
      text-indent: -2ch;
      user-select: all;
    }


    .signature-hex::after {
      content: '';
      display: block;
      width: 20ch;
    }

    #tlon-button {
      display: block;
      width: 100%;
      padding: 1rem;
      background-color: #1A1818;
      color: white;
      text-align: center;
      border-radius: 1rem;
      text-decoration: none;
      font-weight: 500;
      margin-top: 2rem;
      font-size: 0.9rem;
    }
    '''
  --
::
::  body: page layout
::
++  body
  |^  ;body
        ;div(id "owner"):"{owner}"
        ;div(id "timestamp"):"Proof of attestation on {nice-date}"
        ;div(id "full-details")
          ;h3:"Details"
          ;dl
            ;dt(title "The actual identifier value (phone number, X account, etc.)"):"Value"
            ;dd:"{text-id}"
          ==
          ;dl
            ;dt(title "A human-readable description of what was verified"):"Description"
            ;dd:"{text-description}"
          ==
          ;dl
            ;dt(title "The ship that owns/controls this identifier"):"Owner"
            ;dd:"{owner}"
          ==
          ;dl
            ;dt(title "The ship that performed this verification"):"Verified by"
            ;dd:"{(scow %p who.half.tat)}"
          ==
          ;dl
            ;dt(title "When the verification was completed"):"Timestamp"
            ;dd:"{attest-date}"
          ==
          ;dl(id "signature")
            ;dt(title "The cryptographic signature proving this verification"):"Signature Hex"
            ;dd.signature-hex
              ::  for the first "block" (two bytes), leading zeroes shouldn't
              ::  show up in text selection.
              ::
              ;*  :+  ;span:"0x"
                ;span(style "user-select: none;"):"{(reap (sub 4 (mod (met 2 current-sig) 4)) '0')}"
              =+  blocks=(rip 4 current-sig)
              ?:  =(~ blocks)  [;span:"0"]~
              :-  ;span:"{((x-co:co 1) (rear blocks))}"
              ::  for everything after, render as double-byte blocks with dots
              ::  in between, manually line-breaking every six blocks.
              ::
              =-  (flop spans)
              %+  roll  (tail (flop blocks))
              |=  [seg=@ n=@ud spans=(list manx)]
              :-  (mod +(n) 6)
              ^-  (list manx)
              =*  ren  ((x-co:co 4) seg)
              ?.  =(5 n)
                [;span:".{ren}" spans]
              [;span:"{ren}" ;br(style "user-select: none;"); ;span:"." spans]
            ==
          ==
        ==
        ;+  tlon-button
      ==
  ::
  ++  text
    "Verified that {owner} has {text-description} on {nice-date}."
  ::
  ++  tlon-button
    ^-  manx
    =;  [url=tape msg=tape]
      ;a(href url, id "tlon-button"):"{msg}"
    =/  url=tape
      (trip (fall invite ''))
    ?:  =(`0 (find "https://tlon.network/" url))
      [url "DM {owner} on Tlon Messenger"]
    ["https://tlon.io" "Not on Tlon Messenger? Join now"]
  --
--
