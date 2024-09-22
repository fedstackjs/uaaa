---
outline: deep
---

# 应用接入

## 前言

若想将您的应用接入 UAAA，您需要为应用编写正确的清单文件，之后在 UAAA 中创建一个应用，并配置应用使用适当的接入方法。

## 清单文件

<!-- Every application in UAAA has a manifest that describes the application's configuration and permissions. You can write the manifest in `JSON/YAML/TOML` format. Here is an example of an application manifest: -->

每个 UAAA 中的应用都有一个清单文件，用于描述应用的配置和权限。您可以使用 `JSON/YAML/TOML` 格式编写清单文件。以下是一个`YAML`应用清单文件的示例：

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

如果要注册一个应用程序，首先创建一个清单文件并将其提交给 UAAA 管理员。

## 接入方法

如果您想将您的应用程序与 UAAA 集成，您可以使用以下方法：

### OpenID Connect / OAuth2

当 UAAA 配置了内置的 `oidc` 插件时，它将自动为应用程序提供一个 OpenID Connect 端点以进行集成。OpenID Connect 端点用于验证用户并获取用户信息。

UAAA 实现了 [OpenID Connect 配置发现 1.0](https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderConfig)。根据规范，OpenID Connect 配置位于 `https://<your-instance>/.well-known/openid-configuration`。

UAAA 还实现了 [UserInfo 端点](https://openid.net/specs/openid-connect-core-1_0.html#UserInfo)，因此 OAuth2 客户端也可以与 UAAA 集成。

如果您想了解有关 OpenID Connect 和 OAuth2 的更多信息，可以参考 [这篇博客](https://www.authing.cn/blog/558)。
