# The image scripts/test-js.sh runs the JavaScript tests in: Node, with the
# urbit, pill and entrypoint of the fake ship image built from the repository's
# scripts/backend/container/, so the ships and the tests share one loopback.
# vere is static, so it runs on this Alpine as it does on that one.
ARG SHIP_IMAGE=fakeship
FROM $SHIP_IMAGE AS ship

FROM docker.io/library/node:24.22.1-alpine
# runtime.sh prunes by this label.
LABEL fakeship=""

# bash and socat for click, curl to log in, jq for scripts/harness/setup.sh,
# and GNU timeout, which exits 124 when it expires: busybox's exits as the
# killed command would.
RUN apk add --no-cache bash socat curl jq coreutils

COPY --from=ship /usr/local/bin/urbit /usr/local/bin/entrypoint.sh /usr/local/bin/
COPY --from=ship /pills /pills
# The pill is named in the fake ship image's URBIT_PILL, which COPY does not
# carry over.
RUN ln -s /pills/*.pill /pills/boot.pill
ENV URBIT_PILL=/pills/boot.pill

# entrypoint.sh keeps piers in /piers. Rootful docker runs the container as
# the host user, who must be able to write there.
RUN mkdir -m 1777 /piers
