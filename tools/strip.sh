#!/bin/bash

SRCFILE=$1
#DSTFILE=$2
               # Strip single-line comments  # Strip single-line /* */
#cat $SRCFILE | sed -r -e 's@^\s*//[^#].*$@@g' -e 's@^\s*/\*.+\*/\s*$@@g' > $DSTFILE
sed -i -r -e 's@^\s*//[^#].*$@@g' -e 's@^\s*/\*.+\*/\s*$@@g' $SRCFILE
