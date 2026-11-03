::  channel-utils unit tests
::
::    covers the $said builders behind the /vN/said post-reference endpoints
::    (TLON-6536). hosts store reacts as unicode glyphs, and the v9/v10 output
::    types carry them as-is. the builders used to run post reacts through the
::    v7 shortcode conversion anyway; a `:laughing:` shortcode is a valid @t so
::    the output cast never caught it. these lock in glyph passthrough for both
::    the v4 (said-3) and v5 (said-4) builders, for posts and replies.
::
/-  c=channels, cv=channels-ver
/+  *test, utils=channel-utils
|%
++  the-nest  `nest:c`[%chat ~zod %test]
++  post-id   `id-post:c`~2026.1.1
++  reply-id  `id-reply:c`~2026.1.2
++  glyph     '😆'
::  +the-reacts: the one react as every v9+ consumer should see it
::
++  the-reacts    `reacts:c`(my ~[[~bus glyph]])
++  the-v-reacts  `v-reacts:c`(my ~[[~bus [0 `glyph]]])
++  the-memo      `memo:c`[~[[%inline ~['hi']]] ~zod post-id]
++  the-v-reply
  ^-  v-reply:c
  :-  [reply-id the-v-reacts]
  [0 the-memo ~]
++  the-v-post
  ^-  v-post:c
  :-  :*  post-id
          1
          post-id
          (gas:on-v-replies:c *v-replies:c ~[[reply-id &+the-v-reply]])
          the-v-reacts
      ==
  [0 the-memo /chat ~ ~]
++  the-posts
  ^-  v-posts:c
  (gas:on-v-posts:c *v-posts:c ~[[post-id &+the-v-post]])
::  +post-reacts-4 / +reply-reacts-4: pull reacts off a v10 $said
::
++  post-reacts-4
  |=  =said:c
  ^-  reacts:c
  ?>  ?=(%post -.q.said)
  ?>  ?=(%& -.post.q.said)
  reacts.+.post.q.said
++  reply-reacts-4
  |=  =said:c
  ^-  reacts:c
  ?>  ?=(%reply -.q.said)
  ?>  ?=(%& -.reply.q.said)
  reacts.+.reply.q.said
::  +post-reacts-3 / +reply-reacts-3: pull reacts off a v9 $said
::
++  post-reacts-3
  |=  =said:v9:cv
  ^-  reacts:c
  ?>  ?=(%post -.q.said)
  ?>  ?=(%& -.post.q.said)
  reacts.+.post.q.said
++  reply-reacts-3
  |=  =said:v9:cv
  ^-  reacts:c
  ?>  ?=(%reply -.q.said)
  ?>  ?=(%& -.reply.q.said)
  reacts.+.reply.q.said
::  /v5/said: post reacts stay unicode
::
++  test-said-4-post-reacts-stay-unicode
  =/  =cage  (said-4:utils the-nest [post-id ~] the-posts)
  =/  =said:c  !<(said:c q.cage)
  ;:  weld
    (expect-eq !>(%channel-said-3) !>(p.cage))
    (expect-eq !>(the-nest) !>(p.said))
    (expect-eq !>(the-reacts) !>((post-reacts-4 said)))
  ==
::  /v5/said: reply reacts stay unicode
::
++  test-said-4-reply-reacts-stay-unicode
  =/  =cage  (said-4:utils the-nest [post-id `reply-id] the-posts)
  =/  =said:c  !<(said:c q.cage)
  ;:  weld
    (expect-eq !>(%channel-said-3) !>(p.cage))
    (expect-eq !>(the-reacts) !>((reply-reacts-4 said)))
  ==
::  /v4/said: post reacts stay unicode
::
++  test-said-3-post-reacts-stay-unicode
  =/  =cage  (said-3:utils the-nest [post-id ~] the-posts)
  =/  =said:v9:cv  !<(said:v9:cv q.cage)
  ;:  weld
    (expect-eq !>(%channel-said-2) !>(p.cage))
    (expect-eq !>(the-reacts) !>((post-reacts-3 said)))
  ==
::  /v4/said: reply reacts stay unicode
::
++  test-said-3-reply-reacts-stay-unicode
  =/  =cage  (said-3:utils the-nest [post-id `reply-id] the-posts)
  =/  =said:v9:cv  !<(said:v9:cv q.cage)
  ;:  weld
    (expect-eq !>(%channel-said-2) !>(p.cage))
    (expect-eq !>(the-reacts) !>((reply-reacts-3 said)))
  ==
--
