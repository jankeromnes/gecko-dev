# This Makefile is used as a shim to aid people with muscle memory
# so that they can type "make".
#
# This file and all of its targets should not be used by anything important.

all: build run

build:
	./mach build

clean:
	./mach clobber

run:
	./mach run -P dev

update:
	git fetch moz && git rebase moz/master

.PHONY: all build clean run update
