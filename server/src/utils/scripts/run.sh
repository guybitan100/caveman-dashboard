#!/bin/bash

ROOT=/Users/orshemtov/Projects/titan

cd $ROOT/Docker/titan-dev || exit
docker compose up

cd $ROOT/manager || exit
echo manager init-db

cd $ROOT/manager || exit
echo manager run-server

cd $ROOT/generation || exit
echo generation run-server

cd $ROOT/generation || exit
echo generation run-celery

cd $ROOT/client || exit
npm start
