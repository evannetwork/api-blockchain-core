#!/bin/sh

root="$(pwd)/../"

# $1 is parent module
# $2 is child module
# $3 switches child npm linking on and off
linkIn () {
  echo "--- $1 $2 $3 -------------------------"
  if [ $3 = true ] ; then
    cd $root/$2 && npm link
  fi
  MODULE=$2
  cd $root/$1 && npm link $MODULE
  echo ""
}

linkIn "blockchain-core" "@evan.network/dbcp" true
linkIn "blockchain-core" "smart-contracts" true
