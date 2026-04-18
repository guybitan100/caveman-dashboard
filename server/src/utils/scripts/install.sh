#!/bin/bash

ROOT=/Users/orshemtov/Projects/titan

# Install and publish libraries

cd $ROOT/lib/core || exit
poetry install
poetry build

cd $ROOT/lib/model || exit
poetry install
poetry build

cd $ROOT/lib/titan_client || exit
poetry install
poetry build

# Install services

cd $ROOT/services/manager || exit
poetry install

cd $ROOT/services/generation || exit
poetry install

cd $ROOT/client || exit
npm install --legacy-peer-deps
