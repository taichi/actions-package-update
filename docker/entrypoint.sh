#!/bin/sh -l

# copy this container's enviroment original variables into this_env.sh
# so we can restore them back if they are overwritten by env.sh
export -p>this_env.sh

# set this_env.sh shebang
sed -i '1s/^/\#\!\/bin\/sh -l\n/' this_env.sh

chmod +x /env.sh
chmod +x /this_env.sh

# set enviroment variables
. /env.sh
. /this_env.sh

cd /actions-package-update

# ${INPUT_ARGS} are needed by ncu
actions-package-update ${INPUT_ARGS}
