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
        describe('when response normal', () => {
            sdkMock.mock('SecretsManager', 'describeSecret', (
                _: sdk.SecretsManager.Types.DescribeSecretRequest,
                callback: SecretsManagerTypesDescribeSecretCallback,
            ) => {
                console.log('SecretsManager: describeSecret: mocked');
                callback(undefined, {
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
                });
            });

            it('should pass', () => {
                expect(new src.Rotation(event)).toBeDefined();
                sdkMock.restore('SecretsManager');
            });
        });
    });
});
