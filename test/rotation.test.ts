/* eslint-disable max-len, max-lines-per-function */

import * as sdk from 'aws-sdk';
import * as sdkMock from 'aws-sdk-mock';
sdkMock.setSDKInstance(sdk);

import * as src from '../src/';

type SecretsManagerTypesDescribeSecretCallback = (err: sdk.AWSError | undefined, resp: sdk.SecretsManager.Types.DescribeSecretResponse | undefined) => void;
type SecretsManagerTypesGetSecretValueCallback = (err: sdk.AWSError | undefined, resp: sdk.SecretsManager.Types.GetSecretValueResponse | undefined) => void;
type SecretsManagerTypesPutSecretValueCallback = (err: sdk.AWSError | undefined, resp: sdk.SecretsManager.Types.PutSecretValueResponse | undefined) => void;

describe('Initial secret rotation', () => {
    describe('with normal event', () => {
        const event: src.RotationEvent = {
            /* eslint-disable @typescript-eslint/naming-convention */
            Step:               src.RotationStep.CREATE_SECRET,
            SecretId:           'aws-secrets-manager-arn',
            ClientRequestToken: 'version-id-new',
            /* eslint-enable @typescript-eslint/naming-convention */
        };

        describe('when the secret is normal', () => {
            const resp: sdk.SecretsManager.Types.DescribeSecretResponse = {
                /* eslint-disable @typescript-eslint/naming-convention */
                RotationEnabled:    true,
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
                    callback(undefined, resp); /* eslint-disable-line no-undefined */
                });

                expect(new src.Rotation(event)).toBeDefined();

                sdkMock.restore('SecretsManager', 'describeSecret');
            });
        });

        describe('when the secret does not enable rotation', () => {
            const resp: sdk.SecretsManager.Types.DescribeSecretResponse = {
                /* eslint-disable @typescript-eslint/naming-convention */
                RotationEnabled:    false,
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
                    callback(undefined, resp); /* eslint-disable-line no-undefined */
                });

                expect(() => {
                    new src.Rotation(event); /* eslint-disable-line no-new */
                }).toThrowError(new Error(`Secret ${event.SecretId} is not enabled for rotation.`));

                sdkMock.restore('SecretsManager', 'describeSecret');
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
                    callback(undefined, resp); /* eslint-disable-line no-undefined */
                });

                expect(() => {
                    new src.Rotation(event); /* eslint-disable-line no-new */
                }).toThrowError(new Error(`Secret ${event.SecretId} has no version for rotation.`));

                sdkMock.restore('SecretsManager', 'describeSecret');
            });
        });

        describe('when the secret has no given version', () => {
            const resp: sdk.SecretsManager.Types.DescribeSecretResponse = {
                /* eslint-disable @typescript-eslint/naming-convention */
                RotationEnabled:    true,
                VersionIdsToStages: {},
                /* eslint-enable @typescript-eslint/naming-convention */
            };

            it('rotation cycle should not be created', () => {
                sdkMock.mock('SecretsManager', 'describeSecret', (
                    _: sdk.SecretsManager.Types.DescribeSecretRequest,
                    callback: SecretsManagerTypesDescribeSecretCallback,
                ) => {
                    callback(undefined, resp); /* eslint-disable-line no-undefined */
                });

                expect(() => {
                    new src.Rotation(event); /* eslint-disable-line no-new */
                }).toThrowError(new Error(`Secret version ${event.ClientRequestToken} has no stage for rotation of secret ${event.SecretId}.`));

                sdkMock.restore('SecretsManager', 'describeSecret');
            });
        });

        describe('when the given version of the secret is current version', () => {
            const resp: sdk.SecretsManager.Types.DescribeSecretResponse = {
                /* eslint-disable @typescript-eslint/naming-convention */
                RotationEnabled:    true,
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
                    callback(undefined, resp); /* eslint-disable-line no-undefined */
                });

                expect(() => {
                    new src.Rotation(event); /* eslint-disable-line no-new */
                }).toThrowError(new Error(`Secret version ${event.ClientRequestToken} already set as ${src.VersionStage.CURRENT} for secret ${event.SecretId}.`));

                sdkMock.restore('SecretsManager', 'describeSecret');
            });
        });

        describe('when the given version of the secret is not pending version', () => {
            const resp: sdk.SecretsManager.Types.DescribeSecretResponse = {
                /* eslint-disable @typescript-eslint/naming-convention */
                RotationEnabled:    true,
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
                    callback(undefined, resp); /* eslint-disable-line no-undefined */
                });

                expect(() => {
                    new src.Rotation(event); /* eslint-disable-line no-new */
                }).toThrowError(new Error(`Secret version ${event.ClientRequestToken} not set as ${src.VersionStage.PENDING} for rotation of secret ${event.SecretId}.`));

                sdkMock.restore('SecretsManager', 'describeSecret');
            });
        });
    });

    describe('with abnormal event', () => {
        const event: unknown = {};

        it('rotation cycle should not be created', () => {
            sdkMock.mock('SecretsManager', 'describeSecret', undefined); /* eslint-disable-line no-undefined */

            expect(() => {
                new src.Rotation(event as src.RotationEvent); /* eslint-disable-line no-new */
            }).toThrowError('Missing required key \'SecretId\' in params');

            sdkMock.restore('SecretsManager', 'describeSecret');
        });
    });
});

describe('During secret rotation', () => {
    describe('with normal rotation cycle at create secret step', () => {
        const event: src.RotationEvent = {
            /* eslint-disable @typescript-eslint/naming-convention */
            Step:               src.RotationStep.CREATE_SECRET,
            SecretId:           'aws-secrets-manager-arn',
            ClientRequestToken: 'version-id-new',
            /* eslint-enable @typescript-eslint/naming-convention */
        };
        const resp: sdk.SecretsManager.Types.DescribeSecretResponse = {
            /* eslint-disable @typescript-eslint/naming-convention */
            RotationEnabled:    true,
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

        describe('when the secret is normal', () => {
            const errGetSecretValue: sdk.AWSError = {
                ...new Error(''),
                code:    'ResourceNotFoundException',
                message: 'We can\'t find the resource that you asked for',
                time:    new Date(Date.now()),
            };

            it('new secret should be created', async () => {
                sdkMock.mock('SecretsManager', 'describeSecret', (
                    _: sdk.SecretsManager.Types.DescribeSecretRequest,
                    callback: SecretsManagerTypesDescribeSecretCallback,
                ) => {
                    callback(undefined, resp); /* eslint-disable-line no-undefined */
                });
                sdkMock.mock('SecretsManager', 'getSecretValue', (
                    _: sdk.SecretsManager.Types.GetSecretValueRequest,
                    callback: SecretsManagerTypesGetSecretValueCallback,
                ) => {
                    callback(errGetSecretValue, undefined); /* eslint-disable-line no-undefined */
                });
                sdkMock.mock('SecretsManager', 'putSecretValue', undefined); /* eslint-disable-line no-undefined */

                const rotation = new src.Rotation(event);

                expect(await rotation.createSecret({
                    /* eslint-disable @typescript-eslint/naming-convention */
                    SecretString: 'secret',
                    /* eslint-enable @typescript-eslint/naming-convention */
                })).toMatchObject({
                    message: `${src.RotationStep.CREATE_SECRET}: Successfully put the secret for ARN ${event.SecretId} with version ${event.ClientRequestToken}.`,
                });

                sdkMock.restore('SecretsManager', 'getSecretValue');
                sdkMock.restore('SecretsManager', 'putSecretValue');
                sdkMock.restore('SecretsManager', 'describeSecret');
            });
        });
    });
});

// TODO(Leo Liu): Add unit test for all rotation steps
