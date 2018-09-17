#!/bin/bash
# Install and configure the sample-app-backend on this server.

set -e

readonly FLYWAY_VERSION="4.0.3"
readonly NODEJS_VERSION="7.7.3-1nodesource1~xenial1"

function assert_env_var_not_empty {
  local readonly var_name="$1"
  local readonly var_value="${!var_name}"

  if [[ -z "$var_value" ]]; then
    echo "ERROR: Required environment variable $var_name not set."
    exit 1
  fi
}

function user_exists {
  local readonly username="$1"
  id "$username" >/dev/null 2>&1
}

function create_app_user {
  local readonly username="$1"

  if $(user_exists "$username"); then
    echo "User $username already exists. Will not create again."
  else
    echo "Creating user named $username"
    sudo useradd "$username"
  fi
}

function setup_app {
  local readonly src="$1"
  local readonly dest="$2"
  local readonly owner="$3"

  echo "Running npm install to download app dependencies"
  cd "$src/app"
  npm install

  echo "Moving app from $src to $dest and setting owner to $owner"
  sudo mv "$src" "$dest"
  sudo chown -R "$owner":"$owner" "$dest"
  sudo chmod -R +x "$dest/bin"
}

function install_flyway {
  local readonly app_owner="$1"

  echo "Installing Flyway $FLYWAY_VERSION"

  wget -O "/tmp/flyway.tar.gz" "https://repo1.maven.org/maven2/org/flywaydb/flyway-commandline/${FLYWAY_VERSION}/flyway-commandline-${FLYWAY_VERSION}-linux-x64.tar.gz"
  sudo tar -xvzf "/tmp/flyway.tar.gz" -C "/opt/"
  rm -f "/tmp/flyway.tar.gz"

  local readonly flyway_dir="/opt/flyway-$FLYWAY_VERSION"
  local readonly flyway_binary="$flyway_dir/flyway"

  sudo chown -R "$app_owner":"$app_owner" "$flyway_dir"
  sudo chmod +x "$flyway_binary"
  sudo ln -s "$flyway_binary" /usr/bin/flyway
}

function install_nodejs {
  echo "Installing Node.js $NODEJS_VERSION"

  wget -qO- https://deb.nodesource.com/setup_7.x | sudo -E bash -
  sudo apt-get install -y nodejs
}

function install_jq {
  echo "Install jq"
  sudo apt-get install -y jq
}

function install_app {
  assert_env_var_not_empty "APP_OWNER"
  assert_env_var_not_empty "APP_TMP_DIR"

  local readonly app_owner="$APP_OWNER"
  local readonly app_tmp_dir="$APP_TMP_DIR"
  local readonly app_dest_dir="/opt/sample-app-backend"

  create_app_user "$app_owner"
  install_jq
  install_flyway "$app_owner"
  install_nodejs

  setup_app "$app_tmp_dir" "$app_dest_dir" "$app_owner"
}

install_app