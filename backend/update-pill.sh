#!/bin/bash
#
# This script generates a new pill based on supplied
# revisions of base and groups desks.
#

set -eu

# Always run in ./backend
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

fatal() {
    echo "❌ $1" >&2
    exit 1
}

# Find a given file. If not found, download it.
#
# Arguments:
#   $1 - url
#   $2 - file
#
find_download() {

    if (($# < 2))
    then 
        fatal "find_download(): not enough args"
    fi

    local url=$1
    local file=$2

    if [[ ! -e "$file" ]]
    then
        echo "Downloading $file"
        curl -# -f $url -o $file
        return $?
    fi

    return 0
}

# Execute thread via fyrd conn task
#
# run_thread <desc> <pier>
#
# Prints the parsed out result noun to standard output on success.
# On failure terminates the script with diagnostic error message.
#
run_thread() {

    local desc="$1"
    local pier="$2"

    # Allow 10m for longest running operations
    local TIMEOUT=600
    local id=0

    local hoon=$(cat - | awk '{ printf "%s%s", sep, $0; sep="  "}')
    local card="[$id %fyrd [%base %khan-eval %noun [%ted-eval '$hoon']]]"

    out_file=`mktemp`

    result=$(echo "$card" | $vere eval -jn | 
        socat -T 1800 -t $TIMEOUT - UNIX-CONNECT:"$pier/.urb/conn.sock" | 
        $vere eval -cnk 2> $out_file )
    
    rex="\[$id %avow 0.*"
    if [[ ! $result =~ $rex ]]
    then
        echo $result
        cat $out_file >&2
		rm $out_file
        
		fatal "Thread failed: $desc"
    else
		rm $out_file

        echo "➡️ $desc" >&2

        echo $result | sed 's/\[0 %avow 0 %noun \(.\+\)\]/\1/'
        return 0
    fi
}
# Execute thread without printing result
#
run_thread_silent() {

    run_thread "$1" "$2" > /dev/null
}

mount_desk() {
    
    desk=$1

    run_thread_silent "mount $desk desk" $pier <<-HOON
	=/  m  (strand ,vase)
	;<  =bowl  bind:m  get-bowl
	;<  ~  bind:m  (poke [our.bowl %hood] kiln-unmount+!>($desk))
	;<  ~  bind:m  (sleep ~s0)
	=/  =path
	  [(scot %p our.bowl) $desk (scot %da now.bowl) ~]
	;<  ~  bind:m  (poke [our.bowl %hood] kiln-mount+!>([path $desk]))
	;<  ~  bind:m  (sleep ~s0)
	(pure:m !>(&))
	HOON
}

commit_desk() {

    desk=$1

    run_thread_silent "commit $desk desk" $pier <<-HOON
	=/  m  (strand ,vase)
	;<  our=ship  bind:m  get-our
	;<  ~  bind:m  (poke [our %hood] kiln-commit+!>([$desk |]))
	(pure:m !>(&))
	HOON
}

suspend_desk() {
	
	desk=$1

	run_thread_silent "suspend $desk" $pier <<-HOON
	=/  m  (strand ,vase)
	;<  =bowl  bind:m  get-bowl
	;<  ~  bind:m
	  (send-raw-card %pass /suspend %arvo %c [%zest $desk %dead])
	(pure:m !>(&))
	HOON
}

get_desk_hash() {

	desk=$1

	run_thread "retrieve hash for $desk" $pier <<-HOON
	=/  m  (strand ,vase)  
	;<  hash=@uvI  bind:m  (scry @uvI %cz \`path\`[$desk ~])
	(pure:m !>(hash))  
	HOON
}

function usage()
{
    cat <<EOF
Usage: $0 [-fus] <base-ref> <groups-ref>

Generate a pill containing %base and %groups desks at the specified Git references.

Options:
    -f  force skip desk hash check
    -u  upload the resulting pill to storage
    -s  skip pill verification
    -c  cleanup working files
EOF
}

force=false
upload=false
verify=true
cleanup=false

while getopts "fusc" opt; do
    case "$opt" in
        f)
            force=true
            ;;
        u)
            upload=true
            ;;
        s)
            verify=false
            ;;
        c)
            cleanup=true
            ;;
        :)
            usage >&2
            exit 2
            ;;
        \?)
            usage >&2
            exit 2
            ;;
    esac
done

shift "$((OPTIND - 1))"

if (( $# <= 1 ))
then
    usage
    exit 1
fi

if ! $verify && $upload
then
    fatal "-u and -s both used: unverified pills can't be upload"
fi

base_rev=$1
groups_rev=$2

ship="bud"

vere_url="https://bootstrap.urbit.org/vere/live"
vere_ver="v4.6"

urbit_pill_url="https://bootstrap.urbit.org/urbit-$vere_ver.pill"
urbit_pill="urbit-$vere_ver.pill"

base_repo="https://github.com/urbit/urbit"
groups_repo="https://github.com/tloncorp/tlon-apps"

storage_url="gs://bootstrap.urbit.org"

arch=`uname -m`
platform=""

case $OSTYPE in
  linux*)
    platform=linux
    case $arch in
      x86_64)
          arch=x86_64
          ;;
      arm64 | aarch64)
          arch=aarch64
          ;;
      *)
          fatal "Unsupported arch $arch"
    esac ;;
  darwin*)
    platform=macos
    case $arch in
      x86_64)
          arch=x86_64
          ;;
      arm64)
          arch=aarch64
          ;;
      *)
          fatal "Unsupported arch $arch"
          ;;
    esac ;;
  *)
      fatal "Unsupported platform $OSTYPE"
      ;;
esac


if [[ -z $platform ]]
then
    echo "Unsupported platform $OSTYPE"
    exit 1
fi

if [[ -z $arch ]]
then
    echo "Unsupported architecture $arch"
    exit 1
fi

vere_bin="vere-$vere_ver-$platform-$arch"

find_download "$vere_url/$vere_ver/$vere_bin" $vere_bin \
    || fatal "Failed to download $vere_bin"
vere="./$vere_bin"

if [[ ! -x $vere_bin ]]; then chmod +x $vere_bin; fi

find_download $urbit_pill_url $urbit_pill

pier="./$ship"

if [[ -d $pier ]]
then
    echo "pier $pier exists, verifying boot"

    if $vere -x $pier
    then
        echo "✅ $ship ready"
    else
        fatal "$ship fails to boot"
    fi
fi

if [[ ! -d $pier ]]
then
    echo "⚙️ Booting $ship..."
    $vere -x -F $ship -c $ship -B $urbit_pill \
        || fatal "Failed to boot $ship"
    echo "✅ $ship ready"
fi

if [[ ! -d "./$ship" ]]
then
    fatal "Unable to boot $ship"
fi

# Prepare a repository at a remote ref. The ref may be a branch, tag,
# full ref (for example refs/pull/123/head), or fetchable commit hash.
prepare_git_checkout() {
    local dir=$1
    local url=$2
    local ref=$3

    if [[ ! -e "$dir" ]]
    then
        git init -q "$dir" || fatal "Failed to initialize $dir"
        git -C "$dir" remote add origin "$url"
    elif [[ ! -d "$dir/.git" ]]
    then
        fatal "$dir exists but is not a git repository"
    fi

    git -C "$dir" remote set-url origin "$url"
    git -C "$dir" fetch -q --depth=1 origin "$ref" ||
        fatal "Failed to fetch $url at $ref"
    git -C "$dir" checkout -q --force --detach FETCH_HEAD ||
        fatal "Failed to check out $url at $ref"
}

# Prepare base and groups repositories
#
base_url="https://github.com/urbit/urbit"
groups_url="https://github.com/tloncorp/tlon-apps"

prepare_git_checkout urbit-git "$base_url" "$base_rev"
prepare_git_checkout tlon-apps-git "$groups_url" "$groups_rev"

base_hash=$(git -C urbit-git rev-parse --short HEAD)
groups_hash=$(git -C tlon-apps-git rev-parse --short HEAD)

http_port=9123
$vere --loom 33 --http-port $http_port -t $pier &
vere_pid=$!

stop_vere() {
    echo "Shutting down vere $vere_pid"
    kill -TERM $vere_pid 2> /dev/null || true
    wait $vere_pid || true
}

function await_ship
{
    local timeout=1800
    local deadline=$((SECONDS + timeout))
    local url="http://localhost:$http_port/~/login"

    while ! curl --fail --silent --max-time 2 "$url" > /dev/null
    do
        if ! kill -0 "$vere_pid" 2> /dev/null
        then
            fatal "Vere exited while waiting for $url"
        fi

        if (( SECONDS >= deadline ))
        then
            fatal "Timed out after ${timeout}s waiting for $url"
        fi

        sleep 1
    done
}

trap stop_vere EXIT

await_ship

suspend_desk %groups
suspend_desk %landscape
suspend_desk %webterm

mount_desk %base

git -C ./urbit-git restore pkg/base-dev/sur/aquarium.hoon

if ! patch ./urbit-git/pkg/base-dev/sur/aquarium.hoon < ./aqua.patch
then
    fatal "Failed to patch /sur/aquarium.hoon"
fi

if ! rsync -q -avL --delete ./urbit-git/pkg/arvo/ $pier/base
then
    fatal "Failed to sync base desk"
fi

commit_desk %base

await_ship
# We need to wait for spider to reload, it is needed for running kahn threads
sleep 3

echo "Mounting groups"
mount_desk %groups

if ! (cd ./tlon-apps-git && ./scripts/assemble-desk.sh ../$pier/groups)
then
    fatal "Failed to sync groups desk"
fi

groups_old_cz=`get_desk_hash %groups`

commit_desk %groups
await_ship

run_thread_silent "revive %groups" $pier <<HOON
=/  m  (strand ,vase)
;<  =bowl  bind:m  get-bowl
;<  ~  bind:m
  (send-raw-card %pass /live %arvo %c [%zest %groups %live])
;<  ~  bind:m  (sleep ~s0)
(pure:m !>(&))
HOON

await_ship

if [[ "$groups_old_cz" == `get_desk_hash %groups` ]]
then
    if ! $force
    then
        fatal "Groups desk has not updated, override with -f to continue"
    else
        echo "⚠️ Groups desk has not updated, forced to continue"
    fi
fi

safe_base_rev=$(printf '%s' "$base_rev" | sed 's/[^A-Za-z0-9_-]/-/g')
pill_name="groups-$safe_base_rev-$base_hash-$groups_hash"
pill_file=$pill_name.pill

if [[ ! -e ./$pill_file ]]
then
    echo "➡️ Generating pill $pill_name, please standby"

    run_thread_silent "generate pill" $pier <<-HOON
	=/  m  (strand ,vase)
	;<  =bowl  bind:m  get-bowl
	=/  lens-command
	:-  dojo+\'+pill/brass %base %groups\'
	output-pill+\'$pill_name/pill\'
	;<  ~  bind:m
	(poke-our %dojo lens-command+!>([%$ lens-command]))
	(pure:m !>(&))
	HOON

    await_ship

    if [[ ! -e $pier/.urb/put/$pill_file ]]
    then
        fatal "Failed to generate pill $pill_name"
    else
        mv $pier/.urb/put/$pill_file $pill_file
        echo "💊 Pill generated: $pill_file"
    fi
else
    echo "💊 Generated pill $pill_name found"
fi


stop_vere
trap - EXIT

if $verify
then
    echo "⚙️ Verifying pill"

	rm -rf ./nec

    if $vere -F nec -c nec -B $pill_file -x 
    then
        echo "☑️ Pill verified"
        rm -rf ./nec
    else
        echo "❌ Pill failed verification!"
        rm -rf ./nec
        exit 1
    fi
else
    echo "⚠️ Pill verification skipped"
fi

if $upload
then
    if ! $verify
    then
        fatal "Pill must be verified to upload!"
    fi

    echo "⬆️ Uploading $pill_file to storage"

    if ! gcloud storage cp $pill_file $storage_url/$pill_file
    then
        fatal "Upload failed"
    fi
fi

if $cleanup
then
    rm -rf $ship
    rm -rf $urbit_pill
    rm -rf $vere
    rm -rf nec
    rm -rf urbit-git
    rm -rf tlon-apps-git

    # Only cleanup the pill if it was successfully uploaded
    #
    if $upload
    then
        rm -rf $pill_file
    fi
fi

