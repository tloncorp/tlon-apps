#!/usr/bin/env sh

# syncs desk to fake ship
# defaults to syncing to %groups on ~zod
# e.g., to sync to %talk desk on ~net:
# ./desk.sh net talk

# fake ship name, defaults to zod
SHIP="${1:-zod}"
# path to urbit git repo
URBIT_REPO_PATH=~/dev/urbit/urbit
# path to landscape-apps git repo
REPO_PATH=~/dev/urbit/landscape-apps
# path to landscape git repo
LANDSCAPE_PATH=~/dev/urbit/landscape
# path to directory of fake ship piers
SHIP_PATH=~/dev/urbit/ships
# name of src desk in repo
SRC_DESK="${2:-desk}"
# name of dest desk on fake ship
DEST_DESK="${3:-groups}"

rsync -avL --delete $URBIT_REPO_PATH/pkg/base-dev/* $SHIP_PATH/$SHIP/$DEST_DESK/
rsync -avL $LANDSCAPE_PATH/desk-dev/* $SHIP_PATH/$SHIP/$DEST_DESK/
rsync -avL $REPO_PATH/landscape-dev/* $SHIP_PATH/$SHIP/$DEST_DESK/
rsync -avL $REPO_PATH/$SRC_DESK/* $SHIP_PATH/$SHIP/$DEST_DESK/
