::  kits-json: JSON conversions for %kits types
::
/-  k=kits, g=groups
|%
++  enjs
  =,  enjs:format
  |%
  ++  flag
    |=  f=flag:g
    ^-  @t
    (rap 3 (scot %p p.f) '/' q.f ~)
  ++  nest
    |=  n=nest:g
    ^-  @t
    (rap 3 p.n '/' (flag q.n) ~)
  ++  vers
    |=  v=vers:v1:k
    ^-  @t
    %+  rap  3
    :~  (crip (a-co:co major.v))
        '.'
        (crip (a-co:co minor.v))
        '.'
        (crip (a-co:co patch.v))
    ==
  ::  +ref: how a workspace config names an installed kit
  ::
  ++  ref
    |=  [publisher=@p =id:k version=vers:v1:k]
    ^-  @t
    (rap 3 (scot %p publisher) '/' id '@' (vers version) ~)
  ++  manifest
    |=  m=manifest:v1:k
    ^-  json
    %-  pairs
    :~  ['id' s+id.m]
        ['name' s+name.m]
        ['version' s+(vers version.m)]
        ['publisher' s+(scot %p publisher.m)]
        ['description' s+description.m]
        ['image' ?~(image.m ~ s+u.image.m)]
        :-  'places'
        :-  %a
        %+  turn  places.m
        |=  p=place:v1:k
        %-  pairs
        :~  ['name' s+name.p]
            ['kind' s+kind.p]
            ['title' s+title.p]
            ['description' s+description.p]
        ==
        ['instructions' a+(turn instructions.m |=(f=@t s+f))]
        :-  'schedules'
        :-  %a
        %+  turn  schedules.m
        |=  s=schedule:v1:k
        %-  pairs
        :~  ['id' s+id.s]
            ['cron' s+cron.s]
            ['description' s+description.s]
            ['file' s+file.s]
            ['place' s+place.s]
        ==
        :-  'setup'
        ?~  setup.m  ~
        (pairs ~[['file' s+file.u.setup.m] ['place' s+place.u.setup.m]])
        :-  'scaffolds'
        :-  %a
        %+  turn  scaffolds.m
        |=  s=scaffold:v1:k
        (pairs ~[['file' s+file.s] ['title' s+title.s] ['place' s+place.s]])
    ==
  ++  kit
    |=  =kit:v1:k
    ^-  json
    %-  pairs
    :~  ['manifest' (manifest manifest.kit)]
        :-  'files'
        :-  %o
        %-  ~(run by files.kit)
        |=(c=@t `json`s+c)
    ==
  ++  install
    |=  i=install:v1:k
    ^-  json
    %-  pairs
    :~  ['id' s+id.i]
        ['version' s+(vers version.i)]
        ['publisher' s+(scot %p publisher.i)]
        ['bot' s+(scot %p bot.i)]
        :-  'places'
        :-  %o
        %-  ~(run by places.i)
        |=(n=nest:g `json`s+(nest n))
        ['routines' a+(turn (sort ~(tap in routines.i) aor) |=(r=@t s+r))]
        ['installed' s+(scot %da installed.i)]
    ==
  ++  update
    |=  u=update:v1:k
    ^-  json
    ?-  -.u
      %kit          (frond 'kit' (kit kit.u))
      %preview      (frond 'preview' (manifest manifest.u))
      %kits         (frond 'kits' a+(turn kits.u manifest))
      %uninstalled  (frond 'uninstalled' s+(flag flag.u))
        %installs
      %-  frond  :-  'installs'
      :-  %o
      %-  malt
      %+  turn  ~(tap by installs.u)
      |=  [f=flag:g i=install:v1:k]
      [(flag f) (install i)]
    ::
        %installed
      %-  frond  :-  'installed'
      %-  pairs
      :~  ['flag' s+(flag flag.u)]
          ['install' (install install.u)]
      ==
    ==
  --
++  dejs
  =,  dejs:format
  |%
  ++  fl
    ^-  $-(json flag:g)
    (su ;~((glue fas) ;~(pfix sig fed:ag) sym))
  ++  vr
    ^-  $-(json vers:v1:k)
    (su ;~((glue dot) dem dem dem))
  ++  manifest
    ^-  $-(json manifest:v1:k)
    %-  ot
    :~  id+(se %tas)
        name+so
        version+vr
        publisher+(se %p)
        description+so
        image+(mu so)
        :-  %places
        %-  ar
        %-  ot
        :~  name+(se %tas)
            kind+(cu |=(t=@tas ?>(?=(?(%chat %notebook %gallery) t) t)) (se %tas))
            title+so
            description+so
        ==
        instructions+(ar so)
        :-  %schedules
        %-  ar
        %-  ot
        :~  id+(se %tas)
            cron+so
            description+so
            file+so
            place+(se %tas)
        ==
        setup+(mu (ot ~[file+so place+(se %tas)]))
        scaffolds+(ar (ot ~[file+so title+so place+(se %tas)]))
    ==
  ++  kit
    ^-  $-(json kit:v1:k)
    (ot ~[manifest+manifest files+(om so)])
  ++  action
    ^-  $-(json action:v1:k)
    %-  of
    :~  [%add (ot ~[kit+kit])]
        [%del (ot ~[id+(se %tas)])]
        [%fetch (ot ~[ship+(se %p) id+(se %tas)])]
      ::
        :-  %install
        %-  ot
        :~  id+(se %tas)
            name+(se %tas)
            meta+(ot ~[title+so description+so image+so cover+so])
            bot+(se %p)
            tz+(mu so)
        ==
      ::
        [%uninstall (ot ~[flag+fl])]
    ==
  --
--
