::  de-html: tolerant-ish html parser
::
::    modified from +de-xml:html on an as-needed basis.
::    don't rely on this to be able to parse any html page (yet).
::
::    expansions compared to +de-xml:html include broader support for:
::    - implicitly self-closing tags (like <br>)
::    - tags with plaintext bodies (like <script>)
::    - all html5 &entities;
::    - tag attributes without quotes
::    - whitespace in attributes
::    - counting CR as valid whitespace
::    - allowing stand-alone ampersands (in +escp)
::
::    purely for reference, consider the syntax spec and
::    related parts of the html living standard docs.
::    https://html.spec.whatwg.org/multipage/syntax.html
::    we don't claim to be matching it tightly anywhere,
::    but may refer to it occasionally.
::
/+  entities=de-html-entities
::
=<  |=(a=cord (rush a apex))
|_  ent=(map @t @t)  ::REVIEW  can you bring-your-own in html?
::                                                  ::  ++apex
++  apex                                            ::  top level
  =+  spa=;~(pose comt whit)
  %+  knee  *manx  |.  ~+
  %+  ifix
    [;~(plug (more spa decl) (star spa)) (star spa)]
  ::NOTE  the order of this pose has been tuned to avoid degenerate cases.
  ::      if we tried "with child nodes" before "implicit self-closing",
  ::      we could spend the whole document looking for a closing tag that
  ::      never comes, only learning that fate when we reach eof.
  ::      trying "implicit self-closing" first has us maybe proceed under
  ::      a false assumption, but we learn that much earlier: as soon as we
  ::      encounter an unexpected close tag.
  ::TODO  there's probably a lesson in there about wanting something more
  ::      "progressive" than a dumb pose.
  ::TODO  play around with order just a little bit more
  ;~  pose
    ::  explicitly self-closing
    ::
    empt
    ::  implicitly self-closing
    ::
    ::    aka "void elements", see also:
    ::    https://html.spec.whatwg.org/multipage/syntax.html#elements-2
    ::
    ::NOTE  we try this _first_ because otherwise we may spend a lot of time
    ::      parsing the rest of the input while looking for the matching
    ::      closing tag that never comes. this means we have the opposite
    ::      problem, where if it _does_ self-close we "wasted" this parsing
    ::      attempt, but that only makes us twice as slow (in that case)
    ::      instead of disgustingly degenerate (in the seek-closing case).
    ::
    %+  sear
      |=  a=marx
      ?.  ?=  $?  %area  %base   %br    %col   %embed   %hr
                  %img   %input  %link  %meta  %source  %track  %wbr
              ==
          n.a
        ~
      (some [a ~])
    head
  ::
    ::  with plaintext child nodes
    ::
    ::    aka "raw text elements", see also:
    ::    https://html.spec.whatwg.org/multipage/syntax.html#elements-2
    ::
    |=  =nail
    ^-  (like manx)
    =/  heg=(like marx)  (head nail)
    ?~  q.heg
      (fail nail)
    ?.  ?=(?(%script %style) n.p.u.q.heg)
      ::  should not parse as plaintext
      ::
      (fail nail)
    ::  plaintext until the matching closing tag
    ::NOTE  +find-ing is faster than a +less-based parser
    ::
    =*  rest            q.u.q.heg
    =/  tail=tape       "</{(trip n.p.u.q.heg)}>"
    =/  end=(unit @ud)  (find tail q.rest)
    ?~  end  (fail rest)
    %.  rest
    %+  cook
      |=(a=tape `manx`[`marx`p.u.q.heg `marl`[[%$ [%$ a]~] ~]~])
    ;~(sfix (stun [. .]:u.end next) (jest (crip tail)))
  ::
    ::  with child nodes
    ::
    %+  sear
      |=([a=marx b=marl c=mane] ?.(=(c n.a) ~ (some [a b])))
    ;~(plug head many tail)
  ::
  ::

  ==
::                                                  ::  ++attr
++  attr                                            ::  attributes
  %+  knee  *mart  |.  ~+
  %-  star
  ;~  plug
    ;~(pfix (plus whit) name)
    ;~  pose
      %+  ifix
        :_  doq
        ;~(plug (ifix [. .]:(star whit) tis) doq)
      (star ;~(less doq escp))
    ::
      %+  ifix
        :_  soq
        ;~(plug (ifix [. .]:(star whit) tis) soq)
      (star ;~(less soq escp))
    ::
      %+  ifix
        :_  (easy ~)
        (ifix [. .]:(star whit) tis)
      (plus ;~(less gah doq soq tis gal gar tic escp))
    ::
      (easy ~)
    ==
  ==
::                                                  ::  ++cdat
++  cdat                                            ::  CDATA section
  %+  cook
    |=(a=tape ^-(mars ;/(a)))
  %+  ifix
    [(jest '<![CDATA[') (jest ']]>')]
  %-  star
  ;~(less (jest ']]>') next)
::                                                  ::  ++chrd
++  chrd                                            ::  character data
  %+  cook  |=(a=tape ^-(mars ;/(a)))
  (plus ;~(pose (just `@`10) escp))  ::REVIEW  whitespace?
::                                                  ::  ++comt
++  comt                                            ::  comments
  =-  (ifix [(jest '<!--') (jest '-->')] (star -))
  ;~  pose
    ;~(less hep prn)
    whit
    ;~(less (jest '-->') hep)
  ==
::
++  decl                                            ::  ++decl
  %+  ifix                                          ::  XML declaration
    [(jest '<?xml') (jest '?>')]
  %-  star
  ;~(less (jest '?>') prn)
::                                                  ::  ++escp
++  escp                                            ::
  :: ;~(pose ;~(less gal gar pam prn) enty)
  :: ;~(pose ;~(less gal gar pam ;~(pose prn whit)) enty)
  ::REVIEW  should put +whit into other +prn callsites too? (or +prin)
  ;~(pose ;~(less gal gar enty ;~(pose prn whit)) enty)
::                                                  ::  ++enty
++  enty                                            ::  entity
  %+  ifix  pam^mic
  ;~  pose
    %+  sear  ~(get by (~(uni by entities) ent))
    (cook crip ;~(plug alf (stun 1^31 aln)))
    %+  cook  |=(a=@c ?:((gth a 0x10.ffff) '�' (tuft a)))
    =<  ;~(pfix hax ;~(pose - +))
    :-  (bass 10 (stun 1^8 dit))
    (bass 16 ;~(pfix (mask "xX") (stun 1^8 hit)))
  ==
::                                                  ::  ++empt
++  empt                                            ::  self-closing tag
  %+  ifix  [gal (jest '/>')]
  ;~(plug ;~(plug name attr) (cold ~ (star whit)))
::                                                  ::  ++head
++  head                                            ::  opening tag
  (ifix [gal gart] ;~(plug name attr))
::                                                  ::  ++many
++  many                                            ::  contents
  ;~(pfix (star comt) (star ;~(sfix ;~(pose apex chrd cdat) (star comt))))
::                                                  ::  ++name
++  name                                            ::  tag name
  =+  ^=  chx
      %+  cook  crip
      ;~  plug
          ;~(pose cab alf)
          (star ;~(pose cab dot alp))
      ==
  ;~(pose ;~(plug ;~(sfix chx col) chx) chx)
::                                                  ::  ++tail
++  tail                                            ::  closing tag
  (ifix [(jest '</') gart] name)
::                                                  ::  ++gart
++  gart                                            ::  closing gar
  ;~(pfix (star whit) gar)
::                                                  ::  ++whit
++  whit                                            ::  whitespace
  :: (mask ~[' ' `@`0x9 `@`0xa])
  (mask ~[' ' `@`0x9 `@`0xa `@`0xc `@`0xd])  ::  "ascii whitespace"
::
::  fallback "parsing"
::
++  extract
  |=  [tag=tape mode=?(%outer %inner)]
  |=  dat=tape
  ^-  (unit @t)
  ::  for %outer, we do a possibly-too-broad search, just so we can catch
  ::  cases like <tag attr="etc">, at the cost of also finding "<tagged>".
  ::  for %inner, we need to know what length string we found, so we can
  ::  skip past it for extractions.
  ::  this is sufficient for our purposes for now.
  ::
  =/  hin=(unit @ud)  (find "<{tag}{?:(?=(%outer mode) "" ">")}" dat)
  =/  tin=(unit @ud)  (find "</{tag}>" dat)
  =?  tin  ?=(~ tin)  (find "</ {tag}>" dat)
  ?.  &(?=(^ hin) ?=(^ tin))  ~
  ?:  (gte u.hin u.tin)       ~
  %-  some
  %-  crip
  ?-  mode
      %outer
    %+  weld
      (swag [u.hin (sub u.tin u.hin)] dat)
    "</{tag}>"
  ::
      %inner
    =.  u.hin  :(add u.hin (lent tag) 2)
    (swag [u.hin (sub u.tin u.hin)] dat)
  ==
--
