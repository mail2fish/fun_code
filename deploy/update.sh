git pull gitee main
rm f.tar.bz2
rm -rf web/scratch/dist/* && rm -rf web/react-router-www/build/*
wget http://192.168.1.201:9090/f.tar.bz2
tar jxvf f.tar.bz2
make build-go-windows-amd64
