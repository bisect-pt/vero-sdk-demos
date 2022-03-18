# Introduction

This repository contains a vero-sdk demo that automates the generator and pcap capture.

# Build

## First time

-   Install yarn

https://classic.yarnpkg.com/en/docs/install/#debian-stable

## Bootstrap

-   cd <root_repository>

-   git submodule update --init --recursive

-   yarn install

-   npx lerna bootstrap

-   npx lerna run build

## How to run the script that automates the generator and capture a pcap.

-   cd <root_repository>/demos/gen-capture-pcap

-   yarn run gen-capture-pcap -b <server_host> -u <username> -p <user_password>

-   b - The host server that the demo will run against.

-   u - The username from the demo user that you want to create.

-   p - The password from the demo user that you want to create.

Example:

-   `yarn run gen-capture-pcap -b 192.168.88.252 -u admin -p admin`

That would start the demo.
