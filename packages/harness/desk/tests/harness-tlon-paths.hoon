/+  *test, paths=harness-tlon-paths
|%
++  test-dm-writs-bind-local-ship-time-and-peer
  ;:  weld
      %+  expect-eq
        !>(/~lux/chat/~2026.10.1/v4/dm/~nec/writs)
      !>((dm-writs:~(. paths [~lux ~2026.10.1]) ~nec))
      %+  expect-eq
        !>(/~nec/chat/~2026.10.2/v4/dm/~bud/writs)
      !>((dm-writs:~(. paths [~nec ~2026.10.2]) ~bud))
  ==
++  test-dm-post-uses-author-and-decimal-durable-id
  =/  at=@da  ~2026.9.6
  =/  expected
    /~lux/chat/~2026.10.1/v4/dm/~nec/writs/writ/id/~bud/(scot %ud at)/chat-writ-4
  %+  expect-eq
    !>(expected)
  !>((dm-post:~(. paths [~lux ~2026.10.1]) ~nec [~bud at]))
++  test-channel-posts-keep-protocol-and-nest-explicit
  =/  read-path  ~(. paths [~lux ~2026.10.1])
  ;:  weld
      %+  expect-eq
        !>(/~lux/channels/~2026.10.1/v4/chat/~nec/general/posts)
      !>((channel-posts:read-path %v4 [%chat ~nec %general]))
      %+  expect-eq
        !>(/~lux/channels/~2026.10.1/v5/diary/~bud/notes/posts)
      !>((channel-posts:read-path %v5 [%diary ~bud %notes]))
      %+  expect-eq
        !>(/~nec/channels/~2026.10.2/v4/heap/~bud/gallery/posts)
      !>((channel-posts:~(. paths [~nec ~2026.10.2]) %v4 [%heap ~bud %gallery]))
  ==
++  test-channel-replies-append-the-exact-parent
  =/  parent=@da  ~2026.9.6
  =/  prefix  /~lux/channels/~2026.10.1/v5/chat/~nec/general/posts
  =/  expected  (weld prefix /post/id/(scot %ud parent)/replies)
  %+  expect-eq
    !>(expected)
  !>((channel-replies:~(. paths [~lux ~2026.10.1]) %v5 [%chat ~nec %general] parent))
++  test-channel-address-keeps-protocol-and-nest
  =/  read-path  ~(. paths [~lux ~2026.10.1])
  ;:  weld
      %+  expect-eq
        !>(/~lux/channels/~2026.10.1/v4/chat/~nec/general)
      !>((channel:read-path %v4 [%chat ~nec %general]))
      %+  expect-eq
        !>(/~lux/channels/~2026.10.1/v5/diary/~bud/notes)
      !>((channel:read-path %v5 [%diary ~bud %notes]))
  ==
++  test-channel-permissions-use-the-unversioned-native-address
  =/  read-path  ~(. paths [~lux ~2026.10.1])
  ;:  weld
      %+  expect-eq
        !>(/~lux/channels/~2026.10.1/diary/~nec/notes/perm/channel-perm)
      !>((channel-permissions:read-path [%diary ~nec %notes]))
      %+  expect-eq
        !>(/~lux/channels/~2026.10.1/heap/~bud/gallery/perm/channel-perm)
      !>((channel-permissions:read-path [%heap ~bud %gallery]))
  ==
++  test-club-post-uses-club-author-and-decimal-durable-id
  =/  at=@da  ~2026.9.6
  =/  expected
    /~nec/chat/~2026.10.2/v4/club/0v2a/writs/writ/id/~bud/(scot %ud at)/chat-writ-4
  %+  expect-eq
    !>(expected)
  !>((club-post:~(. paths [~nec ~2026.10.2]) 0v2a [~bud at]))
++  test-group-can-read-keeps-local-context-and-group-identity
  ;:  weld
      %+  expect-eq
        !>(/~lux/groups/~2026.10.1/v2/groups/~nec/general/channels/can-read/noun)
      !>((group-can-read:~(. paths [~lux ~2026.10.1]) [~nec %general]))
      %+  expect-eq
        !>(/~nec/groups/~2026.10.2/v2/groups/~bud/club/channels/can-read/noun)
      !>((group-can-read:~(. paths [~nec ~2026.10.2]) [~bud %club]))
  ==
--
