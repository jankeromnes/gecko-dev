FROM gitpod/workspace-full-vnc:latest

# Install the latest rr.
RUN __RR_VERSION__="5.2.0" \
 && cd /tmp \
 && wget -qO rr.deb https://github.com/mozilla/rr/releases/download/${__RR_VERSION__}/rr-${__RR_VERSION__}-Linux-$(uname -m).deb \
 && sudo dpkg -i rr.deb \
 && rm -f rr.deb

# Install the latest Mercurial (hg).
RUN add-apt-repository ppa:mercurial-ppa/releases \
 && apt-get update \
 && apt-get install -y mercurial \
 && apt-get clean && rm -rf /var/cache/apt/* && rm -rf /var/lib/apt/lists/* && rm -rf /tmp/*

# Install git-cinnabar.
RUN git clone https://github.com/glandium/git-cinnabar $HOME/.git-cinnabar \
 && $HOME/.git-cinnabar/git-cinnabar download \
 && echo "\n# Add git-cinnabar to the PATH." >> $HOME/.bashrc \
 && echo "PATH=\"\$PATH:$HOME/.git-cinnabar\"" >> $HOME/.bashrc
ENV PATH $PATH:$HOME/.git-cinnabar

# Install the latest Phabricator helper.
RUN mkdir $HOME/.phacility \
 && cd $HOME/.phacility \
 && git clone https://github.com/phacility/libphutil \
 && git clone https://github.com/phacility/arcanist \
 && echo "\n# Phabricator helper." >> $HOME/.bashrc \
 && echo "PATH=\"\$PATH:$HOME/.phacility/arcanist/bin\"" >> $HOME/.bashrc

# Install Phlay to support uploading multiple commits to Phabricator.
RUN git clone https://github.com/mystor/phlay/ $HOME/.phlay \
 && echo "\n# Add Phlay to the PATH." >> $HOME/.bashrc \
 && echo "PATH=\"\$PATH:$HOME/.phlay\"" >> $HOME/.bashrc

