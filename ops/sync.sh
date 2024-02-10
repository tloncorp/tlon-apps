#!/usr/bin/env sh

# garden
rsync -avqL --delete $URBIT_PATH/pkg/base-dev/* $SHIP_PATH/$SHIP/landscape/ && \
rsync -avqL $LANDSCAPE_PATH/desk/* $SHIP_PATH/$SHIP/landscape/ && \

# groups
rsync -avqL --delete $URBIT_PATH/pkg/base-dev/* $SHIP_PATH/$SHIP/$DESK/ && \
rsync -avqL $LANDSCAPE_PATH/desk-dev/* $SHIP_PATH/$SHIP/$DESK/ && \
rsync -avqL $REPO_PATH/desk/* $SHIP_PATH/$SHIP/$DESK/ && \
