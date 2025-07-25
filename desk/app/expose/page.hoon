::  expose page: rendering for content pages
::
/-  c=cite, d=channels, co=contacts-0
/+  u=channel-utils
::
/=  r  /app/expose/render
/*  style-page    %css  /app/expose/style/page/css
::
|%
++  render
  |=  [=bowl:gall =nest:g:c msg=post:d]
  ^-  (unit manx)
  =/  author=@p
    (get-author-ship:u author.msg)
  =/  aco=(unit contact-0:co)
    (get-author-contact:r bowl author.msg)
  ::
  ::TODO  if we render replies then we can "unroll" whole chat threads too (:
  |^  ?+  kind.msg  ~
          [%chat *]
        =/  title=tape
          (trip (rap 3 (turn (first-inline:u content.msg) flatten-inline:u)))
        %-  some
        %:  build  "chat"
          (heads title ~)
          (prelude ~)
          (story:en-manx:u content.msg)
        ==
      ::
          [%diary *]
        =/  [title=@t image=@t]
          ?~  meta.msg  ['' '']
          [title image]:u.meta.msg
        =+  title=(trip title)
        %-  some
        %:  build  "diary"
          (heads title ?:(=('' image) ~ `image))
        ::
          ?:  =('' image)  (prelude `title)
          :-  ;img.cover@"{(trip image)}"(alt "Cover image");
          (prelude `title)
        ::
          (story:en-manx:u content.msg)
        ==
      ::
          [%heap *]
        =/  title=tape
          ?^  meta.msg
            (trip title.u.meta.msg)
          ::NOTE  could flatten the first-inline, but we don't. showing that
          ::      as both h1 and content is strange
          ""
        %-  some
        %:  build  "chat"
          (heads ?:(=("" title) "Gallery item" title) ~)
          (prelude `title)
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
        ;article.expose-content
          ;header
            ;*  pre
          ==
          ;*  bod
        ==
        ;+  badge
      ==
      ;+  time-script-node:r
    ==
  ::
  ++  heads
    |=  [title=tape img=(unit @t)]
    ;head
      ;title:"{title}"
      ;link(rel "stylesheet", href "/profile/style/shared.css");
      ;style:"{(trip style-page)}"
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
      ;meta(property "og:article:author:username", content (scow %p author));
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
  ++  badge
    ;div.tlon-badge
      ;a(href "https://tlon.io")
        ;span
          ; Powered by Tlon
        ==
      ==
    ==
  ::
  ++  prelude
    |=  title=(unit tape)
    ^-  marl
    =/  main=manx
      ;div.author-row
        ;+  =;  link=(unit @t)
              (%*(. author:r link link) bowl author)
            ?.  =(our.bowl author)  ~
            ?.  .^(? %gu /(scot %p our.bowl)/profile/(scot %da now.bowl)/$)  ~
            `'/profile'
        ;+  (datetime:r sent.msg)
      ==
    ?~  title  [main]~
    ?:  =("" u.title)  [main]~
    :~  ;h1:"{u.title}"
        main
    ==
  --
--
