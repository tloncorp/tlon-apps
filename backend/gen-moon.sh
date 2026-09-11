#!/bin/bash

set -eu

# Always run in ./backend so the cookie cache has a predictable location.
# Preserve the caller's directory so a relative boot directory is resolved as
# users expect rather than relative to ./backend.
caller_dir=$PWD
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

usage() {
    cat <<EOF
Usage: $0 [-bt] [-d directory] <ship>

Generate a moon for a live-network ship. Supply the ship without a leading ~.

Options:
    -b  boot the generated moon
    -d  create the booted moon's pier under this directory (implies -b)
    -t  use Tlon hosted mode (tlon.network instead of arvo.network)
EOF
}

boot=false
hosted=false
boot_dir=.

while getopts ":bd:t" opt
do
    case "$opt" in
        b)
            boot=true
            ;;
        d)
            boot=true
            boot_dir=$OPTARG
            ;;
        t)
            hosted=true
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

if (( $# != 1 ))
then
    usage >&2
    exit 1
fi

ship=$1

if [[ $boot_dir != /* ]]
then
    boot_dir="$caller_dir/$boot_dir"
fi

if [[ ! $ship =~ ^[a-z-]+$ ]]
then
    fatal "Invalid ship '$ship'; expected a name such as sampel-palnet"
fi

ship_name=$ship
ship_id="~$ship_name"
if $hosted
then
    EYRE_HOST="${ship_name}.tlon.network"
else
    EYRE_HOST="${ship_name}.arvo.network"
fi
EYRE_URL="https://${EYRE_HOST}"
COOKIE_FILE=".cookie-${ship_name}.txt"

# Authenticate with Eyre unless a cached session is available. The password is
# read without echoing and sent over stdin so it does not appear in argv.
eyre_auth() {

    if [[ -s $COOKIE_FILE ]]
    then
        if awk -v host="$EYRE_HOST" -v name="urbauth-$ship_id" -v now="$(date +%s)" \
            '$1 == host && $6 == name && ($5 == 0 || $5 > now) { found=1 } END { exit !found }' \
            "$COOKIE_FILE"
        then
            chmod 600 "$COOKIE_FILE"
            return 0
        fi
        rm -f "$COOKIE_FILE"
    fi

    local password
    local cookie_tmp

    printf "Password for %s: " "$ship_id" >&2
    if ! IFS= read -r -s password
    then
        printf '\n' >&2
        fatal "Unable to read password"
    fi
    printf '\n' >&2

    if [[ -z $password ]]
    then
        fatal "Password cannot be empty"
    fi

    umask 077
    cookie_tmp=$(mktemp "${COOKIE_FILE}.tmp.XXXXXX")

    if ! printf 'password=%s' "$password" | \
        curl --fail --silent --show-error --max-time 30 \
            --cookie-jar "$cookie_tmp" \
            --data-binary @- \
            "$EYRE_URL/~/login" > /dev/null
    then
        unset password
        rm -f "$cookie_tmp"
        fatal "Failed to authenticate with $ship_id at $EYRE_URL"
    fi
    unset password

    if ! awk -v name="urbauth-$ship_id" '$6 == name { found=1 } END { exit !found }' "$cookie_tmp"
    then
        rm -f "$cookie_tmp"
        fatal "Eyre did not return an authentication cookie for $ship_id"
    fi

    mv -f "$cookie_tmp" "$COOKIE_FILE"
    chmod 600 "$COOKIE_FILE"
}

# Execute a thread through Eyre's HTTP API.
#
# run_thread <desk> <input-mark> <thread> <output-mark> <json-input>
#
# Prints the JSON response to standard output on success. If a cached cookie is
# rejected, removes it, asks for the password, and retries once.
run_thread() {

    if (( $# != 5 ))
    then
        fatal "run_thread(): expected <desk> <input-mark> <thread> <output-mark> <json-input>"
    fi

    local desk=$1
    local input_mark=$2
    local thread=$3
    local output_mark=$4
    local json_input=$5
    local response_file
    local status
    local attempt

    response_file=$(mktemp)

    for attempt in 1 2
    do
        eyre_auth

        if ! status=$(curl --silent --show-error --max-time 600 \
            --cookie "$COOKIE_FILE" \
            --cookie-jar "$COOKIE_FILE" \
            --header "Content-Type: application/json" \
            --header "Accept: application/json" \
            --request POST \
            --data-binary "$json_input" \
            --output "$response_file" \
            --write-out "%{http_code}" \
            "$EYRE_URL/spider/$desk/$input_mark/$thread/$output_mark")
        then
            rm -f "$response_file"
            fatal "Failed to execute $desk/$thread through Eyre"
        fi

        if [[ $status =~ ^2[0-9][0-9]$ ]]
        then
            cat "$response_file"
            rm -f "$response_file"
            return 0
        fi

        if (( attempt == 1 )) && [[ $status == 401 || $status == 403 ]]
        then
            rm -f "$COOKIE_FILE"
            continue
        fi

        cat "$response_file" >&2
        rm -f "$response_file"
        fatal "Thread $desk/$thread failed with HTTP $status"
    done
}

vere_url="https://bootstrap.urbit.org/vere/live"
vere_ver="v4.6"

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
          arch=arm64
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

boot_moon() {

    if (( $# != 2 ))
    then
        fatal "boot_moon(): expected the gen-moon JSON response and boot directory"
    fi

    if ! command -v jq > /dev/null
    then
        fatal "jq is required to boot the generated moon"
    fi

    local result=$1
    local moon_id
    local moon_name
    local moon_key
    local key_file
    local boot_root=$2
    local moon_path

    if ! moon_id=$(printf '%s' "$result" | jq -er \
        '.ship | strings | select(test("^~[a-z-]+$"))')
    then
        fatal "Thread response does not contain a valid moon ship"
    fi

    if ! moon_key=$(printf '%s' "$result" | jq -er \
        '.key | strings | select(startswith("0w"))')
    then
        fatal "Thread response does not contain a valid moon key"
    fi

    moon_name=${moon_id#\~}
    mkdir -p -- "$boot_root"
    moon_path="$boot_root/$moon_name"
    if [[ -e $moon_path ]]
    then
        fatal "Cannot boot $moon_id: $moon_path already exists"
    fi

    umask 077
    key_file=$(mktemp "${TMPDIR:-/tmp}/gen-moon-key.XXXXXX")
    trap 'rm -f "$key_file"' EXIT
    printf '%s\n' "$moon_key" > "$key_file"

    echo "Booting $moon_id in $moon_path/" >&2
    if ! $vere -w "$moon_name" -k "$key_file" -c "$moon_path"
    then
        fatal "Failed to boot $moon_id"
    fi

    rm -f "$key_file"
    trap - EXIT
}

result=$(run_thread groups json gen-moon json null)
printf '%s\n' "$result"

if $boot
then
    boot_moon "$result" "$boot_dir"
fi
