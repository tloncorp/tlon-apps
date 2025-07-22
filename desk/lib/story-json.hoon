/-  s=story
/+  cj=cite-json
=*  z  ..zuse
|%
++  enjs
  =,  enjs:format
  |%
  ++  story
    |=  s=story:s
    ^-  json
    a+(turn s verse)
  ++  verse
      |=  =verse:s
      ^-  json
      %+  frond  -.verse
      ?-  -.verse
          %block  (block p.verse)
          %inline  a+(turn p.verse inline)
      ==
  ++  block
    |=  b=block:s
    ^-  json
    %+  frond  -.b
    ?-  -.b
        %rule  ~
        %cite  (enjs:cj cite.b)
        %listing  (listing p.b)
        %header
      %-  pairs
      :~  tag+s+p.b
          content+a+(turn q.b inline)
      ==
        %image
      %-  pairs
      :~  src+s+src.b
          height+(numb height.b)
          width+(numb width.b)
          alt+s+alt.b
      ==
        %code
      %-  pairs
      :~  code+s+code.b
          lang+s+lang.b
      ==
        %link
      %-  pairs
      :~  url+s+url.b
          meta+o+(~(run by meta.b) (lead %s))
      ==
    ==
  ::
  ++  listing
    |=  l=listing:s
    ^-  json
    %+  frond  -.l
    ?-  -.l
        %item  a+(turn p.l inline)
        %list
      %-  pairs
      :~  type+s+p.l
          items+a+(turn q.l listing)
          contents+a+(turn r.l inline)
      ==
    ==
  ::
  ++  inline
    |=  i=inline:s
    ^-  json
    ?@  i  s+i
    %+  frond  -.i
    ?-  -.i
      %break  ~
    ::
      %ship  s+(scot %p p.i)
    ::
      %sect  ?~(p.i ~ s+p.i)
    ::
        ?(%code %tag %inline-code)
      s+p.i
    ::
        ?(%italics %bold %strike %blockquote)
      :-  %a
      (turn p.i inline)
    ::
        %block
      %-  pairs
      :~  index+(numb p.i)
          text+s+q.i
      ==
    ::
        %link
      %-  pairs
      :~  href+s+p.i
          content+s+q.i
      ==
        %task
      %-  pairs
      :~  checked+b+p.i
          content+a+(turn q.i inline)
      ==
    ==
  --
++  dejs
  =,  dejs:format
  |%
  ++  ship  `$-(json ship:z)`(su ship-rule)
  ++  ship-rule  ;~(pfix sig fed:ag)
  ::
  ++  story  (ar verse)
  ::
  ++  verse
    ^-  $-(json verse:s)
    %-  of
    :~  block/block
        inline/(ar inline)
    ==
  ::
  ++  block
    |=  j=json
    ^-  block:s
    %.  j
    %-  of
    :~  rule/ul
        cite/dejs:cj
        listing/listing
    ::
      :-  %code
      %-  ot
      :~  code/so
          lang/(se %tas)
      ==
    ::
      :-  %header
      %-  ot
      :~  tag/(su (perk %h1 %h2 %h3 %h4 %h5 %h6 ~))
          content/(ar inline)
      ==
    ::
      :-  %image
      %-  ot
      :~  src/so
          height/ni
          width/ni
          alt/so
      ==
    ::
      :-  %link
      %-  ot
      :~  url+so
          meta+(om so)
      ==
    ==
  ::
  ++  listing
    |=  j=json
    ^-  listing:s
    %.  j
    %-  of
    :~
      item/(ar inline)
      :-  %list
      %-  ot
      :~  type/(su (perk %ordered %unordered %tasklist ~))
          items/(ar listing)
          contents/(ar inline)
      ==
    ==
  ::
  ++  inline
    |=  j=json
    ^-  inline:s
    ?:  ?=([%s *] j)  p.j
    =>  .(j `json`j)
    %.  j
    %-  of
    :~  italics/(ar inline)
        bold/(ar inline)
        strike/(ar inline)
        blockquote/(ar inline)
        ship/ship
        sect/(maybe (se %tas))
        inline-code/so
        code/so
        tag/so
        break/ul
    ::
      :-  %block
      %-  ot
      :~  index/ni
          text/so
      ==
    ::
      :-  %link
      %-  ot
      :~  href/so
          content/so
      ==
    ::
      :-  %task
      %-  ot
      :~  checked/bo
          content/(ar inline)
      ==
    ==
  ::
  ++  maybe
    |*  wit=fist
    |=  jon=json
    ?~(jon ~ (wit jon))
  ::
  ++  v0  v0:ver
  ++  ver
    |%
    ++  v0
      |%
      ++  story  (ar verse)
      ++  verse
        ^-  $-(json verse:v0:ver:s)
        %-  of
        :~  block+block
            inline+(ar inline)
        ==
      ::
      ++  inline
        |=  j=json
        ^-  inline:v0:ver:s
        ?:  ?=([%s *] j)  p.j
        =>  .(j `json`j)
        %.  j
        %-  of
        :~  italics/(ar inline)
            bold/(ar inline)
            strike/(ar inline)
            blockquote/(ar inline)
            ship/ship
            inline-code/so
            code/so
            tag/so
            break/ul
        ::
          :-  %block
          %-  ot
          :~  index/ni
              text/so
          ==
        ::
          :-  %link
          %-  ot
          :~  href/so
              content/so
          ==
        ::
          :-  %task
          %-  ot
          :~  checked/bo
              content/(ar inline)
          ==
        ==
      ::
      ++  listing
        |=  j=json
        ^-  listing:v0:ver:s
        %.  j
        %-  of
        :~
          item/(ar inline)
          :-  %list
          %-  ot
          :~  type/(su (perk %ordered %unordered %tasklist ~))
              items/(ar listing)
              contents/(ar inline)
          ==
        ==
      ::
      ++  block
        ^-  $-(json block:v0:ver:s)
        %-  of
        :~  rule/ul
            cite/dejs:cj
            listing/listing
        ::
          :-  %code
          %-  ot
          :~  code/so
              lang/(se %tas)
          ==
        ::
          :-  %header
          %-  ot
          :~  tag/(su (perk %h1 %h2 %h3 %h4 %h5 %h6 ~))
              content/(ar inline)
          ==
        ::
          :-  %image
          %-  ot
          :~  src/so
              height/ni
              width/ni
              alt/so
          ==
        ==
      --
    --
  --
--
