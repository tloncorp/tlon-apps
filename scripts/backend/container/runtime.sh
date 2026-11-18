# Sourced by the scripts that run fake ships in the image built from this
# directory. Sets runtime to podman when it is usable, otherwise docker;
# CONTAINER_RUNTIME overrides the choice. Sets checkout to a number that
# stands for this checkout's path, and image to the image's tag, which carries
# it: checkouts with different pills can then run at once. prune_images removes
# what rebuilding leaves behind.

if [ -n "$CONTAINER_RUNTIME" ]
then
  runtime=$CONTAINER_RUNTIME
elif podman ps -q > /dev/null 2>&1
then
  runtime=podman
else
  runtime=docker
fi

# Remove the images that a rebuild after a change has left without a tag.
function prune_images
{
  $runtime image prune -f --filter label=fakeship > /dev/null
}

checkout=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd -P | cksum | cut -d' ' -f1)
image=fakeship:$checkout
