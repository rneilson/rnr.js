#!/bin/bash

SRCFILE=$1
#DSTFILE=$2
#cat $SRCFILE | sed -r -e 's@^\s*//[^#].*$@@g' -e 's@^\s*/\*.+\*/\s*$@@g' > $DSTFILE
        # Strip single-line //    Strip single-line /* */
sed -i -r -e 's@^\s*//[^#].*$@@g' -e 's@^\s*/\*.+\*/\s*$@@g' $SRCFILE
