|%
::  $data: generic metadata for various entities
::
::    title: the pretty text representing what something is called
::    description: a longer text entry giving a detailed summary
::    image: an image URL or color string used as an icon/avatar
::    cover: an image URL or color string, used as a header
::
+$  data
  $:  title=cord
      description=cord
      image=cord
      cover=cord
  ==
+$  diff
  $%  [%title =cord]
      [%description =cord]
      [%image =cord]
      [%cover =cord]
  ==
--
