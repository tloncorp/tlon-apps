#!/bin/bash

IMAGE_NAME="playwright_ships"
CONTAINER_NAME="playwright_ships"

# stop and remove the container if it exists
docker rm -f $CONTAINER_NAME 2>/dev/null || true

# build the image and run the container
# this is run from within the ui directory, so we need to go up a level
docker build --platform=linux/amd64 -t $IMAGE_NAME ../.
docker run --platform=linux/amd64 -d --rm --name $CONTAINER_NAME -p 8081:8081 -p 8082:8082 $IMAGE_NAME

