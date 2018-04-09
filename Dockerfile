FROM ubuntu:16.04

RUN apt-get update 
RUN apt-get install build-essential npm -y
RUN cd /usr/local/src \
    wget https://nodejs.org/dist/v8.11.1/node-v8.11.1.tar.gz \
    tar -xvzf node-v8.11.1.tar.gz \
    cd node-v8.11.1 \
    ./configure \
    make \
    sudo make install \ 
    which node \
    node --version

RUN rm -rf /usr/local/src/node-*

RUN mkdir -p /drafts/DrAFTS-spot-tools
COPY . /drafts/DrAFTS-spot-tools

WORKDIR /drafts/DrAFTS-spot-tools/spot-commandline 
RUN npm install 