#!/bin/bash
set -e

cd /urbit

URBIT_EXEC=urbit

if [ -f "$URBIT_EXEC" ]; then
  echo "Remove existing urbit executable"
  rm urbit
fi

echo "Downloading urbit executable"
curl -L https://urbit.org/install/linux-x86_64/latest | tar xzk --transform='s/.*/urbit/g'
chmod +x urbit

if [ -d "/urbit/zod" ]; then
  echo "Remove existing zod ship"
  rm -rf /urbit/zod
fi

if [ -d "/urbit/bus" ]; then
  echo "Remove existing bus ship"
  rm -rf /urbit/bus
fi

echo "Creating fake ships, this will take a while. Go make some coffee."

./urbit -d -F zod --http-port 8081 --loom 32
./urbit -d -F bus --http-port 8082 --loom 32

hood-zod () {
  curl -s --data '{"source":{"dojo":"+hood/'"$1"'"},"sink":{"app":"hood"}}' http://localhost:12321
}
hood-bus () {
  curl -s --data '{"source":{"dojo":"+hood/'"$1"'"},"sink":{"app":"hood"}}' http://localhost:12322
}

echo "Mounting desks on fake ships"
hood-zod "mount %groups"
hood-zod "mount %talk"
hood-bus "mount %groups"
hood-bus "mount %talk"

echo "Copying desk and talk to fake ships"
rsync -avL /app/desk/ /urbit/zod/groups/
rsync -avL /app/talk/ /urbit/zod/talk/
rsync -avL /app/desk/ /urbit/bus/groups/
rsync -avL /app/talk/ /urbit/bus/talk/

echo "Committing changes to fake ships"
hood-zod "commit %groups"
hood-zod "commit %talk"
hood-bus "commit %groups"
hood-bus "commit %talk"

echo "Ships are ready, make your changes and then shut them down, zip the piers in ./rube, and upload to GCP."

tail -f /dev/null
