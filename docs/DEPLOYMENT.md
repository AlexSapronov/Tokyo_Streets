# Deployment to tokyonight.site

Tokyo Streets is a static ES-module game. Nginx serves the files directly;
Node.js is used only in GitHub CI. No game server or database is required.

## Overview

- Every push/PR runs the existing **Game checks** workflow.
- A successful **push to main** starts **Deploy Tokyo Streets**.
- The deployment uses a dedicated SSH user with **no sudo**, a pinned SSH host
  key, and GitHub Actions repository secrets.
- Each commit is copied into a new release directory and activated by switching
  the \`current\` symlink atomically. \`previous\` is kept for rollback.
- An old CI run never intentionally deploys over a newer main commit.
- A failed public-page health check automatically restores \`previous\`.
- This does **not** sync players' localStorage saves or enable multiplayer.

## 1. Prepare Ubuntu VPS (root, one time)

The Nginx site and HTTPS must already work for https://tokyonight.site.

\`\`\`bash
apt install -y rsync
id tokyo-deploy || useradd -m -s /bin/bash tokyo-deploy
install -d -m 700 -o tokyo-deploy -g tokyo-deploy /home/tokyo-deploy/.ssh
touch /home/tokyo-deploy/.ssh/authorized_keys
chown tokyo-deploy:tokyo-deploy /home/tokyo-deploy/.ssh/authorized_keys
chmod 600 /home/tokyo-deploy/.ssh/authorized_keys

install -d -m 755 -o tokyo-deploy -g tokyo-deploy /var/www/tokyo-streets/releases
install -d -m 755 -o tokyo-deploy -g tokyo-deploy /var/www/tokyo-streets/releases/bootstrap
rsync -a /var/www/tokyo-streets/index.html /var/www/tokyo-streets/style.css \
  /var/www/tokyo-streets/src /var/www/tokyo-streets/assets \
  /var/www/tokyo-streets/releases/bootstrap/
chown -R tokyo-deploy:tokyo-deploy /var/www/tokyo-streets/releases
ln -s releases/bootstrap /var/www/tokyo-streets/current
chown tokyo-deploy:tokyo-deploy /var/www/tokyo-streets
\`\`\`

In \`/etc/nginx/sites-available/tokyonight.site\` change the **game site's**
root in the HTTPS server block from:

\`\`\`nginx
root /var/www/tokyo-streets;
\`\`\`

to:

\`\`\`nginx
root /var/www/tokyo-streets/current;
\`\`\`

Do not replace SSL/Certbot directives or change any unrelated virtual host.

\`\`\`bash
nginx -t && systemctl reload nginx
curl -fsS https://tokyonight.site/ -o /dev/null && echo "Site OK"
\`\`\`

If the site is not OK, restore the old Nginx root and reload Nginx before
proceeding.

## 2. Create a deploy SSH key (Windows 11 PowerShell, one time)

\`\`\`powershell
ssh-keygen -t ed25519 -C "tokyo-streets-actions" -f "$env:USERPROFILE\.ssh\tokyo_streets_actions" -N '""'
\`\`\`

If this \`-N\` syntax is not accepted by the local OpenSSH build, omit \`-N\`
and press Enter twice for an empty passphrase. The key must be unencrypted for
noninteractive GitHub Actions. Protect it carefully; never commit it.

Copy the **public** key to the deployment user's authorized keys:

\`\`\`powershell
Get-Content "$env:USERPROFILE\.ssh\tokyo_streets_actions.pub" | ssh root@38.244.174.235 "cat >> /home/tokyo-deploy/.ssh/authorized_keys"
ssh -i "$env:USERPROFILE\.ssh\tokyo_streets_actions" tokyo-deploy@38.244.174.235 "whoami; test -w /var/www/tokyo-streets && echo writable"
\`\`\`

Expected: \`tokyo-deploy\`, then \`writable\`. Do not give this user sudo.

## 3. Add GitHub Actions secrets

Open the repository: **Settings → Secrets and variables → Actions → Secrets**.

Create two **repository secrets**:

| Secret | Content |
| --- | --- |
| \`TOKYO_DEPLOY_SSH_KEY\` | Complete private key from \`tokyo_streets_actions\` (including BEGIN/END lines) |
| \`TOKYO_DEPLOY_KNOWN_HOSTS\` | Server's pinned SSH public host key line below |

To obtain the *trusted* SSH host key directly from the VPS (root):

\`\`\`bash
printf '38.244.174.235 '; cat /etc/ssh/ssh_host_ed25519_key.pub
\`\`\`

Paste the resulting **single line** exactly as \`TOKYO_DEPLOY_KNOWN_HOSTS\`.
Do **not** paste the server's host **private** key.

To copy the deployment *private* key from Windows to the clipboard:

\`\`\`powershell
Get-Content -Raw "$env:USERPROFILE\.ssh\tokyo_streets_actions" | Set-Clipboard
\`\`\`

Paste it into the GitHub secret only, not into chat, a PR, or a shell transcript.

## 4. Activate

Merge the deployment PR **only after the server setup and secrets are ready**.
The merge creates a push to main. On GitHub, open the **Actions** tab.
A successful **Game checks** run starts **Deploy Tokyo Streets**.

The deployment should leave the site accessible at https://tokyonight.site.

If the initial deployment doesn't run, push a harmless change to main;
the deploy workflow only follows successful main push checks.

## Rollback

From an SSH session as root (or tokyo-deploy), if a deployed release is broken:

\`\`\`bash
cd /var/www/tokyo-streets
readlink previous
ln -s "$(readlink previous)" .rollback-manual
mv -Tf .rollback-manual current
\`\`\`

No Nginx restart is needed. This rolls back web files only.
A future successful push to main may replace this manual rollback.

## Notes

- Existing localStorage saves stay in each player's browser because the domain
  remains the same; they are not server files.
- Each published release is retained on disk for debugging. Periodically remove
  *unused* older release directories when disk space warrants it; never delete
  the \`current\` or \`previous\` target.
- The GitHub workflow does not SSH as root, does not install packages, does not
  edit Nginx, and does not need a Docker container.
- If SSH public IP, domain, or deployment username changes, update the workflow,
  pinned host key, and Nginx config accordingly.
