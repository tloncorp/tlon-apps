#!/bin/bash

IMAGE_NAME="playwright_ships"
CONTAINER_NAME="playwright_ships"

# stop and remove the container if it exists
echo "Stopping and removing container $CONTAINER_NAME"
docker rm -f $CONTAINER_NAME 2>/dev/null || true

# build the image and run the container
# this is run from within the ui directory, so we need to go up a level
docker build --platform=linux/amd64 -t $IMAGE_NAME -f ../rube/Dockerfile.playwright ../
docker run --platform=linux/amd64 -d --name $CONTAINER_NAME -p 35453:8081 -p 36963:8082 $IMAGE_NAME

