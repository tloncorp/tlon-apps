# Use the latest Ubuntu image as the base, and specify the platform as linux/amd64
FROM --platform=linux/amd64 ubuntu:latest

# Install necessary packages (curl)
RUN apt-get update && \
    apt-get install -y curl

# Set working directory
WORKDIR /app

# Create data directory
RUN mkdir -p /app/data

# Download tar files from remote bucket using curl
RUN curl -O https://bootstrap.urbit.org/rube-zod2.tgz && \
    curl -O https://bootstrap.urbit.org/rube-bus2.tgz

#Extract both files
RUN tar xf rube-zod2.tgz && \
    tar xf rube-bus2.tgz

# Remove tar files to save space
RUN rm rube-zod2.tgz rube-bus2.tgz

# Set up the entrypoint to run executables from both extraced directories
# and tail /dev/null to keep the container running
ENTRYPOINT ["sh", "-c", "./zod/.run -d --http-port 8081 && ./bus/.run -d --http-port 8082 && tail -f /dev/null"]
