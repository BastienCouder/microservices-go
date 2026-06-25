#!/bin/sh

set -eu

: "${DSN:?DSN is required}"
: "${KRATOS_PUBLIC_BASE_URL:?KRATOS_PUBLIC_BASE_URL is required}"
: "${KRATOS_OIDC_GOOGLE_CLIENT_ID:?KRATOS_OIDC_GOOGLE_CLIENT_ID is required}"
: "${KRATOS_OIDC_GOOGLE_CLIENT_SECRET:?KRATOS_OIDC_GOOGLE_CLIENT_SECRET is required}"

CONFIG_TEMPLATE="${KRATOS_CONFIG_TEMPLATE:-/etc/config/kratos/kratos.yml}"

trim_trailing_slash() {
  printf '%s' "$1" | sed 's:/*$::'
}

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[\/&]/\\&/g'
}

json_quote() {
  escaped="$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  printf '"%s"' "$escaped"
}

append_unique_line() {
  list="$1"
  item="$2"
  if [ -z "$item" ]; then
    printf '%s' "$list"
    return
  fi
  case "
$list
" in
    *"
$item
"*)
      printf '%s' "$list"
      ;;
    *)
      if [ -n "$list" ]; then
        printf '%s\n%s' "$list" "$item"
      else
        printf '%s' "$item"
      fi
      ;;
  esac
}

append_csv_lines() {
  list="$1"
  csv="${2:-}"
  old_ifs=$IFS
  IFS=','
  for raw_item in $csv; do
    item="$(printf '%s' "$raw_item" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    list="$(append_unique_line "$list" "$item")"
  done
  IFS=$old_ifs
  printf '%s' "$list"
}

json_array_from_lines() {
  list="$1"
  out="["
  first=1
  old_ifs=$IFS
  IFS='
'
  for item in $list; do
    [ -n "$item" ] || continue
    if [ "$first" -eq 0 ]; then
      out="$out, "
    fi
    out="$out$(json_quote "$item")"
    first=0
  done
  IFS=$old_ifs
  out="$out]"
  printf '%s' "$out"
}

origin_from_url() {
  url="$(trim_trailing_slash "$1")"
  printf '%s' "$url" | sed -E 's#^((https?://[^/]+)).*$#\1#'
}

cookie_domain_from_url() {
  host="$(trim_trailing_slash "$1" | sed -E 's#^https?://([^/:]+).*$#\1#')"
  case "$host" in
    localhost|127.0.0.1|'' )
      printf '%s' "$host"
      ;;
    *.*.* )
      printf '.%s' "$(printf '%s' "$host" | cut -d. -f2-)"
      ;;
    * )
      printf '%s' "$host"
      ;;
  esac
}

WEB_PUBLIC_URL="$(trim_trailing_slash "${WEB_PUBLIC_URL:-http://localhost:30000}")"
APP_PUBLIC_URL="$(trim_trailing_slash "${APP_PUBLIC_URL:-http://localhost:30004}")"
DOC_PUBLIC_URL="$(trim_trailing_slash "${DOC_PUBLIC_URL:-http://localhost:30001}")"
WEB_AUTH_URL="$(trim_trailing_slash "${WEB_AUTH_URL:-${WEB_PUBLIC_URL}}")"
KRATOS_PUBLIC_BASE_URL="$(trim_trailing_slash "${KRATOS_PUBLIC_BASE_URL}")"
KRATOS_COOKIE_DOMAIN="${KRATOS_COOKIE_DOMAIN:-$(cookie_domain_from_url "$KRATOS_PUBLIC_BASE_URL")}"

allowed_origins=""
allowed_origins="$(append_unique_line "$allowed_origins" "$(origin_from_url "$WEB_PUBLIC_URL")")"
allowed_origins="$(append_unique_line "$allowed_origins" "$(origin_from_url "$APP_PUBLIC_URL")")"
allowed_origins="$(append_unique_line "$allowed_origins" "$(origin_from_url "$DOC_PUBLIC_URL")")"
allowed_origins="$(append_csv_lines "$allowed_origins" "${KRATOS_EXTRA_ALLOWED_ORIGINS:-}")"

allowed_return_urls=""
allowed_return_urls="$(append_unique_line "$allowed_return_urls" "${APP_PUBLIC_URL}/")"
allowed_return_urls="$(append_unique_line "$allowed_return_urls" "${WEB_PUBLIC_URL}/")"
allowed_return_urls="$(append_unique_line "$allowed_return_urls" "${WEB_PUBLIC_URL}/login")"
allowed_return_urls="$(append_unique_line "$allowed_return_urls" "${WEB_PUBLIC_URL}/login/callback")"
allowed_return_urls="$(append_unique_line "$allowed_return_urls" "${WEB_PUBLIC_URL}/register")"
allowed_return_urls="$(append_csv_lines "$allowed_return_urls" "${KRATOS_EXTRA_ALLOWED_RETURN_URLS:-}")"

ESC_DSN="$(escape_sed_replacement "$DSN")"
ESC_KRATOS_PUBLIC_BASE_URL="$(escape_sed_replacement "$KRATOS_PUBLIC_BASE_URL")"
ESC_KRATOS_COOKIE_DOMAIN="$(escape_sed_replacement "$(json_quote "$KRATOS_COOKIE_DOMAIN")")"
ESC_ALLOWED_ORIGINS="$(escape_sed_replacement "$(json_array_from_lines "$allowed_origins")")"
ESC_DEFAULT_BROWSER_RETURN_URL="$(escape_sed_replacement "$(json_quote "${APP_PUBLIC_URL}/")")"
ESC_ALLOWED_RETURN_URLS="$(escape_sed_replacement "$(json_array_from_lines "$allowed_return_urls")")"
ESC_ERROR_UI_URL="$(escape_sed_replacement "$(json_quote "${WEB_PUBLIC_URL}/login/error")")"
ESC_SETTINGS_UI_URL="$(escape_sed_replacement "$(json_quote "${WEB_PUBLIC_URL}/login")")"
ESC_RECOVERY_UI_URL="$(escape_sed_replacement "$(json_quote "${WEB_PUBLIC_URL}/login")")"
ESC_VERIFICATION_UI_URL="$(escape_sed_replacement "$(json_quote "${WEB_PUBLIC_URL}/login")")"
ESC_VERIFICATION_RETURN_URL="$(escape_sed_replacement "$(json_quote "${WEB_PUBLIC_URL}/")")"
ESC_LOGOUT_RETURN_URL="$(escape_sed_replacement "$(json_quote "${WEB_PUBLIC_URL}/login")")"
ESC_LOGIN_UI_URL="$(escape_sed_replacement "$(json_quote "${WEB_PUBLIC_URL}/login")")"
ESC_LOGIN_RETURN_URL="$(escape_sed_replacement "$(json_quote "${APP_PUBLIC_URL}/")")"
ESC_REGISTRATION_UI_URL="$(escape_sed_replacement "$(json_quote "${WEB_PUBLIC_URL}/register")")"
ESC_REGISTRATION_RETURN_URL="$(escape_sed_replacement "$(json_quote "${APP_PUBLIC_URL}/")")"
ESC_GOOGLE_CLIENT_ID="$(escape_sed_replacement "${KRATOS_OIDC_GOOGLE_CLIENT_ID}")"
ESC_GOOGLE_CLIENT_SECRET="$(escape_sed_replacement "${KRATOS_OIDC_GOOGLE_CLIENT_SECRET}")"

sed \
  -e "s|\${DSN}|${ESC_DSN}|g" \
  -e "s|\${KRATOS_PUBLIC_BASE_URL}|${ESC_KRATOS_PUBLIC_BASE_URL}|g" \
  -e "s|\${KRATOS_COOKIE_DOMAIN}|${ESC_KRATOS_COOKIE_DOMAIN}|g" \
  -e "s|\${KRATOS_ALLOWED_ORIGINS}|${ESC_ALLOWED_ORIGINS}|g" \
  -e "s|\${KRATOS_DEFAULT_BROWSER_RETURN_URL}|${ESC_DEFAULT_BROWSER_RETURN_URL}|g" \
  -e "s|\${KRATOS_ALLOWED_RETURN_URLS}|${ESC_ALLOWED_RETURN_URLS}|g" \
  -e "s|\${KRATOS_ERROR_UI_URL}|${ESC_ERROR_UI_URL}|g" \
  -e "s|\${KRATOS_SETTINGS_UI_URL}|${ESC_SETTINGS_UI_URL}|g" \
  -e "s|\${KRATOS_RECOVERY_UI_URL}|${ESC_RECOVERY_UI_URL}|g" \
  -e "s|\${KRATOS_VERIFICATION_UI_URL}|${ESC_VERIFICATION_UI_URL}|g" \
  -e "s|\${KRATOS_VERIFICATION_RETURN_URL}|${ESC_VERIFICATION_RETURN_URL}|g" \
  -e "s|\${KRATOS_LOGOUT_RETURN_URL}|${ESC_LOGOUT_RETURN_URL}|g" \
  -e "s|\${KRATOS_LOGIN_UI_URL}|${ESC_LOGIN_UI_URL}|g" \
  -e "s|\${KRATOS_LOGIN_RETURN_URL}|${ESC_LOGIN_RETURN_URL}|g" \
  -e "s|\${KRATOS_REGISTRATION_UI_URL}|${ESC_REGISTRATION_UI_URL}|g" \
  -e "s|\${KRATOS_REGISTRATION_RETURN_URL}|${ESC_REGISTRATION_RETURN_URL}|g" \
  -e "s|\${KRATOS_OIDC_GOOGLE_CLIENT_ID}|${ESC_GOOGLE_CLIENT_ID}|g" \
  -e "s|\${KRATOS_OIDC_GOOGLE_CLIENT_SECRET}|${ESC_GOOGLE_CLIENT_SECRET}|g" \
  "${CONFIG_TEMPLATE}"
