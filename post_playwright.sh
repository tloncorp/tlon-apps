#!/bin/bash

CONTAINER_NAME="playwright_ships"

docker stop $CONTAINER_NAME && docker rm $CONTAINER_NAME
