::  Hosted authoring uses the owner's default instructions and shared skills.
/-  h=harness
/+  hosted=harness-hosted-auth, hj=harness-json, j=harness-workspace-json
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
  ?.  (lte (met 3 body) 65.536)
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
--
