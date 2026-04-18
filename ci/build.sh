#!/bin/bash
set -ex
npm config set --location project legacy-peer-deps=true
npm install

export VITE_SERVER_HOST=https://v5t4wj8lx6-vpce-07a1401965d8a8c77.execute-api.eu-central-1.amazonaws.com/prod
export VITE_TITAN_VERSION=2.0.9
export VITE_METAFINDER_HOST=https://lb7kh6lbe8-vpce-07a1401965d8a8c77.execute-api.eu-central-1.amazonaws.com/prod
npm run build
