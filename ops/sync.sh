#!/usr/bin/env sh

rsync -avqL --delete $URBIT_PATH/pkg/base-dev/* $SHIP_PATH/$SHIP/garden/ && \
rsync -avqL $URBIT_PATH/pkg/garden/* $SHIP_PATH/$SHIP/garden/ && \
rsync -avqL --delete $URBIT_PATH/pkg/base-dev/* $SHIP_PATH/$SHIP/$DESK/ && \
rsync -avqL $URBIT_PATH/pkg/garden-dev/* $SHIP_PATH/$SHIP/$DESK/ && \
rsync -avqL $REPO_PATH/desk/* $SHIP_PATH/$SHIP/$DESK/ && \
rsync -avqL $REPO_PATH/landscape-dev/* $SHIP_PATH/$SHIP/$DESK/
