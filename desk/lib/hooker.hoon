/-  h=hooker, c=channels
/+  cj=channel-json
=*  z  ..zuse
|%
++  enjs
  =,  enjs:format
  |%
  ::
  +|  %primitives
  ++  ship
    |=  s=ship:z
    s+(scot %p s)
  ::
  :: +|  %basics
  ::
  :: +|  %action
  ::
  :: +|  %updates
  ::
  --
::
++  dejs
  =,  dejs:format
  |%
  +|  %primitives
  ++  ship  `$-(json ship:z)`(su ship-rule)
  ++  ship-rule  ;~(pfix sig fed:ag)
  ++  transformer
    %-  su
    %-  perk
    :~  %direct
        %github
        %linear
    ==
  +|  %action
  ++  command
    ^-  $-(json command:h)
    %-  of
    :~  message/message
        store/store
    ==
  ::
  ::
  ++  message
    %-  ot
    :~  nest/nest:dejs:cj
        story/story:dejs:cj
    ==
  ::
  ++  store
    %-  ot
    :~  key/so
        data/(om so)
    ==
  ::
  --
++  github
  |%
  ++  pull-request
    |=  =request:http
    ^-  command:h
    ?>  ?=(^ body.request)
    =/  json  (de:json:html q.u.body.request)
    ?~  json  ~|(['bad json' `@t`q.u.body.request] !!)
    ~|  "unable to decode json: {<`@t`q.u.body.request>}"
    =/  pr=pull-request:github:h  (pull-request:dejs u.json)
    :: ?~  pr  ~|(['unable to decode json' `@t`q.u.body.request] !!)
    ~&  "pull-request: {<pr>}"
    =/  =story:c
      :~  :-  %inline
          :~  [%bold user.pr.pr ' ' ~]
              action.pr
              ' '
              [%link url.pr.pr (crip "{(trip repository.pr)}#{<number.pr>}")]
              [%break ~]
              [%bold 'reviewers: ' ~]
              (crip (join ', ' reviewers.pr.pr))
              [%break ~]
              [%break ~]
              [%bold ~[title.pr.pr ?.(draft.pr.pr '' '(draft)')]]
              [%break ~]
              [%blockquote body.pr.pr ~]
          ==
      ==
    [%message [%chat ~bitpyx-dildus %interface] story]
  ++  dejs
    =,  dejs:format
    |%
    ++  user  (ou login/(un so) ~)
    ++  pull-request
      %-  ou
      :~  action/(un (su (perk %opened %reopened %closed ~)))
          number/(un ni)
          repository/(un repository)
          [%'pull_request' (un pull-request-inner)]
      ==
    ++  pull-request-inner
      %-  ou
      :~  [%'html_url' (un so)]
          title/(un so)
          body/(un so)
          draft/(un bo)
          user/(un user)
          [%'requested_reviewers' (un (ar user))]
      ==
    ++  repository  (ou [%'full_name' (un so)] ~)
    --
  --
--
