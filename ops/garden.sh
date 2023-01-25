#!/usr/bin/env sh

# syncs landscape (fka garden / grid) to fake ship
# defaults to syncing to ~zod
# e.g., to sync to %garden desk on ~net:
# ./garden.sh net

# fake ship name, defaults to zod
SHIP="${1:-zod}"
# path to urbit git repo
URBIT_REPO_PATH=~/dev/urbit/urbit
# path to landscape-apps git repo
REPO_PATH=~/dev/urbit/landscape
# path to directory of fake ship piers
SHIP_PATH=~/dev/urbit/ships
# name of src desk in repo
SRC_DESK="${2:-desk}"
# name of dest desk on fake ship
DEST_DESK="${3:-garden}"

rsync -avL --delete $URBIT_REPO_PATH/pkg/base-dev/* $SHIP_PATH/$SHIP/$DEST_DESK/
rsync -avL $URBIT_REPO_PATH/pkg/garden-dev/* $SHIP_PATH/$SHIP/$DEST_DESK/
rsync -avL $REPO_PATH/$SRC_DESK/* $SHIP_PATH/$SHIP/$DEST_DESK/
