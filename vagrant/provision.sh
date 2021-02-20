#!/usr/bin/env bash
sudo apt-get update

curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install nodejs -y
sudo npm install yarn -g

# force startup folder to /src folder in project
echo "cd /vagrant/src" >> /home/vagrant/.bashrc

# set hostname, makes console easier to identify
sudo echo "randomatic" > /etc/hostname
sudo echo "127.0.0.1 randomatic" >> /etc/hosts

