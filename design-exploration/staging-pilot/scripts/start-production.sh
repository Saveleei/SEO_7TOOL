#!/bin/sh
set -eu

node scripts/validate-production-config.mjs
exec node node_modules/vinext/dist/cli.js start
