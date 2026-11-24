::  Explicit clearweb exposure of a single existing native channel post.
::  Public paths are relative to this ship; never invent its external domain.
/-  cite
/+  spec=harness-tlon-tool, message=harness-tlon-message-tool
|_  bowl=bowl:gall
++  handles
  |=  action=@t
  =/  actions=(list @t)
    :~  'list_publications'
        'get_publication'
        'publish_post'
        'unpublish_post'
    ==
  (lien actions |=(item=@t =(item action)))
++  published
  ^-  (set cite:cite)
  ?>  .^(? %gu /(scot %p our.bowl)/expose/(scot %da now.bowl)/$)
  .^((set cite:cite) %gx /(scot %p our.bowl)/expose/(scot %da now.bowl)/show/noun)
++  citation-kind
  |=  kind=@tas
  ^-  @ta
  ?+  kind  !!
    %chat  %msg
    %diary  %note
    %heap  %curio
  ==
++  reference
  |=  args=json
  ^-  cite:cite
  ::  Exposure addresses a root channel post, by citation or message identity.
  ?>  &(!(has:spec args 'ship') !(has:spec args 'parent'))
  ?.  (has:spec args 'citation')
    =/  nest  (nest:spec (required:spec args 'channel' 256))
    =/  stamp  (timestamp:spec (required:spec args 'message_id' 128))
    [%chan nest (citation-kind kind.nest) (crip (a-co:co stamp)) ~]
  ?>  &(!(has:spec args 'channel') !(has:spec args 'message_id'))
  =/  raw  (required:spec args 'citation' 1.024)
  =/  ref  (parse:cite (need (rush raw stap)))
  ?>  =((spat (print:cite ref)) raw)
  ?>  ?=([%chan * ?(%msg %note %curio) @ ~] ref)
  ?>  ?=(?(%chat %diary %heap) p.nest.ref)
  ?>  =(i.wer.ref (citation-kind p.nest.ref))
  ::  Native citations use ungrouped decimal, unlike channel scry paths.
  =/  stamp  (rash i.t.wer.ref dum:ag)
  ?>  ?&  =(i.t.wer.ref (crip (a-co:co stamp)))
          (gth stamp 0)
          (lte (met 0 stamp) 128)
      ==
  ref
++  row
  |=  ref=cite:cite
  =/  citation  (spat (print:cite ref))
  %-  pairs:enjs:format
  :~  ['citation' %s citation]
      ['public_path' %s (cat 3 '/expose' citation)]
  ==
++  run
  |=  [args=json wire=wire]
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  action  (required:spec args 'action' 32)
  ?:  =('list_publications' action)
    [(en:json:html (directory:spec args (turn ~(tap in published) row))) ~]
  =/  ref  (reference args)
  =/  visible  (~(has in published) ref)
  =/  citation  (spat (print:cite ref))
  =/  info
    %-  pairs:enjs:format
    :~  ['citation' %s citation]
        ['published' %b visible]
        ['public_path' ?:(visible [%s (cat 3 '/expose' citation)] ~)]
        :*  'note'  %s
            'Relative to this ship HTTP origin. Public reachability depends on hosting; unpublishing cannot erase third-party copies.'
        ==
    ==
  ?:  =('get_publication' action)  [(en:json:html info) ~]
  ?>  =(citation (required:spec args 'confirm' 1.024))
  =/  show  =('publish_post' action)
  ?>  |(show =('unpublish_post' action))
  ::  Hiding a post does not depend on whether its source remains readable.
  =/  readable
    ?.  show  &
    ?>  ?=([%chan * ?(%msg %note %curio) @ ~] ref)
    ?>  ?=(?(%chat %diary %heap) p.nest.ref)
    ::  Exact local read proves that this is an existing accessible post.
    =/  post  (channel-post:~(. message bowl) nest.ref (rash i.t.wer.ref dum:ag))
    (gth sent:+.+.post 0)
  ?>  readable
  =/  payload  (pairs:enjs:format ~[[?:(show 'show' 'hide') %s citation]])
  :-  %:  rap
        3
        'accepted: local public exposure changed; verify get_publication. Public path: /expose'
        citation
        ~
      ==
  `[%pass wire %agent [our.bowl %expose] %poke %json !>(payload)]
--
