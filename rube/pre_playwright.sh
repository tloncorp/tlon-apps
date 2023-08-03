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

# zod=25752
# bus=13731

# hood () {
#   curl -H "Content-Type: application/json" -d '{"source":{"dojo":"+hood/'"$2"'"},"sink":{"app":"hood"}}' http://localhost:$1 --trace-ascii /dev/stdout
# }

# echo "Wait for ship boot"
# sleep 5

# echo "Logging in to fake ships and recording hash"
# init lidlut-tabwed-pillex-ridrup 35453 zod
# init riddec-bicrym-ridlev-pocsef 36963 bus

# echo "Wait for mounts and syncs"
# sleep 10

# echo "Committing changes to fake ships"
# hood $zod "commit %groups"
# hood $zod "commit %talk"
# check_hash zod

# hood $bus "commit %groups"
# hood $bus "commit %talk"
# check_hash bus

# # TIME=${WAIT_TIME:-"1"}
# # echo "Waiting "$TIME"s for ships to compile"
# # sleep $TIME
# echo "Compilation done"