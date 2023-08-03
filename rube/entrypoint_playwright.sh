#!/bin/bash
set -e

cd ui
npm ci
cd ..

echo "Starting fake ships"
./zod/.run -d --http-port 8081
./bus/.run -d --http-port 8082

zod=12321
bus=12322

dojo () {
  curl -s --data '{"source":{"dojo":"'"$2"'"},"sink":{"stdout":null}}' http://localhost:$1
}

hood () {
  curl -s --data '{"source":{"dojo":"+hood/'"$2"'"},"sink":{"app":"hood"}}' http://localhost:$1
}

init () {
  data="password=$1&redirect=/"
  login="http://localhost:$2/~/login"
  echo "Attempting ~$3 login: $data at $login"
  curl -c .cookies.$3.txt \
    --connect-timeout 5 \
    --max-time 10 \
    --retry 5 \
    --retry-delay 0 \
    --retry-max-time 40 \
    --retry-connrefused \
    --retry-all-errors \
    -H "Content-Type: application/x-www-form-urlencoded" -d $data $login

  if [ -z "$hash" ]; then
    path="http://localhost:$2/~/scry/hood/kiln/pikes.json"
    hash=$(curl -b .cookies.$3.txt -s $path | jq '.groups.hash')
    echo "starting %groups hash: $hash"
  fi;
}

check_hash() {
  count=0
  path="http://localhost:$2/~/scry/hood/kiln/pikes.json"
  while [[ $count -lt 300 ]]
  do
    printf '.'
    response=$(curl -b .cookies.$1.txt -s --connect-timeout 3 $path)
    x=$(echo $response | jq '.groups.hash');
    echo "$x"
    if [[ "$x" != "$hash" ]]; then 
      echo "compiled %groups hash: $x"
      break; 
    fi; 
    sleep 1
    count=$((count + 1))
  done

  if [[ $count -eq 300 ]]; then
    echo "Failed to compile %groups"
    exit 1
  fi
  
  echo "~$1 ready!"
}

echo "Logging in to fake ships and recording hash"
init lidlut-tabwed-pillex-ridrup 8081 zod
init riddec-bicrym-ridlev-pocsef 8082 bus

echo "Mounting desks on fake ships"
hood $zod "mount %groups"
hood $zod "mount %talk"
hood $bus "mount %groups"
hood $bus "mount %talk"

echo "Copying desk and talk to fake ships"
rsync -avL /app/desk/ /app/zod/groups/
rsync -avL /app/talk/ /app/zod/talk/
rsync -avL /app/desk/ /app/bus/groups/
rsync -avL /app/talk/ /app/bus/talk/

echo "Committing changes to fake ships"
hood $zod "commit %groups"
hood $zod "commit %talk"
check_hash zod 8081

hood $bus "commit %groups"
hood $bus "commit %talk"
check_hash bus 8082

# TIME=${WAIT_TIME:-"1"}
# echo "Waiting "$TIME"s for ships to compile"
# sleep $TIME
echo "Compilation done"

SHIP=~bus npx playwright test --debug --workers=1
SHIP=~zod npx playwright test --debug --workers=1

tail -f /dev/null