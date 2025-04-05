::  verifier: display: render clearweb attestation page
::
/-  verifier
/+  hu=http-utils
=,  (verifier)
::
|=  [full=? tat=attestation]
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
  %+  scow  %da
  =*  when  when.dat.half.tat
  (sub when (mod when ~d1))
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
::  head: meta and styling
::
++  head
  |^  ;head
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
    * { border: 1px solid red; text-align: center; margin: 2px; }
    '''
  --
::
::  body: page layout
::
++  body
  |^  ;body
        ;div(id "owner"):"{owner}"
        ;div(id "timestamp"):"{attest-date}"
        ;div(id "description", class registration-kind)
          ;a(href id-link)
            ; {text-description}
          ==
        ==
        ;div(id "etc"):"{text}"
      ==
  ::
  ++  text
    "verified that {owner} has {text-description} on {attest-date}."
  --
--
