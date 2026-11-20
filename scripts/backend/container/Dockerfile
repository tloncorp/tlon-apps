FROM alpine:3.22
# runtime.sh prunes by this label.
LABEL fakeship=""

# click, which drives a ship over its conn.sock, needs bash and socat.
RUN apk add --no-cache bash socat curl

# curl has no timeout of its own, so a stalled transfer would hang the build:
# give up when under 1 kB/s for 30 seconds, and retry.
ARG FETCH="curl -fsSL --connect-timeout 20 --speed-limit 1024 --speed-time 30 --retry 3"

ARG VERE_VERSION=v4.6

RUN $FETCH -o /usr/local/bin/urbit \
    "https://bootstrap.urbit.org/vere/live/${VERE_VERSION}/vere-${VERE_VERSION}-linux-$(uname -m)" && \
    chmod +x /usr/local/bin/urbit

# base 408k-2, groups v12.5.0
ARG PILL=groups-5a187fe-a93c6c1
ENV URBIT_PILL=/pills/${PILL}.pill

RUN mkdir /pills && \
    $FETCH -o "$URBIT_PILL" "https://bootstrap.urbit.org/${PILL}.pill"

COPY entrypoint.sh /usr/local/bin/entrypoint.sh

WORKDIR /piers

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["zod"]
