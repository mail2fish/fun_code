#!/bin/bash

git push huo main
rsync -avz --delete ./web/react-router-www/build/client huo:/root/src/fun_code/web/react-router-www/build
rsync -avz --delete ./web/scratch/dist/ huo:/root/src/fun_code/web/scratch/dist
rsync -avz --delete ./web/excalidraw/dist/ huo:/root/src/fun_code/web/excalidraw/dist
