#!/bin/bash

IMAGE_NAME="build_fakeships"
CONTAINER_NAME="build_fakeships"

# stop and remove the container if it exists
docker rm -f $CONTAINER_NAME 2>/dev/null || true

# build the image and run the container
docker build --platform=linux/amd64 -t $IMAGE_NAME -f ../rube/Dockerfile.rubeships ../
docker run --platform=linux/amd64 --name $CONTAINER_NAME -p 35453:8081 -p 36963:8082 -p -v $(dirname $(pwd))/rube:/urbit $IMAGE_NAME

