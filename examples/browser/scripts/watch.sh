#!/usr/bin/env bash

# Note: this scripts is meant to be executed through "npm run watch".

concurrently --names watch-backend,watch-frontend
	
