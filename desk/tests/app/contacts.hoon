/-  *contacts, c0=contacts-0
/+  *test-agent
/+  c=contacts
/=  contacts-agent  /app/contacts
=*  agent  contacts-agent
::  XX consider simplifying tests
::  with functional 'micro' strands, that set
::  a contact, subscribe to a peer etc.
::
|%
::
+|  %help
::
++  tick  ^~((rsh 3^2 ~s1))
++  mono
  |=  [old=@da new=@da]
  ^-  @da
  ?:  (lth old new)  new
  (add old tick)
::  +filter: filter unwanted cards
::
:: ++  filter
::   |=  caz=(list card)
::   ^+  caz
::   %+  skip  caz
::   |=  =card
::   ?.  ?=(%pass -.card)  |
::   ?+  p.card  |
::     [%~.~ %negotiate *]  &
::   ==
:: ++  ex-cards
::   |=  [caz=(list card) exes=(list $-(card tang))]
::   %+  ^ex-cards
::     (filter caz)
::   exes
::
+|  %poke-0
::
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
  =/  cag  (need (need peek))
  ;<  ~  b
    %+  ex-equal
    !>  cag
    !>  contact-1+!>(con)
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
  =/  cag  (need (need peek))
  %+  ex-equal
  !>  cag
  !>  contact-1+!>(`contact`(~(del by con) %bio))
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
  ;<  caz=(list card)  b  (do-init %contacts contacts-agent)
  ;<  =bowl  b  get-bowl
  ::  v0 %heed is the new %meet
  ::
  ;<  caz=(list card)  b  (do-poke %contact-action !>([%heed ~[~sun]]))
  %+  ex-cards  caz
  :~  (ex-task /contact [~sun %contacts] %watch /v1/contact)
      (ex-fact ~[/news] contact-news+!>([~sun ~]))
      (ex-fact ~[/v1/news] contact-response-0+!>([%peer ~sun ~]))
  ==
+|  %poke
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
  %+  ex-equal
  !>(cag)
  !>(contact-1+!>(`contact`~))
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
  =/  mypage=^page
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
  =/  =cage  (need (need peek))
  ;<  ~  b
    %+  ex-equal
    !>  [%contact-page-0 q.cage]
    !>  [%contact-page-0 !>(mypage)]
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
  =/  mypage=^page
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
  =/  =cage  (need (need peek))
  %+  ex-equal
  !>  [%contact-page-0 q.cage]
  !>  [%contact-page-0 !>(mypage)]
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
  =/  cag=cage  (need (need peek))
  ;<  ~  b
    %+  ex-equal
    !>  cag
    !>  contact-foreign-0+!>(`foreign`[[now.bowl con-sun] %want])
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
  =/  cag=cage  (need (need peek))
  ;<  ~  b
    %+  ex-equal
    !>  cag
    !>  contact-foreign-0+!>(`foreign`[~ %want])
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
  =/  cag=cage  (need (need peek))
  ;<  ~  b
    %+  ex-equal
    !>  cag
    !>  [%contact-page-0 !>(`page:c`[con-sun con-mod])]
  ::  and his effective contact is changed
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/contact/~sun)
  =/  cag=cage  (need (need peek))
  %+  ex-equal
  !>  cag
  !>  contact-1+!>((contact-uni:c con-sun con-mod))
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
  =/  cag=cage  (need (need peek))
  ;<  ~  b
    %+  ex-equal
    !>  cag
    !>  contact-foreign-0+!>(`foreign`[[now.bowl con-sun] %want])
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
  =/  cag=cage  (need (need peek))
  ;<  ~  b
    %+  ex-equal
    !>  cag
    !>  contact-foreign-0+!>(`foreign`[[now.bowl con-sun] %want])
  ::  however, ~sun's contact book page is changed
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/book/~sun)
  =/  cag=cage  (need (need peek))
  ;<  ~  b
    %+  ex-equal
    !>  cag
    !>  [%contact-page-0 !>(`page:c`[con-sun con-mod])]
  ::  and his effective contact is changed
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/contact/~sun)
  =/  cag=cage  (need (need peek))
  ;<  ~  b
    %+  ex-equal
    !>  cag
    !>  contact-1+!>((contact-uni:c con-sun con-mod))
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
  =/  cag  (need (need peek))
  ;<  ~  b  (ex-equal !>(cag) !>(contact-page-0+!>(*page:c)))
  :: (ex-equal !>(2) !>(2))
  ::  despite the removal, ~sun peer contact is unchanged
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/peer/~sun)
  =/  cag=cage  (need (need peek))
  %+  ex-equal
  !>  cag
  !>  contact-foreign-0+!>(`foreign`[[now.bowl con-sun] %want])
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
  =/  cag=cage  (need (need peek))
  ;<  ~  b
    %+  ex-equal
    !>  cag
    !>  contact-foreign-0+!>(`foreign`[[now.bowl con-sun] %want])
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
  =/  cag=cage  (need (need peek))
  %+  ex-equal
  !>  cag
  !>  contact-page-0+!>(`page:c`[con-sun con-mod])
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
  =/  cag=cage  (need (need peek))
  %+  ex-equal
  !>  cag
  !>  contact-foreign-0+!>(`foreign`[[now.bowl con-sun] ~])
::
+|  %peer
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
        (ex-fact ~ contact-update-1+!>([%full `@da`(add now.bowl tick) con]))
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
  ;<  caz=(list card)  b  (do-watch /v1/contact/at/(scot %da now.bowl))
  ;<  ~  b
    %+  ex-cards  caz
    :~  (ex-fact ~ contact-update-1+!>([%full now con]))
    ==
  ::  ~sun subscribes to /contact/at/(add now.bowl tick).
  ::  no update is sent - already at latest
  ::
  ;<  ~  b  (set-src ~sun)
  ;<  caz=(list card)  b  (do-watch /v1/contact/at/(scot %da now))
  %+  ex-cards  caz  ~
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
  =/  cag=cage  (need (need peek))
  ;<  ~  b
    %+  ex-equal
    !>  cag
    !>  contact-foreign-0+!>(`foreign`[[now.bowl con] %want])
  ;<  caz=(list card)  b
    (do-agent /contact [~sun %contacts] %fact contact-update-1+!>([%full (add now.bowl tick) mod]))
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/peer/~sun)
  =/  cag=cage  (need (need peek))
  ;<  ~  b
    %+  ex-equal
    !>  cag
    !>  contact-foreign-0+!>(`foreign`[[(add now.bowl tick) mod] %want])
  ;<  caz=(list card)  b
    (do-agent /contact [~sun %contacts] %kick ~)
  %+  ex-cards  caz
  :~  %^  ex-task  /contact
          [~sun %contacts]
          [%watch /v1/contact/at/(scot %da (add now.bowl tick))]
  ==
::
+|  %peek
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
  %+  ex-equal
  !>  cag
  !>  contact-page-0+!>(`page:c`[~ con-1])
  ::
  ;<  peek=(unit (unit cage))  b  (get-peek /u/v1/book/id/0v2)
  ;<  ~  b  (ex-equal q:(need (need peek)) !>(&))
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/book/id/0v2)
  =/  cag=cage  (need (need peek))
  :: ;<  ~  b
  %+  ex-equal
  !>  cag
  !>  contact-page-0+!>(`page:c`[~ con-2])
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
  ;<  peek=(unit (unit cage))  b  (get-peek /x/v1/all)
  =/  cag=cage  (need (need peek))
  ?>  ?=(%contact-directory-0 p.cag)
  =/  dir  !<(directory q.cag)
  ;<  ~  b
    %+  ex-equal
    !>  (~(got by dir) ~sun)
    !>  (contact-uni:c con-sun con-mod)
  %+  ex-equal
  !>  (~(got by dir) ~mur)
  !>  con-mur
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
--
