#!/bin/bash

click=./backend/click
#ship_manifest=./apps/tlon-web/e2e/shipManifest.json
ship="~bud"
pier_dir=${ship#\~}
pier=$pier_dir-aqua

urbit_bin_url="https://bootstrap.urbit.org/vere/next/kelvin/408/v4.4-faff152"
vere_ver="vere-v4.4-faff152"
arch=`arch`

case $OSTYPE in
  linux* )  
    platform=linux
    case $arch in
      x86_64 ) 
        # urbit_bin_url="$urbit_bin_url/linux-x86_64/latest"
        urbit_bin_url="$urbit_bin_url/$vere_ver-linux-x86_64"
        arch=x86_64
        ;;
      arm64  ) 
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

echo $urbit_bin_url
  
echo "Running backend unit tests"

#download_url=`jq -r ".[\"$ship\"][\"downloadUrl\"]" < $ship_manifest`
download_url="https://bootstrap.urbit.org/zod-aqua-408k.xst"
pill_download_url="https://bootstrap.urbit.org/groups-v11-2-2.pill"

archive=`basename $download_url`
pill=`basename $pill_download_url`
pill_name=`echo $pill | cut -d . -f1`
echo "pill: $pill_name"

if [ ! -f $archive ]
then
  echo "Downloading ~zod archive $archive"
  curl -s $download_url > $archive
fi

# Unpack the pier
if [ ! -d $pier ]
then
  echo "Unpacking pier $archive"
  tar -xf $archive
  mv $pier_dir $pier
fi

if [ ! -d $pier ]
then
  echo "Pier $pier not found!"
  exit 1
else
  echo "Pier ready"
fi

if [ ! -f $pill ]
then
  echo "Downloading aqua test pill $pill"
  curl -s $pill_download_url > $pill
fi

function find_vere()
{
  # vere_version=`ls | grep "vere-.*-${platform}-${arch}" | cut -d '-' -f 2`
  # echo $vere_version
  # vere="./vere-${vere_version}-${platform}-${arch}"
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
  # tar -xf $vere_archive
fi

find_vere

if [ ! -x $vere ]
then
  echo "Failed to find vere binary!"
  exit 1
fi

http_port=9090
if [ ! -d $pier_dir ]
then
  echo "Generating test ship $ship"
  $vere -F $pier_dir -c $pier_dir -B $pill --http-port $http_port -t -x

  if [ "$?" -ne 0 ]
  then
    echo "Failed to generate test ship $ship"
    exit 1
  fi
fi

echo "Booting ship"
($vere --loom 33 --http-port $http_port -t $pier) &
vere_pid=$!

sleep 3
while ! curl -s "http://localhost:$http_port"
do
  sleep 3
done

run_click="$click -b $vere -i - -kp"

# Mount %base
echo "Mounting base..."
$run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
;<  ~  bind:m  (poke [~zod %hood] kiln-unmount+!>(%base))  
;<  ~  bind:m  (sleep ~s0)  
=/  =path  
  [(scot %p our.bowl) %base (scot %da now.bowl) ~]  
;<  ~  bind:m  (poke [~zod %hood] kiln-mount+!>([path %base]))  
(pure:m !>(%ok))  
EOF

# Unmount and mount %groups
echo "Mounting groups..."
$run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
;<  ~  bind:m  (poke [~zod %hood] kiln-unmount+!>(%groups))  
;<  ~  bind:m  (sleep ~s0)  
=/  =path  
  [(scot %p our.bowl) %groups (scot %da now.bowl) ~]  
;<  ~  bind:m  (poke [~zod %hood] kiln-mount+!>([path %groups]))  
(pure:m !>(%ok))  
EOF

# Insert the jammed pill

if [ ! -f "${pier}/groups/${pill_name}.jam" ]
then
  cp $pill ${pier}/groups/${pill_name}.jam
fi

patch -f $pier/base/lib/strandio.hoon `dirname $0`/strandio.patch
rm -f $pier/base/lib/strandio.hoon.rej
rm -f $pier/base/lib/strandio.hoon.orig

patch -f $pier/base/sur/aquarium.hoon `dirname $0`/aqua-sur.patch
rm -f $pier/base/sur/aquarium.hoon.rej
rm -f $pier/base/sur/aquarium.hoon.orig

echo "Updating base desk..."
$run_click $pier <<EOF
=/  m  (strand ,vase)  
;<  our=ship  bind:m  get-our  
;<  ~  bind:m  (poke [~zod %hood] kiln-commit+!>([%base |]))  
(pure:m !>(%ok))  
EOF

# TODO: We should figure out the source ship for this file and delete it
rm -f $pier/groups/tests/lib/diary-graph.hoon
rm -f $pier/groups/tests/ph/chat.hoon

# Update the groups desk
rsync -r desk/ $pier/groups

# Hard-update our tests
rsync -r --delete desk/tests/ $pier/groups/tests

result=$( $run_click -t 3 $pier <<EOF
=/  m  (strand ,vase)  
;<  hash=@uvI  bind:m  (scry @uvI %cz /groups)  
(pure:m !>(hash))  
EOF
)
desk_hash_a=`echo $result | sed 's/\[0 %avow 0 %noun \(.*\)\]/\1/'`

echo "Updating groups desk"
${run_click} $pier <<EOF
=/  m  (strand ,vase)  
;<  our=ship  bind:m  get-our  
;<  ~  bind:m  (poke [~zod %hood] kiln-commit+!>([%groups |]))  
(pure:m !>(%ok))  
EOF

echo "Awaiting desk update..."
sleep 3
while ! curl -s "http://localhost:$http_port"
do
  sleep 3
done

result=$( $run_click -t 3 $pier <<EOF
=/  m  (strand ,vase)  
;<  hash=@uvI  bind:m  (scry @uvI %cz /groups)  
(pure:m !>(hash))  
EOF
)
desk_hash_b=`echo $result | sed 's/\[0 %avow 0 %noun \(.*\)\]/\1/'`

if [ $desk_hash_a == $desk_hash_b ]
then
  echo "Desk upgrade failed ❌"
  kill -TERM $vere_pid
  exit 1
fi

echo "Starting %aqua..."
${run_click} $pier "/lib/pill/hoon"<<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl    
;<  ~  bind:m  (poke [~zod %hood] kiln-nuke+!>([%aqua |]))  
=+  .^(=cone:clay %cx /(scot %p p.byk.bowl)//(scot %da now.bowl)/domes)  
=/  =dome:clay  (~(gut by cone) [p.byk.bowl %base] *dome:clay)  
;<  ~      bind:m  (sleep ~s0)  
;<  ~  bind:m  (poke [~zod %hood] kiln-rein+!>([%base (~(put by ren.dome) %aqua &)]))  
=+  pill-path=/(scot %p p.byk.bowl)/groups/(scot %da now.bowl)/${pill_name}/jam  
=+  .^(pil=@ %cx pill-path)  
=/  pill  ;;(pill:pill (cue pil))  
;<  ~  bind:m  (poke [~zod %aqua] pill+!>(pill))  
;<  ~  bind:m  (poke [~zod %hood] kiln-rm+!>(pill-path))  
(pure:m !>(%ok))  
EOF

echo "Preparing aqua snapshot..."
result=$( $run_click -t 900 $pier <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=+  tid=%ci-ph-fleet  
=/  args  
  [\`%ci-aqua-tests ~[~zod ~nec ~bud ~wes ~loshut-lonreg ~rivfur-livmet ~dem ~fen] &]  
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
  kill -TERM $vere_pid
  exit 1
fi

# Run aqua tests
#
echo "Running tests..."
result=$( $run_click -t 1200 $pier <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=/  ph-tests=path  
  [(scot %p our.bowl) %groups (scot %da now.bowl) %tests %ph ~]  
=/  args  
  [\`ph-tests %ci-aqua-tests]  
=+  ted=%ci-ph-test  
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
kill -TERM $vere_pid

if [[ $result_code == "0" ]]
then
  echo "Tests passed ✅"
  exit 0
else
  echo "Tests failed ❌"
  exit 1
fi

