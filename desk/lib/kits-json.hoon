::  kits-json: JSON conversions for %kits types
::
/-  k=kits, c=channels, g=groups
=,  format
|%
++  enjs
  =,  enjs:format
  |%
  ++  flag
    |=  f=flag:g
    ^-  @t
    (rap 3 (scot %p p.f) '/' q.f ~)
  ++  nest
    |=  n=nest:v1:k
    ^-  @t
    (rap 3 kind.n '/' (scot %p host.n) '/' name.n ~)
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
        ['scope' s+scope.m]
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
        :-  'bindings'
        :-  %a
        %+  turn  bindings.m
        |=  b=binding:v1:k
        %-  pairs
        :~  ['file' s+file.b]
            ['scope' s+scope.b]
            ['trigger' ?~(trigger.b ~ s+u.trigger.b)]
            ['load' s+load.b]
        ==
        :-  'schedules'
        :-  %a
        %+  turn  schedules.m
        |=  s=schedule:v1:k
        (pairs ~[['id' s+id.s] ['cron' s+cron.s] ['description' s+description.s]])
        :-  'scaffolds'
        :-  %a
        %+  turn  scaffolds.m
        |=  s=scaffold:v1:k
        (pairs ~[['file' s+file.s] ['workspace' s+workspace.s]])
        ['policy' ?~(policy.m ~ s+u.policy.m)]
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
        :-  'places'
        :-  %o
        %-  malt
        %+  turn  ~(tap by places.i)
        |=  [n=@tas cn=nest:v1:k]
        [n `json`s+(nest cn)]
        ['setup' s+setup.i]
        ['installed' s+(scot %da installed.i)]
    ==
  ++  config
    |=  [our=@p i=install:v1:k schedules=(list schedule:v1:k)]
    ^-  json
    %-  pairs
    :~  ['version' n+'1']
        :-  'kits'
        :-  %a  :_  ~
        %-  pairs
        :~  ['installId' s+(rap 3 id.i '-0' ~)]
            :-  'kit'
            %-  pairs
            :~  ['id' s+id.i]
                ['version' s+(vers version.i)]
                ['publisher' s+(scot %p publisher.i)]
            ==
            :-  'places'
            :-  %o
            %-  malt
            %+  turn  ~(tap by places.i)
            |=  [n=@tas cn=nest:v1:k]
            [n `json`s+(nest cn)]
            ::  declared, not running. A kit's schedule is offered to the
            ::  household after their first result and only then switched
            ::  on; installing one must not start it firing.
            :-  'schedules'
            :-  %a
            %+  turn  schedules
            |=  s=schedule:v1:k
            (pairs ~[['id' s+id.s] ['cron' s+cron.s] ['enabled' b+|]])
            ['agents' a+~[s+(scot %p our)]]
            ['setup' s+setup.i]
            ['installedAt' (time installed.i)]
        ==
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
        scope+(cu |=(t=@tas ?>(?=(?(%group %dm %agent) t) t)) (se %tas))
        :-  %places
        %-  ar
        %-  ot
        :~  name+(se %tas)
            ::  a place kind this build cannot create is refused here, at the
        ::  mark boundary, rather than at install: refusing the whole kit
        ::  is better than instantiating a workspace with a missing place.
        kind+(cu |=(t=@tas ?>(?=(?(%chat %notebook %gallery %notes) t) t)) (se %tas))
            title+so
            description+so
        ==
        :-  %bindings
        %-  ar
        %-  ot
        :~  file+so
            scope+(cu |=(t=@tas ?>(?=(?(%group %dm %agent) t) t)) (se %tas))
            trigger+(mu so)
            load+(cu |=(t=@tas ?>(?=(?(%ambient %on-trigger %pulled) t) t)) (se %tas))
        ==
        schedules+(ar (ot ~[id+(se %tas) cron+so description+so]))
        scaffolds+(ar (ot ~[file+so workspace+so]))
        policy+(mu so)
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
        [%install (ot ~[id+(se %tas) name+(se %tas) meta+(ot ~[title+so description+so image+so cover+so])])]
        [%uninstall (ot ~[flag+fl])]
        [%setup-done (ot ~[flag+fl])]
    ==
  --
--
