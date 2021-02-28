import * as sdk from 'aws-sdk';
import * as sdkMock from 'aws-sdk-mock';

import * as src from '../src';

describe('Initial secret rotation', () => {
    describe('given normal event', () => {
        const event: src.RotationEvent = {
            /* eslint-disable @typescript-eslint/naming-convention */
            Step: src.RotationStep.CREATE_SECRET,
            SecretId: 'aws-secrets-manager-arn',
            ClientRequestToken: 'version-id-new',
            /* eslint-enable @typescript-eslint/naming-convention */
        };
        type SecretsManagerTypesDescribeSecretCallback = (err: sdk.AWSError | undefined, resp: sdk.SecretsManager.Types.DescribeSecretResponse | undefined) => void

        describe('when the secret is normal', () => {
            const resp: sdk.SecretsManager.Types.DescribeSecretResponse = {
                /* eslint-disable @typescript-eslint/naming-convention */
                RotationEnabled: true,
                VersionIdsToStages: {
                    'version-id-old': [
                        src.VersionStage.CURRENT,
                    ],
                    'version-id-new': [
                        src.VersionStage.PENDING,
                    ],
                },
                /* eslint-enable @typescript-eslint/naming-convention */
            };

            it('rotation cycle should be created', () => {
                sdkMock.mock('SecretsManager', 'describeSecret', (
                    _: sdk.SecretsManager.Types.DescribeSecretRequest,
                    callback: SecretsManagerTypesDescribeSecretCallback,
                ) => {
                    callback(undefined, resp);
                });
                expect(new src.Rotation(event)).toBeDefined();
                sdkMock.restore('SecretsManager');
            });
        });

        describe('when the secret does not enable rotation', () => {
            const resp: sdk.SecretsManager.Types.DescribeSecretResponse = {
                /* eslint-disable @typescript-eslint/naming-convention */
                RotationEnabled: false,
                VersionIdsToStages: {
                    'version-id-old': [
                        src.VersionStage.CURRENT,
                    ],
                    'version-id-new': [
                        src.VersionStage.PENDING,
                    ],
                },
                /* eslint-enable @typescript-eslint/naming-convention */
            };

            it('rotation cycle should not be created', () => {
                sdkMock.mock('SecretsManager', 'describeSecret', (
                    _: sdk.SecretsManager.Types.DescribeSecretRequest,
                    callback: SecretsManagerTypesDescribeSecretCallback,
                ) => {
                    callback(undefined, resp);
                });
                expect(() => { new src.Rotation(event) }).toThrowError(new Error(`Secret ${event.SecretId} is not enabled for rotation.`));
                sdkMock.restore('SecretsManager');
            });
        });

        describe('when the secret has no version', () => {
            const resp: sdk.SecretsManager.Types.DescribeSecretResponse = {
                /* eslint-disable @typescript-eslint/naming-convention */
                RotationEnabled: true,
                /* eslint-enable @typescript-eslint/naming-convention */
            };

            it('rotation cycle should not be created', () => {
                sdkMock.mock('SecretsManager', 'describeSecret', (
                    _: sdk.SecretsManager.Types.DescribeSecretRequest,
                    callback: SecretsManagerTypesDescribeSecretCallback,
                ) => {
                    callback(undefined, resp);
                });
                expect(() => { new src.Rotation(event) }).toThrowError(new Error(`Secret ${event.SecretId} has no version for rotation.`));
                sdkMock.restore('SecretsManager');
            });
        });

        describe('when the secret has no given version', () => {
            const resp: sdk.SecretsManager.Types.DescribeSecretResponse = {
                /* eslint-disable @typescript-eslint/naming-convention */
                RotationEnabled: true,
                VersionIdsToStages: {},
                /* eslint-enable @typescript-eslint/naming-convention */
            };

            it('rotation cycle should not be created', () => {
                sdkMock.mock('SecretsManager', 'describeSecret', (
                    _: sdk.SecretsManager.Types.DescribeSecretRequest,
                    callback: SecretsManagerTypesDescribeSecretCallback,
                ) => {
                    callback(undefined, resp);
                });
                expect(() => { new src.Rotation(event) }).toThrowError(new Error(`Secret version ${event.ClientRequestToken} has no stage for rotation of secret ${event.SecretId}.`));
                sdkMock.restore('SecretsManager');
            });
        });

        describe('when the given version of the secret is current version', () => {
            const resp: sdk.SecretsManager.Types.DescribeSecretResponse = {
                /* eslint-disable @typescript-eslint/naming-convention */
                RotationEnabled: true,
                VersionIdsToStages: {
                    'version-id-new': [
                        src.VersionStage.CURRENT,
                    ],
                },
                /* eslint-enable @typescript-eslint/naming-convention */
            };

            it('rotation cycle should not be created', () => {
                sdkMock.mock('SecretsManager', 'describeSecret', (
                    _: sdk.SecretsManager.Types.DescribeSecretRequest,
                    callback: SecretsManagerTypesDescribeSecretCallback,
                ) => {
                    callback(undefined, resp);
                });
                expect(() => { new src.Rotation(event) }).toThrowError(new Error(`Secret version ${event.ClientRequestToken} already set as ${src.VersionStage.CURRENT} for secret ${event.SecretId}.`));
                sdkMock.restore('SecretsManager');
            });
        });

        describe('when the given version of the secret is not pending version', () => {
            const resp: sdk.SecretsManager.Types.DescribeSecretResponse = {
                /* eslint-disable @typescript-eslint/naming-convention */
                RotationEnabled: true,
                VersionIdsToStages: {
                    'version-id-new': [],
                },
                /* eslint-enable @typescript-eslint/naming-convention */
            };

            it('rotation cycle should not be created', () => {
                sdkMock.mock('SecretsManager', 'describeSecret', (
                    _: sdk.SecretsManager.Types.DescribeSecretRequest,
                    callback: SecretsManagerTypesDescribeSecretCallback,
                ) => {
                    callback(undefined, resp);
                });
                expect(() => { new src.Rotation(event) }).toThrowError(new Error(`Secret version ${event.ClientRequestToken} not set as ${src.VersionStage.PENDING} for rotation of secret ${event.SecretId}.`));
                sdkMock.restore('SecretsManager');
            });
        });
    });
});
