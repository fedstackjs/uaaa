---
outline: deep
---

# Application Integration

## Overview

To integrate your application with UAAA, you need to create an application in UAAA with the appropriate manifest and configure the application to use the appropriate integration method.

## Application Manifest

Every application in UAAA has a manifest that describes the application's configuration and permissions. You can write the manifest in `JSON/YAML/TOML` format. Here is an example of an application manifest:

```yaml
appId: com.example.app # The application ID
name: Example App # The application name
description: An example application # The application description
icon: https://example.com/icon.png # The application icon
providedPermissions: # Array of permissions provided by the application
  - name: Read user data # The permission name
    description: Allow the application to read user data # The permission description
    path: /user # The permission path, see concepts for details
requestedPermissions: # Array of permissions requested by the application
  - perm: uaaa/session/claim # The permission url in compact form
    reason: Get the user's session claim # The reason for requesting the permission
    required: true # Whether the permission is required
requestedClaims: # Array of claims requested by the application
  - name: username # The claim name
    reason: Get the user's username # The reason for requesting the claim
    required: true # Whether the claim is required
    verified: true # Whether the claim must be verified
callbackUrls: # Array of callback URLs
  - https://example.com/callback
variables: # Application variables
  example_var: aaa
secrets: # Application secrets
  example_secret: bbb
securityLevel: 0 # Security level that the application can hold
```

To register an application, first create a manifest file and submit it to UAAA administrator.

## Integration Methods

To integrate your application with UAAA, you can use the following methods:

### OpenID Connect / OAuth2

When UAAA is configured with its builtin `oidc` plugin, it will automatically expose an OpenID Connect endpoint for applications to integrate with. The OpenID Connect endpoint is used to authenticate users and obtain user information.

UAAA implements [OpenID Connect Configuration Discovery 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfig). According to the specification, the OpenID Connect configuration is available at `https://<your-instance>/.well-known/openid-configuration`.

UAAA also implements [UserInfo Endpoint](https://openid.net/specs/openid-connect-core-1_0.html#UserInfo) thus OAuth2 clients can also work with UAAA.

To know more about OpenID Connect and OAuth2, you can visit [Auth0's documentation](https://auth0.com/docs/authenticate/protocols/openid-connect-protocol).
