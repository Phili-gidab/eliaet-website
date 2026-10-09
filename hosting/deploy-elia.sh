#!/usr/bin/env bash
# Puts the ELIA website online at https://elia.allafricanleatherfair.org/, for now on the AALF site's hosting (Yegara,
# cPanel account allafrpp), until ELIA has hosting of its own.
#
#   ./deploy-elia.sh
#
# Run it from Git Bash in the folder it is in, next to the package it sends (elia-site-<version>.tar.gz, made by
# hosting/bundle.mjs). It uses the same SSH setup as the AALF site's deploy-site.sh: the "allafrica" host block in
# ~/.ssh/config, with the public key authorized in cPanel > Security > SSH Access. No password is asked for.
#
# What it does:
#  1. the first time, creates the subdomain (document root ~/elia.allafricanleatherfair.org) and asks cPanel's
#     AutoSSL for its certificate;
#  2. backs up the subdomain's folder to ~/backups on the server (the last three are kept);
#  3. sends the package: the pages, scripts, typefaces and form handlers, a few MB;
#  4. has the server download the films and photos from the site's GitHub repository, at the same version (about
#     60 MB that never travel over this computer's connection), unless that version is already there;
#  5. adds the Apache rules (HTTPS, clean addresses, security headers, caching, kept out of search engines) to the
#     folder's .htaccess between "# BEGIN ELIA site" and "# END ELIA site", leaving anything cPanel keeps there.
# Nothing on the server is deleted. What people send through the forms is kept outside the web root, in
# ~/elia-data/elia.allafricanleatherfair.org/ (CSV files that open in Excel), and e-mailed (see api/_config.php).
set -euo pipefail

REMOTE="allafrica"
HOME_DIR="/home/allafrpp"
REPO="Phili-gidab/eliaet-website"
MARKER="ELIA site"                               # our block in .htaccess

cd "$(dirname "$0")"
BUNDLE="$(ls -1t elia-site-*.tar.gz 2>/dev/null | head -n 1 || true)"
[ -n "$BUNDLE" ] || { echo "!!  No elia-site-*.tar.gz next to this script."; exit 1; }
COMMIT="$(tar xzf "$BUNDLE" -O ./VERSION | tr -d '[:space:]')"
SITE="$(tar xzf "$BUNDLE" -O ./SITE | tr -d '[:space:]')"
[ ${#COMMIT} -eq 40 ] && [ -n "$SITE" ] || { echo "!!  $BUNDLE does not say which version it is."; exit 1; }
DOMAIN="${SITE#https://}"                        # elia.allafricanleatherfair.org
SUB="${DOMAIN%%.*}"                              # elia
ROOT_DOMAIN="${DOMAIN#*.}"                       # allafricanleatherfair.org
TARGET="${HOME_DIR}/${DOMAIN}"                   # the subdomain's Document Root
NAME="${REPO#*/}"

echo "==> Putting the ELIA site (version ${COMMIT:0:7}) online at https://${DOMAIN}/"

echo "==> Checking ${DOMAIN} on the server"
if ! ssh "$REMOTE" "test -d '${TARGET}'"; then
    echo "    Creating the subdomain (document root ~/${DOMAIN})"
    ssh "$REMOTE" "uapi SubDomain addsubdomain domain=${SUB} rootdomain=${ROOT_DOMAIN} dir=${DOMAIN}" 2>/dev/null | grep -E 'status|reason|errors' || true
    if ! ssh "$REMOTE" "test -d '${TARGET}'"; then
        echo "!!  The subdomain could not be created over SSH. Create it in cPanel > Domains (${DOMAIN}, document root"
        echo "    ${DOMAIN}), then run this again."
        exit 1
    fi
    ssh "$REMOTE" "uapi SSL start_autossl_check >/dev/null 2>&1 || true"
    echo "    Asked AutoSSL for its certificate: https://${DOMAIN}/ may show a certificate warning for a few minutes."
fi

echo "==> Backing up ${TARGET} (without the films, which come from GitHub)"
ssh "$REMOTE" "mkdir -p ${HOME_DIR}/backups && tar czf ${HOME_DIR}/backups/${DOMAIN}-\$(date +%Y%m%d-%H%M%S).tar.gz --exclude=./film -C ${TARGET} . && ls -1t ${HOME_DIR}/backups/${DOMAIN}-*.tar.gz | tail -n +4 | xargs -r rm -f"

echo "==> Sending the pages, scripts and form handlers ($(du -h "$BUNDLE" | cut -f1))"
scp -q "$BUNDLE" "${REMOTE}:${HOME_DIR}/elia-upload.tar.gz"

echo "==> Unpacking on the server"
ssh "$REMOTE" bash -s <<EOF
set -euo pipefail
T='${TARGET}'
UP='${HOME_DIR}/elia-upload.tar.gz'
W="\$(mktemp -d)"
trap 'rm -rf "\$W"; rm -f "\$UP"' EXIT
tar xzf "\$UP" -C "\$W" --no-same-owner --no-same-permissions

# the films and photos, from GitHub at the same version, when that version's are not there yet
if [ "\$(cat "\$T/.elia-media" 2>/dev/null || true)" != '${COMMIT}' ]; then
    echo "==> The server is downloading the films and photos from GitHub (about 60 MB)"
    URL='https://codeload.github.com/${REPO}/tar.gz/${COMMIT}'
    if command -v curl >/dev/null 2>&1; then curl -fsSL --retry 3 -o "\$W/src.tar.gz" "\$URL"; else wget -q -O "\$W/src.tar.gz" "\$URL"; fi
    mkdir -p "\$W/pub"
    tar xzf "\$W/src.tar.gz" -C "\$W/pub" --strip-components=3 --no-same-owner --no-same-permissions \\
        '${NAME}-${COMMIT}/web/public/film' '${NAME}-${COMMIT}/web/public/media'
    rm -f "\$W/src.tar.gz"
    if [ ! -d "\$W/pub/film" ] || [ ! -d "\$W/pub/media" ]; then echo "!!  The films and photos did not arrive."; exit 1; fi
    cp -R "\$W/pub/." "\$T/"
    echo '${COMMIT}' > "\$T/.elia-media"
fi

# the pages, scripts, typefaces and form handlers
cp -R "\$W/site/." "\$T/"

# the Apache rules: drop our previous block, then append the current one
HT="\$T/.htaccess"
touch "\$HT"
if grep -q "# BEGIN ${MARKER}" "\$HT"; then sed -i "/# BEGIN ${MARKER}/,/# END ${MARKER}/d" "\$HT"; fi
sed -i -e :a -e '/^\n*\$/{\$d;N;ba' -e '}' "\$HT"     # no pile-up of blank lines at the end
printf '\n' >> "\$HT"
cat "\$W/htaccess-elia.conf" >> "\$HT"

# where the forms keep what people send: outside the web root
mkdir -p '${HOME_DIR}/elia-data/${DOMAIN}'
chmod 700 '${HOME_DIR}/elia-data' '${HOME_DIR}/elia-data/${DOMAIN}'
EOF

echo "==> Checking the site"
code="$(curl -s -o /dev/null -w '%{http_code}' "https://${DOMAIN}/" || true)"
if [ "$code" = 200 ]; then
    echo "    https://${DOMAIN}/ answers (200)."
else
    echo "    https://${DOMAIN}/ does not answer yet (${code:-no answer}). A new subdomain can take a few minutes for its"
    echo "    certificate; try it in the browser in a little while."
fi
echo "==> Done: https://${DOMAIN}/"
echo "    Forms: kept in ${HOME_DIR}/elia-data/${DOMAIN}/ (cPanel > File Manager) and e-mailed to the address in"
echo "    ${DOMAIN}/api/_config.php."
