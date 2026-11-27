::  Hosted authoring uses the owner's default instructions and shared skills.
/-  h=harness
/+  hosted=harness-hosted-auth, hj=harness-json, j=harness-workspace-json,
    policy=harness-defaults, tz=harness-timezone
|%
++  soul-revision
  |=  body=@t
  (scot %uv (sham body))
++  soul-view
  |=  body=@t
  %+  envelope:hosted  200
  %-  pairs:enjs:format
  :~  ['body' %s body]
      ['revision' %s (soul-revision body)]
  ==
++  fields
  |=  [args=json names=(list @t)]
  ^-  ?
  ?.  ?=(%o -.args)  |
  %+  levy  ~(tap by p.args)
  |=  [name=@t value=json]
  (~(has in (silt names)) name)
++  apply-soul
  |=  [config=config:h args=json]
  ^-  [config=config:h response=json]
  ?>  ?=(%o -.args)
  ?:  =(~ p.args)  [config (soul-view system.config)]
  ?.  (fields args ~['revision' 'body'])
    [config (error:hosted 400 'Unsupported soul field.')]
  =/  expected  (get:j args 'revision')
  ?.  =(expected `[%s (soul-revision system.config)])
    [config (error:hosted 409 'Soul changed. Read it and retry.')]
  =/  body  (string:j args 'body')
  ?.  (lte (met 3 body) prompt-limit:policy)
    [config (error:hosted 400 'Soul must be at most 65536 bytes.')]
  [config(system body) (soul-view body)]
++  apply-skills
  |=  [skills=(map @t skill:h) args=json]
  ^-  [skills=(map @t skill:h) response=json]
  ?>  ?=(%o -.args)
  ?:  =(~ p.args)
    [skills (envelope:hosted 200 (skills-json:hj skills))]
  ?.  (fields args ~['name' 'revision' 'desc' 'body'])
    [skills (error:hosted 400 'Unsupported skill field.')]
  =/  name  (string:j args 'name')
  ?.  &(!=('' name) (lte (met 3 name) 128))
    [skills (error:hosted 400 'Skill name must be 1-128 bytes.')]
  =/  old  (~(get by skills) name)
  ?:  =(1 (lent ~(tap by p.args)))
    ?~  old  [skills (error:hosted 404 'Unknown skill.')]
    [skills (envelope:hosted 200 (skill-json:hj name u.old))]
  =/  expected  (get:j args 'revision')
  ?.  =(expected `[%s ?~(old '' (scot %uv (sham u.old)))])
    [skills (error:hosted 409 'Skill changed. Read it and retry.')]
  =/  desc  (string:j args 'desc')
  =/  body  (string:j args 'body')
  ?.  ?&  (lte (met 3 desc) 1.024)
          !=('' body)
          (lte (met 3 body) 65.536)
      ==
    [skills (error:hosted 400 'Description: up to 1024 bytes; instructions: 1-65536 bytes.')]
  [(~(put by skills) name [desc body]) (envelope:hosted 200 (skill-json:hj name [desc body]))]
++  timezone-revision
  |=  zone=(unit @t)
  (scot %uv (sham zone))
++  timezone-view
  |=  [zone=(unit @t) now=@da]
  ^-  json
  =/  clk  ?~(zone ~ (clock:tz u.zone now))
  %+  envelope:hosted  200
  %-  pairs:enjs:format
  :~  ['timezone' ?~(zone ~ [%s u.zone])]
      ['utcOffset' ?~(clk ~ [%s offset.u.clk])]
      ['revision' %s (timezone-revision zone)]
  ==
++  apply-timezone
  |=  [zone=(unit @t) args=json now=@da]
  ^-  [zone=(unit @t) response=json]
  ?>  ?=(%o -.args)
  ?:  =(~ p.args)  [zone (timezone-view zone now)]
  ?.  (fields args ~['revision' 'timezone'])
    [zone (error:hosted 400 'Unsupported timezone field.')]
  =/  expected  (get:j args 'revision')
  ?.  =(expected `[%s (timezone-revision zone)])
    [zone (error:hosted 409 'Timezone changed. Read it and retry.')]
  =/  supplied  (get:j args 'timezone')
  ?~  supplied
    [zone (error:hosted 400 'Expected timezone (IANA name or null).')]
  ?:  ?=(~ u.supplied)
    [~ (timezone-view ~ now)]
  ?.  ?=(%s -.u.supplied)
    [zone (error:hosted 400 'Expected timezone (IANA name or null).')]
  ?.  (valid:tz p.u.supplied)
    :-  zone
    %+  error:hosted  400
    'Invalid IANA timezone. Use a name such as America/Los_Angeles or UTC.'
  [`p.u.supplied (timezone-view `p.u.supplied now)]
--
