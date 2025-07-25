::  tests for metagrab utilities
::
/+  *test, mg=metagrab
|%
++  expect-url-equivalence
  |=  [expect=@t have=@t]
  ^-  tang
  ?:  =(expect have)  ~
  ::  eg.com vs eg.com/ doesn't matter
  ::
  =+  e=(need (de-purl:html expect))
  =+  h=(need (de-purl:html have))
  =?  q.q.e  =(/$ q.q.e)  /
  =?  q.q.h  =(/$ q.q.h)  /
  ?:  =(e h)  ~
  (expect-eq !>(expect) !>(have))
::
++  test-expand-url-a
  %+  expect-url-equivalence
    'http://net.com/blah'
  (expand-url:mg 'http://net.com/foo/bar' '../blah')
++  test-expand-url-b
  %+  expect-url-equivalence
    'http://net.com/foo/blah'
  (expand-url:mg 'http://net.com/foo/bar/' '../blah')
++  test-expand-url-c
  %+  expect-url-equivalence
    'http://net.com/foo/blah'
  (expand-url:mg 'http://net.com/foo/bar' './blah')
++  test-expand-url-d
  %+  expect-url-equivalence
    'http://net.com/foo/bar/blah'
  (expand-url:mg 'http://net.com/foo/bar/' './blah')
++  test-expand-url-e
  %+  expect-url-equivalence
    'http://net.com/blah'
  (expand-url:mg 'http://net.com/foo/bar/' '../../../blah')
++  test-expand-url-f
  %+  expect-url-equivalence
    'http://blah/'
  (expand-url:mg 'http://net.com/foo/bar/' '//blah')
++  test-expand-url-g
  %+  expect-url-equivalence
    'http://net.com/blah'
  (expand-url:mg 'http://net.com/foo/bar/' '/blah')
::
++  test-expand-url-basic-relative-path
  %+  expect-url-equivalence
    'http://example.com/about'
  (expand-url:mg 'http://example.com' 'about')
++  test-expand-url-file-relative-path
  %+  expect-url-equivalence
    'http://example.com/post.html'
  (expand-url:mg 'http://example.com/blog' 'post.html')
++  test-expand-url-directory-relative-path
  %+  expect-url-equivalence
    'http://example.com/blog/post.html'
  (expand-url:mg 'http://example.com/blog/' 'post.html')
::i
++  test-expand-url-parent-directory-navigation
  %+  expect-url-equivalence
    'http://example.com/archive'
  (expand-url:mg 'http://example.com/blog/' '../archive')
++  test-expand-url-multiple-parent-navigation
  %+  expect-url-equivalence
    'http://example.com/a/d'
  (expand-url:mg 'http://example.com/a/b/c/' '../../d')
::
++  test-expand-url-root-relative-path
  %+  expect-url-equivalence
    'http://example.com/images/logo.png'
  (expand-url:mg 'http://example.com' '/images/logo.png')
++  test-expand-url-protocol-relative-url
  %+  expect-url-equivalence
    'http://cdn.example.com/lib.js'
  (expand-url:mg 'http://example.com/blog/' '//cdn.example.com/lib.js')
::
++  test-expand-url-query-string-replacement
  %+  expect-url-equivalence
    'http://example.com/?filter=new'
  (expand-url:mg 'http://example.com?page=1' '?filter=new')
:: ++  test-expand-url-fragment-replacement
::   %+  expect-url-equivalence
::     'http://example.com/blog#new-section'
::   (expand-url:mg 'http://example.com/blog#sec' '#new-section')
++  test-expand-url-empty-href-handling
  %+  expect-url-equivalence
    'http://example.com/'
  (expand-url:mg 'http://example.com' '')
++  test-expand-url-excessive-parent-traversals
  %+  expect-url-equivalence
    'http://example.com/d'
  (expand-url:mg 'http://example.com/a/b/c' '../../../../d')
::
++  test-expand-url-relative-path-with-dot-slash
  %+  expect-url-equivalence
    'http://example.com/blog/meta/about.html'
  (expand-url:mg 'http://example.com/blog/' './meta/about.html')
:: ++  test-expand-url-path-cleaning-dot-dot-slash
::   %+  expect-url-equivalence
::     'http://example.com/bar/baz'
::   (expand-url:mg 'http://example.com' 'foo/../bar/./baz')
:: ++  test-expand-url-absolute-url-preservation
::   %+  expect-url-equivalence
::     'http://example.com/a/d'
::   (expand-url:mg 'http://example.com/a/b/' '.././c/../d')
++  test-expand-url-absolute-url-preservation
  %+  expect-url-equivalence
    'http://other.site/page'
  (expand-url:mg 'http://example.com' 'http://other.site/page')
++  test-expand-url-query-string-addition-to-file-url
  %+  expect-url-equivalence
    'http://example.com/blog/post?edit=true'
  (expand-url:mg 'http://example.com/blog/post' '?edit=true')
++  test-expand-url-fragment-addition-to-root-url
  %+  expect-url-equivalence
    'http://example.com/#features'
  (expand-url:mg 'http://example.com' '#features')
--
