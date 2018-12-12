FROM gitpod/workspace-full-vnc:latest

USER root

# Install the latest rr.
RUN __RR_VERSION__="5.2.0" \
 && cd /tmp \
 && wget -qO rr.deb https://github.com/mozilla/rr/releases/download/${__RR_VERSION__}/rr-${__RR_VERSION__}-Linux-$(uname -m).deb \
 && dpkg -i rr.deb \
 && rm -f rr.deb

# Install Firefox build dependencies.
# One-line setup command from:
# https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions/Linux_Prerequisites#Most_Distros_-_One_Line_Bootstrap_Command
RUN apt-get update \
 && apt-get install -y htop mercurial python-requests \
 && wget -O /tmp/gecko.zip https://github.com/mozilla/gecko/archive/central.zip \
 && unzip /tmp/gecko.zip -d /tmp \
 && cd /tmp/gecko-central \
 && python2.7 python/mozboot/bin/bootstrap.py --no-interactive --application-choice=browser \
 && rm -rf /tmp/gecko.zip /tmp/gecko-central /var/lib/apt/lists/*

USER gitpod

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

# Give back control
USER root
