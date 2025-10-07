#!/bin/bash

click=./backend/click
ship_manifest=./apps/tlon-web/e2e/shipManifest.json
ship="~zod"
pier=${ship#\~}

urbit_bin_url="https://urbit.org/install"

arch=`arch`

case $OSTYPE in
  linux* )  
    platform=linux
    case $arch in
      x86_64 ) 
        urbit_bin_url="$urbit_bin_url/linux-x86_64/latest"
        arch=x86_64
        ;;
      arm64  ) 
        urbit_bin_url="$urbit_bin_url/linux-aarch64/latest"
        arch=aarch64
        ;;
    esac ;;
  darwin* )
    platform=macos
    case $arch in
      x86_64 ) 
        urbit_bin_url="$urbit_bin_url/macos-x86_64/latest"
        arch=x86_64
        ;;
      arm64  ) 
        urbit_bin_url="$urbit_bin_url/macos-aarch64/latest"
        arch=aarch64
        ;;
    esac ;;
esac

echo $urbit_bin_url
  
echo "Running backend unit tests"

download_url=`jq -r ".[\"$ship\"][\"downloadUrl\"]" < $ship_manifest`
archive=`basename $download_url`

if [ ! -f $archive ]
then
  echo "Downloading ~zod archive $archive"
  curl $download_url > $archive
fi

# Unpack the pier
if [ ! -d $pier ]
then
  echo "Unpacking pier $archive"
  tar -xf $archive
fi

if [ ! -d $pier ]
then
  echo "Pier $pier not found!"
  exit 1
else
  echo "Pier ready"
fi

function find_vere()
{
  vere_version=`ls | grep "vere-.*-${platform}-${arch}" | cut -d '-' -f 2`
  vere="./vere-${vere_version}-${platform}-${arch}"
}

find_vere

vere_archive=vere-latest.gz

if [ ! -x $vere ]
then
  echo "Downloading urbit runtime"
  curl -L $urbit_bin_url -o $vere_archive
  tar -xf $vere_archive
fi

find_vere

if [ ! -x $vere ]
then
  echo "Failed to find vere binary!"
  exit 1
fi

http_port=9090
echo "Booting ship"
($vere --loom 33 --http-port $http_port -t $pier) &
vere_pid=$!

sleep 3
while ! curl "http://localhost:$http_port"
do
  sleep 3
done

sleep 5

run_click="$click -b $vere -i - -kp $pier"

# Mount %base
$run_click <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=/  =path  
  [(scot %p our.bowl) %base (scot %da now.bowl) ~]  
;<  ~  bind:m  (poke [~zod %hood] kiln-mount+!>([path %base]))  
(pure:m !>(%ok))  
EOF

# Unmount and mount %groups
$run_click <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
;<  ~  bind:m  (poke [~zod %hood] kiln-unmount+!>(%groups))  
;<  ~  bind:m  (sleep ~s0)  
=/  =path  
  [(scot %p our.bowl) %groups (scot %da now.bowl) ~]  
;<  ~  bind:m  (poke [~zod %hood] kiln-mount+!>([path %groups]))  
(pure:m !>(%ok))  
EOF

# Patch the broken +await-thread in /lib/strandio.hoon
patch -f $pier/base/lib/strandio.hoon `dirname $0`/strandio.patch
$run_click <<EOF
=/  m  (strand ,vase)  
;<  our=ship  bind:m  get-our  
;<  ~  bind:m  (poke [~zod %hood] kiln-commit+!>([%base |]))  
(pure:m !>(%ok))  
EOF

# TODO: We should figure out the source ship for this file and delete it
rm $pier/groups/tests/lib/diary-graph.hoon

# Update the desk
rsync -r desk/ $pier/groups

$run_click <<EOF
=/  m  (strand ,vase)  
;<  our=ship  bind:m  get-our  
;<  ~  bind:m  (poke [~zod %hood] kiln-commit+!>([%groups |]))  
(pure:m !>(%ok))  
EOF

echo "Awaiting desk update..."
sleep 3
while ! curl "http://localhost:$http_port"
do
  sleep 3
done

# Run the unit tests
echo "Running tests..."
result=$( $run_click <<EOF
=/  m  (strand ,vase)  
;<  =bowl  bind:m  get-bowl  
=/  tests=path  
  [(scot %p our.bowl) %groups (scot %da now.bowl) %tests ~]  
;<  =thread-result  bind:m  
  (await-thread %test !>(\`tests))  
?:  ?=(%| -.thread-result)  
  %-  (slog %thread-fail p.thread-result)  
  (pure:m !>(1))  
(pure:m !>(0))  
EOF
)

result_code=`echo $result | sed 's/\[0 %avow 0 %noun \(.*\)\]/\1/'`

if [[ $result_code == 0 ]]
then
  echo "Tests passed ✅"
  exit 0
else
  echo "Tests failed ❌"
fi

kill -TERM $vere_pid
