/-  h=harness, *harness-store
/+  *test, ix=harness-session-index, storage=harness-store
|%
++  test-modification-only-stamps-changed-sessions
  =/  original=session:h  [~[[%command-completed 0v1 'memory' 'no notes']] 0]
  =/  changed  original(log [[%command-completed 0v2 'memory' 'no notes'] log.original])
  =/  before  (my ~[['unchanged' original] ['changed' original] ['deleted' original]])
  =/  after  (my ~[['unchanged' original] ['changed' changed] ['new' original]])
  =/  prior  (my ~[['unchanged' ~2026.1.1] ['changed' ~2026.1.1] ['deleted' ~2026.1.1]])
  =/  got  (update:ix before after prior ~2026.9.6)
  (expect-eq !>((my ~[['unchanged' ~2026.1.1] ['changed' ~2026.9.6] ['new' ~2026.9.6]])) !>(got))
++  test-read-only-comparison-preserves-index
  =/  sessions  (my ~[['a' *session:h]])
  =/  prior  (my ~[['a' ~2026.1.1]])
  (expect-eq !>(prior) !>((update:ix sessions sessions prior ~2026.9.6)))
--
