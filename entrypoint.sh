#!/bin/sh -l

# set SET_NODE_VERSION env variable to latest if not defined
SET_NODE_VERSION="${SET_NODE_VERSION:-latest}"

echo "creating docker image running node version: $SET_NODE_VERSION"

cd /actions-package-update

# copy the files we will need to build the main/original docker container
cp docker/Dockerfile Dockerfile
cp docker/entrypoint.sh entrypoint.sh

# .git is used by actions-package-update to query the repo that needs to be updated
cp --recursive ${GITHUB_WORKSPACE}/.git .git

rm -rf docker

# copy this container's enviroment variables into env.sh so we can use them in the main container
export -p >env.sh

# set env.sh shebang
sed -i '1s/^/\#\!\/bin\/sh -l\n/' env.sh

# here we can make the construction of the image as customizable as we need
# and if we need parameterizable values it is a matter of sending them as inputs
docker build -t actions-package-update --build-arg SET_NODE_VERSION="$SET_NODE_VERSION"

# run actions-package-update container
docker run actions-package-update ${INPUT_ARGS}
