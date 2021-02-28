# AWS Secrets Manager

## Rotation

This package has helpers for AWS Secrets Manager SDK which makes rotating secrets from Lambda easier.

### Usage

1. Initial a rotation cycle with event given by AWS Secrets Manager in Lambda handler.
2. Call each steps with its methods.

#### Steps

1. `createSecret` stores the new secret to AWS Secrets Manager.
2. `setSecret` retrieves the new secret from AWS Secrets Manager for setting it in the external service.
3. `testSecret` retrieves the new secret from AWS Secrets Manager for testing it in the external service.
4. `finishSecret` set the current version to the new secret in AWS Secrets Manager.
5. `revokePreviousSecret` retrieves the new secret from AWS Secrets Manager for revoking it in the external service. (Optional, needs be called right after `finishSecret`)
