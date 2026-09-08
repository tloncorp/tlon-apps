#!/bin/sh
set -eu
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
out=${1:?supply a fresh absolute output directory}
case "$out" in /*) ;; *) exit 2;; esac
mkdir -p "$out"
python3 - "$here/../TlonReadRegistration.mm" "$out/registry-actual.inc" <<'PY'
import sys
from pathlib import Path
s=Path(sys.argv[1]).read_text()
a=s.index('@interface TlonReadRegistry :')
b=s.index('\n@end',a)+len('\n@end')
c=s.index('@implementation TlonReadRegistry')
d=s.index('\n@end',c)+len('\n@end')
h=s.index('static RNSScreenView *nearestScreen(')
he=s.index('\n}',h)+2
bh=s.index('static BOOL belongsTo(');be=s.index('\n}',bh)+2
helpers = s[bh:be]+'\n' if 'belongsTo(' in s[c:d] else ''
Path(sys.argv[2]).write_text(helpers+s[h:he]+'\n'+s[a:b]+'\n'+s[c:d]+'\n')
PY
clang++ -std=c++20 -fobjc-arc -fblocks -framework Foundation -framework CoreGraphics \
  -Wall -Wextra -Werror -I "$out" "$here/../TlonReadDescriptors.mm" \
  "$here/read-lifetime-controls.mm" -o "$out/read-lifetime-controls"
"$out/read-lifetime-controls"
