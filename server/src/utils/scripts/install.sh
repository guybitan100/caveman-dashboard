#!/bin/bash

ROOT=/Users/orshemtov/Projects/six

# Install and publish libraries

cd $ROOT/lib/core || exit
poetry install
poetry build

cd $ROOT/lib/model || exit
poetry install
poetry build

cd $ROOT/lib/six_client || exit
poetry install
poetry build

# Install services

cd $ROOT/services/manager || exit
poetry install

cd $ROOT/services/generation || exit
poetry install

cd $ROOT/client || exit
npm install --legacy-peer-deps
