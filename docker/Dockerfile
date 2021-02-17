# SET_NODE_VERSION default is set in ../entrypoint.sh
ARG SET_NODE_VERSION
FROM node:${SET_NODE_VERSION}

LABEL version="0.11.0"
LABEL repository="https://github.com/taichi/actions-package-update"
LABEL homepage="https://github.com/taichi/actions-package-update"
LABEL maintainer="Sato Taichi <ryushi+actions@gmail.com>"

LABEL "com.github.actions.name"="GitHub Action for package.json update."
LABEL "com.github.actions.description"="Upgrades your package.json dependencies to the latest versions"
LABEL "com.github.actions.icon"="corner-right-up"
LABEL "com.github.actions.color"="gray-dark"

RUN apt-get update && apt-get install -y --no-install-recommends -y git
RUN yarn global add npm-check-updates
RUN yarn global add actions-package-update

# copy files from the action repository to the filesystem path `/` of the container
COPY env.sh /env.sh
COPY . /actions-package-update
COPY entrypoint.sh /entrypoint.sh

RUN ["chmod", "+x", "/entrypoint.sh"]

ENTRYPOINT ["/entrypoint.sh"]
