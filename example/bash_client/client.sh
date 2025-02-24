#!/bin/bash

# OAuth2 device flow test script

server=http://localhost:3000
device_endpoint="$server/oauth/device/code"
token_endpoint="$server/oauth/token"
client_id=org.fedstack.bash_client
scope="uperm://uaaa.local/session/claim uperm://$client_id/**"
device_code_resp=$(curl \
  -s -X POST \
  --data-urlencode "client_id=$client_id" \
  --data-urlencode "scope=$scope" \
  $device_endpoint
)
device_code=$(echo "$device_code_resp" | jq -r '.device_code')
user_code=$(echo "$device_code_resp" | jq -r '.user_code')
verification_uri_complete=$(echo "$device_code_resp" | jq -r '.verification_uri_complete')
poll_interval=$(echo "$device_code_resp" | jq -r '.interval')
echo "User code: $user_code"
echo "Verification URI: $verification_uri_complete"

# start polling
while true; do
  token_resp=$(curl -s -X POST -d "client_id=$client_id&device_code=$device_code&grant_type=urn:ietf:params:oauth:grant-type:device_code" $token_endpoint)
  if [ "$(echo "$token_resp" | jq -r '.error')" == "authorization_pending" ]; then
    echo "Authorization pending..."
    sleep "$poll_interval"
  else
    break
  fi
done

echo "$token_resp"
access_token=$(echo "$token_resp" | jq -r '.access_token')
id_token=$(echo "$token_resp" | jq -r '.id_token')
echo "Access token: $access_token"
cut -d. -f2 <<< "$access_token" | base64 -d 2>/dev/null | jq
echo ""
echo "ID token: $id_token"
cut -d. -f2 <<< "$id_token" | base64 -d 2>/dev/null | jq
echo ""

touch .env
sed -i "/^ACCESS_TOKEN=/d" .env
echo "ACCESS_TOKEN=$access_token" >> .env
sed -i "/^ID_TOKEN=/d" .env
echo "ID_TOKEN=$id_token" >> .env

# Refresh token to get a new access token
refresh_token=$(echo "$token_resp" | jq -r '.refresh_token')
refresh_token_resp=$(curl \
  -s -X POST \
  --data-urlencode "client_id=$client_id" \
  --data-urlencode "refresh_token=$refresh_token" \
  --data-urlencode "grant_type=refresh_token" \
  --data-urlencode "target_app_id=$client_id" \
  $token_endpoint
)

echo "Refresh Response:"
echo "$refresh_token_resp" | jq
echo "New Access Token Payload:"
echo "$refresh_token_resp" | jq -r '.access_token' | cut -d. -f2 | base64 -d 2>/dev/null | jq
echo ""