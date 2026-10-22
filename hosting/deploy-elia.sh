#!/usr/bin/env bash
# Puts the ELIA website online at https://elia.allafricanleatherfair.org/ as a Node.js app, for now on the AALF site's
# hosting (Yegara, cPanel account allafrpp), until ELIA has hosting of its own.
#
#   ./deploy-elia.sh                                        a new version of the site
#   ./deploy-elia.sh --admin you@example.com "Your Name"    the same, then a Secretariat account for the back office
#                                                           (the link to set its password is shown at the end)
#
# Run it from Git Bash in the folder it is in, next to the package it sends (elia-app-<version>.tar.gz, made by
# hosting/bundle.mjs). It uses the same SSH setup as the AALF site's deploy: the "allafrica" host block in
# ~/.ssh/config, with the public key authorized in cPanel > Security > SSH Access. No password is asked for.
#
# What it does:
#  1. the first time, creates the subdomain (document root ~/elia.allafricanleatherfair.org) and asks AutoSSL for its
#     certificate;
#  2. finds the newest Node.js on the server (22.13 or later is needed);
#  3. copies the site's data (database and uploads) to ~/backups/elia-data (the last five copies are kept);
#  4. sends the package (a few MB) and has the server download the films, photos and documents from the site's GitHub
#     repository, at the same version (about 60 MB that never travel over this computer's connection), unless the
#     ones it has are already the same;
#  5. puts the new version in ~/elia-app (the one before it stays in ~/elia-app/.previous);
#  6. the first time, makes it a Node.js app in cPanel (Setup Node.js App), and moves the old static site's files out
#     of the subdomain's folder into ~/backups; after that, restarts the app;
#  7. checks that the site answers, and (with --admin) makes the Secretariat account.
# The data lives outside the web root, in ~/elia-data/elia.allafricanleatherfair.org/ with the settings file .env
# (who receives the forms, the e-mail sender). Nothing of the data is ever deleted by this script.
set -euo pipefail

REMOTE="allafrica"
HOME_DIR="/home/allafrpp"
REPO="Phili-gidab/eliaet-website"
APP="elia-app"                                   # the app's folder, in the home folder
MARKER="ELIA site"                               # our block in .htaccess

ADMIN_EMAIL=""; ADMIN_NAME=""
if [ "${1:-}" = "--admin" ]; then
    ADMIN_EMAIL="${2:-}"; ADMIN_NAME="${3:-}"
    if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_NAME" ]; then
        echo "Usage: ./deploy-elia.sh --admin you@example.com \"Your Name\""; exit 1
    fi
fi

cd "$(dirname "$0")"
BUNDLE="$(ls -1t elia-app-*.tar.gz 2>/dev/null | head -n 1 || true)"
[ -n "$BUNDLE" ] || { echo "!!  No elia-app-*.tar.gz next to this script."; exit 1; }
COMMIT="$(tar xzf "$BUNDLE" -O ./VERSION | tr -d '[:space:]')"
SITE="$(tar xzf "$BUNDLE" -O ./SITE | tr -d '[:space:]')"
MEDIA="$(tar xzf "$BUNDLE" -O ./MEDIA 2>/dev/null | tr -d '[:space:]' || true)"
[ ${#COMMIT} -eq 40 ] && [ -n "$SITE" ] || { echo "!!  $BUNDLE does not say which version it is."; exit 1; }
DOMAIN="${SITE#https://}"                        # elia.allafricanleatherfair.org
SUB="${DOMAIN%%.*}"                              # elia
ROOT_DOMAIN="${DOMAIN#*.}"                       # allafricanleatherfair.org
DOCROOT="${HOME_DIR}/${DOMAIN}"                  # the subdomain's document root
APPROOT="${HOME_DIR}/${APP}"
DATA="${HOME_DIR}/elia-data/${DOMAIN}"
NAME="${REPO#*/}"
ADMIN_EMAIL_Q="$(printf '%q' "$ADMIN_EMAIL")"
ADMIN_NAME_Q="$(printf '%q' "$ADMIN_NAME")"

echo "==> Putting the ELIA site (version ${COMMIT:0:7}) online at https://${DOMAIN}/"

echo "==> Checking ${DOMAIN} on the server"
if ! ssh "$REMOTE" "test -d '${DOCROOT}'"; then
    echo "    Creating the subdomain (document root ~/${DOMAIN})"
    ssh "$REMOTE" "uapi SubDomain addsubdomain domain=${SUB} rootdomain=${ROOT_DOMAIN} dir=${DOMAIN}" 2>/dev/null | grep -E 'status|reason|errors' || true
    if ! ssh "$REMOTE" "test -d '${DOCROOT}'"; then
        echo "!!  The subdomain could not be created over SSH. Create it in cPanel > Domains (${DOMAIN}, document root"
        echo "    ${DOMAIN}), then run this again."
        exit 1
    fi
    ssh "$REMOTE" "uapi SSL start_autossl_check >/dev/null 2>&1 || true"
    echo "    Asked AutoSSL for its certificate: https://${DOMAIN}/ may show a certificate warning for a few minutes."
fi

echo "==> Finding Node.js on the server"
NODEINFO="$(ssh "$REMOTE" 'for v in 26 24 22; do n=/opt/alt/alt-nodejs$v/root/usr/bin/node; if [ -x "$n" ]; then echo "$v $n $("$n" -v)"; break; fi; done' || true)"
if [ -z "$NODEINFO" ]; then
    echo "!!  No Node.js 22 or later on the server (cPanel > Setup Node.js App lists the versions it has)."
    echo "    The site needs Node.js 22.13 or later: ask Yegara to add it."
    exit 1
fi
read -r MAJOR NODE NODEV <<<"$NODEINFO"
IFS=. read -r NA NB NC <<<"${NODEV#v}"
if [ "$NA" -lt 22 ] || { [ "$NA" -eq 22 ] && [ "$NB" -lt 13 ]; }; then
    echo "!!  The newest Node.js on the server is ${NODEV}; the site needs 22.13 or later (its database). Ask Yegara to update it."
    exit 1
fi
echo "    Node.js ${NODEV}"

echo "==> Sending the package ($(du -h "$BUNDLE" | cut -f1))"
scp -q "$BUNDLE" "${REMOTE}:${HOME_DIR}/elia-upload.tar.gz"

echo "==> Installing it on the server"
set +e
ssh "$REMOTE" bash -s <<EOF
set -euo pipefail
NODE='${NODE}'
APPROOT='${APPROOT}'
DOCROOT='${DOCROOT}'
DATA='${DATA}'
UP='${HOME_DIR}/elia-upload.tar.gz'
W="\$(mktemp -d)"
trap 'rm -rf "\$W"; rm -f "\$UP"' EXIT
tar xzf "\$UP" -C "\$W" --no-same-owner --no-same-permissions
NEW="\$W/app"

# 1. a copy of the data, before anything changes
mkdir -p '${HOME_DIR}/elia-data' "\$DATA" '${HOME_DIR}/backups'
chmod 700 '${HOME_DIR}/elia-data' "\$DATA"
if [ -f "\$DATA/elia.sqlite" ] && [ -f "\$APPROOT/server/dist/cli.mjs" ]; then
    echo "==> Copying the data to ~/backups/elia-data"
    (cd "\$APPROOT" && "\$NODE" server/dist/cli.mjs backup '${HOME_DIR}/backups/elia-data' | sed 's/^/    /')
    ls -1dt '${HOME_DIR}'/backups/elia-data/elia-* 2>/dev/null | tail -n +6 | xargs -r rm -rf
fi

# 2. the films, photos and documents: the ones there if they are the same, otherwise from GitHub at this version
mkdir -p "\$NEW/web/dist" "\$NEW/server/data/seed"
if [ -n '${MEDIA}' ] && [ "\$(cat "\$APPROOT/.elia-media" 2>/dev/null || true)" = '${MEDIA}' ] && [ -d "\$APPROOT/web/dist/media" ]; then
    echo "==> The films and photos on the server are the current ones"
    cp -al "\$APPROOT/web/dist/film" "\$APPROOT/web/dist/media" "\$NEW/web/dist/"
    [ -d "\$APPROOT/server/data/seed/files" ] && cp -al "\$APPROOT/server/data/seed/files" "\$NEW/server/data/seed/"
else
    echo "==> The server is downloading the films, photos and documents from GitHub (about 60 MB)"
    URL='https://codeload.github.com/${REPO}/tar.gz/${COMMIT}'
    if command -v curl >/dev/null 2>&1; then curl -fsSL --retry 3 -o "\$W/src.tar.gz" "\$URL"; else wget -q -O "\$W/src.tar.gz" "\$URL"; fi
    mkdir -p "\$W/src"
    tar xzf "\$W/src.tar.gz" -C "\$W/src" --strip-components=1 --no-same-owner --no-same-permissions \\
        '${NAME}-${COMMIT}/web/public/film' '${NAME}-${COMMIT}/web/public/media' '${NAME}-${COMMIT}/server/data/seed/files'
    rm -f "\$W/src.tar.gz"
    if [ ! -d "\$W/src/web/public/film" ] || [ ! -d "\$W/src/web/public/media" ]; then echo "!!  The films and photos did not arrive."; exit 1; fi
    mv "\$W/src/web/public/film" "\$W/src/web/public/media" "\$NEW/web/dist/"
    [ -d "\$W/src/server/data/seed/files" ] && mv "\$W/src/server/data/seed/files" "\$NEW/server/data/seed/"
fi

# 3. the new version in place; the one before it kept in .previous
mkdir -p "\$APPROOT"
rm -rf "\$APPROOT/.previous"
mkdir -p "\$APPROOT/.previous"
for x in app.js package.json server web; do [ -e "\$APPROOT/\$x" ] && mv "\$APPROOT/\$x" "\$APPROOT/.previous/"; done
for x in app.js package.json server web; do mv "\$NEW/\$x" "\$APPROOT/"; done
echo '${MEDIA}' > "\$APPROOT/.elia-media"
cat > "\$APPROOT/server/.env" <<ENV
# Written by deploy-elia.sh on every deploy. The site's settings are in \$DATA/.env
NODE_ENV=production
DATA_DIR=\$DATA
ENV

# 4. the settings, the first time (then left as they are edited)
if [ ! -f "\$DATA/.env" ]; then
    cat > "\$DATA/.env" <<ENV
# The ELIA website's settings on this server. They are read when the app starts: after a change, restart it
# (cPanel > Setup Node.js App > Restart). Written once by deploy-elia.sh, then left as you edit it.

SITE_URL=https://${DOMAIN}
# keep search engines out while the site lives on this temporary address
NOINDEX=1

# who receives what the forms bring in (the content document's teams): one address for all, or one each
NOTIFY_TO=info@eliaet.com
# TEAM_SECRETARIAT=
# TEAM_MEMBERS=
# TEAM_PROGRAMS=
# TEAM_COMMS=
TEAM_AALF=elia.aalf2@gmail.com
CONTACT_EMAIL=info@eliaet.com

# set by deploy-elia.sh after checking this host: every visitor counts as one for the limits
CLIENT_IP=shared

# e-mail goes out through the server's own mail; the sender is an address of a domain on this hosting
MAIL_FROM=ELIA website <no-reply@${ROOT_DOMAIN}>
# or through an e-mail account (cPanel > Email Accounts):
# SMTP_HOST=mail.${ROOT_DOMAIN}
# SMTP_PORT=465
# SMTP_SECURE=true
# SMTP_USER=no-reply@${ROOT_DOMAIN}
# SMTP_PASS=
ENV
    chmod 600 "\$DATA/.env"
    echo "    Settings written to ~/elia-data/${DOMAIN}/.env (who receives the forms: info@eliaet.com)"
fi

# 5. a Node.js app in cPanel, the first time; a restart after that
if [ -d '${HOME_DIR}/nodevenv/${APP}' ]; then
    echo "==> Restarting the app"
    cloudlinux-selector restart --json --interpreter nodejs --app-root '${APP}' >/dev/null 2>&1 || true
    mkdir -p "\$APPROOT/tmp" && touch "\$APPROOT/tmp/restart.txt"
else
    echo "==> Making it a Node.js app in cPanel"
    if ! command -v cloudlinux-selector >/dev/null 2>&1; then exit 3; fi
    OK=''
    for URI in '' '/'; do
        OUT="\$(cloudlinux-selector create --json --interpreter nodejs --version '${MAJOR}' --app-root '${APP}' --domain '${DOMAIN}' --app-uri "\$URI" --startup-file app.js 2>&1 || true)"
        if echo "\$OUT" | grep -q '"result": *"success"'; then OK=1; break; fi
    done
    if [ -z "\$OK" ]; then echo "\$OUT" | head -c 600; echo; exit 3; fi
fi

# 6. the subdomain's folder: Apache would answer from any file in it before the app, so the old static site's files
#    go to ~/backups (once); the .htaccess keeps cPanel's lines (the app's) and gets ours
if [ ! -f "\$APPROOT/.docroot-cleared" ]; then
    B='${HOME_DIR}/backups/elia-docroot-'"\$(date +%Y%m%d-%H%M%S)"
    mkdir -p "\$B"
    shopt -s dotglob nullglob
    for f in "\$DOCROOT"/*; do
        case "\$(basename "\$f")" in .htaccess|.well-known|cgi-bin) ;; *) mv "\$f" "\$B/" ;; esac
    done
    shopt -u dotglob nullglob
    touch "\$APPROOT/.docroot-cleared"
    echo "    The old static site's files are now in ~/backups/\$(basename "\$B")"
fi
HT="\$DOCROOT/.htaccess"
touch "\$HT"
if grep -q "# BEGIN ${MARKER}" "\$HT"; then sed -i "/# BEGIN ${MARKER}/,/# END ${MARKER}/d" "\$HT"; fi
sed -i -e :a -e '/^\n*\$/{\$d;N;ba' -e '}' "\$HT"
printf '\n' >> "\$HT"
cat "\$W/htaccess-elia.conf" >> "\$HT"

# how the site's e-mail goes out (the forms reach ELIA by it)
MAILMODE="\$(cd "\$APPROOT" && "\$NODE" server/dist/cli.mjs stats 2>/dev/null | sed -n '/^e-mail from/d; s/^e-mail  *//p' || true)"
echo "==> E-mail: \${MAILMODE:-unknown}"

# 7. the Secretariat's account, if asked for
if [ -n ${ADMIN_EMAIL_Q} ]; then
    echo "==> The Secretariat account for ${ADMIN_EMAIL}"
    (cd "\$APPROOT" && "\$NODE" server/dist/cli.mjs create-admin ${ADMIN_EMAIL_Q} ${ADMIN_NAME_Q} --print-link | sed 's/^/    /')
fi
EOF
STATUS=$?
set -e
if [ "$STATUS" -eq 3 ]; then
    echo "!!  The app could not be made from here. Make it once in cPanel > Setup Node.js App > Create Application:"
    echo "      Node.js version:          ${MAJOR} (${NODEV})"
    echo "      Application mode:         Production"
    echo "      Application root:         ${APP}"
    echo "      Application URL:          ${DOMAIN} (nothing after the slash)"
    echo "      Application startup file: app.js"
    echo "    Then run this script again: it finishes the rest."
    exit 1
elif [ "$STATUS" -ne 0 ]; then
    echo "!!  Installing stopped (see above). The site as it was is still there."
    exit "$STATUS"
fi

echo "==> Checking the site"
sleep 2
health() { curl -s --max-time 30 "$@" "https://${DOMAIN}/api/health" || true; }
seen() { printf '%s' "$1" | sed -n 's/.*"seen":"\([^"]*\)".*/\1/p'; }
# The limits on the forms and on signing in count each visitor by the address the web server in front of the app
# reports. Until this check says that address is the visitor's real one (not one a visitor can make up in a header,
# not the same for everybody), the site counts all visitors together (CLIENT_IP=shared in its settings).
has_shared() { ssh "$REMOTE" "grep -qs '^CLIENT_IP=' '${DATA}/.env'"; }
restart_app() { ssh "$REMOTE" "cloudlinux-selector restart --json --interpreter nodejs --app-root '${APP}' >/dev/null 2>&1 || true; mkdir -p '${APPROOT}/tmp' && touch '${APPROOT}/tmp/restart.txt'"; }
set_shared() {
    if ! has_shared; then
        ssh "$REMOTE" "printf '\n# set by deploy-elia.sh after checking this host: every visitor counts as one for the limits\nCLIENT_IP=shared\n' >> '${DATA}/.env'"
        restart_app
    fi
}
body="$(health)"
if printf '%s' "$body" | grep -q '"ok":true'; then
    echo "    https://${DOMAIN}/ answers."
    here="$(seen "$body")"
    fake="$(seen "$(health -H 'X-Forwarded-For: 203.0.113.7' -H 'X-Real-IP: 203.0.113.7')")"
    there="$(seen "$(ssh "$REMOTE" "curl -s --max-time 20 https://${DOMAIN}/api/health" 2>/dev/null || true)")"
    mine="$(ssh "$REMOTE" 'echo "${SSH_CLIENT%% *}"' 2>/dev/null || true)"
    v4() { printf '%s' "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; }
    WHY=""
    if [ "$fake" = "203.0.113.7" ]; then WHY="a visitor can make up the address it shows"
    elif [ -z "$here" ] || [ "$here" = "shared" ]; then WHY="the web server does not pass the visitor's address on"
    elif [ -n "$there" ] && [ "$here" = "$there" ]; then WHY="every visitor shows the same address"
    elif v4 "$here" && v4 "$mine" && [ "$here" != "$mine" ]; then WHY="it shows ${here} for you, but your connection is ${mine}"
    fi
    if [ -n "$WHY" ]; then
        set_shared
        echo "    The site cannot tell visitors apart here (${WHY}): its limits count all visitors together."
    else
        if has_shared; then
            ssh "$REMOTE" "sed -i '/^# set by deploy-elia.sh after checking this host/d;/^CLIENT_IP=/d' '${DATA}/.env'"
            restart_app
        fi
        echo "    The site sees each visitor's own address (yours: ${here}), so its limits count each visitor apart."
    fi
else
    set_shared
    echo "    https://${DOMAIN}/ does not answer yet (${body:-no answer}). The app starts on its first visit and a new"
    echo "    subdomain can take a few minutes for its certificate: try it in the browser in a minute."
    echo "    If it stays down: cPanel > Setup Node.js App > the app > Restart, and ~/${APP}/stderr.log on the server."
    echo "!!  So the visitor-address check did not run: until it does, the site's limits count all visitors together."
    echo "    Run ./deploy-elia.sh again once the site answers (with the same package it just puts the same version back)."
fi
echo "==> Done: https://${DOMAIN}/"
echo "    Back office: https://${DOMAIN}/admin    Members: https://${DOMAIN}/members/login"
echo "    Settings (who receives the forms, the e-mail sender): ~/elia-data/${DOMAIN}/.env on the server."
