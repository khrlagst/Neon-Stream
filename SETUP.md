# Neon Stream — Laptop Music Server Setup (Fedora Workstation)

Turn an old Fedora laptop into a 24/7 private music server with **Navidrome**, reachable only through a **Tailscale** private mesh, with your library backed up nightly to **Google Drive**.

This is the "laptop-first" setup: one machine, no VPS, zero public attack surface.

## Overview

| Component | Role |
|---|---|
| HP 14-BW017AU (8GB RAM, 512GB SSD) | Server hardware, runs 24/7 at home |
| Fedora Workstation | OS (DNF, GDM, firewalld, SELinux) |
| Navidrome | Music server (metadata, streaming, gapless) |
| Tailscale | Private mesh VPN — no open ports, no public exposure |
| Smart plug | Self-healing after blackouts (power-on state = always ON) |
| rclone → Google Drive | Nightly offsite backup |
| Android app (Ultrasonic / Symfonium) | Client with background playback |

## Prerequisites

- Laptop with Fedora Workstation installed (confirm with `cat /etc/os-release`)
- A smart plug with **configurable power-on state** (set to "always ON after outage" — most Tuya-based plugs support this)
- A Tailscale account (free tier)
- Google Drive containing the music library

---

## Step 0 — BIOS check (do this FIRST, it decides everything)

At the laptop: reboot → press **F10** at the HP logo → look for **"Restore on AC Power Loss"** / **"Power On After Power Failure"** (often under *Advanced → Power* or *Security*). Set it to **Enabled**.

**This is the make-or-break setting.** The smart plug restores power — but this BIOS option is what tells the laptop to *boot* when power returns. If the option doesn't exist, the self-healing plan needs a different trigger (e.g., a smart plug with relay-press, or running on battery).

---

## Step 1 — System prep

```bash
cat /etc/os-release          # confirm: NAME="Fedora Linux"
whoami                      # your username (used in Step 2)
uname -m                    # expect x86_64 on that HP
sudo dnf update -y
```

---

## Step 2 — Autologin (boot straight to desktop, no password)

```bash
sudo nano /etc/gdm/custom.conf
```

Add under `[daemon]`:

```ini
[daemon]
AutomaticLoginEnable=True
AutomaticLogin=your_username
```

---

## Step 3 — Never suspend (the critical server setting)

```bash
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
```

Caffeine (GNOME extension) keeps the screen awake; this keeps the *machine* awake. Together they mean: never down.

---

## Step 4 — Tailscale (zero public attack surface)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Install the Tailscale app on your phone, log into the same account. Then:

```bash
sudo tailscale set --ssh          # key-based SSH over the mesh, no open port 22
sudo firewall-cmd --permanent --zone=trusted --add-interface=tailscale0
sudo firewall-cmd --reload
```

The firewall commands put *all* Tailscale traffic into the trusted zone — Navidrome becomes reachable from your devices only, and **nothing is exposed to the public internet**. No port forwarding, nothing for bots to scan.

---

## Step 5 — Navidrome (binary install — lightest for a 2017 dual-core)

```bash
sudo useradd -r -s /usr/sbin/nologin navidrome
sudo mkdir -p /opt/navidrome /var/lib/navidrome/music
cd /tmp
# Grab the current version from https://github.com/navidrome/navidrome/releases
# and substitute it below (e.g. 0.5x.x):
curl -L -o navidrome.tar.gz \
  "https://github.com/navidrome/navidrome/releases/latest/download/navidrome_0.5x.x_linux_amd64.tar.gz"
sudo tar -xzf navidrome.tar.gz -C /opt/navidrome
sudo chown -R navidrome:navidrome /opt/navidrome /var/lib/navidrome
```

### Config

```bash
sudo mkdir -p /etc/navidrome
sudo nano /etc/navidrome/navidrome.toml
```

```toml
Address = "0.0.0.0"
Port = 4533
MusicFolder = "/var/lib/navidrome/music"
DataFolder = "/var/lib/navidrome"
```

### Systemd service

```bash
sudo nano /etc/systemd/system/navidrome.service
```

```ini
[Unit]
Description=Navidrome Music Server
After=network.target

[Service]
User=navidrome
Group=navidrome
Type=simple
WorkingDirectory=/opt/navidrome
ExecStart=/opt/navidrome/navidrome --configfile /etc/navidrome/navidrome.toml
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now navidrome
```

### Fedora gotcha — SELinux

SELinux runs **enforcing** by default on Fedora. If Navidrome starts but "sees no music files," it's usually SELinux blocking reads. Check with `getenforce`. If blocked, the pragmatic home-server call is permissive:

```bash
sudo setenforce 0   # immediate, non-persistent
```

To persist, edit `/etc/selinux/config` → `SELINUX=permissive`.

Tradeoff: permissive weakens SELinux — acceptable on a Tailscale-only box where the firewall is your real boundary.

---

## Step 6 — Pull the library down + nightly backup to Drive

### Initial pull (from Drive → laptop)

```bash
sudo dnf install -y rclone
rclone config            # create remote "gdrive" (Google Drive)
sudo rclone copy gdrive:YourMusicFolder /var/lib/navidrome/music
```

### Nightly backup script

```bash
sudo nano /usr/local/bin/navidrome-backup
```

```bash
#!/bin/bash
rclone sync /var/lib/navidrome/music gdrive:MusicBackup --transfers 4 --log-file /var/log/navidrome-backup.log
```

```bash
sudo chmod +x /usr/local/bin/navidrome-backup
```

### systemd service + timer

```bash
sudo systemctl edit --force --full navidrome-backup.service
```

```ini
[Unit]
Description=Backup Navidrome library to Google Drive

[Service]
Type=oneshot
ExecStart=/usr/local/bin/navidrome-backup
```

```bash
sudo systemctl edit --force --full navidrome-backup.timer
```

```ini
[Unit]
Description=Nightly music backup

[Timer]
OnCalendar=*-*-* 03:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now navidrome-backup.timer
```

First sync: 40GB up at ~350 Mbps ≈ 15 minutes. Nightly syncs after that are delta-only.

---

## Step 7 — Phone app

Open `http://<laptop-hostname-or-tailscale-ip>:4533` in your phone browser **over Tailscale** — first visit creates your admin account. Then install:

- **Ultrasonic** (free) or **Symfonium** (paid, nicer)
- Server URL: `http://<hostname>:4533`

You get background playback, lockscreen controls, and gapless — your Spotify replacement.

---

## Step 8 — Validation tests

1. **Autologin:** reboot → desktop, no password.
2. **Playback:** play a track on your phone, lock the screen, confirm audio continues + lockscreen controls work.
3. **Blackout simulation:** pull the smart plug → laptop dies → restore power → watch it boot on its own → phone reconnects. Repeat until boring.
4. **Backup verification:** `rclone ls gdrive:MusicBackup | wc -l` should match your local file count.

---

## Final security posture

- Public zone: **zero** open ports (SSH lives on Tailscale now)
- Tailscale zone: trusted — only your devices
- SELinux: permissive (documented tradeoff) or enforcing-with-labels
- Bonus hardening: `sudo dnf install -y dnf-automatic && sudo systemctl enable --now dnf-automatic.timer` — security patches apply themselves.

## Recovery notes

- **Mid-week hang** (not power loss): nothing auto-recovers it — it waits for the weekend. That's the price of the free option; the mobile prototype streaming from Drive is the emergency fallback.
- **Data safety**: laptop is master, Google Drive is the offsite mirror. Never keep the only copy on a single device.
- **Backing up the backup**: if you ever move to a VPS, this exact setup migrates 1:1 — Tailscale and Navidrome config carry over unchanged.
