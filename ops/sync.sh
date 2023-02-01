#!/usr/bin/env sh

# garden
rsync -avqL --delete $URBIT_PATH/pkg/base-dev/* $SHIP_PATH/$SHIP/garden/ && \
rsync -avqL $LANDSCAPE_PATH/desk/* $SHIP_PATH/$SHIP/garden/ && \

# groups
rsync -avqL --delete $URBIT_PATH/pkg/base-dev/* $SHIP_PATH/$SHIP/$DESK/ && \
rsync -avqL $LANDSCAPE_PATH/desk-dev/* $SHIP_PATH/$SHIP/$DESK/ && \
rsync -avqL $REPO_PATH/landscape-dev/* $SHIP_PATH/$SHIP/$DESK/ && \
rsync -avqL $REPO_PATH/desk/* $SHIP_PATH/$SHIP/$DESK/ && \

# talk
rsync -avqL --delete $URBIT_PATH/pkg/base-dev/* $SHIP_PATH/$SHIP/talk/ && \
rsync -avqL $LANDSCAPE_PATH/desk-dev/* $SHIP_PATH/$SHIP/talk/ && \
rsync -avqL $REPO_PATH/landscape-dev/* $SHIP_PATH/$SHIP/talk/ && \
rsync -avqL $REPO_PATH/talk/* $SHIP_PATH/$SHIP/talk/
