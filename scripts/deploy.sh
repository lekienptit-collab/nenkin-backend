#!/usr/bin/env bash
#
# Deploy Nenkin (backend + frontend) tren Amazon Linux 2023.
#
#   ./deploy.sh              # deploy ca hai
#   ./deploy.sh backend      # chi backend
#   ./deploy.sh frontend     # chi frontend
#   ./deploy.sh rollback     # tra frontend ve ban build truoc do
#   ./deploy.sh --no-pull    # bo qua git pull, chi build lai
#
set -Eeuo pipefail

# Script nam trong repo va se `git pull` de len chinh no. Bash doc file theo
# tung doan trong luc chay, nen file bi ghi de giua chung co the lam chay sai.
# -> Chay tu mot ban sao ngoai repo.
if [[ "${NENKIN_DEPLOY_REEXEC:-}" != "1" ]]; then
  _runner="$HOME/.nenkin-deploy.running.sh"
  cp -f "$0" "$_runner"
  chmod +x "$_runner"
  NENKIN_DEPLOY_REEXEC=1 exec "$_runner" "$@"
fi

# ---------------------------------------------------------------- cau hinh ---
BACKEND_DIR=/var/www/nenkin-backend
FRONTEND_DIR=/var/www/nenkin-frontend
WEB_ROOT=/var/www/nenkin-web          # nginx tro root vao $WEB_ROOT/current
KEEP_RELEASES=3
PM2_APP=nenkin-api
MIN_FREE_MB=3000                      # build frontend can cho trong
NODE_BUILD_MEM=2048                   # MB, tranh OOM tren may RAM thap
HEALTH_RETRIES=15

RELEASES="$WEB_ROOT/releases"
LOCK_FILE=/tmp/nenkin-deploy.lock

# ------------------------------------------------------------------- tien ich ---
C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_OFF=$'\033[0m'
log()  { printf '%s\n' "${C_OK}==>${C_OFF} $*"; }
step() { printf '\n%s\n' "${C_OK}=== $* ===${C_OFF}"; }
warn() { printf '%s\n' "${C_WARN}[!]${C_OFF} $*" >&2; }
die()  { printf '%s\n' "${C_ERR}[x]${C_OFF} $*" >&2; exit 1; }

trap 'die "That bai o dong $LINENO. Khong co gi bi restart, he thong van chay ban cu."' ERR

# Chi cho phep mot phien deploy chay tai mot thoi diem.
exec 9>"$LOCK_FILE"
flock -n 9 || die "Dang co mot phien deploy khac chay. Neu chac chan khong phai, xoa $LOCK_FILE"

# ---------------------------------------------------------------- tham so ---
TARGET=all
DO_PULL=1
DO_MIGRATE=1

for arg in "$@"; do
  case "$arg" in
    backend|frontend|all|rollback) TARGET="$arg" ;;
    --no-pull)     DO_PULL=0 ;;
    --skip-migrate) DO_MIGRATE=0 ;;
    -h|--help)
      sed -n '2,12p' "$0" | sed 's/^#\s\?//'
      exit 0 ;;
    *) die "Tham so khong hieu: $arg" ;;
  esac
done

# ------------------------------------------------------------- kiem tra moi truong ---
[[ $EUID -ne 0 ]] || die "Dung chay bang root/sudo. pm2 dang thuoc user thuong, chay bang root se tao daemon thu hai."

command -v node >/dev/null || die "Khong tim thay node"
command -v npm  >/dev/null || die "Khong tim thay npm"
command -v pm2  >/dev/null || die "Khong tim thay pm2"

# Da tung ENOSPC lam hong node_modules giua chung -> chan truoc khi bat dau.
free_mb=$(df -Pm / | awk 'NR==2 {print $4}')
if (( free_mb < MIN_FREE_MB )); then
  df -h /
  die "Chi con ${free_mb}MB trong o dia, can it nhat ${MIN_FREE_MB}MB. Don bot roi chay lai:
     pm2 flush && npm cache clean --force && docker system prune -af"
fi
log "O dia con trong: ${free_mb}MB"

# --------------------------------------------------------------------- git ---
git_pull() {
  local dir="$1" name="$2"
  cd "$dir"

  # Tren server co file bi sua tay (vd docker-compose.yml da doi binding 127.0.0.1).
  # Stash lai de pull khong bi chan, va bao cho nguoi dung biet cach lay lai.
  if [[ -n "$(git status --porcelain)" ]]; then
    warn "$name co thay doi cuc bo, dang stash:"
    git status --porcelain | sed "s/^/    ${C_DIM}/;s/$/${C_OFF}/"
    git stash push -u -m "deploy-autostash-$(date +%F_%H%M%S)" >/dev/null
    warn "Lay lai bang: cd $dir && git stash list && git stash pop"
  fi

  local branch; branch=$(git rev-parse --abbrev-ref HEAD)
  local before;  before=$(git rev-parse --short HEAD)
  git pull --ff-only origin "$branch"
  local after;   after=$(git rev-parse --short HEAD)

  if [[ "$before" == "$after" ]]; then
    log "$name: khong co commit moi ($after)"
  else
    log "$name: $before -> $after"
    git --no-pager log --oneline "$before..$after" | sed 's/^/    /'
  fi
}

# npm ci mat vai phut va xoa sach node_modules; chi chay khi lockfile thuc su doi.
npm_install_if_needed() {
  local dir="$1" name="$2" before_hash="$3"
  cd "$dir"
  local after_hash; after_hash=$(md5sum package-lock.json | awk '{print $1}')

  if [[ ! -d node_modules ]]; then
    log "$name: chua co node_modules, cai moi"
    npm ci
  elif [[ "$before_hash" != "$after_hash" ]]; then
    log "$name: package-lock.json doi, cai lai"
    npm ci
  else
    log "$name: dependencies khong doi, bo qua npm ci"
  fi
}

lock_hash() { md5sum "$1/package-lock.json" 2>/dev/null | awk '{print $1}' || echo none; }

# ----------------------------------------------------------------- backend ---
deploy_backend() {
  step "BACKEND"
  [[ -f "$BACKEND_DIR/.env" ]] || die "Thieu $BACKEND_DIR/.env"

  local before_hash; before_hash=$(lock_hash "$BACKEND_DIR")
  if (( DO_PULL )); then git_pull "$BACKEND_DIR" "backend"; fi
  npm_install_if_needed "$BACKEND_DIR" "backend" "$before_hash"

  cd "$BACKEND_DIR"

  log "Build..."
  npm run build
  [[ -f dist/main.js ]] || die "Build xong nhung khong thay dist/main.js"

  # Migration chay TRUOC khi restart: neu hong thi tien trinh cu van phuc vu
  # schema cu, khong roi vao trang thai code moi + schema cu.
  if (( DO_MIGRATE )); then
    log "Chay migration..."
    npm run migrate:up
  else
    warn "Bo qua migration theo yeu cau"
  fi

  # --cwd bat buoc: nenkin-pdf.service.ts doc mau PDF theo process.cwd()
  # tu assets/nenkin-templates/ va assets/fonts/.
  if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
    log "Restart pm2..."
    pm2 restart "$PM2_APP" --update-env
  else
    log "Khoi dong pm2 lan dau..."
    pm2 start dist/main.js --name "$PM2_APP" --cwd "$BACKEND_DIR"
  fi
  pm2 save >/dev/null

  # Port lay tu .env; app mac dinh 3000 neu khong khai bao.
  local port
  port=$(grep -E '^PORT=' .env | head -1 | cut -d= -f2 | tr -d '"'\''' | xargs)
  port=${port:-3000}

  log "Cho backend len o port $port..."
  local i
  for ((i = 1; i <= HEALTH_RETRIES; i++)); do
    if curl -sf -o /dev/null "http://127.0.0.1:$port/" \
       || curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/" | grep -qE '^[2-4]'; then
      log "Backend song (port $port)"
      return 0
    fi
    sleep 2
  done

  warn "Backend khong phan hoi sau $((HEALTH_RETRIES * 2))s. Log gan nhat:"
  pm2 logs "$PM2_APP" --lines 30 --nostream || true
  die "Backend khong len duoc"
}

# ---------------------------------------------------------------- frontend ---
deploy_frontend() {
  step "FRONTEND"
  [[ -f "$FRONTEND_DIR/.env" ]] || die "Thieu $FRONTEND_DIR/.env (can REACT_APP_API)"

  # REACT_APP_API bi nhung cung vao bundle luc build, khong doc luc chay.
  local api; api=$(grep -E '^REACT_APP_API=' "$FRONTEND_DIR/.env" | head -1 | cut -d= -f2-)
  log "REACT_APP_API = $api"
  if [[ "$api" == *127.0.0.1* || "$api" == *localhost* ]]; then
    die "REACT_APP_API dang tro ve localhost. Trinh duyet nguoi dung se goi ve may cua ho.
     Sua $FRONTEND_DIR/.env thanh dia chi public roi chay lai."
  fi

  local before_hash; before_hash=$(lock_hash "$FRONTEND_DIR")
  # .env cua frontend dang duoc git theo doi (khac backend). git pull se keo
  # ban trong repo de len, lam REACT_APP_API quay ve localhost -> giu lai ban server.
  local env_backup; env_backup=$(mktemp)
  cp "$FRONTEND_DIR/.env" "$env_backup"

  if (( DO_PULL )); then git_pull "$FRONTEND_DIR" "frontend"; fi

  if ! cmp -s "$env_backup" "$FRONTEND_DIR/.env"; then
    cp "$env_backup" "$FRONTEND_DIR/.env"
    warn ".env vua bi git pull ghi de, da khoi phuc ban tren server."
    warn "Nen go khoi git (chay tren may dev, mot lan duy nhat):"
    warn "    cd nenkin-frontend && git rm --cached .env && echo '.env' >> .gitignore"
    warn "    git commit -m 'khong theo doi .env' && git push"
  fi
  rm -f "$env_backup"
  npm_install_if_needed "$FRONTEND_DIR" "frontend" "$before_hash"

  cd "$FRONTEND_DIR"
  set -a; source .env; set +a

  log "Build (co the mat vai phut)..."
  NODE_OPTIONS="--max-old-space-size=${NODE_BUILD_MEM}" npm run build
  [[ -f dist/index.html ]] || die "Build xong nhung khong thay dist/index.html"

  # Build vao thu muc rieng roi doi symlink: trong luc `max build` xoa dist/
  # thi nginx van phuc vu ban cu, khong bi 500 giua chung.
  local ts; ts=$(date +%Y%m%d-%H%M%S)
  mkdir -p "$RELEASES"
  cp -a dist "$RELEASES/$ts"
  chmod -R o+rX "$RELEASES/$ts"
  chmod o+x "$WEB_ROOT" "$RELEASES"

  ln -sfn "$RELEASES/$ts" "$WEB_ROOT/current.tmp"
  mv -Tf "$WEB_ROOT/current.tmp" "$WEB_ROOT/current"
  log "Da chuyen sang ban build $ts"

  # Giu lai vai ban cu de con duong lui.
  local old
  old=$(ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) || true)
  if [[ -n "$old" ]]; then
    printf '%s\n' "$old" | xargs -r rm -rf
    log "Da xoa $(printf '%s\n' "$old" | wc -l) ban build cu"
  fi
}

# ---------------------------------------------------------------- rollback ---
do_rollback() {
  step "ROLLBACK FRONTEND"
  local prev
  prev=$(ls -1dt "$RELEASES"/*/ 2>/dev/null | sed -n 2p || true)
  [[ -n "$prev" ]] || die "Khong co ban build truoc do de quay ve"
  prev=${prev%/}

  ln -sfn "$prev" "$WEB_ROOT/current.tmp"
  mv -Tf "$WEB_ROOT/current.tmp" "$WEB_ROOT/current"
  log "Da quay ve $(basename "$prev")"
  warn "Backend khong duoc rollback tu dong. Neu can:
     cd $BACKEND_DIR && git checkout <commit-cu> && ./deploy.sh backend --no-pull"
}

# -------------------------------------------------------------------- main ---
started=$(date +%s)

case "$TARGET" in
  rollback) do_rollback ;;
  backend)  deploy_backend ;;
  frontend) deploy_frontend ;;
  all)      deploy_backend; deploy_frontend ;;
esac

if [[ "$TARGET" != rollback ]]; then
  step "KIEM TRA"
  printf '  nginx      : %s\n' "$(systemctl is-active nginx)"
  printf '  backend    : %s\n' "$(pm2 jlist | grep -o '"status":"[a-z]*"' | head -1 | cut -d'"' -f4)"
  printf '  frontend / : %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/)"
  printf '  api /api/  : %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1/api/)"
  echo "  (frontend 200 la dat; /api/ tra 404 la binh thuong vi NestJS khong co route '/')"
fi

step "XONG sau $(( $(date +%s) - started ))s"
