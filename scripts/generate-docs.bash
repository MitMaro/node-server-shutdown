#!/usr/bin/env bash

cd "$(dirname "${BASH_SOURCE[0]}")" && source "./common.bash"

ensure-directory "docs/"

typedoc \
	--name "API Documentation" \
	--includeDeclarations \
	--target "ES6" \
	--theme minimal \
	--excludeExternals \
	--out "docs/" \
	--mode file \
	src/
