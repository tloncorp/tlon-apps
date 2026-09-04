#!/bin/bash

click=./backend/click
ship="~zod"
pier_dir=${ship#\~}
pier=$pier_dir

urbit_bin_url="https://bootstrap.urbit.org/vere/live/v4.6"
vere_ver="vere-v4.6"
arch=`uname -m`

case $OSTYPE in
  linux* )
    platform=linux
    case $arch in
      x86_64 )
        # urbit_bin_url="$urbit_bin_url/linux-x86_64/latest"
        urbit_bin_url="$urbit_bin_url/$vere_ver-linux-x86_64"
        arch=x86_64
        ;;
      arm64 | aarch64 )
        # urbit_bin_url="$urbit_bin_url/linux-aarch64/latest"
        urbit_bin_url="$urbit_bin_url/$vere_ver-linux-aarch64"
        arch=aarch64
        ;;
    esac ;;
  darwin* )
    platform=macos
    case $arch in
      x86_64 )
        # urbit_bin_url="$urbit_bin_url/macos-x86_64/latest"
        urbit_bin_url="$urbit_bin_url/$vere_ver-macos-x86_64"
        arch=x86_64
        ;;
      arm64  )
        # urbit_bin_url="$urbit_bin_url/macos-aarch64/latest"
        urbit_bin_url="$urbit_bin_url/$vere_ver-macos-aarch64"
        arch=aarch64
        ;;
    esac ;;
esac

pill_download_url="https://bootstrap.urbit.org/tlon-192187b-1f43d2e.pill"

#archive=`basename $download_url`
pill=`basename $pill_download_url`
pill_name=`echo $pill | cut -d . -f1`
echo "pill: $pill_name"

if [ ! -f $pill ]
then
  echo "Downloading aqua test pill $pill"
  curl -s $pill_download_url > $pill
fi

function find_vere()
{
  vere="./${vere_ver}-${platform}-${arch}"
  echo "our vere: $vere"
}

find_vere

vere_archive=vere-latest.gz

if [ ! -x $vere ]
then
  echo "Downloading urbit runtime"
  curl -L $urbit_bin_url -o $vere_ver-${platform}-${arch}
  chmod +x $vere
fi

find_vere

if [ ! -x $vere ]
then
  echo "Failed to find vere binary!"
  exit 1
fi

http_port=9090
ames_port=31999
if [ ! -d $pier_dir ]
then
  echo "Generating test ship $ship"
  $vere -F $pier_dir -c $pier_dir -B $pill --http-port $http_port -p $ames_port -t -x

  if [ "$?" -ne 0 ]
  then
    echo "Failed to generate test ship $ship"
    exit 1
  fi
fi

echo "Booting ship"
($vere --loom 33 --http-port $http_port -p $ames_port -t $pier) &
vere_pid=$!
trap 'kill -TERM $vere_pid 2>/dev/null' EXIT

function await_ship
{
    while ! curl -s "http://localhost:$http_port/~/login" > /dev/null
    do
        sleep 1
    done
}

await_ship

# Login becomes available before Gall finishes installing %spider from a
# freshly booted brass pill. Desk operations below rely on that agent.
sleep 3

# Aqua snapshots boot and sync an eight-ship fleet, which can exceed ten
# minutes on the two-core CI runners. Keep the request alive through that
# work; socat's inactivity ceiling remains 30 minutes as well.
TIMEOUT=1800

# Send source exactly as the pill builder does.  The legacy click helper
# rewrites input layout, which is incompatible with Vere 4.6's %khan-eval.
run_thread() {
  local hoon card
  hoon=$(awk '{ printf "%s%s", "\\0a", $0 }')
  card="[0 %fyrd [%base %khan-eval %noun [%ted-eval '$hoon']]]"
  echo "$card" | "$vere" eval -jn |
    socat -T 1800 -t "$TIMEOUT" - UNIX-CONNECT:"$pier/.urb/conn.sock" |
    "$vere" eval -cnk
}

# Aqua's %pill poke is typed by /lib/pill/hoon.  This is the direct-transport
# equivalent of the legacy click invocation with that dependency.
run_thread_with_pill_lib() {
  local hoon card
  hoon=$(awk '{ printf "%s%s", "\\0a", $0 }')
  card="[0 %fyrd [%base %khan-eval %noun [%ted-eval ['$hoon' [/lib/pill/hoon ~]]]]]"
  echo "$card" | "$vere" eval -jn |
    socat -T 1800 -t "$TIMEOUT" - UNIX-CONNECT:"$pier/.urb/conn.sock" |
    "$vere" eval -cnk
}

# Mount %base
echo "Mounting base..."
run_thread <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
;<  ~  bind:m  (poke [our.bowl %hood] kiln-unmount+!>(%base))  
;<  ~  bind:m  (sleep ~s0)
=/  =path  
  [(scot %p our.bowl) %base (scot %da now.bowl) ~]  
;<  ~  bind:m  (poke [our.bowl %hood] kiln-mount+!>([path %base]))  
(pure:m !>(%ok))  
EOF

# Mount the %tlon desk supplied by the brass pill.
echo "Mounting %tlon..."
run_thread <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=/  =path  
  [(scot %p our.bowl) %tlon (scot %da now.bowl) ~]
;<  ~  bind:m  (poke [our.bowl %hood] kiln-mount+!>([path %tlon]))
(pure:m !>(%ok))  
EOF

# Insert the jammed pill

if [ ! -f "${pier}/tlon/${pill_name}.jam" ]
then
  cp $pill ${pier}/tlon/${pill_name}.jam
fi

echo "Updating base desk..."
run_thread <<EOF
=/  m  (strand ,vase)  
;<  our=ship  bind:m  get-our  
;<  ~  bind:m  (poke [our %hood] kiln-commit+!>([%base |]))  
(pure:m !>(%ok))  
EOF

# TODO: We should figure out the source ship for this file and delete it
rm -f $pier/tlon/tests/lib/diary-graph.hoon

# Update the tlon desk. Assemble the full desk (desk-deps/ vendored deps +
# desk/ source) and overlay it onto the pill's tlon desk. The pill provides a
# bootable base; the assembled tree brings in peru-vendored deps (e.g.
# sur/mcp-proxy) that live only in desk-deps/. Overlaid without --delete so the
# pill's own artifacts (the jammed pill used by the aqua tests) are preserved.
assembled=$(mktemp -d)
./scripts/assemble-desk.sh "$assembled"
# assemble-desk stamps the git hash into commit.txt; keep the 'development'
# placeholder the logs test (/tests/app/logs) asserts on instead.
cp desk/commit.txt "$assembled/commit.txt"
rsync -r "$assembled"/ $pier/tlon
rm -rf "$assembled"

rsync -r --delete desk/tests/ $pier/tlon/tests

result=$( run_thread <<EOF
=/  m  (strand ,vase)  
;<  hash=@uvI  bind:m  (scry @uvI %cz /tlon)
(pure:m !>(hash))  
EOF
)
desk_hash_a=`echo $result | sed -n 's/\[0 %avow 0 %noun \(.*\)\]/\1/p'`

if [ -z "$desk_hash_a" ]
then
  echo "Invalid empty desk hash (a)"
  kill -TERM $vere_pid
  exit 1
fi

echo "Updating tlon desk"
run_thread <<EOF
=/  m  (strand ,vase)  
;<  our=ship  bind:m  get-our  
;<  ~  bind:m  (poke [our %hood] kiln-commit+!>([%tlon |]))
(pure:m !>(%ok))  
EOF

sleep 3
echo "Awaiting desk update..."
await_ship

result=$( run_thread <<EOF
=/  m  (strand ,vase)  
;<  hash=@uvI  bind:m  (scry @uvI %cz /tlon)
(pure:m !>(hash))  
EOF
)
desk_hash_b=`echo $result | sed -n 's/\[0 %avow 0 %noun \(.*\)\]/\1/p'`

if [ -z "$desk_hash_b" ]
then
  echo "Invalid empty desk hash (b)"
  kill -TERM $vere_pid
  exit 1
fi


if [ "$desk_hash_a" == "$desk_hash_b" ]
then
  echo "Desk upgrade failed ❌"
  kill -TERM $vere_pid
  exit 1
fi

# Run the unit tests
echo "Running unit tests..."
result=$( run_thread <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=/  tests=path  
  [(scot %p our.bowl) %tlon (scot %da now.bowl) %tests ~]
;<  =thread-result  bind:m  
  (await-thread %test !>(\`tests))  
?:  ?=(%| -.thread-result)  
  %-  (slog %thread-fail p.thread-result)  
  (pure:m !>(|))  
=+  !<(ok=? p.thread-result)  
(pure:m !>(ok))  
EOF
)

result_code=`echo $result | sed 's/\[0 %avow 0 %noun \(.*\)\]/\1/'`

if [[ $result_code == "0" ]]
then
  echo "Unit tests passed ✅"
else
  echo "Unit tests failed ❌"
  kill -TERM $vere_pid
  exit 1
fi

echo "Starting %aqua..."
run_thread_with_pill_lib <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl    
;<  ~  bind:m  (poke [our.bowl %hood] kiln-nuke+!>([%aqua |]))  
=+  .^(=cone:clay %cx /(scot %p p.byk.bowl)//(scot %da now.bowl)/domes)  
=/  =dome:clay  (~(gut by cone) [p.byk.bowl %base] *dome:clay)  
;<  ~      bind:m  (sleep ~s0)  
;<  ~  bind:m  (poke [our.bowl %hood] kiln-rein+!>([%base (~(put by ren.dome) %aqua &)]))  
=+  pill-path=/(scot %p p.byk.bowl)/tlon/(scot %da now.bowl)/${pill_name}/jam
=+  .^(pil=@ %cx pill-path)  
=/  pill  ;;(pill:pill (cue pil))  
;<  ~  bind:m  (poke [our.bowl %aqua] pill+!>(pill))  
;<  ~  bind:m  (poke [our.bowl %hood] kiln-rm+!>(pill-path))  
(pure:m !>(%ok))  
EOF

echo "Preparing aqua snapshot..."
result=$( run_thread <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=+  tid=~.ci-ph-fleet  
=/  args  
  [\`%ci-aqua-tests ~[~zod ~nec ~bud ~wes ~dem ~fen ~loshut-lonreg ~rivfur-livmet] &]  
=/  poke-vase  !>(\`start-args:spider\`[\`tid.bowl \`tid byk.bowl(q %tlon) %ph-fleet !>(\`args)])
;<  ~      bind:m  (watch-our /awaiting/[tid] %spider /thread-result/[tid])  
;<  ~      bind:m  (poke-our %spider %spider-start poke-vase)  
;<  =cage  bind:m  (take-fact /awaiting/[tid])  
;<  ~      bind:m  (take-kick /awaiting/[tid])  
=/  thread-result=(each vase [term tang])  
  ?+  p.cage  ~|([%strange-thread-result p.cage %ph-test tid] !!)  
    %thread-done  [%& q.cage]  
    %thread-fail  [%| !<([term tang] q.cage)]  
  ==  
?:  ?=(%| -.thread-result)  
  %-  (slog %thread-fail p.thread-result)  
  (pure:m !>(|))  
(pure:m !>(&))  
EOF
)

result_code=`echo $result | sed 's/\[0 %avow 0 %noun \(.*\)\]/\1/'`

if [[ $result_code != "0" ]]
then
  echo "Failed to generate aqua snapshot ❌"
  kill -TERM $vere_pid
  exit 1
fi

# Run aqua tests
#
aqua_test_path="${AQUA_TEST_PATH:-/tests/ph}"
echo "Running tests..."
result=$( run_thread <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=/  ph-tests=path  
  [(scot %p our.bowl) %tlon (scot %da now.bowl) ${aqua_test_path}]
=/  args  
  [\`ph-tests %ci-aqua-tests]  
=+  tid=~.ci-ph-test  
=/  poke-vase  !>(\`start-args:spider\`[\`tid.bowl \`tid byk.bowl(q %tlon) %ph-test !>(\`args)])
;<  ~      bind:m  (watch-our /awaiting/[tid] %spider /thread-result/[tid])  
;<  ~      bind:m  (poke-our %spider %spider-start poke-vase)  
;<  =cage  bind:m  (take-fact /awaiting/[tid])  
;<  ~      bind:m  (take-kick /awaiting/[tid])  
=/  thread-result=(each vase [term tang])  
  ?+  p.cage  ~|([%strange-thread-result p.cage %ph-test tid] !!)  
    %thread-done  [%& q.cage]  
    %thread-fail  [%| !<([term tang] q.cage)]  
  ==  
?:  ?=(%| -.thread-result)  
  %-  (slog %thread-fail p.thread-result)  
  (pure:m !>(|))  
=+  !<(ok=? p.thread-result)  
(pure:m !>(ok))  
EOF
)

result_code=`echo $result | sed 's/\[0 %avow 0 %noun \(.*\)\]/\1/'`

if [[ $result_code == "0" ]]
then
  echo "Aqua tests passed ✅"
else
  echo "Aqua tests failed ❌"
  kill -TERM $vere_pid
  exit 1
fi

kill -TERM $vere_pid
exit 0
