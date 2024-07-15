# UAAA Concepts

- User
  - A meaningless and unique identifier.
  - The entity which interacts with the system is called Operator.
  - An Operator is represented by a User.
- Application
  - An App is the isolation boundary for permission and data.
  - An App is a collection of resources that can be accessed by a User,
    or other Apps on behalf of the User.
  - An App can expose multiple permissions, which user can be granted to other Apps.
  - An App will be associated with
- Trust Level
  - Trust Level is a measure of the Operator's trustworthiness.
- Session
  - A Session is a temporary state of the Operator.
  - Session is bound to a device and a User, and will be shared across Apps.
  - Session stores the Operator's current status and temporary granted permissions.
  - Session is associated with a Trust Level.
- User Credential
  - User have multiple Credentials to authenticate themselves.
  - Every Credential has a Trust Level, by authenticating with a Credential within
    a Session, the Session's Trust Level will be updated.
  - Every Credential
- User Attribute
  - User have multiple Attributes to describe themselves.
  - We arbitrarily define some Attributes as Well-Known Attributes to support a
    minimal user interface to display the User's information.
- Auth Source
  - Auth Source sets, updates and verifies the User's credentials.
  - Auth Source provides the following functionalities:
    - **Verify**: Given UserID and user provided Credential, verify the
      Credential is valid to authenticate the User.
    - **Locate**: Find the User's UserID by the Credential.
    - **Bind**: Add a new Credential to the User.
    - **Unbind**: Remove a Credential from the User.
    - **Rebind**: Update the Credential of the User.
  - Auth Source could also update the User's Attributes.
- Auth Provider
  - Auth Provider connects Apps to UAAA.
  - Planned Auth Providers:
    - OAuth2
    - OpenID Connect
    - IAAA
- Token
  - A Token is associated with a Session.
  - Every Token is a JWT token.

## Components

- User Access Control (UAC)
  - **Functionalities**
    - Verify the Operator's identity and
- User KV Storage (UKV)
