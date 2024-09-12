#!/usr/bin/env bash

# this script globs a folder of files, then subsequently uploads the
# glob to bootstrap.urbit.org and replaces the hash in the docket file.
# assumes gcloud credentials are loaded and gsutil installed.

# $1: the folder of files to glob
# $2: the location of the docket file

# globber is a prebooted and docked fakezod
curl https://storage.googleapis.com/bootstrap.urbit.org/globberv4.tar.gz | tar xzk
./zod/.run -d

dojo () {
  curl -s --data '{"source":{"dojo":"'"$1"'"},"sink":{"stdout":null}}' http://localhost:12321
}

hood () {
  curl -s --data '{"source":{"dojo":"+hood/'"$1"'"},"sink":{"app":"hood"}}' http://localhost:12321
}

rsync -avL $1 zod/work/glob
hood "commit %work"
dojo "-garden!make-glob %work /glob"

gsutil cp zod/.urb/put/*.glob gs://bootstrap.urbit.org
hash=$(ls -1 -c zod/.urb/put | head -1 | sed "s/glob-\([a-z0-9\.]*\).glob/\1/")
sed -i "s/glob\-[a-z0-9\.]*glob' *[a-z0-9\.]*\]/glob-$hash.glob' $hash]/g" $2

echo "hash=$(echo $hash)" >> $GITHUB_OUTPUT

hood "exit"
sleep 5s
rm -rf zod
