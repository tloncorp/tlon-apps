#!/bin/bash
set -e

echo "Starting fake ships"
./zod/.run -d --http-port 8081
./bus/.run -d --http-port 8082

dojo-zod () {
  curl -s --data '{"source":{"dojo":"'"$1"'"},"sink":{"stdout":null}}' http://localhost:12321
}

hood-zod () {
  curl -s --data '{"source":{"dojo":"+hood/'"$1"'"},"sink":{"app":"hood"}}' http://localhost:12321
}

dojo-bus () {
  curl -s --data '{"source":{"dojo":"'"$1"'"},"sink":{"stdout":null}}' http://localhost:12322
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
rsync -avL /app/desk/ /app/zod/groups/
rsync -avL /app/talk/ /app/zod/talk/
rsync -avL /app/desk/ /app/bus/groups/
rsync -avL /app/talk/ /app/bus/talk/

echo "Committing changes to fake ships"
hood-zod "commit %groups"
hood-zod "commit %talk"
hood-bus "commit %groups"
hood-bus "commit %talk"

# keep container running
tail -f /dev/null

