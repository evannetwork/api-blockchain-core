#!/bin/sh

#  Copyright (C) 2018-present evan GmbH.
#
#  This program is free software: you can redistribute it and/or modify it
#  under the terms of the GNU Affero General Public License, version 3,
#  as published by the Free Software Foundation.
#
#  This program is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
#  See the GNU Affero General Public License for more details.
#
#  You should have received a copy of the GNU Affero General Public License
#  along with this program. If not, see http://www.gnu.org/licenses/ or
#  write to the Free Software Foundation, Inc., 51 Franklin Street,
#  Fifth Floor, Boston, MA, 02110-1301 USA, or download the license from
#  the following URL: https://evan.network/license/

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
