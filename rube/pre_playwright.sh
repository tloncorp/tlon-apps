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

check_hash() {
  data="password=$1&redirect=/"
  login="http://localhost:$2/~/login"
  echo "Attempting ~$3 login: $data at $login"
  curl -c .cookies.$3.txt -H "Content-Type: application/x-www-form-urlencoded" -d $data $login

  if [ -z "$hash" ]; then
    path="http://localhost:$2/~/scry/hood/kiln/pikes.json"
    hash=$(curl -b .cookies.$3.txt -s $path | jq '.groups.hash')
    echo "starting %groups hash: $hash"
  fi;

  while true
  do
    printf '.'
    x=$(curl -b .cookies.$3.txt -s --connect-timeout 1 $path | jq '.groups.hash');
    if [[ "$x" != "$hash" ]]; then 
      echo "compiled %groups hash: $x"
      break; 
    fi; 
    sleep 0.5
  done

  echo "~$3 ready!"
}

echo "Waiting for ships to compile"
sleep 1

check_hash lidlut-tabwed-pillex-ridrup 35453 zod
check_hash riddec-bicrym-ridlev-pocsef 36963 bus