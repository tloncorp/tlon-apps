#!/bin/bash

click=/repo/scripts/backend/click
ship="~zod"
pier=/piers/${ship#\~}

# The ship runs in a container built from scripts/backend/container/, with the
# repository mounted read-only at /repo. click and every pier file operation
# run inside it, so the host needs only a container runtime and what
# `just build` uses to assemble the desk.
container=groups-tests-$$

source scripts/backend/container/runtime.sh

$runtime build -t $image scripts/backend/container/ || exit 1
prune_images

echo "Booting ship"
$runtime run -d --rm --name $container -e URBIT_ARGS="--loom 33" \
  -v "$PWD":/repo:ro $image $ship > /dev/null || exit 1
trap '$runtime stop $container > /dev/null 2>&1' EXIT
$runtime logs -f $container &

function in_ship
{
    $runtime exec -i $container "$@"
}

function await_ship
{
    while ! in_ship wget -q -O /dev/null "http://127.0.0.1:8080/~/login" 2> /dev/null
    do
        # The container is removed when the ship exits.
        if ! $runtime inspect $container > /dev/null 2>&1
        then
            echo "Ship exited"
            exit 1
        fi
        sleep 1
    done
}

await_ship

# Allow 10m for longest running operations
TIMEOUT=600

run_click="in_ship $click -t $TIMEOUT -b urbit -i - -kp"

# Unmount and mount %groups
echo "Mounting groups..."
$run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
;<  ~  bind:m  (poke [our.bowl %hood] kiln-unmount+!>(%groups))  
;<  ~  bind:m  (sleep ~s0)  
=/  =path  
  [(scot %p our.bowl) %groups (scot %da now.bowl) ~]  
;<  ~  bind:m  (poke [our.bowl %hood] kiln-mount+!>([path %groups]))  
(pure:m !>(%ok))  
EOF

# Insert the image's boot pill, which the aqua tests boot their ships from.
in_ship sh -c "cp \$URBIT_PILL $pier/groups/pill.jam"

# TODO: We should figure out the source ship for this file and delete it
in_ship rm -f $pier/groups/tests/lib/diary-graph.hoon

# Update the groups desk. Assemble the full desk (desk-deps/ vendored deps +
# desk/ source) and overlay it onto the pill's groups desk. The pill provides a
# bootable base; the assembled tree brings in vendored deps (e.g.
# sur/mcp-proxy) that live only in desk-deps/. Overlaid without deleting so the
# pill's own artifacts (the jammed pill used by the aqua tests) are preserved.
just build || exit 1
in_ship cp -r /repo/desk-out/. $pier/groups/
# The build stamps the git hash into commit.txt; keep the 'development'
# placeholder the logs test (/tests/app/logs) asserts on instead.
in_ship cp /repo/desk/commit.txt $pier/groups/commit.txt

in_ship rm -rf $pier/groups/tests
in_ship cp -r /repo/desk/tests $pier/groups/tests

result=$( $run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  hash=@uvI  bind:m  (scry @uvI %cz /groups)  
(pure:m !>(hash))  
EOF
)
desk_hash_a=`echo $result | sed -n 's/\[0 %avow 0 %noun \(.*\)\]/\1/p'`

if [ -z "$desk_hash_a" ]
then
  echo "Invalid empty desk hash (a)"
  exit 1
fi

echo "Updating groups desk"
${run_click} $pier <<EOF
=/  m  (strand ,vase)  
;<  our=ship  bind:m  get-our  
;<  ~  bind:m  (poke [our %hood] kiln-commit+!>([%groups |]))  
(pure:m !>(%ok))  
EOF

sleep 3
echo "Awaiting desk update..."
await_ship

result=$( $run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  hash=@uvI  bind:m  (scry @uvI %cz /groups)  
(pure:m !>(hash))  
EOF
)
desk_hash_b=`echo $result | sed -n 's/\[0 %avow 0 %noun \(.*\)\]/\1/p'`

if [ -z "$desk_hash_b" ]
then
  echo "Invalid empty desk hash (b)"
  exit 1
fi


if [ "$desk_hash_a" == "$desk_hash_b" ]
then
  echo "Desk upgrade failed ❌"
  exit 1
fi

# Run the unit tests
echo "Running unit tests..."
result=$( $run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=/  tests=path  
  [(scot %p our.bowl) %groups (scot %da now.bowl) %tests ~]  
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
  exit 1
fi

echo "Starting %aqua..."
${run_click} $pier "/lib/pill/hoon"<<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl    
;<  ~  bind:m  (poke [our.bowl %hood] kiln-nuke+!>([%aqua |]))  
=+  .^(=cone:clay %cx /(scot %p p.byk.bowl)//(scot %da now.bowl)/domes)  
=/  =dome:clay  (~(gut by cone) [p.byk.bowl %base] *dome:clay)  
;<  ~      bind:m  (sleep ~s0)  
;<  ~  bind:m  (poke [our.bowl %hood] kiln-rein+!>([%base (~(put by ren.dome) %aqua &)]))  
=+  pill-path=/(scot %p p.byk.bowl)/groups/(scot %da now.bowl)/pill/jam  
=+  .^(pil=@ %cx pill-path)  
=/  pill  ;;(pill:pill (cue pil))  
;<  ~  bind:m  (poke [our.bowl %aqua] pill+!>(pill))  
;<  ~  bind:m  (poke [our.bowl %hood] kiln-rm+!>(pill-path))  
(pure:m !>(%ok))  
EOF

echo "Preparing aqua snapshot..."
result=$( $run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=+  tid=~.ci-ph-fleet  
=/  args  
  [\`%ci-aqua-tests ~[~zod ~nec ~bud ~wes ~dem ~fen ~loshut-lonreg ~rivfur-livmet] &]  
=/  poke-vase  !>(\`start-args:spider\`[\`tid.bowl \`tid byk.bowl(q %groups) %ph-fleet !>(\`args)])  
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
  exit 1
fi

# Run aqua tests
#
echo "Running tests..."
result=$( $run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=/  ph-tests=path  
  [(scot %p our.bowl) %groups (scot %da now.bowl) %tests %ph ~]  
=/  args  
  [\`ph-tests %ci-aqua-tests]  
=+  tid=~.ci-ph-test  
=/  poke-vase  !>(\`start-args:spider\`[\`tid.bowl \`tid byk.bowl(q %groups) %ph-test !>(\`args)])  
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
  exit 1
fi

exit 0

