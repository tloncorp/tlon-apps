::  sigil-symbols: svg symbols for phonemes, for use in /lib/sigil
::
::    the map is keyed by phoneme cords and allows a function to 
::    generate lists of manxes based on fore- and background colors,
::    intended to be wrapped up in an svg <g> for further processing.
::
::    shapes and default attributes sourced from:
::    https://github.com/urbit/sigil-js/blob/fdea06f/src/index.json
::
::NOTE  to reduce svg size, we exclude certain common/shared attributes.
::      we expect the /lib/sigil to wrap these elements in a <g> which sets
::      those attributes, letting them be inherited. they are as follows:
::        =fill    fg
::        =stroke  bg
::        =stroke-linecap  "square"
::        =stroke-width
::      we assume the defaults specified above, and only include those
::      attributes below if they deviate from those. (this includes adding
::      stroke="none" for elements whose original specification did not
::      include a stroke.)
::      unfortunately, the vector-effect attribute cannot be inherted by <g>
::      children, so we have to inline it for every element here.
::      for ease of change, we leave excluded attributes as comments here.
::
%-  ~(gas by *(map cord (list manx)))
=/  fg  "fg"
=/  bg  "bg"
:~
  :-  'bac'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'bal'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "32.0072"
        =x2  "32.7071"
        =y2  "127.3"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "64.0072"
        =x2  "64.7071"
        =y2  "127.3"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "96.0072"
        =x2  "96.7071"
        =y2  "127.3"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'ban'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0C128 70.6924 70.6924 128 -1.52588e-05 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'bar'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'bat'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0C128 35.3462 99.3462 64 64 64C28.6538 64 0 35.3462 0 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'bec'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'bel'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ben'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "8"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'bep'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64C92.6538 64 64 92.6538 64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ber'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M96 0L96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'bes'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 128C64 92.6538 35.3462 64 0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'bet'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "16.0036"
        =y1  "15.9965"
        =x2  "48.0036"
        =y2  "47.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'bex'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "16.0036"
        =y1  "15.9965"
        =x2  "48.0036"
        =y2  "47.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'bic'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 96C74.9807 96 32 53.0193 32 -4.19629e-06"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'bid'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 0C32 70.6925 74.9807 128 128 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'bil'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0035"
        =y1  "79.9965"
        =x2  "112.004"
        =y2  "111.997"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'bin'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
  ==
::
  :-  'bis'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-8.87604e-09"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "96"
        =x2  "-8.87604e-09"
        =y2  "96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "32"
        =x2  "-8.87604e-09"
        =y2  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'bit'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'bol'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-4.37114e-08"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'bon'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 128C92.6538 128 64 99.3462 64 64C64 28.6538 92.6538 4.215e-07 128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'bor'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M0 128C4.63574e-06 92.6489 14.3309 60.6449 37.5 37.4807"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 128C32 101.492 42.7436 77.4939 60.1138 60.1217"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 128C64 110.328 71.1626 94.3287 82.7432 82.7471"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M95.6284 128C95.6284 119.164 99.2097 111.164 105 105.374"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'bos'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'bot'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "32"
        =y1  "2.18557e-08"
        =x2  "32"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'bud'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M16 64C16 90.5097 37.4903 112 64 112"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'bur'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M7.37542e-06 -3.56072e-06C1.19529e-06 70.6924 57.3075 128 128 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'bus'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 128C32 110.327 17.6731 96 0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'byl'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M22.1288 22.6299C16.0075 28.7511 8.0234 31.874 0.00134547 31.9986M44.7562 45.2573C32.3866 57.6269 16.2133 63.8747 0.00134277 64.0005M67.3836 67.8847C48.7656 86.5027 24.403 95.8749 0.00134412 96.0012"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'byn'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0C128 35.3511 113.669 67.3551 90.5 90.5193"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 0C96 26.5077 85.2564 50.5061 67.8862 67.8783"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 0C64 17.6721 56.8374 33.6713 45.2568 45.2529"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32.3716 0C32.3716 8.83603 28.7903 16.8356 23 22.6264"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'byr'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "48"
        =cy  "80"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "48"
        =cy  "80"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'byt'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dab'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =y1  "-0.5"
        =x2  "45.2548"
        =y2  "-0.5"
        =transform  "matrix(0.707107 -0.707107 -0.707107 -0.707107 79.65 47.6499)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'dac'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64L-5.96046e-08 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dal'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "63.29"
        =y2  "63.2929"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "32.0072"
        =x2  "32.7071"
        =y2  "127.3"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "64.0072"
        =x2  "64.7071"
        =y2  "127.3"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "96.0072"
        =x2  "96.7071"
        =y2  "127.3"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'dan'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "96"
        =y1  "2.18557e-08"
        =x2  "96"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dap'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0035"
        =y1  "79.9964"
        =x2  "112.004"
        =y2  "111.996"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'dar'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;path
        =d  "M86.6274 86.6274C99.1242 74.1307 99.1242 53.8694 86.6274 41.3726C74.1306 28.8758 53.8694 28.8758 41.3726 41.3726"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M75.3137 75.3137C81.5621 69.0653 81.5621 58.9347 75.3137 52.6863C69.0653 46.4379 58.9347 46.4379 52.6863 52.6863"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M97.9411 97.9411C116.686 79.1959 116.686 48.804 97.9411 30.0589C79.196 11.3137 48.804 11.3137 30.0589 30.0589"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'das'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'dat'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 128C92.6538 128 64 99.3462 64 64C64 28.6538 92.6538 -1.54503e-06 128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dav'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 64C96 46.3269 81.6731 32 64 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'deb'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 -6.35781e-07C64 35.3462 35.3462 64 0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dec'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "112"
        =cy  "16"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "112"
        =cy  "16"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'def'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M0 128L128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M0 94L94 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M0 64L64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M0 32L32 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'deg'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 128C64 92.6538 35.3462 64 0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'del'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'dem'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M64 -6.35781e-07C64 35.3462 35.3462 64 0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'den'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M1.52575e-06 96C53.0193 96 96 53.0193 96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'dep'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 128C32 101.492 42.7436 77.4939 60.1138 60.1216"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 128C64 110.328 71.1626 94.3287 82.7432 82.7471"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M95.6284 128C95.6284 119.164 99.2097 111.164 105 105.374"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'der'
  :~  ;path
        =d  "M0 64L5.59506e-06 0L128 1.11901e-05V64C128 99.3462 99.3462 128 64 128C28.6538 128 -4.6351e-06 99.3462 0 64Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M96 128L96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'des'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M96 0L96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'det'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "15.9964"
        =y1  "111.996"
        =x2  "47.9964"
        =y2  "79.9964"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dev'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "96.5"
        =y1  "3.07317e-08"
        =x2  "96.5"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "32.5"
        =y1  "3.07317e-08"
        =x2  "32.5"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'dex'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'dib'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "8.74228e-08"
        =y1  "64"
        =x2  "128"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "5.25874e-08"
        =y1  "32"
        =x2  "128"
        =y2  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'dif'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M60.1244 67.3837C41.5063 48.7657 32.1342 24.4031 32.0079 0.00145601M82.7518 44.7563C70.3822 32.3867 64.1344 16.2134 64.0086 0.00145196M105.379 22.1289C99.258 16.0077 96.1351 8.02351 96.0105 0.00145196"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "16"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "16"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'dig'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64.5"
        =y1  "-0.5"
        =x2  "64.5"
        =y2  "127.5"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "16.0035"
        =y1  "15.9965"
        =x2  "48.0035"
        =y2  "47.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dil'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0036"
        =y1  "79.9964"
        =x2  "112.004"
        =y2  "111.996"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'din'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "96"
        =y1  "2.18557e-08"
        =x2  "96"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dir'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M96 64C96 81.6731 81.6731 96 64 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "16.0035"
        =y1  "15.9965"
        =x2  "48.0035"
        =y2  "47.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dis'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.0029152 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'div'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-4.19629e-06 96C70.6924 96 128 53.0193 128 5.59506e-06"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-2.79753e-06 64C70.6924 64 128 35.3462 128 5.59506e-06"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'doc'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M127.997 0L-0.00291443 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M86.6274 41.3726C74.1306 28.8758 53.8694 28.8758 41.3726 41.3726C28.8758 53.8694 28.8758 74.1306 41.3726 86.6274"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dol'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-4.19629e-06 16C26.5097 16 48 37.4903 48 64C48 90.5097 26.5097 112 0 112"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'don'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-3.8147e-06 128C-7.24632e-07 92.6538 28.6538 64 64 64C99.3462 64 128 92.6538 128 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dop'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 112C90.5097 112 112 90.5097 112 64C112 37.4903 90.5097 16 64 16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'dor'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =y1  "63.5"
        =x2  "128"
        =y2  "63.5"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dos'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M86.6274 86.6274C99.1242 74.1306 99.1242 53.8693 86.6274 41.3725C74.1306 28.8758 53.8694 28.8758 41.3726 41.3725"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dot'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'dov'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M-0.701724 31.9914C25.6281 31.9914 49.4822 42.5913 66.8261 59.7565M-0.701723 63.9914C16.7916 63.9914 32.6456 71.0098 44.1982 82.3844M-0.701722 95.9914C7.955 95.9914 15.8089 99.4288 21.5694 105.013"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M0 0C35.3511 0 67.3551 14.3309 90.5193 37.5"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'doz'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 128L0 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M30.0589 30.0589C48.804 11.3137 79.196 11.3137 97.9411 30.0589C116.686 48.804 116.686 79.196 97.9411 97.9411"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M52.6863 52.6863C58.9347 46.4379 69.0653 46.4379 75.3137 52.6863C81.5621 58.9347 81.5621 69.0653 75.3137 75.3137"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M41.3726 41.3726C53.8694 28.8758 74.1306 28.8758 86.6274 41.3726C99.1242 53.8694 99.1242 74.1306 86.6274 86.6274"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'duc'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32L0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'dul'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 16C90.5097 16 112 37.4903 112 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 64L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'dun'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M112 64C112 37.4903 90.5097 16 64 16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dur'
  :~  ;path
        =d  "M0 64L5.59506e-06 0L128 1.11901e-05V64C128 99.3462 99.3462 128 64 128C28.6538 128 -4.6351e-06 99.3462 0 64Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
  ==
::
  :-  'dus'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 -3.05151e-06C32 53.0193 74.9807 96 128 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'dut'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'dux'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-2.79795e-06 -3.55988e-06C70.6924 -4.40288e-06 128 57.3075 128 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dyl'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M2.03434e-06 128C70.6924 128 128 70.6925 128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dyn'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 32L0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dyr'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'dys'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-3.8147e-06 1.11901e-05C-7.24633e-07 35.3462 28.6538 64 64 64C99.3462 64 128 35.3462 128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'dyt'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'fab'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'fad'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'fal'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M0 128L128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M0 0C35.3511 0 67.3551 14.3309 90.5193 37.5"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M0 32C26.5077 32 50.5061 42.7436 67.8783 60.1138"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M0 64C17.6721 64 33.6713 71.1626 45.2529 82.7432"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M0 95.6284C8.83603 95.6284 16.8356 99.2097 22.6264 105"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fam'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-4.37114e-08"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'fan'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'fas'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'feb'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M7.37542e-06 -3.56072e-06C1.19529e-06 70.6924 57.3075 128 128 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fed'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 32L0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'fel'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =y1  "-0.5"
        =x2  "45.2548"
        =y2  "-0.5"
        =transform  "matrix(0.707107 -0.707107 -0.707107 -0.707107 79.65 47.6499)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fen'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M0 128C4.63574e-06 92.6489 14.3309 60.6449 37.5 37.4807"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 128C32 101.492 42.7436 77.4939 60.1138 60.1217"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 128C64 110.328 71.1626 94.3287 82.7432 82.7471"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M95.6284 128C95.6284 119.164 99.2097 111.164 105 105.374"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fep'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'fer'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fes'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fet'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'fex'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =y1  "-0.5"
        =x2  "45.2548"
        =y2  "-0.5"
        =transform  "matrix(0.707107 -0.707107 -0.707107 -0.707107 79.6499 47.6499)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'fid'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00291443 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'fig'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fil'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-4.37114e-08"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "32"
        =y1  "2.18557e-08"
        =x2  "32"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fin'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "98"
        =y1  "2.18557e-08"
        =x2  "98"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fip'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'fir'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =y1  "-0.5"
        =x2  "45.2548"
        =y2  "-0.5"
        =transform  "matrix(0.707107 -0.707107 -0.707107 -0.707107 79.65 47.6499)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "80.0036"
        =y1  "79.9965"
        =x2  "112.004"
        =y2  "111.997"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "16.0035"
        =y1  "15.9965"
        =x2  "48.0035"
        =y2  "47.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'fit'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'fod'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'fog'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M86.6274 86.6274C99.1242 74.1306 99.1242 53.8694 86.6274 41.3726C74.1306 28.8758 53.8694 28.8758 41.3726 41.3726"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fol'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-4.37114e-08"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fon'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'fop'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M16 64C16 90.5097 37.4903 112 64 112"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'for'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "96"
        =y1  "2.18557e-08"
        =x2  "96"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'fos'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M96 0C96 53.0193 53.0193 96 0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 0C64 35.3462 35.3462 64 0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 0C32 17.6731 17.6731 32 0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fot'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "15.9964"
        =y1  "111.997"
        =x2  "47.9964"
        =y2  "79.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'ful'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 96C81.6731 96 96 81.6731 96 64C96 46.3269 81.6731 32 64 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fun'
  :~  ;path
        =d  "M128 64V128H0L2.79753e-06 64C4.34256e-06 28.6538 28.6538 -1.54503e-06 64 0C99.3462 1.54503e-06 128 28.6538 128 64Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "15.9964"
        =y1  "111.997"
        =x2  "47.9964"
        =y2  "79.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'fur'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M86.8823 41.6275C74.3855 29.1307 54.1242 29.1307 41.6274 41.6275C29.1307 54.1243 29.1307 74.3855 41.6274 86.8823"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fus'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M32 128C32 110.327 17.6731 96 0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'fyl'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M22.1288 22.6299C16.0075 28.7511 8.0234 31.874 0.00134547 31.9986M44.7562 45.2573C32.3866 57.6269 16.2133 63.8747 0.00134277 64.0005M67.3836 67.8847C48.7656 86.5027 24.403 95.8749 0.00134412 96.0012"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'fyn'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'fyr'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00268555 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =y1  "-0.5"
        =x2  "45.2548"
        =y2  "-0.5"
        =transform  "matrix(0.707107 -0.707107 -0.707107 -0.707107 79.6499 47.6499)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'hab'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M60.1244 67.3837C41.5063 48.7657 32.1342 24.4031 32.0079 0.00145601M82.7518 44.7563C70.3822 32.3867 64.1344 16.2134 64.0086 0.00145196M105.379 22.1289C99.258 16.0077 96.1351 8.02351 96.0105 0.00145196"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'hac'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'had'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'hal'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64.5"
        =y1  "-0.5"
        =x2  "64.5"
        =y2  "127.5"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M16 64C16 90.5097 37.4903 112 64 112"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M112 64C112 37.4903 90.5097 16 64 16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'han'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
  ==
::
  :-  'hap'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'har'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'has'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'hat'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "16"
        =cy  "16"
        =r  "8"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M48 32C48 40.8366 40.8366 48 32 48C23.1634 48 16 40.8366 16 32C16 23.1634 23.1634 16 32 16C40.8366 16 48 23.1634 48 32ZM32 40C36.4183 40 40 36.4183 40 32C40 27.5817 36.4183 24 32 24C27.5817 24 24 27.5817 24 32C24 36.4183 27.5817 40 32 40Z"
        =fill  bg;
  ==
::
  :-  'hav'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "96"
        =y1  "2.18557e-08"
        =x2  "96"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'heb'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M2.03434e-06 128C70.6924 128 128 70.6925 128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'hec'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'hep'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.00285417"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'hes'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M48 96C48 104.837 40.8366 112 32 112C23.1634 112 16 104.837 16 96C16 87.1634 23.1634 80 32 80C40.8366 80 48 87.1634 48 96ZM32 104C36.4183 104 40 100.418 40 96C40 91.5817 36.4183 88 32 88C27.5817 88 24 91.5817 24 96C24 100.418 27.5817 104 32 104Z"
        =fill  bg;
  ==
::
  :-  'het'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M96 128L96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'hex'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'hid'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M2.03434e-06 128C70.6924 128 128 70.6925 128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M1.52575e-06 96C53.0193 96 96 53.0193 96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M1.01717e-06 64C35.3462 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M5.08584e-07 32C17.6731 32 32 17.6731 32 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'hil'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "8.74228e-08"
        =y1  "64"
        =x2  "128"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'hin'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "32"
        =y1  "2.18557e-08"
        =x2  "32"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M48 64C48 72.8366 40.8366 80 32 80C23.1634 80 16 72.8366 16 64C16 55.1634 23.1634 48 32 48C40.8366 48 48 55.1634 48 64ZM32 72C36.4183 72 40 68.4183 40 64C40 59.5817 36.4183 56 32 56C27.5817 56 24 59.5817 24 64C24 68.4183 27.5817 72 32 72Z"
        =fill  bg;
  ==
::
  :-  'hob'
  :~  ;path
        =d  "M128 64V128H0L2.79753e-06 64C4.34256e-06 28.6538 28.6538 -1.54503e-06 64 0C99.3462 1.54503e-06 128 28.6538 128 64Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-4.37114e-08"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'hoc'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =y1  "-0.5"
        =x2  "45.2548"
        =y2  "-0.5"
        =transform  "matrix(0.707107 -0.707107 -0.707107 -0.707107 79.65 47.6499)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'hod'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'hol'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-4.37114e-08"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'hop'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 96C81.6731 96 96 81.6731 96 64C96 46.3269 81.6731 32 64 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'hos'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0036"
        =y1  "79.9965"
        =x2  "112.004"
        =y2  "111.997"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "16.0036"
        =y1  "15.9965"
        =x2  "48.0036"
        =y2  "47.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "48"
        =cy  "48"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "48"
        =cy  "48"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "80"
        =cy  "47"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "80"
        =cy  "47"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "80"
        =cy  "81"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "80"
        =cy  "81"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "48"
        =cy  "80"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "48"
        =cy  "80"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'hul'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "48"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "48"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'hus'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M64 96C46.3269 96 32 81.6731 32 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'hut'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'lab'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =y1  "-0.5"
        =x2  "45.2548"
        =y2  "-0.5"
        =transform  "matrix(0.707107 -0.707107 -0.707107 -0.707107 79.65 47.6499)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "15.9964"
        =y1  "111.997"
        =x2  "47.9964"
        =y2  "79.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lac'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 -9.40976e-06C64 70.6924 92.6538 128 128 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 -7.63193e-07C32 70.6924 74.9807 128 128 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lad'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "95.35"
        =y1  "32.7071"
        =x2  "32.0571"
        =y2  "96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'lag'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 112C90.5097 112 112 90.5097 112 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lan'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "32"
        =y1  "2.18557e-08"
        =x2  "32"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lap'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M112 64C112 37.4903 90.5097 16 64 16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "112"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "112"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'lar'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "2.78181e-08"
        =y1  "64"
        =x2  "128"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'las'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'lat'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M2.03434e-06 128C70.6924 128 128 70.6925 128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M1.52575e-06 96C53.0193 96 96 53.0193 96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M1.01717e-06 64C35.3462 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M5.08584e-07 32C17.6731 32 32 17.6731 32 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lav'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 128C92.6489 128 60.6449 113.669 37.4807 90.5"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96C101.492 96 77.4939 85.2564 60.1217 67.8862"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64C110.328 64 94.3287 56.8374 82.7471 45.2568"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32.3716C119.164 32.3716 111.164 28.7903 105.374 23"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'leb'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-1.64036e-05 32C53.0193 32 96 74.9807 96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lec'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'led'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'leg'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M7.63192e-07 32C17.6731 32 32 46.3269 32 64C32 81.6731 17.6731 96 0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'len'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'lep'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 96C110.327 96 96 110.327 96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ler'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'let'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lev'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'lex'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =x1  "15.9965"
        =y1  "111.997"
        =x2  "47.9965"
        =y2  "79.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'lib'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64C92.6538 64 64 92.6538 64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lid'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "16.0036"
        =y1  "15.9965"
        =x2  "48.0036"
        =y2  "47.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'lig'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lin'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "128"
        =x2  "64"
        =y2  "-6.55671e-08"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "80"
        =cy  "64"
        =r  "8"
        =fill  bg
        =stroke  "none";
  ==
::
  :-  'lis'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-4.70488e-06 64C35.3462 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lit'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00286865 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M128 0C128 35.3511 113.669 67.3551 90.5 90.5193"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 0C96 26.5077 85.2564 50.5061 67.8862 67.8783"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 0C64 17.6721 56.8374 33.6713 45.2568 45.2529"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32.3716 0C32.3716 8.83603 28.7903 16.8356 23 22.6264"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'liv'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-5.21346e-06 32C70.6924 32 128 17.6731 128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M3.4331e-06 96C70.6924 96 128 53.0193 128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'loc'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 96C74.9807 96 32 53.0193 32 -4.19629e-06"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lod'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M16 64C16 90.5097 37.4903 112 64 112"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lom'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'lon'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M2.03434e-06 128C70.6924 128 128 70.6925 128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M1.52575e-06 96C53.0193 96 96 53.0193 96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M1.01717e-06 64C35.3462 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M5.08584e-07 32C17.6731 32 32 17.6731 32 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lop'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-8.87604e-09"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "32"
        =x2  "-8.87604e-09"
        =y2  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'lor'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'los'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'luc'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-8.87604e-09"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96L0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lud'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 0L96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lug'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 -7.62939e-06L64 -2.03434e-06C99.3462 1.05573e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
  ==
::
  :-  'lun'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lup'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 -7.62939e-06L64 -2.03434e-06C99.3462 1.05573e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 16C90.5097 16 112 37.4903 112 64C112 90.5097 90.5097 112 64 112"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-8.87604e-09"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lur'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 0L96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lus'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'lut'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'lux'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'lyd'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'lyn'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lyr'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00268555 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "80"
        =cy  "48"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "80"
        =cy  "48"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'lys'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'lyt'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =x1  "80.0035"
        =y1  "79.9965"
        =x2  "112.003"
        =y2  "111.997"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'lyx'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'mac'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'mag'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'mal'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0035"
        =y1  "79.9964"
        =x2  "112.004"
        =y2  "111.996"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'map'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0036"
        =y1  "79.9965"
        =x2  "112.004"
        =y2  "111.997"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'mar'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.0029152 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M64 64L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M86.6274 86.6274C99.1242 74.1307 99.1242 53.8694 86.6274 41.3726C74.1306 28.8758 53.8694 28.8758 41.3726 41.3726"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M75.3137 75.3137C81.5621 69.0653 81.5621 58.9347 75.3137 52.6863C69.0653 46.4379 58.9347 46.4379 52.6863 52.6863"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M97.9411 97.9411C116.686 79.1959 116.686 48.804 97.9411 30.0589C79.196 11.3137 48.804 11.3137 30.0589 30.0589"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mas'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'mat'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 32C110.327 32 96 17.6731 96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'meb'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 -3.05151e-06C32 53.0193 74.9807 96 128 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mec'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0035"
        =y1  "79.9965"
        =x2  "112.003"
        =y2  "111.997"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'med'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'meg'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64C92.6538 64 64 92.6538 64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mel'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "15.9964"
        =y1  "111.997"
        =x2  "47.9964"
        =y2  "79.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mep'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96L0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32L0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mer'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mes'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =x1  "15.9964"
        =y1  "111.996"
        =x2  "47.9964"
        =y2  "79.9964"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'met'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 128L32 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mev'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mex'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'mic'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-2.09815e-06 80C26.5097 80 48 101.49 48 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mid'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-4.37114e-08"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64C92.6538 64 64 92.6538 64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mig'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "80.0036"
        =y1  "79.9965"
        =x2  "112.004"
        =y2  "111.997"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mil'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-4.37114e-08"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "32"
        =x2  "-4.37114e-08"
        =y2  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "96"
        =x2  "-4.37114e-08"
        =y2  "96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'min'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'mip'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 128C92.6538 128 64 99.3462 64 64C64 28.6538 92.6538 4.215e-07 128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mir'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "16.0036"
        =y1  "15.9964"
        =x2  "48.0036"
        =y2  "47.9964"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 64C96 46.3269 81.6731 32 64 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mis'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64C92.6538 64 64 92.6538 64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00286865 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'mit'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'moc'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96L0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32L0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mod'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M0 96L128 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "16.0035"
        =y1  "15.9965"
        =x2  "48.0035"
        =y2  "47.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mog'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mol'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-4.37114e-08"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M112 64C112 90.5097 90.5097 112 64 112C37.4903 112 16 90.5097 16 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M112 0C112 26.5097 90.5097 48 64 48C37.4903 48 16 26.5097 16 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mon'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'mop'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'mor'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "16.0035"
        =y1  "15.9964"
        =x2  "48.0035"
        =y2  "47.9964"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "15.9964"
        =y1  "111.996"
        =x2  "47.9964"
        =y2  "79.9964"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'mos'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'mot'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 96C110.327 96 96 81.6731 96 64C96 46.3269 110.327 32 128 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'mud'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "80"
        =cy  "80"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "80"
        =cy  "80"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'mug'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 96C81.6731 96 96 81.6731 96 64C96 46.3269 81.6731 32 64 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mul'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0035"
        =y1  "79.9964"
        =x2  "112.003"
        =y2  "111.996"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M112 64C112 37.4903 90.5097 16 64 16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mun'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64C92.6538 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'mur'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'mus'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M96 128C96 74.9807 53.0193 32 0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'mut'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'myl'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "16.0035"
        =y1  "15.9965"
        =x2  "48.0035"
        =y2  "47.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "16"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "16"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'myn'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 1.52638e-06C57.3076 -7.74381e-06 9.2702e-06 57.3075 0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32C74.9807 32 32 74.9807 32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64C92.6538 64 64 92.6538 64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96C110.327 96 96 110.327 96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'myr'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nac'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'nal'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M2.82114e-06 110C60.7513 110 110 60.7513 110 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-5.09828e-06 73C40.3168 73 73 40.3168 73 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-6.63647e-07 37C20.4345 37 37 20.4345 37 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nam'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "8.74228e-08"
        =y1  "64"
        =x2  "128"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "112"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "112"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nap'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nar'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "8"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nat'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-1.52588e-05 128C-9.07866e-06 57.3075 57.3076 1.44926e-06 128 7.62939e-06"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nav'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 96C101.492 96 77.4939 85.2564 60.1217 67.8862"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64C110.328 64 94.3287 56.8374 82.7471 45.2568"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32.3716C119.164 32.3716 111.164 28.7903 105.374 23"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'neb'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 32C74.9807 32 32 74.9807 32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nec'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ned'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nel'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00268555 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M96 1.90735e-06C96 53.0193 53.0193 96 0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nem'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M128 64C92.6538 64 64 92.6538 64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nep'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 128C57.3076 128 3.09007e-06 70.6925 0 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96C74.9807 96 32 53.0193 32 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64C92.6538 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32C110.327 32 96 17.6731 96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ner'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "15.9965"
        =y1  "111.997"
        =x2  "47.9965"
        =y2  "79.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nes'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'net'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 64L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nev'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nex'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 -7.62939e-06L64 -2.03434e-06C99.3462 1.05573e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0035"
        =y1  "79.9964"
        =x2  "112.003"
        =y2  "111.996"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'nib'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96L0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nid'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 128C92.6538 128 64 70.6925 64 7.63192e-07"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nil'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-8.87604e-09"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "32"
        =x2  "-8.87604e-09"
        =y2  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nim'
  :~  ;path
        =d  "M128 64V128H0L2.79753e-06 64C4.34256e-06 28.6538 28.6538 -1.54503e-06 64 0C99.3462 1.54503e-06 128 28.6538 128 64Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nis'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 32C74.9807 32 32 74.9807 32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00285435 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'noc'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nod'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nol'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "1.51277e-05"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nom'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nop'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =y1  "-0.5"
        =x2  "45.2548"
        =y2  "-0.5"
        =transform  "matrix(0.707107 -0.707107 -0.707107 -0.707107 79.65 47.65)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nor'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 96C46.3269 96 32 81.6731 32 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nos'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nov'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M2.03434e-06 128C70.6924 128 128 70.6925 128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M1.52575e-06 96C53.0193 96 96 53.0193 96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M1.01717e-06 64C35.3462 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M5.08584e-07 32C17.6731 32 32 17.6731 32 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nub'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nul'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'num'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nup'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 -7.62939e-06L64 -2.03434e-06C99.3462 1.05573e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 16C90.5097 16 112 37.4903 112 64C112 90.5097 90.5097 112 64 112"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nus'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M0.000105172 128C35.3582 128 67.3679 113.664 90.5332 90.4863"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "31"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "31"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nut'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0035"
        =y1  "79.9964"
        =x2  "112.003"
        =y2  "111.996"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =y1  "-0.5"
        =x2  "45.2548"
        =y2  "-0.5"
        =transform  "matrix(0.707107 -0.707107 -0.707107 -0.707107 79.6499 47.6499)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nux'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96L0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32L0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nyd'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nyl'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M0 128C4.63574e-06 92.6489 14.3309 60.6449 37.5 37.4807"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 128C32 101.492 42.7436 77.4939 60.1138 60.1217"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 128C64 110.328 71.1626 94.3287 82.7432 82.7471"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M95.6284 128C95.6284 119.164 99.2097 111.164 105 105.374"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nym'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 0L96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nyr'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00268555 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M95.9984 0C95.9984 26.3298 85.3985 50.1839 68.2332 67.5278M63.9983 0C63.9983 17.4933 56.9799 33.3473 45.6054 44.8999M31.9983 0C31.9983 8.65672 28.5609 16.5106 22.9766 22.2711"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nys'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'nyt'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 32C81.6731 32 96 46.3269 96 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 16C90.5097 16 112 37.4903 112 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'nyx'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'pac'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'pad'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'pag'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "15.9964"
        =y1  "111.997"
        =x2  "47.9964"
        =y2  "79.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pal'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M128 96C101.492 96 77.4939 85.2564 60.1217 67.8862"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64C110.328 64 94.3287 56.8374 82.7471 45.2568"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32.3716C119.164 32.3716 111.164 28.7903 105.374 23"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pan'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M41.3726 86.6274C28.8758 74.1306 28.8758 53.8693 41.3726 41.3725C53.8694 28.8758 74.1306 28.8758 86.6274 41.3725"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'par'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.693 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pas'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 0L96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pat'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 -2.67054e-06C32 53.0193 74.9807 96 128 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 -1.78036e-06C64 35.3462 92.6538 64 128 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 -8.9018e-07C96 17.6731 110.327 32 128 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pec'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'ped'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'peg'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M96 0C96 17.6731 81.6731 32 64 32C46.3269 32 32 17.6731 32 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pel'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M112 64C112 37.4903 90.5097 16 64 16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pem'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M64 128C64 92.6538 35.3462 64 0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pen'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M96 0C96 17.6731 81.6731 32 64 32C46.3269 32 32 17.6731 32 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'per'
  :~  ;path
        =d  "M0 64L5.59506e-06 0L128 1.11901e-05V64C128 99.3462 99.3462 128 64 128C28.6538 128 -4.6351e-06 99.3462 0 64Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pes'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 112C90.5097 112 112 90.5097 112 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "-0.00285417"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'pet'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0035"
        =y1  "79.9964"
        =x2  "112.003"
        =y2  "111.996"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pex'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'pic'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M96 128C96 74.9807 53.0193 32 0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 128C64 92.6538 35.3462 64 0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 128C32 110.327 17.6731 96 0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pid'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'pil'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'pin'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'pit'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'poc'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64.5"
        =y1  "-0.5"
        =x2  "64.5"
        =y2  "127.5"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "96.5"
        =y1  "-0.5"
        =x2  "96.5"
        =y2  "127.5"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "32.5"
        =y1  "-0.5"
        =x2  "32.5"
        =y2  "127.5"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pod'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "96"
        =x2  "-8.87604e-09"
        =y2  "96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pol'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "32"
        =x2  "-8.87604e-09"
        =y2  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pon'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
  ==
::
  :-  'pos'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'pub'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pun'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M112 64C112 37.4903 90.5097 16 64 16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 64C96 46.3269 81.6731 32 64 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M80 64C80 55.1634 72.8366 48 64 48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pur'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M3.73284e-05 64C17.6633 64 33.6554 56.8445 45.2356 45.2741"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'put'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'pyl'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-5.59506e-06 128C35.3462 128 64 99.3462 64 64C64 28.6538 35.3462 1.54503e-06 0 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'pyx'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'rab'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =x1  "15.9965"
        =y1  "111.997"
        =x2  "47.9964"
        =y2  "79.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rac'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'rad'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'rag'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "16.0036"
        =y1  "15.9965"
        =x2  "48.0036"
        =y2  "47.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ral'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ram'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'ran'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00291443 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rap'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "-1.29797e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'rav'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 32L0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'reb'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 -9.40976e-06C57.3075 -6.31969e-06 -3.09007e-06 57.3075 0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rec'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'red'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'ref'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'reg'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 96C110.327 96 96 81.6731 96 64C96 46.3269 110.327 32 128 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rel'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96L0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32L0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rem'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M128 64C92.6538 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ren'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0035"
        =y1  "79.9965"
        =x2  "112.003"
        =y2  "111.997"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rep'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 128C32 74.9807 74.9807 32 128 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'res'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0035"
        =y1  "79.9965"
        =x2  "112.003"
        =y2  "111.997"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ret'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rev'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "15.9965"
        =y1  "111.997"
        =x2  "53.9965"
        =y2  "73.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'rex'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'rib'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "8.74228e-08"
        =y1  "64"
        =x2  "128"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ric'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M96 128C96 74.9807 53.0193 32 0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rid'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 0L96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rig'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'ril'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.693 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'rin'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "32"
        =y1  "2.18557e-08"
        =x2  "32"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rip'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M96 64C96 46.3269 81.6731 32 64 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'ris'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M128 0C128 35.3511 113.669 67.3551 90.5 90.5193"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 0C96 26.5077 85.2564 50.5061 67.8862 67.8783"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 0C64 17.6721 56.8374 33.6713 45.2568 45.2529"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32.3716 0C32.3716 8.83603 28.7903 16.8356 23 22.6264"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rit'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'riv'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'roc'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
      ;circle
        =cx  "112"
        =cy  "16"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "112"
        =cy  "16"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'rol'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 16C90.5097 16 112 37.4903 112 64C112 90.5097 90.5097 112 64 112"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ron'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0C128 70.6924 70.6925 128 0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rop'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M112 64C112 37.4903 90.5097 16 64 16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ros'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'rov'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M128 0C128 35.3511 113.669 67.3551 90.5 90.5193"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 0C96 26.5077 85.2564 50.5061 67.8862 67.8783"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 0C64 17.6721 56.8374 33.6713 45.2568 45.2529"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32.3716 0C32.3716 8.83603 28.7903 16.8356 23 22.6264"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ruc'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32L0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rud'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rul'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0035"
        =y1  "79.9964"
        =x2  "112.003"
        =y2  "111.996"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'rum'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M5.08584e-07 32C17.6731 32 32 17.6731 32 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'run'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 0L96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rup'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 112C90.5097 112 112 90.5097 112 64C112 37.4903 90.5097 16 64 16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rus'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M64 128C64 92.6538 35.3462 64 0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rut'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'rux'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 64C32 81.6731 46.3269 96 64 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ryc'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 96L0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ryd'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M96 64C96 81.6731 81.6731 96 64 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ryg'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-2.79795e-06 -3.55988e-06C70.6924 -4.40288e-06 128 57.3075 128 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "16.0035"
        =y1  "15.9965"
        =x2  "48.0035"
        =y2  "47.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'ryl'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M128 128C92.6489 128 60.6449 113.669 37.4807 90.5"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96C101.492 96 77.4939 85.2564 60.1217 67.8862"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64C110.328 64 94.3287 56.8374 82.7471 45.2568"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32.3716C119.164 32.3716 111.164 28.7903 105.374 23"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'rym'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 96L0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ryn'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 128C57.3075 128 -3.09007e-06 70.6925 0 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ryp'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'rys'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M1.52575e-06 96C53.0193 96 96 53.0193 96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ryt'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 -7.62939e-06L64 -2.03434e-06C99.3462 1.05573e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'ryx'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sab'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =y1  "-0.5"
        =x2  "45.2548"
        =y2  "-0.5"
        =transform  "matrix(0.707107 -0.707107 -0.707107 -0.707107 79.65 47.65)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'sal'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M0 128L128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M-0.701724 31.9914C25.6281 31.9914 49.4822 42.5913 66.8261 59.7565M-0.701723 63.9914C16.7916 63.9914 32.6456 71.0098 44.1982 82.3844M-0.701722 95.9914C7.955 95.9914 15.8089 99.4288 21.5694 105.013"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sam'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'san'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'sap'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-4.37114e-08"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "8"
        =fill  bg
        =stroke  "none";
  ==
::
  :-  'sar'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sat'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 128C128 57.3076 70.6925 0 0 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sav'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M96 64C96 46.3269 81.6731 32 64 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'seb'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64C92.6538 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sec'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'sed'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'sef'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'seg'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 128C32 110.327 46.3269 96 64 96C81.6731 96 96 110.327 96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sel'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "8"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sem'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M1.01717e-06 64C35.3462 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'sen'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 128C96 110.327 81.6731 96 64 96C46.3269 96 32 110.327 32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'sep'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 128L64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 128L32 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 128L96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ser'
  :~  ;path
        =d  "M0 64L5.59506e-06 0L128 1.11901e-05V64C128 99.3462 99.3462 128 64 128C28.6538 128 -4.6351e-06 99.3462 0 64Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'set'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 64L128 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sev'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sib'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M64 9.40976e-06C64 35.3462 92.6538 64 128 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sic'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'sid'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 128C110.327 128 96 113.673 96 96C96 78.3269 110.327 64 128 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sig'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'sil'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "16.0036"
        =y1  "15.9965"
        =x2  "48.0036"
        =y2  "47.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'sim'
  :~  ;path
        =d  "M128 64V128H0L2.79753e-06 64C4.34256e-06 28.6538 28.6538 -1.54503e-06 64 0C99.3462 1.54503e-06 128 28.6538 128 64Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sip'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M16 64C16 37.4903 37.4903 16 64 16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'sit'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'siv'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96L0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'soc'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "16"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "16"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'sog'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M64 96C81.6731 96 96 81.6731 96 64C96 46.3269 81.6731 32 64 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sol'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64L-5.96046e-08 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'som'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'son'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "127.553"
        =y1  "128.224"
        =x2  "63.5528"
        =y2  "0.223598"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sop'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'sor'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M128 0C128 35.3511 113.669 67.3551 90.5 90.5193"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M96 0C96 26.5077 85.2564 50.5061 67.8862 67.8783"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 0C64 17.6721 56.8374 33.6713 45.2568 45.2529"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32.3716 0C32.3716 8.83603 28.7903 16.8356 23 22.6264"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sov'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M0 128L128 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M128 128C92.6489 128 60.6449 113.669 37.4807 90.5"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96C101.492 96 77.4939 85.2564 60.1217 67.8862"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64C110.328 64 94.3287 56.8374 82.7471 45.2568"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32.3716C119.164 32.3716 111.164 28.7903 105.374 23"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sub'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sud'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-8.87604e-09"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'sug'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "80"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "80"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'sul'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 96C46.3269 96 32 81.6731 32 64C32 46.3269 46.3269 32 64 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sum'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M1.01717e-06 64C35.3462 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sun'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =stroke  "none";
      ;circle
        =cx  "80"
        =cy  "80"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "80"
        =cy  "80"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "80"
        =cy  "48"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "80"
        =cy  "48"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "48"
        =cy  "48"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "48"
        =cy  "48"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "48"
        =cy  "80"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "48"
        =cy  "80"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'sup'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 112C90.5097 112 112 90.5097 112 64C112 37.4903 90.5097 16 64 16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'sur'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M3.73284e-05 64.0001C17.6633 64.0001 33.6554 56.8446 45.2356 45.2742"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M0.000105172 128C35.3582 128 67.3679 113.664 90.5332 90.4863"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'sut'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'syd'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 16C37.4903 16 16 37.4903 16 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'syl'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'sym'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "96.5"
        =y1  "3.07317e-08"
        =x2  "96.5"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'syn'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M0 0C35.3511 0 67.3551 14.3309 90.5193 37.5"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M0 32C26.5077 32 50.5061 42.7436 67.8783 60.1138"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M0 64C17.6721 64 33.6713 71.1626 45.2529 82.7432"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M0 95.6284C8.83603 95.6284 16.8356 99.2097 22.6264 105"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'syp'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M1.01717e-06 64C35.3462 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'syr'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'syt'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'syx'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M0 128C4.63574e-06 92.6488 14.3309 60.6449 37.5 37.4807"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 128C32 101.492 42.7436 77.4939 60.1138 60.1216"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 128C64 110.328 71.1626 94.3287 82.7432 82.7471"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M95.6284 128C95.6284 119.164 99.2097 111.164 105 105.374"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'tab'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "8"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'tac'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tad'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tag'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0036"
        =y1  "79.9964"
        =x2  "112.004"
        =y2  "111.996"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tal'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "0.5"
        =y1  "-0.5"
        =x2  "181.5"
        =y2  "-0.5"
        =transform  "matrix(-0.707107 0.707107 0.707107 0.707107 128.71 0)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M96 128C96 74.9807 53.0193 32 0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tam'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "96"
        =x2  "-8.87604e-09"
        =y2  "96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "32"
        =x2  "-8.87604e-09"
        =y2  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tan'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M96 128C96 74.9807 53.0193 32 0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 128C64 92.6538 35.3462 64 0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M48 128C48 101.49 26.5097 80 0 80"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M32 128C32 110.327 17.6731 96 0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M16 128C16 119.163 8.83656 112 0 112"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 128C128 57.3075 70.6925 0 0 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tap'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-8.87604e-09"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 32C81.6731 32 96 46.3269 96 64C96 81.6731 81.6731 96 64 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tar'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tas'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M64 32C81.6731 32 96 46.3269 96 64C96 81.6731 81.6731 96 64 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'teb'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M1.52575e-06 96C53.0193 96 96 53.0193 96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tec'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0035"
        =y1  "79.9965"
        =x2  "112.003"
        =y2  "111.997"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'ted'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'teg'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 80C119.163 80 112 72.8366 112 64C112 55.1634 119.163 48 128 48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tel'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "15"
        =cy  "112"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "15"
        =cy  "112"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;path
        =d  "M0 0L127.986 127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M32 0L128 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M64 0L128 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M96 0L128 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'tem'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64C92.6538 64 64 92.6538 64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "-0.00285417"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'ten'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "48"
        =cy  "48"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "48"
        =cy  "48"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "80"
        =cy  "48"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "80"
        =cy  "48"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "80"
        =cy  "80"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "80"
        =cy  "80"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "48"
        =cy  "80"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "48"
        =cy  "80"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tep'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M1.14479e-06 96C53.0193 96 96 53.0193 96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'ter'
  :~  ;path
        =d  "M0 64L5.59506e-06 0L128 1.11901e-05V64C128 99.3462 99.3462 128 64 128C28.6538 128 -4.6351e-06 99.3462 0 64Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "96.5"
        =y1  "3.07317e-08"
        =x2  "96.5"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M1.01717e-06 64C35.3462 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tes'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tev'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tex'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "15.9965"
        =y1  "111.997"
        =x2  "47.9965"
        =y2  "79.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'tic'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 32C110.327 32 96 17.6731 96 -1.39876e-06"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tid'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "96"
        =y1  "2.18557e-08"
        =x2  "96"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M112 32C112 40.8366 104.837 48 96 48C87.1634 48 80 40.8366 80 32C80 23.1634 87.1634 16 96 16C104.837 16 112 23.1634 112 32ZM96 40C100.418 40 104 36.4183 104 32C104 27.5817 100.418 24 96 24C91.5817 24 88 27.5817 88 32C88 36.4183 91.5817 40 96 40Z"
        =fill  bg;
  ==
::
  :-  'til'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0036"
        =y1  "79.9965"
        =x2  "112.004"
        =y2  "111.997"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tim'
  :~  ;path
        =d  "M128 64V128H0L2.79753e-06 64C4.34256e-06 28.6538 28.6538 -1.54503e-06 64 0C99.3462 1.54503e-06 128 28.6538 128 64Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00291443 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'tin'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "32"
        =y1  "2.18557e-08"
        =x2  "32"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tip'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 0L64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'tir'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tob'
  :~  ;path
        =d  "M128 64V128H0L2.79753e-06 64C4.34256e-06 28.6538 28.6538 -1.54503e-06 64 0C99.3462 1.54503e-06 128 28.6538 128 64Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 96L0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'toc'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "96"
        =x2  "-8.87604e-09"
        =y2  "96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tod'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tog'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 96C46.3269 96 32 81.6731 32 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'tol'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "128"
        =y1  "64"
        =x2  "-4.37114e-08"
        =y2  "64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M16 128C16 101.49 37.4903 80 64 80C90.5097 80 112 101.49 112 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tom'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'ton'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 32C74.9807 32 32 74.9807 32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64C92.6538 64 64 92.6538 64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96C110.327 96 96 110.327 96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'top'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "16"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tor'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tuc'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96L0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tud'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tug'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32L0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tul'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'tun'
  :~  ;path
        =d  "M128 64V128H0L2.79753e-06 64C4.34256e-06 28.6538 28.6538 -1.54503e-06 64 0C99.3462 1.54503e-06 128 28.6538 128 64Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tus'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tux'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tyc'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'tyd'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00280762 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;line
        =y1  "-0.5"
        =x2  "45.2548"
        =y2  "-0.5"
        =transform  "matrix(0.707107 -0.707107 -0.707107 -0.707107 79.65 47.6499)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "15.9964"
        =y1  "111.997"
        =x2  "47.9964"
        =y2  "79.9965"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'tyl'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M7.37542e-06 -3.56072e-06C1.19529e-06 70.6924 57.3075 128 128 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tyn'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 -2.28831e-06C57.3076 -3.13131e-06 8.42999e-07 57.3075 0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'typ'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M96 1.90735e-06C96 53.0193 53.0193 96 0 96"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tyr'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M0 0L128 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M128 64C92.6538 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M0 64C35.3462 64 64 92.6538 64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'tyv'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M256 0L128 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'wac'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "11.5"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
      ;circle
        =cx  "16"
        =cy  "112"
        =r  "9"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
        :: =stroke-width  "2"
  ==
::
  :-  'wal'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64.5"
        =y1  "-0.5"
        =x2  "64.5"
        =y2  "127.5"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "32"
        =y1  "2.18557e-08"
        =x2  "32"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'wan'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
  ==
::
  :-  'wat'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'web'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 128C128 57.3075 70.6925 0 0 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'wed'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'weg'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M79.5254 0C79.5254 8.83656 72.3619 16 63.5254 16C54.6888 16 47.5254 8.83656 47.5254 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'wel'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 32C74.9807 32 32 74.9807 32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 64C92.6538 64 64 92.6538 64 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96C110.327 96 96 110.327 96 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'wen'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M1.01717e-06 64C35.3462 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
  ==
::
  :-  'wep'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'wer'
  :~  ;path
        =d  "M0 64L5.59506e-06 0L128 1.11901e-05V64C128 99.3462 99.3462 128 64 128C28.6538 128 -4.6351e-06 99.3462 0 64Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M32 0L32 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'wes'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "80.0035"
        =y1  "79.9965"
        =x2  "112.003"
        =y2  "111.997"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "112"
        =cy  "112"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "112"
        =cy  "112"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'wet'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M64 64H0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'wex'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'wic'
  :~  ;path
        =d  "M128 0C57.3075 8.42999e-07 -8.42999e-07 57.3075 0 128H128V0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'wid'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "48.0035"
        =y1  "80.0036"
        =x2  "16.0035"
        =y2  "112.004"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =fill-rule  "evenodd"
        =clip-rule  "evenodd"
        =stroke  "none"
        =d  "M80 64C80 72.8366 72.8366 80 64 80C55.1634 80 48 72.8366 48 64C48 55.1634 55.1634 48 64 48C72.8366 48 80 55.1634 80 64ZM64 72C68.4183 72 72 68.4183 72 64C72 59.5817 68.4183 56 64 56C59.5817 56 56 59.5817 56 64C56 68.4183 59.5817 72 64 72Z"
        =fill  bg;
  ==
::
  :-  'win'
  :~  ;rect
        =width  "128"
        =height  "128"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'wis'
  :~  ;path
        =d  "M0 0C0 70.6925 57.3075 128 128 128V0H0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 64L0 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 32L0 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'wit'
  :~  ;path
        =d  "M0 127.946C0.0292286 57.2783 57.3256 3.08928e-06 128 0C128 70.6823 70.7089 127.984 0.0305092 128C0.0203397 128 0.01017 128 2.36469e-09 128L0 127.946Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =x1  "64"
        =y1  "2.18557e-08"
        =x2  "64"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "32"
        =y1  "2.18557e-08"
        =x2  "32"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "96"
        =y1  "2.18557e-08"
        =x2  "96"
        =y2  "128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'wol'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M0 64L128 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M128 96C110.327 96 96 81.6731 96 64C96 46.3269 110.327 32 128 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'wor'
  :~  ;path
        =d  "M64 0H128V128H64C28.6538 128 0 99.3462 0 64C0 28.6538 28.6538 0 64 0Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;line
        =y1  "-0.5"
        =x2  "45.2548"
        =y2  "-0.5"
        =transform  "matrix(0.707107 -0.707107 -0.707107 -0.707107 79.65 47.65)"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;line
        =x1  "-0.0029152"
        =x2  "127.983"
        =y2  "127.986"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M64 96C46.3269 96 32 81.6731 32 64"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'wyc'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
  ==
::
  :-  'wyd'
  :~  ;path
        =d  "M0.0541 0C70.7217 0.0292317 128 57.3256 128 128C57.3177 128 0.0164917 70.7089 7.62806e-06 0.0305091C7.62851e-06 0.0203397 -4.44317e-10 0.01017 0 0H0.0541Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;path
        =d  "M32 64C32 46.3269 46.3269 32 64 32"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'wyl'
  :~  ;path
        =d  "M128 128C128 57.3076 70.6925 6.18013e-06 1.11901e-05 0L0 128L128 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-3.8147e-06 128C-7.24633e-07 92.6538 28.6538 64 64 64C99.3462 64 128 92.6538 128 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'wyn'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M1.52575e-06 96C53.0193 96 96 53.0193 96 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M1.01717e-06 64C35.3462 64 64 35.3462 64 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;path
        =d  "M5.08584e-07 32C17.6731 32 32 17.6731 32 0"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
  ==
::
  :-  'wyt'
  :~  ;path
        =d  "M64 128H0L5.59506e-06 0L64 5.59506e-06C99.3462 8.68512e-06 128 28.6538 128 64C128 99.3462 99.3462 128 64 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M128 0L0 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "64"
        =cy  "64"
        =r  "48"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        =fill  "none";
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "16"
        =cy  "64"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'wyx'
  :~  ;path
        =d  "M5.59506e-06 128C70.6925 128 128 70.6925 128 0L0 5.59506e-06L5.59506e-06 128Z"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
      ;path
        =d  "M-0.00292969 0L127.997 128"
        =vector-effect  "non-scaling-stroke"
        :: =stroke  bg
        :: =stroke-linecap  "square"
        =fill  "none";
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "96"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "32"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "11.5"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke"
        =stroke  fg;
      ;circle
        =cx  "96"
        =cy  "32"
        =r  "9"
        =fill  bg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "2"
  ==
::
  :-  'zod'
  :~  ;circle
        =cx  "64"
        =cy  "64"
        =r  "64"
        :: =fill  fg
        =vector-effect  "non-scaling-stroke";
        :: =stroke  bg
        :: =stroke-width  "0.5"
  ==
==