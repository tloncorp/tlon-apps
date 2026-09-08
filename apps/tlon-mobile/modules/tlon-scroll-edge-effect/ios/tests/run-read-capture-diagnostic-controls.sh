#!/bin/sh
set -eu
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
out=${1:?supply a fresh absolute output directory}
case "$out" in /*) ;; *) exit 2;; esac
mkdir -p "$out"
python3 - "${SCROLLER_REGISTRATION_SOURCE:-$here/../TlonReadRegistration.mm}" "$out" <<'PY'
import sys
from pathlib import Path
s=Path(sys.argv[1]).read_text();out=Path(sys.argv[2])
a=s.index('@interface TlonReadRegistration ()');b=s.index('\nstatic char RegistryKey',a)
interfaces=s[a:b].replace('@interface TlonReadRegistration ()','@interface TlonReadRegistration : NSObject')
c=s.index('  sr::Point resolve(')
provider=s[b:c]+'  sr::Point resolve(const sr::Witness &, const sr::Mount &, const sr::Viewport &) override { return {}; }\n};\n'
x=s.index('- (void)recordCapture:',s.index('@implementation TlonReadRegistry'));y=s.index('- (instancetype)init',x)
bridge=s[s.index('+ (NSDictionary *)diagnosticForScrollView:'):s.index('- (instancetype)initWithHost:')]
out.joinpath('provider-actual.inc').write_text('@class TlonReadRegistry;\n'+interfaces+'\n'+provider+'\n@implementation TlonReadRegistry\n'+s[x:y]+'\n@end\n@implementation TlonReadRegistration\n'+bridge+'\n@end\n')
PY
repo=${SCROLLER_TEST_REPO:-$(git -C "$here" rev-parse --show-toplevel)}
clang++ -std=c++20 -fobjc-arc -fblocks -framework Foundation -framework CoreGraphics \
  -Wall -Wextra -Wno-incomplete-implementation -Wno-missing-field-initializers -Werror -I "$out" \
  -I "$repo/node_modules/react-native/React/Fabric/Mounting/ComponentViews/ScrollView" \
  "$here/../TlonReadDescriptors.mm" "$here/read-capture-diagnostic-controls.mm" -o "$out/read-capture-diagnostic-controls"
"$out/read-capture-diagnostic-controls"
