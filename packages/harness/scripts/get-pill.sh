#!/bin/bash

# base 408k-2, groups v12.4.0
version="5a187fe-77bc997"

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
        # curl has no timeout of its own, so a stalled transfer would hang
        # forever: give up when under 1 kB/s for 30 seconds, and retry. The
        # partial file gets another name, or the next run would take it for
        # the pill.
        curl -# -f --connect-timeout 20 --speed-limit 1024 --speed-time 30 --retry 3 "$url" -o "$file.part" &&
            mv "$file.part" "$file"
        return $?
    fi

    return 0
}

usage() {
    echo "usage: $0"
    echo "Download latest groups pill"
}

# if (($# < 2));
# then
#     usage
#     exit 1
# fi

file="groups-${version}.pill"
find_download "https://bootstrap.urbit.org/$file" $file


