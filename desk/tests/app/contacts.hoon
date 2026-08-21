/-  *contacts, c0=contacts-0
/+  *test-negotiate-agent
/+  c=contacts
/=  contacts-agent  /app/contacts
=*  agent  contacts-agent
::  XX consider simplifying tests
::  with functional 'micro' strands, that set
::  a contact, subscribe to a peer etc.
::
|%
::
+$  state-3
  $:  %3
      rof=profile
      =book
      =peers
      last-updated=(list [=kip =time])
      retry=(map ship @da)  ::  retry sub at time
  ==
::
++  tick  ^~((rsh 3^2 ~s1))
++  mono
  |=  [old=@da new=@da]
  ^-  @da
  ?:  (lth old new)  new
  (add old tick)
::
++  contact-nickname
  |=  nickname=@t
  ^-  contact
  %-  malt
  ^-  (list (pair @tas value))
  ~[nickname+text/nickname bio+text/'The good ship']
::
++  ex-cage
  |=  [actual=cage expected=cage]
  =/  m  (mare ,~)
  ;<  ~  bind:m  (ex-equal !>(p.actual) !>(p.expected))
  (ex-equal q.actual q.expected)
::  +fake-sub: manually register a subscription in .wex, bypassing the
::  normal %watch flow. used to simulate a wire/dock pairing that the
::  agent itself would never actually construct (e.g. an impostor), so
::  we can prove a trust check holds even if it were ever reachable.
::
++  fake-sub
  |=  [=wire =ship =term =path]
  %-  jab-bowl
  |=  b=bowl
  b(wex (~(put by wex.b) [wire ship term] [| path]))
::  +test-poke-0-anon: v0 delete the profile
::
++  test-poke-0-anon
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =|  con-0=contact-0:c0
  =.  nickname.con-0  'Zod'
  =.  bio.con-0  'The first of the galaxies'
  ::
  =/  con-1=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Zod' bio+text/'The first of the galaxies']
  =/  edit-0=(list field-0:c0)
    ^-  (list field-0:c0)
    :~  nickname+'Zod'
        bio+'The first of the galaxies'
    ==
  ::  foreign subscriber to /v1/contact
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b  (do-watch /v1/contact)
  ::  local subscriber to /news
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-watch /news)
  ::
  ;<  ~  b  (set-src our.bowl)
  ::  action-0:c0 profile %edit
  ::
  ;<  caz=(list card)  b  (do-poke contact-action+!>([%edit edit-0]))
  ::
  =/  upd-0=update-0:c0
    [%full (add now.bowl (mul 2 tick)) ~]
  =/  upd-1=update
    [%full (add now.bowl (mul 2 tick)) ~]
  ;<  caz=(list card)  b  (do-poke contact-action+!>([%anon ~]))
  %+  ex-cards  caz
  :~  (ex-fact ~[/news] contact-news+!>([our.bowl ~]))
      (ex-fact ~[/v1/news] contact-response-0+!>([%self ~]))
      (ex-fact ~[/v1/contact] contact-update-1+!>(upd-1))
  ==
::  +test-poke-0-edit: v0 edit the profile
::
++  test-poke-0-edit
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =|  con-0=contact-0:c0
  =.  nickname.con-0  'Zod'
  =.  bio.con-0  'The first of the galaxies'
  =.  groups.con-0  (silt ~sampel-palnet^%oranges ~)
  ::
  =/  con=contact
    %-  malt
    ^-  (list (pair @tas value))
    :~  nickname+text/'Zod'
        bio+text/'The first of the galaxies'
        groups+set/(silt flag/~sampel-palnet^%oranges ~)
    ==
  ::
  =/  edit-0=(list field-0:c0)
    ^-  (list field-0:c0)
    :~  nickname+'Zod'
        bio+'The first of the galaxies'
        add-group+~sampel-palnet^%apples
        add-group+~sampel-palnet^%oranges
        del-group+~sampel-palnet^%apples
    ==
  ::  foreign subscriber to /v1/contact
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b  (do-watch /v1/contact)
  ::  local subscriber to /news
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-watch /news)
  ::  local subscriber to /v1/news
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-watch /v1/news)
  ::
  ;<  ~  b  (set-src our.bowl)
  ::  action-0:c0 profile %edit
  ::
  ;<  caz=(list card)  b  (do-poke %contact-action !>([%edit edit-0]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/news] contact-news+!>([our.bowl con-0]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%self con]))
        (ex-fact ~[/v1/contact] contact-update-1+!>([%full `@da`(add now.bowl tick) con]))
    ==
  ::  profile is set
  ::
  ;<  peek=(unit (unit cage))  b
    (get-peek /x/v1/self)
  ;<  ~  b
    %+  ex-cage  (need (need peek))
    contact-1+!>(con)
  ::  change groups
  ::
  ;<  caz=(list card)  b
    (do-poke %contact-action !>([%edit del-group+~sampel-palnet^%oranges ~]))
  =/  new-con
    (~(put by con) groups+set/~)
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/news] contact-news+!>([our.bowl con-0(groups ~)]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%self new-con]))
        (ex-fact ~[/v1/contact] contact-update-1+!>([%full (add now.bowl (mul 2 tick)) new-con]))
    ==
  ::  remove bio
  ::
  ;<  caz=(list card)  b
    (do-poke %contact-action-1 !>([%self `contact`[%bio^~ ~ ~]]))
  ::  add oranges back
  ::
  ;<  caz=(list card)  b
    (do-poke %contact-action !>([%edit add-group+~sampel-palnet^%oranges ~]))
  ::  profile is missing bio
  ::
  ;<  peek=(unit (unit cage))  b
    (get-peek /x/v1/self)
  %+  ex-cage  (need (need peek))
  contact-1+!>(`contact`(~(del by con) %bio))
::  +test-poke-meet-0: v0 meet a peer
::
++  test-poke-0-meet
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::  v0 %meet is no-op
  ::
  ;<  caz=(list card)  b  (do-poke %contact-action !>([%meet ~[~sun]]))
  (ex-cards caz ~)
::  +test-poke-heed-0: v0 heed a peer
::
++  test-poke-0-heed
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  :: ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  :: ;<  =bowl  b  get-bowl
  ::  v0 %heed is the new %meet
  ::
  :: ;<  caz=(list card)  b  (do-poke %contact-action !>([%heed ~[~sun]]))
  :: %+  ex-cards  caz
  :: :~  (ex-task /contact [~sun %contacts] %watch /v1/contact)
  ::     (ex-fact ~[/news] contact-news+!>([~sun ~]))
  ::     (ex-fact ~[/v1/news] contact-response-0+!>([%peer ~sun ~]))
  :: ==
  (pure:m ~)
::  +test-poke-anon: delete the profile
::
++  test-poke-anon
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =/  con-1=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Zod' bio+text/'The first of the galaxies']
  ::
  =/  edit-1  con-1
  ::  foreign subscriber to /contact
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b  (do-watch /v1/contact)
  ::  local subscriber to /news
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-watch /v1/news)
  ::
  ;<  ~  b  (set-src our.bowl)
  ::  edit the profile
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%self con-1]))
  ::  delete the profile
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%anon ~]))
  ::  contact update is published on /v1/contact
  ::  news is published on /news, /v1/news
  ::
  ;<  ~  b  %+  ex-cards  caz
    :~  (ex-fact ~[/news] contact-news+!>([our.bowl ~]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%self ~]))
        (ex-fact ~[/v1/contact] contact-update-1+!>([%full (add now.bowl (mul 2 tick)) ~]))
    ==
  ::  v0: profile is empty
  ::
  ;<  peek=(unit (unit cage))  b
    (get-peek /x/contact/(scot %p our.bowl))
  ;<  ~  b
    %+  ex-equal
    !>((need peek))
    !>(~)
  ::  profile is empty
  ::
  ;<  peek=(unit (unit cage))  b
    (get-peek /x/v1/self)
  =/  cag  (need (need peek))
  (ex-cage cag contact-1+!>(`contact`~))
::  +test-poke-self: change the profile
::
++  test-poke-self
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =|  con-0=contact-0:c0
  =.  nickname.con-0  'Zod'
  =.  bio.con-0  'The first of the galaxies'
  ::
  =/  con-1=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Zod' bio+text/'The first of the galaxies']
  ::
  =/  upd-0=update-0:c0
    [%full (add now.bowl tick) con-0]
  =/  upd-1=update
    [%full (add now.bowl tick) con-1]
  =/  edit-1  con-1
  ::  foreign subscriber to /contact
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b  (do-watch /v1/contact)
  ::  local subscriber to /news
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-watch /v1/news)
  ::
  ;<  ~  b  (set-src our.bowl)
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%self con-1]))
  %+  ex-cards  caz
  :~  (ex-fact ~[/news] contact-news+!>([our.bowl con-0]))
      (ex-fact ~[/v1/news] contact-response-0+!>([%self con-1]))
      (ex-fact ~[/v1/contact] contact-update-1+!>(upd-1))
  ==
::  +test-poke-page: create new contact page
::
++  test-poke-page
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =/  con-1=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Sun' bio+text/'It is bright today']
  ::
  =/  resp=response
    [%page id+0v1 ~ con-1]
  =/  mypage=page:c
    [p=~ q=con-1]
  ::  local subscriber to /news
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-watch /v1/news)
  ::
  ;<  ~  b  (set-src our.bowl)
  ::  create new contact page
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%page id+0v1 con-1]))
  ::  news is published on /v1/news
  ::
  ;<  ~  b  %+  ex-cards  caz
    :~  (ex-fact ~[/v1/news] contact-response-0+!>(resp))
    ==
  ::  peek page in the book: new contact page is found
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/book/id/0v1)
  ;<  ~  b
    %+  ex-cage  (need (need peek))
    [%contact-page-0 !>(mypage)]
  ::  fail to create duplicate page
  ::
  %-  ex-fail  (do-poke contact-action-1+!>([%page id+0v1 con-1]))
::  +test-poke-edit: edit the contact book
::
++  test-poke-edit
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  =/  groups
    ^-  (list value)
    :~  flag/~sampel-palnet^%apples
        flag/~sampel-palnet^%oranges
    ==
  =/  con-1=contact
    %-  malt
    ^-  (list (pair @tas value))
    :~  nickname+text/'Sun'
        bio+text/'It is bright today'
        groups+set/(silt groups)
    ==
  ::
  =/  resp=response
    [%page id+0v1 ~ con-1]
  =/  mypage=page:c
    [p=~ q=con-1]
  =/  edit-1  con-1
  ::  local subscriber to /news
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-watch /v1/news)
  ::
  ;<  ~  b  (set-src our.bowl)
  ::  create new contact page
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%page id+0v1 con-1]))
  ::  news is published on /v1/news
  ::
  ;<  ~  b  %+  ex-cards  caz
    :~  (ex-fact ~[/v1/news] contact-response-0+!>(resp))
    ==
  ::  peek page in the book: new contact page is found
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/book/id/0v1)
  %+  ex-cage  (need (need peek))
  [%contact-page-0 !>(mypage)]
  ::  delete favourite groups
  ::
::
++  test-poke-meet
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =/  con-sun=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Sun' bio+text/'It is bright today']
  ::  local subscriber to /news
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-watch /news)
  ::  meet ~sun
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%meet ~[~sun]]))
  ::  ~sun publishes his contact
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b
    (do-agent /contact [~sun %contacts] %fact contact-update-1+!>([%full now.bowl con-sun]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/news] contact-news+!>([~sun (contact:to-0:c con-sun)]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%peer ~sun con-sun]))
    ==
  ::  ~sun appears in peers
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/peer/~sun)
  ;<  ~  b
    %+  ex-cage  (need (need peek))
    contact-foreign-0+!>(`foreign`[[now.bowl con-sun] %want])
  ;<  ~  b  (set-src ~sun)
  ::  meet ~sun a second time: a no-op
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke %contact-action !>([%meet ~[~sun]]))
  (ex-cards caz ~)
::
++  test-poke-page-unknown
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =/  con-sun=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Sun' bio+text/'It is bright today']
  ::  local subscriber to /news
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-watch /news)
  ::  page ~sun to contact boook: he also becomes our peer
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%page ~sun ~]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-task /contact [~sun %contacts] %watch /v1/contact)
        (ex-fact ~[/news] contact-news+!>([~sun ~]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%peer ~sun ~]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%page ~sun `page:c`[~ ~]]))
    ==
  ::  ~sun appears in peers
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/peer/~sun)
  ;<  ~  b
    %+  ex-cage  (need (need peek))
    contact-foreign-0+!>(`foreign`[~ %want])
  ::  ~sun publishes his contact
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b
    (do-agent /contact [~sun %contacts] %fact contact-update-1+!>([%full now.bowl con-sun]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/news] contact-news+!>([~sun (contact:to-0:c con-sun)]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%page ~sun con-sun ~]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%peer ~sun con-sun]))
    ==
  ::  ~sun contact page is edited
  ::
  ;<  ~  b  (set-src our.bowl)
  =/  con-mod=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Bright Sun' avatar+look/'https://sun.io/sun.png']
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%edit ~sun con-mod]))
  ::  ~sun's contact book page is updated
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/book/~sun)
  ;<  ~  b
    %+  ex-cage  (need (need peek))
    [%contact-page-0 !>(`page:c`[con-sun con-mod])]
  ::  and his effective contact is changed
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/contact/~sun)
  %+  ex-cage  (need (need peek))
  contact-1+!>((contact-uni:c con-sun con-mod))
::
++  test-poke-page-wipe
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =/  con-sun=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Sun' bio+text/'It is bright today']
  ::  local subscriber to /news
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-watch /news)
  ::  meet ~sun
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%meet ~[~sun]]))
  ::  ~sun publishes his contact
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b
    (do-agent /contact [~sun %contacts] %fact contact-update-1+!>([%full now.bowl con-sun]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/news] contact-news+!>([~sun (contact:to-0:c con-sun)]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%peer ~sun con-sun]))
    ==
  ::  ~sun appears in peers
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/peer/~sun)
  ;<  ~  b
    %+  ex-cage  (need (need peek))
    contact-foreign-0+!>(`foreign`[[now.bowl con-sun] %want])
  ;<  ~  b  (set-src ~sun)
  ::  ~sun is added to contacts
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%page ~sun ~]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/v1/news] contact-response-0+!>([%page ~sun con-sun ~]))
    ==
  ::  ~sun contact page is edited
  ::
  =/  con-mod=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Bright Sun' avatar+look/'https://sun.io/sun.png']
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%edit ~sun con-mod]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  :: (ex-fact ~[/news] contact-news+!>([~sun (contact:to-0:c (~(uni by con-sun) con-mod))]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%page ~sun con-sun con-mod]))
    ==
  ::  despite the edit, ~sun peer contact is unchanged
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/peer/~sun)
  ;<  ~  b
    %+  ex-cage  (need (need peek))
    contact-foreign-0+!>(`foreign`[[now.bowl con-sun] %want])
  ::  however, ~sun's contact book page is changed
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/book/~sun)
  ;<  ~  b
    %+  ex-cage  (need (need peek))
    [%contact-page-0 !>(`page:c`[con-sun con-mod])]
  ::  and his effective contact is changed
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/contact/~sun)
  ;<  ~  b
    %+  ex-cage  (need (need peek))
    contact-1+!>((contact-uni:c con-sun con-mod))
  ::  ~sun contact page is deleted
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%wipe ~[~sun]]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  :: (ex-fact ~[/news] contact-news+!>([~sun (contact:to-0:c con-sun)]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%wipe ~sun]))
    ==
  ::  ~sun contact page is removed
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/book/~sun)
  ;<  ~  b
    (ex-cage (need (need peek)) contact-page-0+!>(*page:c))
  :: (ex-equal !>(2) !>(2))
  ::  despite the removal, ~sun peer contact is unchanged
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/peer/~sun)
  %+  ex-cage  (need (need peek))
  contact-foreign-0+!>(`foreign`[[now.bowl con-sun] %want])
::
++  test-poke-drop
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =/  con-sun=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Sun' bio+text/'It is bright today']
  ::  local subscriber to /news
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-watch /news)
  ::  meet ~sun
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%meet ~[~sun]]))
  ::  ~sun publishes his contact
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b
    (do-agent /contact [~sun %contacts] %fact contact-update-1+!>([%full now.bowl con-sun]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/news] contact-news+!>([~sun (contact:to-0:c con-sun)]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%peer ~sun con-sun]))
    ==
  ::  ~sun appears in peers
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/peer/~sun)
  ;<  ~  b
    %+  ex-cage  (need (need peek))
    contact-foreign-0+!>(`foreign`[[now.bowl con-sun] %want])
  ;<  ~  b  (set-src ~sun)
  ::  ~sun is added to contacts
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%page ~sun ~]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/v1/news] contact-response-0+!>([%page ~sun con-sun ~]))
    ==
  ::  ~sun contact page is edited
  ::
  =/  con-mod=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Bright Sun' avatar+look/'https://sun.io/sun.png']
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%edit ~sun con-mod]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  :: (ex-fact ~[/news] contact-news+!>([~sun (contact:to-0:c (~(uni by con-sun) con-mod))]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%page ~sun con-sun con-mod]))
    ==
  ::  ~sun is dropped
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%drop ~[~sun]]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-task /contact [~sun %contacts] %leave ~)
        (ex-fact ~[/news] contact-news+!>([~sun ~]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%peer ~sun ~]))
    ==
  ::  ~sun is not found in peers
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/peer/~sun)
  ;<  ~  b
    %+  ex-equal
    !>  peek
    !>  [~ ~]
  ::  but his contact is not modified
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/book/~sun)
  %+  ex-cage  (need (need peek))
  contact-page-0+!>(`page:c`[con-sun con-mod])
::  +test-poke-snub: test snubbing a peer
::
::    scenario
::
::  we heve a local subscriber to /news. we meet
::  a peer ~sun. ~sun publishes his contact. subsequently,
::  ~sun is added to the contact book. we now snub ~sun.
::  ~sun is still found in peers.
::
++  test-poke-snub
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =/  con-sun=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Sun' bio+text/'It is bright today']
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-watch /v1/news)
  ::  meet ~sun
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%meet ~[~sun]]))
  ::  ~sun publishes his contact
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b
    (do-agent /contact [~sun %contacts] %fact contact-update-1+!>([%full now.bowl con-sun]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/news] contact-news+!>([~sun (contact:to-0:c con-sun)]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%peer ~sun con-sun]))
    ==
  ::  ~sun is snubbed
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%snub ~[~sun]]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-task /contact [~sun %contacts] %leave ~)
    ==
  ::  ~sun is still found in peers
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/peer/~sun)
  %+  ex-cage  (need (need peek))
  contact-foreign-0+!>(`foreign`[[now.bowl con-sun] ~])
::  +test-pub-profile
::
::    scenario
::
::  ~sun subscribes to our /contact. we publish
::  our profile with current time a. we then change
::  the profile, advancing the timestamp to time b.
::  ~sun now subscribes to /contact/at/b.
::  no update is sent.
::
++  test-pub-profile
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =/  con=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Dev' bio+text/'Let\'s build']
  ::  edit our profile
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%self con]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/news] contact-news+!>([our.bowl (contact:to-0:c con)]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%self con]))
        (ex-fact ~[/v1/contact] contact-update-1+!>([%full `@da`(add now.bowl tick) con]))
    ==
  ::  ~sun subscribes to /contact, profile is published
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b  (do-watch /v1/contact)
  ;<  ~  b  %+  ex-cards  caz
    :~  (ex-fact ~ contact-update-1+!>([%full `@da`(add now.bowl tick) con]))
    ==
  ::  we update our profile, which advances the timestamp.
  ::  update is published.
  ::
  =+  now=`@da`(add now.bowl (mul 2 tick))
  =.  con  (~(put by con) birthday+date/~2000.1.1)
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%self con]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/news] contact-news+!>([our.bowl (contact:to-0:c con)]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%self con]))
        (ex-fact ~[/v1/contact] contact-update-1+!>([%full now con]))
    ==
  ::  ~sun resubscribes to /contact/at/old-now
  ::  update is sent
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b  (do-watch /v1/contact/at/(scot:h136 %da now.bowl))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~ contact-update-1+!>([%full now con]))
    ==
  ::  ~sun subscribes to /contact/at/(add now.bowl tick).
  ::  no update is sent - already at latest
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b  (do-watch /v1/contact/at/(scot:h136 %da now))
  (ex-cards caz ~)
::
::  +test-sub-profile
::
::    scenario
::
::  we subscribe to ~sun's /contact. we receive
::  her profile at time a. subsequently, another update
::  of the profile with older timestamp is received.
::  ~sun's profile is not updated. most recent update
::  at time b arrives. ~sun's profile is updated.
::  we are kicked off the subscription, and in
::  the result we subscribe to /contact/at/b
::  path.
::
++  test-sub-profile
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =/  con=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Sun' bio+text/'It is sunny today']
  =/  mod=contact
    %-  ~(uni by con)
    %-  malt  ^-  (list (pair @tas value))
    ~[birthday+date/~2000.1.1]
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%meet ~sun ~]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-task /contact [~sun %contacts] %watch /v1/contact)
        (ex-fact ~[/news] contact-news+!>([~sun ~]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%peer ~sun ~]))
    ==
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b
    (do-agent /contact [~sun %contacts] %fact contact-update-1+!>([%full now.bowl con]))
  ;<  caz=(list card)  b
    (do-agent /contact [~sun %contacts] %fact contact-update-1+!>([%full (sub now.bowl tick) mod]))
  ::  ~sun's profile is unchanged
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/peer/~sun)
  ;<  ~  b
    %+  ex-cage  (need (need peek))
    contact-foreign-0+!>(`foreign`[[now.bowl con] %want])
  ;<  caz=(list card)  b
    (do-agent /contact [~sun %contacts] %fact contact-update-1+!>([%full (add now.bowl tick) mod]))
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/peer/~sun)
  ;<  ~  b
    %+  ex-cage  (need (need peek))
    contact-foreign-0+!>(`foreign`[[(add now.bowl tick) mod] %want])
  ;<  caz=(list card)  b
    (do-agent /contact [~sun %contacts] %kick ~)
  %+  ex-cards  caz
  :~  %^  ex-task  /contact
          [~sun %contacts]
          [%watch /v1/contact/at/(scot:h136 %da (add now.bowl tick))]
  ==
::
++  test-peek-0-all
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =/  con-sun=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Sun' bio+text/'It is bright today']
  =/  con-mur=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Mur' bio+text/'Murky waters']
  ::  meet ~sun and ~mur
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke %contact-action-1 !>([%meet ~[~sun ~mur]]))
  ::  ~sun publishes his contact
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b
    (do-agent /contact [~sun %contacts] %fact %contact-update-1 !>([%full now.bowl con-sun]))
  ::  ~mur publishes his contact
  ::
  ;<  ~  b  (set-src ~mur)
  ;<  caz=(list card)  b
    (do-agent /contact [~mur %contacts] %fact %contact-update-1 !>([%full now.bowl con-mur]))
  ::  peek all: two peers are found
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/all)
  =/  cag=cage  (need (need peek))
  ?>  ?=(%contact-rolodex p.cag)
  =/  rol  !<(rolodex:c0 q.cag)
  ;<  ~  b
    %+  ex-equal
    !>  (~(got by rol) ~sun)
    !>  [[now.bowl (contact:to-0:c con-sun)] %want]
  %+  ex-equal
  !>  (~(got by rol) ~mur)
  !>  [[now.bowl (contact:to-0:c con-mur)] %want]
::
++  test-peek-book
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =/  con-1=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Sun' bio+text/'It is bright today']
  =/  con-2=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Mur' bio+text/'Murky waters']
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%page id+0v1 con-1]))
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%page id+0v2 con-2]))
  ::  peek book: two contacts are found
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/book)
  =/  cag=cage  (need (need peek))
  ?>  ?=(%contact-book-0 p.cag)
  =/  =book  !<(book q.cag)
  ;<  ~  b
    %+  ex-equal
    !>  mod:(~(got by book) id+0v1)
    !>  con-1
  %+  ex-equal
  !>  mod:(~(got by book) id+0v2)
  !>  con-2
::
++  test-peek-page
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =/  con-1=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Sun' bio+text/'It is bright today']
  =/  con-2=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Mur' bio+text/'Murky waters']
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%page id+0v1 con-1]))
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%page id+0v2 con-2]))
  ::  unknown page is not found
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /u/v1/book/id/0v3)
  ;<  ~  b  (ex-equal q:(need (need peek)) !>(|))
  ::
  ::  two pages are found
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /u/v1/book/id/0v1)
  ;<  ~  b  (ex-equal q:(need (need peek)) !>(&))
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/book/id/0v1)
  =/  cag=cage  (need (need peek))
  ;<  ~  b
  %+  ex-cage  cag
  contact-page-0+!>(`page:c`[~ con-1])
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /u/v1/book/id/0v2)
  ;<  ~  b  (ex-equal q:(need (need peek)) !>(&))
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/book/id/0v2)
  =/  cag=cage  (need (need peek))
  :: ;<  ~  b
  %+  ex-cage  cag
  contact-page-0+!>(`page:c`[~ con-2])
::
++  test-peek-all
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::
  =/  con-sun=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Sun' bio+text/'It is bright today']
  =/  con-mur=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Mur' bio+text/'Murky waters']
  =/  con-mod=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[avatar+look/'https://sun.io/sun.png']
  ::  meet ~sun and ~mur
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke %contact-action-1 !>([%meet ~[~sun ~mur]]))
  ::  ~sun publishes his contact
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b
    (do-agent /contact [~sun %contacts] %fact contact-update-1+!>([%full now.bowl con-sun]))
  ::  ~sun is added to the contact book with user overlay
  ::
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%page ~sun con-mod]))
  ::  ~mur publishes his contact
  ::
  ;<  ~  b  (set-src ~mur)
  ;<  caz=(list card)  b
    (do-agent /contact [~mur %contacts] %fact contact-update-1+!>([%full now.bowl con-mur]))
  ::  peek all: two contacts are found
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/directory)
  =/  cag=cage  (need (need peek))
  ?>  ?=(%contact-directory-0 p.cag)
  =/  dir  !<(directory q.cag)
  ;<  ~  b
    %+  ex-equal
    !>  (~(got by dir) ~sun)
    !>  `leaf`[& con-sun con-mod]
  %+  ex-equal
  !>  (~(got by dir) ~mur)
  !>  `leaf`[| con-mur ~]
::  +test-retry: test resubscription logic
::
::    scenario
::
::  we %meet ~sun. however, ~sun is running incompatible version.
::  negative %watch-ack arrives. we setup the timer to retry.
::  the timer fires. we resubscribe.
::
++  test-retry
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ::
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%meet ~[~sun]]))
  ;<  caz=(list card)  b
    %^  do-agent  /contact
      [~sun %contacts]
    [%watch-ack (some leaf+"outdated contacts" ~)]
  ;<  ~  b
    %+  ex-cards  caz
    :~  %+  ex-arvo  /retry/(scot %p ~sun)
        [%b %wait (add now.bowl ~m30)]
    ==
  ;<  caz=(list card)  b
    %+  do-arvo  /retry/(scot %p ~sun)
    [%behn %wake ~]
  %+  ex-cards  caz
  :~  %^  ex-task  /contact
        [~sun %contacts]
      [%watch /v1/contact]
  ==
::  +test-nickname-spoofing: test nickname spoofing protection
::
::  a nickname can be used to spoof an urbit id.
::
::  when a ship attempts to set a nickname that begins with a
::  sig-confusable character, but not a sig itself, the update fails.
::
::  when a ship attempts to set a nickname that begins with a sig,
::  what follows must be a valid urbit id that corresponds to the
::  identity of the ship.
::
::  when the user attempts to associate a contact page with a nickname
::  that would constitute a spoofing attempt, the update fails.
::
++  test-nickname-spoofing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-init %contacts contacts-agent)
  ;<  =bowl  bind:m  get-bowl
  ::  own id can be set as nickname
  ::
  ;<  *  bind:m
    (do-poke contact-action-1+!>([%self (contact-nickname '~zod')]))
  :: allow embellished urbit ids
  ::
  ;<  *  bind:m
    (do-poke contact-action-1+!>([%self (contact-nickname '⁓👑zod is king')]))
  ::  prevent self spoofing of another ship
  ::
  ;<  ~  bind:m
    (ex-fail (do-poke contact-action-1+!>([%self (contact-nickname '⁓dev')])))
  ::  prevent self spoofing with a sig confusable
  ::
  ;<  ~  bind:m
    (ex-fail (do-poke contact-action-1+!>([%self (contact-nickname '⁓dev')])))
  ::  meet ~fed
  ::
  ;<  *  bind:m  (do-poke contact-action-1+!>([%meet ~[~fed]]))
  ;<  ~  bind:m  (set-src ~fed)
  ::  own id can be set as nickname
  ::
  ;<  *  bind:m
    =/  con  (contact-nickname '🕵🏻‍♂️~𝒇ed')
    (do-agent /contact [~fed %contacts] %fact contact-update-1+!>([%full now.bowl con]))
  ::  prevent spoofing of another ship
  ::
  ;<  *  bind:m
    =/  spoof  (contact-nickname '~de𝕧')
    (do-agent /contact [~fed %contacts] %fact contact-update-1+!>([%full now.bowl spoof]))
  ;<  peek=cage  bind:m  (got-peek /x/v1/contact/~fed)
  =+  !<(fec=contact:c q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get cy:c fec) %nickname %text))
    !>(`'🕵🏻‍♂️~𝒇ed')
  ::  prevent spoofing with a sig confusable
  ::
  ;<  *  bind:m
    =/  spoof  (contact-nickname '⁓dev')
    (do-agent /contact [~fed %contacts] %fact contact-update-1+!>([%full now.bowl spoof]))
  ;<  peek=cage  bind:m  (got-peek /x/v1/contact/~fed)
  =+  !<(fec=contact:c q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get cy:c fec) %nickname %text))
    !>(`'🕵🏻‍♂️~𝒇ed')
  ::  prevent spoofing with an embedded pat-p
  ::
  ;<  *  bind:m
    =/  spoof  (contact-nickname 'look, i am ⁓dev now')
    (do-agent /contact [~fed %contacts] %fact contact-update-1+!>([%full now.bowl spoof]))
  ;<  peek=cage  bind:m  (got-peek /x/v1/contact/~fed)
  =+  !<(fec=contact:c q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get cy:c fec) %nickname %text))
    !>(`'🕵🏻‍♂️~𝒇ed')
  (pure:m ~)
::  +test-migration-nickname-insane: test migration of spoofed nicknames
::
++  test-migration-nickname-insane
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  now  (add *@da ~d1)
  =/  =state-3
    :-  %3
    :*  ::  profile
        [now (contact-nickname 'avoid ~fed')]
        ::  book
        ::
        %-  malt
        ^-  (list [kip page:c])
        :~  :-  ~dev  ^-  page:c  :-
              (contact-nickname 'i am ~zod')
            (contact-nickname 'fake ~zod')
          ::
            :-  ~fed  ^-  page:c  :-
              (contact-nickname 'i am ~nus')
            (contact-nickname 'fake ~nus')
        ==
        ::  peers
        ::
        %-  malt
        ^-  (list [ship foreign])
        :~  :+  ~dev
              [now (contact-nickname 'i am ~zod')]
            %want
          ::
            :+  ~fed
              [now (contact-nickname 'i am ~nus')]
            %want
        ==
      ~  ::  last updated
      ~  ::  retries
    ==
  ;<  *  bind:m  (do-load agent `!>([state-3 ~]))
  ::  verify profile migration
  ::
  ;<  peek=cage  bind:m  (got-peek /x/v1/self)
  =+  !<(con=contact:c q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get cy:c con) %nickname %text))
    !>(`'avoid fed')
  ::  verify peers migration
  ::
  ;<  peek=cage  bind:m  (got-peek /x/v1/peer/~dev)
  =+  !<(far=foreign:c q.peek)
  ;<  ~  bind:m
    ?>  ?=(^ for.far)
    %+  ex-equal  !>((~(get cy:c con.for.far) %nickname %text))
    !>(`'i am zod')
  ;<  peek=cage  bind:m  (got-peek /x/v1/peer/~fed)
  =+  !<(far=foreign:c q.peek)
  ;<  ~  bind:m
    ?>  ?=(^ for.far)
    %+  ex-equal  !>((~(get cy:c con.for.far) %nickname %text))
    !>(`'i am nus')
  ::  verify contact book migration
  ::
  ;<  peek=cage  bind:m  (got-peek /x/v1/contact/~dev)
  =+  !<(con=contact:c q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get cy:c con) %nickname %text))
    !>(`'fake ~zod')
  ;<  peek=cage  bind:m  (got-peek /x/v1/contact/~fed)
  =+  !<(con=contact:c q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get cy:c con) %nickname %text))
    !>(`'fake ~nus')
  (pure:m ~)
::  +test-migration-nickname-sane: test migration of good nicknames
::
++  test-migration-nickname-sane
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  now  (add *@da ~d1)
  =/  =state-3
    :-  %3
    :*  ::  profile
        [now (contact-nickname '👑⁓𝒛ס𝓭👑')]
        ::  book
        ::
        %-  malt
        ^-  (list [kip page:c])
        :~  :-  ~dev  ^-  page:c  :-
              (contact-nickname '⁓deט')
            (contact-nickname 'fake ~zod')
          ::
            :-  ~fed  ^-  page:c  :-
              (contact-nickname '⁓fe𝓭')
            (contact-nickname 'fake ~nus')
        ==
        ::  peers
        ::
        %-  malt
        ^-  (list [ship foreign])
        :~  :+  ~dev
              [now (contact-nickname '⁓deט')]
            %want
          ::
            :+  ~fed
              [now (contact-nickname '⁓fe𝓭')]
            %want
        ==
      ~  ::  last updated
      ~  ::  retries
    ==
  ;<  *  bind:m  (do-load agent `!>([state-3 ~]))
  ::  verify profile migration
  ::
  ;<  peek=cage  bind:m  (got-peek /x/v1/self)
  =+  !<(con=contact:c q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get cy:c con) %nickname %text))
    !>(`'👑⁓𝒛ס𝓭👑')
  ::  verify peers migration
  ::
  ;<  peek=cage  bind:m  (got-peek /x/v1/peer/~dev)
  =+  !<(far=foreign:c q.peek)
  ;<  ~  bind:m
    ?>  ?=(^ for.far)
    %+  ex-equal  !>((~(get cy:c con.for.far) %nickname %text))
    !>(`'⁓deט')
  ;<  peek=cage  bind:m  (got-peek /x/v1/peer/~fed)
  =+  !<(far=foreign:c q.peek)
  ;<  ~  bind:m
    ?>  ?=(^ for.far)
    %+  ex-equal  !>((~(get cy:c con.for.far) %nickname %text))
    !>(`'⁓fe𝓭')
  ::  verify contact book migration
  ::
  ;<  peek=cage  bind:m  (got-peek /x/v1/contact/~dev)
  =+  !<(con=contact:c q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get cy:c con) %nickname %text))
    !>(`'fake ~zod')
  ;<  peek=cage  bind:m  (got-peek /x/v1/contact/~fed)
  =+  !<(con=contact:c q.peek)
  ;<  ~  bind:m
    %+  ex-equal  !>((~(get cy:c con) %nickname %text))
    !>(`'fake ~nus')
  (pure:m ~)
::  like +scries below but %vouch classifies the moon as a bot
::
++  bot-scries
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gx @ %vouch @ %status @ *] path)
    `!>(`?(%unknown %real %bot)`%bot)
  ~
::  +test-bot-profile: a bot moon never boots, so %contacts must not try
::  to subscribe to it. instead the host sets the bot's contact profile
::  directly via %contact-bot-0, and +si-meet must no-op for it rather
::  than emitting a %watch that would retry forever.
::
++  test-bot-profile
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(our ~sampel-palnet)))
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  ~  b  (set-scry-gate bot-scries)
  ;<  =bowl  b  get-bowl
  ::
  =/  moon=ship  ~doznec-sampel-palnet
  =/  con=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Weatherbot']
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke %contact-bot-0 !>([moon con]))
  ::  the bot's profile is retrievable, like any peer's
  ::
  ;<  ~  b  (ex-scry-result /x/v1/contact/(scot %p moon) !>(con))
  ::  meeting the bot moon does not subscribe -- it never boots
  ::
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%meet ~[moon]]))
  (ex-cards caz ~)
::  like +bot-scries but %vouch classifies the moon as real
::
++  real-scries
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gx @ %vouch @ %status @ *] path)
    `!>(`?(%unknown %real %bot)`%real)
  ~
::  like +bot-scries but %vouch has no record for the moon
::
++  unknown-scries
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gx @ %vouch @ %status @ *] path)
    `!>(`?(%unknown %real %bot)`%unknown)
  ~
::  +test-bot-resolver-serves: the host side of the bot-moon resolver.
::  a foreign ship watching /v1/vouch/<moon> gets the bot's current
::  profile immediately, and a fresh fact whenever the host updates it
::  via %contact-bot-0.
::
++  test-bot-resolver-serves
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(our ~sampel-palnet)))
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  ~  b  (set-scry-gate bot-scries)
  ;<  =bowl  b  get-bowl
  ::
  =/  moon=ship  ~doznec-sampel-palnet
  ::  ~bus watches the resolver path before we have any profile on file
  ::
  ;<  ~  b  (set-src ~bus)
  ;<  caz=(list card)  b  (do-watch /v1/vouch/(scot %p moon))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~ contact-update-1+!>(`update`[%full now.bowl ~]))
    ==
  ::  the host sets the bot's profile
  ::
  =/  con=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Weatherbot']
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke %contact-bot-0 !>([moon con]))
  ::  the resolver subscriber gets a fresh fact on the resolver path,
  ::  in addition to the usual local /news and /v1/news publication
  ::
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/news] contact-news+!>([moon (contact:to-0:c con)]))
        %^  ex-fact  ~[/v1/vouch/(scot %p moon)]
          %contact-update-1
        !>(`update`[%full now.bowl con])
        (ex-fact ~[/v1/news] contact-response-0+!>([%peer moon con]))
    ==
  ::  the profile is also visible via scry, like any peer's
  ::
  (ex-scry-result /x/v1/contact/(scot %p moon) !>(con))
::  +test-bot-resolver-redirects: if %vouch actually believes the moon
::  is real, the host redirects the watcher off instead of serving a
::  (nonexistent) bot profile.
::
++  test-bot-resolver-redirects
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(our ~sampel-palnet)))
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  ~  b  (set-scry-gate real-scries)
  ;<  =bowl  b  get-bowl
  ::
  =/  moon=ship  ~doznec-sampel-palnet
  ;<  ~  b  (set-src ~bus)
  ;<  caz=(list card)  b  (do-watch /v1/vouch/(scot %p moon))
  %+  ex-cards  caz
  :~  (ex-fact ~ vouch-real+!>(moon))
      (ex-card %give %kick ~ ~)
  ==
::  +test-bot-resolver-unknown-crashes: with no classification on file
::  yet, the host has nothing to serve and nothing to redirect to --
::  the watch fails, and the subscriber's normal watch-nack retry
::  machinery is expected to handle it.
::
++  test-bot-resolver-unknown-crashes
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(our ~sampel-palnet)))
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  ~  b  (set-scry-gate unknown-scries)
  ;<  =bowl  b  get-bowl
  ::
  =/  moon=ship  ~doznec-sampel-palnet
  ;<  ~  b  (set-src ~bus)
  (ex-fail (do-watch /v1/vouch/(scot %p moon)))
::  +test-meet-foreign-bot-via-host: meeting a foreign moon that our
::  own %vouch store doesn't (yet) believe is real routes through the
::  moon's host's resolver instead of watching the moon directly.
::  the fact answer is filed like a normal peer update, and -- since we
::  didn't already know the moon's status -- we learn it organically.
::
++  test-meet-foreign-bot-via-host
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(our ~bus)))
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  ~  b  (set-scry-gate unknown-scries)
  ;<  =bowl  b  get-bowl
  ::
  =/  moon=ship  ~doznec-sampel-palnet
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%meet ~[moon]]))
  ::  we watch the moon's host, never the moon itself
  ::
  ;<  ~  b
    %+  ex-cards  caz
    :~  %^  ex-task  /contact/vouch/(scot %p moon)
          [~sampel-palnet %contacts]
        [%watch /v1/vouch/(scot %p moon)]
        (ex-fact ~[/news] contact-news+!>([moon ~]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%peer moon ~]))
    ==
  ::  the host answers with the bot's profile
  ::
  =/  con=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Weatherbot']
  ;<  caz=(list card)  b
    %^  do-agent  /contact/vouch/(scot %p moon)
      [~sampel-palnet %contacts]
    [%fact contact-update-1+!>(`update`[%full now.bowl con])]
  ::  filed like a normal peer update, plus an organic %vouch-learn
  ::  poke since we didn't already know the moon's classification
  ::
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~[/news] contact-news+!>([moon (contact:to-0:c con)]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%peer moon con]))
        (ex-poke /vouch-learn [our.bowl %vouch] vouch-learn+!>([moon %bot]))
    ==
  (ex-scry-result /x/v1/contact/(scot %p moon) !>(con))
::  +test-meet-foreign-real-moon-direct: meeting a foreign moon %vouch
::  already believes is real watches it directly, same as any peer.
::
++  test-meet-foreign-real-moon-direct
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(our ~bus)))
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  ~  b  (set-scry-gate real-scries)
  ;<  =bowl  b  get-bowl
  ::
  =/  moon=ship  ~doznec-sampel-palnet
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%meet ~[moon]]))
  %+  ex-cards  caz
  :~  (ex-task /contact [moon %contacts] %watch /v1/contact)
      (ex-fact ~[/news] contact-news+!>([moon ~]))
      (ex-fact ~[/v1/news] contact-response-0+!>([%peer moon ~]))
  ==
::  +test-vouch-real-redirect-switches: while resolving a moon through
::  its host, a %vouch-real redirect must make us learn the correction
::  and switch straight to a direct subscription -- without waiting for
::  the %kick that follows it. once switched, that trailing %kick is a
::  no-op.
::
++  test-vouch-real-redirect-switches
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(our ~bus)))
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  ~  b  (set-scry-gate bot-scries)
  ;<  =bowl  b  get-bowl
  ::
  =/  moon=ship  ~doznec-sampel-palnet
  ;<  ~  b  (set-src our.bowl)
  ;<  caz=(list card)  b  (do-poke contact-action-1+!>([%meet ~[moon]]))
  ;<  ~  b
    %+  ex-cards  caz
    :~  %^  ex-task  /contact/vouch/(scot %p moon)
          [~sampel-palnet %contacts]
        [%watch /v1/vouch/(scot %p moon)]
        (ex-fact ~[/news] contact-news+!>([moon ~]))
        (ex-fact ~[/v1/news] contact-response-0+!>([%peer moon ~]))
    ==
  ::  the host declares the moon real and redirects us
  ::
  ;<  caz=(list card)  b
    %^  do-agent  /contact/vouch/(scot %p moon)
      [~sampel-palnet %contacts]
    [%fact vouch-real+!>(moon)]
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-poke /vouch-learn [our.bowl %vouch] vouch-learn+!>([moon %real]))
        (ex-task /contact [moon %contacts] %watch /v1/contact)
    ==
  ::  the trailing kick from the host is a no-op -- we already switched
  ::
  ;<  caz=(list card)  b
    %^  do-agent  /contact/vouch/(scot %p moon)
      [~sampel-palnet %contacts]
    [%kick ~]
  (ex-cards caz ~)
::  +test-vouch-resolver-trust: a %contact-update-1 fact on the
::  resolver wire is only accepted from the moon's actual sponsor.
::  gall's dock-bound subscriptions mean an impostor could never really
::  reach this code in production; we simulate it anyway by manually
::  registering the subscription an impostor would need (through the
::  same /lib/negotiate inner-watch wire wrapping do-agent/do-poke use
::  transparently) to prove the sponsor check holds regardless.
::
++  test-vouch-resolver-trust
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(our ~bus)))
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  ~  b  (set-scry-gate bot-scries)
  ;<  =bowl  b  get-bowl
  ::
  =/  moon=ship  ~doznec-sampel-palnet
  =/  =wire  /contact/vouch/(scot %p moon)
  =/  wrapped-wire=^wire  [%~.~ %negotiate %inner-watch (scot %p ~fed) %contacts wire]
  ;<  ~  b  (fake-sub wrapped-wire ~fed %contacts /v1/vouch/(scot %p moon))
  =/  con=contact
    %-  malt
    ^-  (list (pair @tas value))
    ~[nickname+text/'Weatherbot']
  %-  ex-fail
  (do-agent wire [~fed %contacts] %fact contact-update-1+!>(`update`[%full now.bowl con]))
::  +test-watch-from-moon-learns-real: "any traffic from a moon is real" --
::  a direct watch on our own profile from an %earl src is genuine network
::  traffic (a bot moon never boots), so we learn it %real organically.
::  a watch from a non-moon emits no such card.
::
++  test-watch-from-moon-learns-real
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(our ~bus)))
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  ~  b  (set-scry-gate unknown-scries)
  ;<  =bowl  b  get-bowl
  ::
  =/  moon=ship  ~doznec-sampel-palnet
  ;<  ~  b  (set-src moon)
  ;<  caz=(list card)  b  (do-watch /v1/contact)
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-poke /vouch-learn [our.bowl %vouch] vouch-learn+!>([moon %real]))
        (ex-fact ~ contact-update-1+!>(`update`[%full now.bowl ~]))
    ==
  ::  a watch from a non-moon never emits a vouch-learn card
  ::
  ;<  ~  b  (set-src ~bud)
  ;<  caz=(list card)  b  (do-watch /v1/contact)
  (ex-cards caz ~[(ex-fact ~ contact-update-1+!>(`update`[%full now.bowl ~]))])
--

