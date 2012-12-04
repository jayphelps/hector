#!/usr/bin/perl

use strict;

while(chomp(my $file = <>)) {
    while(-l $file) {
        $file = readlink $file;
    }
    print "$file\n";
}